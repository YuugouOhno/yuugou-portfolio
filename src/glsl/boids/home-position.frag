uniform float uDelta;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(texturePosition, uv);
  pos.xyz += texture2D(textureVelocity, uv).xyz * uDelta;
  pos.w = mod(pos.w + uDelta * 2.0, 6.283185);
  gl_FragColor = pos;
}
