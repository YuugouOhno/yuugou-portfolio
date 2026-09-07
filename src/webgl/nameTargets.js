import { nameLines } from './homeMotion.js'

// Rasterize a local system font, independent of asynchronous web-font loading.
// Evenly sample filled glyphs, so every fish begins inside a letter on frame one.
export function createNameTargets(count, width, height, worldHeight) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 500
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Name rasterization unavailable')
  const lines = nameLines(width)
  const fontSize = lines.length === 1 ? 180 : 200
  ctx.font = `700 ${fontSize}px Arial, sans-serif`
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
  const scale = Math.min(1, 1120 / maxWidth)
  ctx.translate(600, 250)
  ctx.scale(scale, scale)
  lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * 220))
  const pixels = ctx.getImageData(0, 0, 1200, 500).data
  const points = []
  for (let y = 0; y < 500; y += 2) {
    for (let x = 0; x < 1200; x += 2) {
      if (pixels[(y * 1200 + x) * 4 + 3] > 160) points.push([x, y])
    }
  }
  if (!points.length) throw new Error('Empty name targets')
  const worldWidth = worldHeight * width / height
  const displayWidth = Math.min(worldWidth * .9, 135)
  const data = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const [x, y] = points[Math.floor((i + .5) * points.length / count)]
    data[i * 4] = (x - 600) / 1200 * displayWidth
    data[i * 4 + 1] = -(y - 250) / 1200 * displayWidth + worldHeight * .04
    data[i * 4 + 2] = 0
    data[i * 4 + 3] = i * 2.399963 // stable individual swimming phase
  }
  return data
}
