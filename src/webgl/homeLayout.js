// Keep the visit's glyph layout in simulation coordinates. Resize only its
// presentation, so even a desktop-to-phone shrink fits on the first frame.
export function fitNameToViewport(formationWidth, width, height, worldHeight, initialWorldWidth) {
  const worldWidth = worldHeight * width / height
  const scale = Math.min(worldWidth * .9, 135) / formationWidth
  return {
    scale,
    offsetY: worldHeight * .04 * (1 - scale),
    // Released fish use the visit's fixed simulation width, independent of the
    // capped glyph width. Depth and vertical range stay in camera world units.
    laneScaleX: worldWidth / initialWorldWidth,
    // At z=-35 the smallest broadside fish is ~3 CSS pixels long; distant
    // fish remain ~1.6px. Letter sizing must not make phone body fish subpixel.
    laneFishScale: worldHeight / height * 3.4,
  }
}
