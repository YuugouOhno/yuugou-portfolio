uniform float uDelta;
uniform float uTime;
uniform float uRelease;
uniform float uWorldWidth;
uniform sampler2D uTargets;

vec3 limit(vec3 v, float maximum) {
  return v * min(1.0, maximum / max(length(v), .0001));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 pos = texture2D(texturePosition, uv).xyz;
  vec4 vel = texture2D(textureVelocity, uv);
  vec4 target = texture2D(uTargets, uv);
  float index = floor(gl_FragCoord.y) * resolution.x + floor(gl_FragCoord.x);
  float phase = target.w;
  vec3 drift = vec3(sin(uTime * .7 + phase), cos(uTime * .6 + phase), 0.0) * .055;
  vec3 hold = (target.xyz + drift - pos) * 5.0 - vel.xyz * 4.0;

  vec3 separation = vec3(0.0);
  vec3 alignment = vec3(0.0);
  vec3 cohesion = vec3(0.0);
  float nearby = 0.0;
  // Retain the existing separation/alignment/cohesion model. 1024 fish, with
  // 64 distributed neighbors per frame instead of the previous 4096^2 scan.
  if (uRelease > .001) {
    for (float j = 0.0; j < 64.0; j++) {
      float sampleIndex = mod(index + j * 17.0 + floor(uTime * 8.0) * 13.0, 1024.0);
      vec2 ref = (vec2(mod(sampleIndex, resolution.x), floor(sampleIndex / resolution.x)) + .5) / resolution.xy;
      vec4 otherVel = texture2D(textureVelocity, ref);
      vec3 other = texture2D(texturePosition, ref).xyz;
      vec3 diff = pos - other;
      float dist = length(diff);
      if (dist > .001 && dist < 2.0) separation += diff / max(dist * dist, .1);
      if (dist > .001 && dist < 12.0 && otherVel.w == vel.w) {
        alignment += otherVel.xyz;
        cohesion += other;
        nearby += 1.0;
      }
    }
  }
  vec3 flock = limit(separation, 2.0) * 1.5;
  if (nearby > 0.0) {
    flock += limit(alignment / nearby - vel.xyz, 1.0);
    flock += limit(cohesion / nearby - pos, 1.0) * .6;
  }
  // Swim in side lanes, with 80% of the fish farther away. The opaque reading
  // surface additionally keeps links/text clear while fish travel into the lanes.
  // Leave through the closest margin instead of sending half the name across
  // the opaque copy. The assignment stays fixed for the whole visit.
  float side = target.x < 0.0 ? -1.0 : 1.0;
  float depth = mod(index, 5.0) < 1.0 ? -35.0 : -160.0;
  // Follow a perspective-correct corridor at the CURRENT depth. A far-away
  // lane's final x coordinate points offscreen while the fish is still near.
  float laneX = side * uWorldWidth * .455 * (1.0 - pos.z / 100.0);
  // Reach the exposed margins before receding: a direct diagonal toward the
  // distant lane otherwise spends many seconds hidden under mobile copy.
  // Use current projected position so this remains continuous and resize-safe.
  float screenSide = abs(pos.x) / (uWorldWidth * (1.0 - pos.z / 100.0));
  // Mobile copy ends at |screenSide|=.43. Start receding only after emerging.
  float inMargin = smoothstep(.43, .455, screenSide);
  // Give lateral steering its own budget: normalizing a vector toward z=-160
  // otherwise reduces its small x correction almost to zero, pulling the fish
  // back under the copy as perspective shrinks its projected x coordinate.
  flock += vec3(clamp((laneX - pos.x) * 1.2, -3.0, 3.0),
    clamp((sin(uTime * .11 + vel.w * 2.1) * 36.0 - pos.y) * .22, -1.4, 1.4) * inMargin,
    clamp((depth - pos.z) * .22, -1.4, 1.4) * inMargin);
  flock += vec3(sin(phase + uTime * .3), cos(phase + uTime * .2), sin(uTime * .2 + phase)) * .3;
  flock -= vel.xyz * .24;
  // Blend forces, never positions. Acceleration and speed are bounded even for
  // anchor jumps, resize, and a resumed background tab. No minimum-speed snap.
  vec3 acceleration = limit(mix(hold, flock, uRelease), 6.0);
  vec3 velocity = limit(vel.xyz + acceleration * uDelta, 6.0);
  gl_FragColor = vec4(velocity, vel.w);
}
