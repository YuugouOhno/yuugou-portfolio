uniform float uTime;
uniform float uDelta;
uniform vec3 uBounds;

uniform float uSeparationDistance;
uniform float uAlignmentDistance;
uniform float uCohesionDistance;

uniform float uSeparationWeight;
uniform float uAlignmentWeight;
uniform float uCohesionWeight;

uniform float uMaxSpeed;
uniform float uMinSpeed;

uniform float uWallWeight;

uniform vec3 uMouse;
uniform vec3 uMouseRayDir;
uniform float uMouseWeight;
uniform int uInteractionType;

// Limit vector magnitude
vec3 limit(vec3 v, float max) {
  float len = length(v);
  if (len > max) {
    return normalize(v) * max;
  }
  return v;
}

// Distance from point to ray (line)
float distanceToRay(vec3 pos, vec3 rayOrigin, vec3 rayDir) {
  vec3 toPos = pos - rayOrigin;
  float t = dot(toPos, rayDir);
  vec3 closestPoint = rayOrigin + rayDir * t;
  return length(pos - closestPoint);
}

// Get closest point on ray to position
vec3 closestPointOnRay(vec3 pos, vec3 rayOrigin, vec3 rayDir) {
  vec3 toPos = pos - rayOrigin;
  float t = dot(toPos, rayDir);
  return rayOrigin + rayDir * t;
}

// Mouse interaction force
vec3 interactMouse(vec3 pos) {
  if (uInteractionType == 0) return vec3(0.0);

  float influence = 30.0; // Interaction radius

  if (uInteractionType == 1) {
    // Repel mode: avoid the ray (line) from camera through mouse
    float dist = distanceToRay(pos, uMouse, uMouseRayDir);

    if (dist < 0.1) dist = 0.1;

    if (dist < influence) {
      float strength = 1.0 - (dist / influence);
      strength = strength * strength; // Quadratic falloff

      // Direction away from the closest point on ray
      vec3 closestPt = closestPointOnRay(pos, uMouse, uMouseRayDir);
      vec3 awayDir = normalize(pos - closestPt);

      return awayDir * strength * 10.0;
    }
  } else if (uInteractionType == 2) {
    // Attract mode: attract to point on interaction plane
    vec3 toMouse = uMouse - pos;
    float dist = length(toMouse);

    if (dist < 0.1) return vec3(0.0);

    if (dist < influence) {
      float strength = 1.0 - (dist / influence);
      strength = strength * strength; // Quadratic falloff

      vec3 direction = normalize(toMouse);
      return direction * strength * 5.0;
    }
  }

  return vec3(0.0);
}

// Wall avoidance force
vec3 avoidWalls(vec3 pos) {
  vec3 force = vec3(0.0);
  float margin = 5.0;
  float strength = 1.0;

  // X bounds
  if (pos.x > uBounds.x - margin) {
    force.x -= strength * (pos.x - (uBounds.x - margin)) / margin;
  }
  if (pos.x < -uBounds.x + margin) {
    force.x += strength * ((-uBounds.x + margin) - pos.x) / margin;
  }

  // Y bounds
  if (pos.y > uBounds.y - margin) {
    force.y -= strength * (pos.y - (uBounds.y - margin)) / margin;
  }
  if (pos.y < -uBounds.y + margin) {
    force.y += strength * ((-uBounds.y + margin) - pos.y) / margin;
  }

  // Z bounds
  if (pos.z > uBounds.z - margin) {
    force.z -= strength * (pos.z - (uBounds.z - margin)) / margin;
  }
  if (pos.z < -uBounds.z + margin) {
    force.z += strength * ((-uBounds.z + margin) - pos.z) / margin;
  }

  return force;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);

  vec3 position = pos.xyz;
  vec3 velocity = vel.xyz;
  float myGroup = vel.w;

  // Boids forces
  vec3 separation = vec3(0.0);
  vec3 alignment = vec3(0.0);
  vec3 cohesion = vec3(0.0);

  int separationCount = 0;
  int alignmentCount = 0;
  int cohesionCount = 0;

  // Sample neighbors from texture
  float texelSize = 1.0 / resolution.x;

  for (float y = 0.0; y < resolution.y; y += 1.0) {
    for (float x = 0.0; x < resolution.x; x += 1.0) {
      vec2 ref = vec2(x, y) * texelSize;

      if (ref.x == uv.x && ref.y == uv.y) continue;

      vec4 otherVel = texture2D(textureVelocity, ref);
      float otherGroup = otherVel.w;

      // Only interact with same group
      if (myGroup != otherGroup) continue;

      vec3 otherPos = texture2D(texturePosition, ref).xyz;

      float dist = distance(position, otherPos);

      // Separation
      if (dist < uSeparationDistance && dist > 0.0) {
        vec3 diff = position - otherPos;
        diff = normalize(diff) / dist;
        separation += diff;
        separationCount++;
      }

      // Alignment
      if (dist < uAlignmentDistance) {
        alignment += otherVel.xyz;
        alignmentCount++;
      }

      // Cohesion
      if (dist < uCohesionDistance) {
        cohesion += otherPos;
        cohesionCount++;
      }
    }
  }

  // Calculate steering forces
  vec3 acc = vec3(0.0);

  // 1. Wall avoidance
  acc += avoidWalls(position) * uWallWeight;

  // 2. Mouse interaction
  acc += interactMouse(position) * uMouseWeight;

  // 2. Separation
  if (separationCount > 0) {
    separation /= float(separationCount);
    acc += separation * uSeparationWeight;
  }

  // 3. Alignment
  if (alignmentCount > 0) {
    alignment /= float(alignmentCount);
    alignment = normalize(alignment) * uMaxSpeed;
    alignment -= velocity;
    alignment = limit(alignment, 0.5);
    acc += alignment * uAlignmentWeight;
  }

  // 4. Cohesion
  if (cohesionCount > 0) {
    cohesion /= float(cohesionCount);
    cohesion = cohesion - position;
    cohesion = normalize(cohesion) * uMaxSpeed;
    cohesion -= velocity;
    cohesion = limit(cohesion, 0.5);
    acc += cohesion * uCohesionWeight;
  }

  // Apply acceleration
  velocity += acc * uDelta;

  // Clamp speed
  float speed = length(velocity);
  if (speed > uMaxSpeed) {
    velocity = normalize(velocity) * uMaxSpeed;
  } else if (speed < uMinSpeed) {
    velocity = normalize(velocity) * uMinSpeed;
  }

  // Preserve group ID in w channel
  gl_FragColor = vec4(velocity, myGroup);
}
