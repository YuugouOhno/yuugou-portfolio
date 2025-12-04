uniform float uTime;
uniform float uDelta;
uniform vec3 uBounds;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  vec4 extra = texture2D(textureExtra, uv);

  // extra.r = team ID (0 or 1)
  // extra.g = HP (0.0 - 1.0)
  // extra.b = state flags
  // extra.a = generic counter

  // For now, just pass through
  // Future: implement HP decay, state transitions, etc.

  gl_FragColor = extra;
}
