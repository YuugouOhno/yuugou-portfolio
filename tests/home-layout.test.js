import test from 'node:test'
import assert from 'node:assert/strict'
import { fitNameToViewport } from '../src/webgl/homeLayout.js'

const worldHeight = 2 * Math.tan(25 * Math.PI / 180) * 100
const viewports = [[1440, 900], [390, 844], [844, 390], [320, 740]]

test('an existing formation fits immediately through shrinking and rotation without moving fish', () => {
  for (const [initialWidth, initialHeight] of viewports) {
    const formationWidth = Math.min(worldHeight * initialWidth / initialHeight * .9, 135)
    // Enclose the entire 1200 × 500 glyph raster, including fish geometry.
    const positions = [-1, 1].flatMap(x => [-1, 1].map(y => [
      x * formationWidth * .48,
      worldHeight * .04 + y * formationWidth * .22,
    ]))
    const original = structuredClone(positions)
    for (const [width, height] of viewports) {
      const fit = fitNameToViewport(formationWidth, width, height, worldHeight)
      for (const [x, y] of positions) {
        const screenX = x * fit.scale / (worldHeight * width / height) + .5
        const screenY = .5 - (y * fit.scale + fit.offsetY) / worldHeight
        assert.ok(screenX >= .05 && screenX <= .95, `horizontal clipping: ${width}×${height}`)
        assert.ok(screenY >= .1 && screenY <= .8, `vertical clipping: ${width}×${height}`)
      }
      // The lane target is expressed in simulation space, then rendered at the viewport width.
      assert.ok(Math.abs(fit.simulationWidth * fit.scale - worldHeight * width / height) < 1e-10)
    }
    assert.deepEqual(positions, original)
    assert.equal(fitNameToViewport(formationWidth, initialWidth, initialHeight, worldHeight).scale, 1)
  }
})
