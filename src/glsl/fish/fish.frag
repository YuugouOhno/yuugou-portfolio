uniform float uTime;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vVelocity;
varying float vPhase;

void main() {
  vec3 baseColor = vColor;

  // Speed-based color modification (subtle highlight when fast)
  float speed = length(vVelocity);
  float speedFactor = smoothstep(10.0, 25.0, speed) * 0.3; // Max 30% color shift
  vec3 finalColor = mix(baseColor, baseColor + vec3(0.2, 0.1, 0.0), speedFactor);

  // Simple lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
  float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
  float ambient = 0.3;
  float lighting = ambient + diffuse * 0.7;

  finalColor *= lighting;

  gl_FragColor = vec4(finalColor, 1.0);
}
