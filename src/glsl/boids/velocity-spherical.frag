// Spherical shell Boids shader for AR
// Constrains boids to a spherical shell between inner and outer radius

uniform float uTime;
uniform float uDelta;

// Spherical shell bounds
uniform float uInnerRadius;
uniform float uOuterRadius;

uniform float uSeparationDistance;
uniform float uAlignmentDistance;
uniform float uCohesionDistance;

uniform float uSeparationWeight;
uniform float uAlignmentWeight;
uniform float uCohesionWeight;

uniform float uMaxSpeed;
uniform float uMinSpeed;

uniform float uWallWeight;

// Limit vector magnitude
vec3 limit(vec3 v, float max) {
  float len = length(v);
  if (len > max) {
    return normalize(v) * max;
  }
  return v;
}

// Spherical shell avoidance - keeps boids between innerRadius and outerRadius
vec3 avoidSphericalShell(vec3 pos) {
  float dist = length(pos);
  vec3 force = vec3(0.0);
  float margin = 0.3; // Transition zone width

  // Prevent division by zero
  if (dist < 0.01) {
    // If too close to center, push outward in random direction
    return vec3(0.0, 1.0, 0.0) * 5.0;
  }

  vec3 radialDir = normalize(pos);

  // Inner boundary - push outward
  if (dist < uInnerRadius + margin) {
    float penetration = (uInnerRadius + margin) - dist;
    float strength = penetration / margin;
    strength = strength * strength; // Quadratic falloff
    force += radialDir * strength * 5.0;
  }

  // Outer boundary - push inward
  if (dist > uOuterRadius - margin) {
    float penetration = dist - (uOuterRadius - margin);
    float strength = penetration / margin;
    strength = strength * strength;
    force -= radialDir * strength * 5.0;
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

  // 1. Spherical shell avoidance (most important for AR)
  acc += avoidSphericalShell(position) * uWallWeight;

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
  } else if (speed < uMinSpeed && speed > 0.01) {
    velocity = normalize(velocity) * uMinSpeed;
  }

  // Preserve group ID in w channel
  gl_FragColor = vec4(velocity, myGroup);
}
