// Fractions of the hero's actual height; tune the release interval here.
export const RELEASE_START = 0.12
export const RELEASE_END = 0.7

export function advanceRelease(released, progress) {
  const latched = released || progress >= RELEASE_END
  const t = Math.max(0, Math.min(1, (progress - RELEASE_START) / (RELEASE_END - RELEASE_START)))
  return { released: latched, amount: latched ? 1 : t * t * (3 - 2 * t) }
}

export function easeRelease(current, target, delta) {
  return current + (target - current) * (1 - Math.exp(-3 * Math.min(Math.max(delta, 0), 1 / 60)))
}

export function nameLines(width) {
  return width < 700 ? ['Yuugou', 'Ohno'] : ['YuugouOhno']
}
