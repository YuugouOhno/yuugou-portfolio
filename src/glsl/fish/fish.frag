uniform float uTime;
uniform int uColorMode;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vVelocity;
varying vec4 vExtra;
varying float vPhase;

void main() {
  vec3 baseColor = vColor;

  // Speed-based color modification
  float speed = length(vVelocity);
  vec3 speedColor = mix(baseColor, vec3(1.0, 0.4, 0.2), smoothstep(0.0, 10.0, speed));

  // Team-based color
  vec3 teamColor = vExtra.r < 0.5 ? vec3(0.2, 0.5, 1.0) : vec3(1.0, 0.3, 0.3);

  // Select color based on mode
  vec3 finalColor;
  if (uColorMode == 0) {
    finalColor = baseColor;
  } else if (uColorMode == 1) {
    finalColor = speedColor;
  } else if (uColorMode == 2) {
    finalColor = teamColor;
  } else {
    finalColor = mix(speedColor, teamColor, 0.5);
  }

  // HP-based effects (blink when low HP)
  float hp = vExtra.g;
  if (hp < 0.3) {
    finalColor *= 0.5 + 0.5 * sin(uTime * 10.0);
  }

  // Simple lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
  float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
  float ambient = 0.3;
  float lighting = ambient + diffuse * 0.7;

  finalColor *= lighting;

  gl_FragColor = vec4(finalColor, 1.0);
}
