uniform float uTime;
uniform float uDelta;
uniform float uSphereRadius;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);

  // Update position based on velocity
  pos.xyz += vel.xyz * uDelta;

  // Hard clamp: never escape the sphere
  float posLen = length(pos.xyz);
  if (posLen > uSphereRadius) {
    pos.xyz = normalize(pos.xyz) * uSphereRadius;
  }

  // Update animation phase
  pos.w += uDelta * 5.0; // Animation speed
  if (pos.w > 6.28318) pos.w -= 6.28318; // Keep in 0-2PI range

  gl_FragColor = pos;
}
