// Keep the visit's glyph layout in simulation coordinates. Resize only its
// presentation, so even a desktop-to-phone shrink fits on the first frame.
export function fitNameToViewport(formationWidth, width, height, worldHeight) {
  const worldWidth = worldHeight * width / height
  const scale = Math.min(worldWidth * .9, 135) / formationWidth
  return {
    scale,
    offsetY: worldHeight * .04 * (1 - scale),
    simulationWidth: worldWidth / scale,
  }
}
