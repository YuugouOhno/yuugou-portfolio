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
uniform float uMouseWeight;
uniform int uInteractionType;

uniform float uShapeModeStrength;
uniform float uShapeWeight;

// Limit vector magnitude
vec3 limit(vec3 v, float max) {
  float len = length(v);
  if (len > max) {
    return normalize(v) * max;
  }
  return v;
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
  vec4 extra = texture2D(textureExtra, uv);

  vec3 position = pos.xyz;
  vec3 velocity = vel.xyz;

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

      vec3 otherPos = texture2D(texturePosition, ref).xyz;
      vec3 otherVel = texture2D(textureVelocity, ref).xyz;

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
        alignment += otherVel;
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

  // Apply drag
  velocity *= vel.w;

  // Clamp speed
  float speed = length(velocity);
  if (speed > uMaxSpeed) {
    velocity = normalize(velocity) * uMaxSpeed;
  } else if (speed < uMinSpeed) {
    velocity = normalize(velocity) * uMinSpeed;
  }

  gl_FragColor = vec4(velocity, vel.w);
}
