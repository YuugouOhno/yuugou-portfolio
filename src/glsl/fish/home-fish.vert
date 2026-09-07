uniform float uTime;
uniform float uScale;
uniform float uFormationScale;
uniform float uFormationOffsetY;
uniform float uLaneScaleX;
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

attribute vec2 aReference;
attribute vec3 aColor;
attribute float aSize;
attribute float aSeed;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vVelocity;
varying float vPhase;

// Rotation matrix to align with velocity direction
mat3 lookAtMatrix(vec3 forward, vec3 up) {
  vec3 f = normalize(forward);
  vec3 safeUp = abs(dot(up, f)) > 0.99 ? vec3(1.0, 0.0, 0.0) : up;
  vec3 r = normalize(cross(safeUp, f));
  vec3 u = cross(f, r);
  return mat3(r, u, f);
}

void main() {
  // Sample GPGPU textures
  vec4 posData = texture2D(texturePosition, aReference);
  vec4 velData = texture2D(textureVelocity, aReference);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;
  float phase = posData.w;

  // Pass to fragment shader
  vColor = aColor;
  vNormal = normal;
  vVelocity = vel;
  vPhase = phase;

  // Create rotation matrix to face velocity direction
  vec3 direction = length(vel) > 0.001 ? normalize(vel) : vec3(1.0, 0.0, 0.0);
  mat3 rotationMatrix = lookAtMatrix(direction, vec3(0.0, 1.0, 0.0));

  // Apply swimming animation (tail wiggle)
  vec3 animated = position;
  float tailFactor = max(0.0, position.z + 0.5); // More movement at tail
  animated.x += sin(phase + aSeed * 6.28) * tailFactor * 0.2;

  // Fit the name at z=0; keep swimming lanes at a fixed screen fraction and
  // fixed depth. Blend by actual depth, not scroll, so an anchor jump cannot
  // move fish instantly. Resizing never changes GPU positions or velocities.
  float laneWeight = smoothstep(0.0, 35.0, -pos.z);
  vec2 viewportScale = mix(vec2(uFormationScale), vec2(uLaneScaleX, 1.0), laneWeight);
  pos.xy *= viewportScale;
  pos.y += uFormationOffsetY * (1.0 - laneWeight);

  // Keep each fish's proportions; never scale swimming depth with glyph size.
  float fishScale = mix(uFormationScale, min(uLaneScaleX, 1.0), laneWeight);
  vec3 transformed = rotationMatrix * (animated * aSize * uScale * fishScale);

  // Apply world position
  transformed += pos;

  // Transform normal
  vNormal = rotationMatrix * normal;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
