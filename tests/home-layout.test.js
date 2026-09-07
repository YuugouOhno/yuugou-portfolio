import test from 'node:test'
import assert from 'node:assert/strict'
import { PerspectiveCamera, Vector3 } from 'three'
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
      const fit = fitNameToViewport(formationWidth, width, height, worldHeight, worldHeight * initialWidth / initialHeight)
      for (const [x, y] of positions) {
        const screenX = x * fit.scale / (worldHeight * width / height) + .5
        const screenY = .5 - (y * fit.scale + fit.offsetY) / worldHeight
        assert.ok(screenX >= .05 && screenX <= .95, `horizontal clipping: ${width}×${height}`)
        assert.ok(screenY >= .1 && screenY <= .8, `vertical clipping: ${width}×${height}`)
      }
    }
    assert.deepEqual(positions, original)
    assert.equal(fitNameToViewport(formationWidth, initialWidth, initialHeight, worldHeight, worldHeight * initialWidth / initialHeight).scale, 1)
  }
})

test('released near and far lanes retain xyz projection through every resize, without changing simulation positions', () => {
  for (const [initialWidth, initialHeight] of viewports) {
    const initialWorldWidth = worldHeight * initialWidth / initialHeight
    const formationWidth = Math.min(initialWorldWidth * .9, 135)
    for (const [width, height] of viewports) {
      const camera = new PerspectiveCamera(50, width / height, .1, 600)
      camera.position.z = 100
      camera.updateMatrixWorld()
      const fit = fitNameToViewport(formationWidth, width, height, worldHeight, initialWorldWidth)
      for (const z of [-35, -160]) {
        for (const side of [-1, 1]) {
          for (const y of [-36, 0, 36]) {
            const x = side * initialWorldWidth * (z === -35 ? .6 : 1.15)
            // At lane depth the shader uses this presentation, never a z scale.
            const projected = new Vector3(x * fit.laneScaleX, y, z).project(camera)
            assert.ok(Math.abs(projected.x) > .85 && Math.abs(projected.x) < .91,
              `side lane lost after ${initialWidth}x${initialHeight} -> ${width}x${height}: ${projected.x}`)
            assert.ok(Math.abs(projected.y) < .6)
            assert.ok(projected.z > -1 && projected.z < 1, `depth clipped: ${projected.z}`)
          }
        }
      }
    }
  }
})
