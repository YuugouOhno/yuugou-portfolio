// Rotation matrix around X axis
mat3 rotateX(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(
    1.0, 0.0, 0.0,
    0.0, c, -s,
    0.0, s, c
  );
}

// Rotation matrix around Y axis
mat3 rotateY(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(
    c, 0.0, s,
    0.0, 1.0, 0.0,
    -s, 0.0, c
  );
}

// Rotation matrix around Z axis
mat3 rotateZ(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(
    c, -s, 0.0,
    s, c, 0.0,
    0.0, 0.0, 1.0
  );
}

// Look-at rotation matrix (align Z axis with forward direction)
mat3 lookAtMatrix(vec3 forward, vec3 up) {
  vec3 f = normalize(forward);
  vec3 r = normalize(cross(up, f));
  vec3 u = cross(f, r);
  return mat3(r, u, f);
}
