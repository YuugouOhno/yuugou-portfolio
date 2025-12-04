uniform float uTime;
uniform float uDelta;
uniform vec3 uBounds;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);

  // Update position based on velocity
  pos.xyz += vel.xyz * uDelta;

  // Update animation phase
  pos.w += uDelta * 5.0; // Animation speed
  if (pos.w > 6.28318) pos.w -= 6.28318; // Keep in 0-2PI range

  gl_FragColor = pos;
}
