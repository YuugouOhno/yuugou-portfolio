uniform float uTime;
uniform float uDelta;
uniform float uSphereRadius;

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

uniform float uFleeDistance;
uniform float uFleeWeight;
uniform vec3 uPredatorPos;

// Limit vector magnitude
vec3 limit(vec3 v, float max) {
  float len = length(v);
  if (len > max) {
    return normalize(v) * max;
  }
  return v;
}

float distanceToRay(vec3 pos, vec3 rayOrigin, vec3 rayDir) {
  vec3 toPos = pos - rayOrigin;
  float t = dot(toPos, rayDir);
  vec3 closestPoint = rayOrigin + rayDir * t;
  return length(pos - closestPoint);
}

vec3 closestPointOnRay(vec3 pos, vec3 rayOrigin, vec3 rayDir) {
  vec3 toPos = pos - rayOrigin;
  float t = dot(toPos, rayDir);
  return rayOrigin + rayDir * t;
}

vec3 interactMouse(vec3 pos) {
  if (uInteractionType == 0) return vec3(0.0);

  float influence = 30.0;

  if (uInteractionType == 1) {
    float dist = distanceToRay(pos, uMouse, uMouseRayDir);
    if (dist < 0.1) dist = 0.1;
    if (dist < influence) {
      float strength = 1.0 - (dist / influence);
      strength = strength * strength;
      vec3 closestPt = closestPointOnRay(pos, uMouse, uMouseRayDir);
      vec3 awayDir = normalize(pos - closestPt);
      return awayDir * strength * 10.0;
    }
  } else if (uInteractionType == 2) {
    vec3 toMouse = uMouse - pos;
    float dist = length(toMouse);
    if (dist < 0.1) return vec3(0.0);
    if (dist < influence) {
      float strength = 1.0 - (dist / influence);
      strength = strength * strength;
      return normalize(toMouse) * strength * 5.0;
    }
  }

  return vec3(0.0);
}

vec3 avoidSphere(vec3 pos) {
  float dist = length(pos);
  if (dist < 0.01) return vec3(0.0, 1.0, 0.0) * 2.0;

  float margin = 5.0;
  float boundary = uSphereRadius - margin;

  if (dist > boundary) {
    float penetration = dist - boundary;
    float strength = penetration / margin;
    strength = strength * strength;
    return -normalize(pos) * strength * 3.0;
  }
  return vec3(0.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);

  vec3 position = pos.xyz;
  vec3 velocity = vel.xyz;
  float myGroup = vel.w;

  bool isShark = myGroup > 2.49; // group 3 or 4

  vec3 acc = vec3(0.0);
  acc += avoidSphere(position) * uWallWeight;

  if (isShark) {
    float texStep = 1.0 / resolution.x;

    // Pass 1: fishCentroid of all normal fish
    vec3 fishCentroid = vec3(0.0);
    float fishCount = 0.0;
    for (float y = 0.0; y < resolution.y; y += 1.0) {
      for (float x = 0.0; x < resolution.x; x += 1.0) {
        vec2 ref = vec2(x, y) * texStep;
        vec4 otherVel = texture2D(textureVelocity, ref);
        if (otherVel.w > 2.49) continue;
        fishCentroid += texture2D(texturePosition, ref).xyz;
        fishCount += 1.0;
      }
    }
    if (fishCount > 0.0) fishCentroid /= fishCount;

    vec3 target = fishCentroid;

    if (myGroup > 3.49) {
      // Group 4: isolation shark — seek fish farthest from fishCentroid
      float maxDist = 0.0;
      for (float y = 0.0; y < resolution.y; y += 1.0) {
        for (float x = 0.0; x < resolution.x; x += 1.0) {
          vec2 ref = vec2(x, y) * texStep;
          vec4 otherVel = texture2D(textureVelocity, ref);
          if (otherVel.w > 2.49) continue;
          vec3 otherPos = texture2D(texturePosition, ref).xyz;
          float d = distance(otherPos, fishCentroid);
          if (d > maxDist) { maxDist = d; target = otherPos; }
        }
      }
    }
    // Group 3: density shark — target = fishCentroid (already set)

    vec3 toTarget = target - position;
    if (length(toTarget) > 0.1) {
      acc += normalize(toTarget) * 5.0;
    }

  } else {
    // Normal fish: flock with same group, flee from sharks
    vec3 separation = vec3(0.0);
    vec3 alignment  = vec3(0.0);
    vec3 cohesion   = vec3(0.0);
    vec3 sharkFlee  = vec3(0.0);

    int separationCount = 0;
    int alignmentCount  = 0;
    int cohesionCount   = 0;

    float texSize = 1.0 / resolution.x;

    for (float y = 0.0; y < resolution.y; y += 1.0) {
      for (float x = 0.0; x < resolution.x; x += 1.0) {
        vec2 ref = vec2(x, y) * texSize;
        if (ref.x == uv.x && ref.y == uv.y) continue;

        vec4 otherVel  = texture2D(textureVelocity, ref);
        float otherGroup = otherVel.w;

        // Flee from shark neighbors — read position only for sharks
        if (otherGroup > 2.49) {
          vec3 sharkPos = texture2D(texturePosition, ref).xyz;
          float sharkDist = distance(position, sharkPos);
          if (sharkDist < uFleeDistance && sharkDist > 0.0) {
            float w = 1.0 - sharkDist / uFleeDistance;
            w = w * w;
            sharkFlee += normalize(position - sharkPos) * w;
          }
          continue;
        }

        // Only interact with same group
        if (myGroup != otherGroup) continue;

        vec3 otherPos = texture2D(texturePosition, ref).xyz;
        float dist    = distance(position, otherPos);

        if (dist < uSeparationDistance && dist > 0.0) {
          vec3 diff = position - otherPos;
          separation += normalize(diff) / dist;
          separationCount++;
        }
        if (dist < uAlignmentDistance) {
          alignment += otherVel.xyz;
          alignmentCount++;
        }
        if (dist < uCohesionDistance) {
          cohesion += otherPos;
          cohesionCount++;
        }
      }
    }

    acc += interactMouse(position) * uMouseWeight;

    if (separationCount > 0) {
      separation /= float(separationCount);
      acc += separation * uSeparationWeight;
    }
    if (alignmentCount > 0) {
      alignment /= float(alignmentCount);
      alignment = normalize(alignment) * uMaxSpeed;
      alignment -= velocity;
      alignment = limit(alignment, 0.5);
      acc += alignment * uAlignmentWeight;
    }
    if (cohesionCount > 0) {
      cohesion /= float(cohesionCount);
      cohesion = cohesion - position;
      cohesion = normalize(cohesion) * uMaxSpeed;
      cohesion -= velocity;
      cohesion = limit(cohesion, 0.5);
      acc += cohesion * uCohesionWeight;
    }

    if (length(sharkFlee) > 0.001) {
      acc += normalize(sharkFlee) * uFleeWeight;
    }
  }

  // Flee from whale (predator position passed as uniform — no loop needed)
  float predDist = distance(position, uPredatorPos);
  if (predDist < uFleeDistance && predDist > 0.0) {
    float w = 1.0 - predDist / uFleeDistance;
    w = w * w;
    acc += normalize(position - uPredatorPos) * w * uFleeWeight;
  }

  velocity += acc * uDelta;

  float speed = length(velocity);
  if (speed > uMaxSpeed) {
    velocity = normalize(velocity) * uMaxSpeed;
  } else if (speed < uMinSpeed) {
    velocity = normalize(velocity) * uMinSpeed;
  }

  gl_FragColor = vec4(velocity, myGroup);
}
