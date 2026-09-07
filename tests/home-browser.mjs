// Optional browser verification; keep Playwright outside application dependencies.
// Start `npm run dev -- --host 127.0.0.1` separately, then:
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/home-browser.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const output = 'docs/home-prototype/evidence'
const base = process.env.HOME_TEST_URL || 'http://127.0.0.1:5173'
const viewports = [
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['mobile-emulated', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
]
const report = {
  environment: { platform: process.platform, node: process.version, date: new Date().toISOString(), base },
  plannedViewports: viewports, physicalDevicesVerified: false, screenshots: [],
  results: [], status: 'running', stage: 'browser-launch',
}
await mkdir(output, { recursive: true })
let browser
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE
  const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright')
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  report.stage = 'browser-checks'
  report.environment.browser = browser.version()
  report.environment.mode = 'headless desktop browser; mobile viewport/touch emulation, not physical devices'
  const errors = []
  async function contextFor(options = {}) {
    const context = await browser.newContext(options)
    // Isolate existing third-party scripts from local visual verification.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== new URL(base).origin) return route.abort()
      if (url.pathname !== '/src/webgl/Scene.js') return route.continue()
      // Dev-server test instrumentation only: inspect real GPU positions and
      // live scene ownership without exposing a scene handle in application code.
      const response = await route.fetch()
      await route.fulfill({ response, body: await response.text() + `
        window.__homeScenes = new Set();
        const originalInit = Scene.prototype.init;
        Scene.prototype.init = function () {
          originalInit.call(this);
          window.__homeScenes.add(this);
        };
        const originalDispose = Scene.prototype.dispose;
        Scene.prototype.dispose = function () {
          originalDispose.call(this);
          window.__homeScenes.delete(this);
        };
      ` })
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    return { context, page }
  }
  async function capture(page, name) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: horizontal overflow`)
    await page.screenshot({ path: `${output}/${name}.png` })
    report.screenshots.push(`${name}.png`)
  }
  const waitForFish = page => page.waitForSelector('.has-fish .home-ocean canvas')
  async function readProjection(page) {
    const bounds = await page.evaluate(() => {
      const scene = [...window.__homeScenes][0]
      const { renderer, camera, fishMesh, gpgpu } = scene
      const positions = new Float32Array(scene.config.boidCount * 4)
      renderer.readRenderTargetPixels(gpgpu.gpuCompute.getCurrentRenderTarget(gpgpu.positionVariable),
        0, 0, gpgpu.textureSize, gpgpu.textureSize, positions)
      fishMesh.mesh.updateMatrixWorld(true)
      const point = camera.position.clone()
      const uniforms = fishMesh.material.uniforms
      let x = 0, y = 0, z = 0, minX = Infinity
      for (let i = 0; i < positions.length; i += 4) {
        // Mirror home-fish.vert's depth-dependent viewport transform before
        // applying the real Three.js camera. Check xyz, not just screen xy.
        const t = Math.max(0, Math.min(1, -positions[i + 2] / 35))
        const laneWeight = t * t * (3 - 2 * t)
        const scale = uniforms.uFormationScale.value
        const scaleX = scale + (uniforms.uLaneScaleX.value - scale) * laneWeight
        const scaleY = scale + (1 - scale) * laneWeight
        point.set(positions[i] * scaleX,
          positions[i + 1] * scaleY + uniforms.uFormationOffsetY.value * (1 - laneWeight), positions[i + 2])
          .applyMatrix4(fishMesh.mesh.matrixWorld).project(camera)
        x = Math.max(x, Math.abs(point.x))
        y = Math.max(y, Math.abs(point.y))
        z = Math.max(z, Math.abs(point.z))
        minX = Math.min(minX, Math.abs(point.x))
      }
      return { x, y, z, minX, scenes: window.__homeScenes.size, released: scene.visit.released }
    })
    assert.equal(bounds.scenes, 1)
    assert.ok(bounds.z < 1, `fish clipped in depth: ${JSON.stringify(bounds)}`)
    return bounds
  }
  async function assertFormationFits(page) {
    const bounds = await readProjection(page)
    assert.equal(bounds.released, false)
    assert.ok(bounds.x > .2 && bounds.x < .95, `fish formation clipped horizontally: ${JSON.stringify(bounds)}`)
    assert.ok(bounds.y > .05 && bounds.y < .85, `fish formation clipped vertically: ${JSON.stringify(bounds)}`)
  }
  for (const [label, options] of viewports) {
    const { context, page } = await contextFor(options)
    await page.goto(base)
    await waitForFish(page)
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.locator('h1').textContent(), 'YuugouOhno')
    await assertFormationFits(page)
    await capture(page, `${label}-formation`)
    // Regress the reported bug BEFORE release, including both rotation directions.
    for (const [width, height] of [[390, 844], [844, 390], [320, 740], [1440, 900]]) {
      await page.setViewportSize({ width, height })
      await page.waitForFunction(({ width, height }) => {
        const scene = [...window.__homeScenes][0]
        return Math.abs(scene.camera.aspect - width / height) < .001
      }, { width, height })
      await assertFormationFits(page)
      await capture(page, `${label}-forming-resize-${width}x${height}`)
    }
    await page.setViewportSize(options.viewport)
    await page.evaluate(() => scrollTo(0, document.querySelector('.home-hero').offsetHeight * .4))
    await page.waitForTimeout(700)
    await capture(page, `${label}-loosening`)
    await page.evaluate(() => scrollTo(0, 0))
    assert.equal(await page.locator('.home-ocean').getAttribute('data-release'), 'forming')
    if (label === 'desktop') {
      await page.mouse.wheel(0, 1000)
      await page.waitForFunction(() => scrollY > 100)
    } else {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 650 }] })
      for (const y of [550, 450, 350, 250, 150]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y }] })
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForFunction(() => scrollY > 100)
    }
    await page.evaluate(() => document.querySelector('#profile').scrollIntoView())
    await page.waitForFunction(() => document.querySelector('.home-ocean').dataset.blend === '1.000')
    await page.waitForTimeout(1500)
    await capture(page, `${label}-body`)
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForTimeout(100)
    assert.equal(await page.locator('.home-ocean').getAttribute('data-release'), 'released')
    await capture(page, `${label}-returned-released`)
    await page.locator('.motion-toggle').click()
    await page.setViewportSize({ width: 320, height: 740 })
    await capture(page, `${label}-paused-resized`)
    assert.ok(await page.locator('h1').evaluate(el => el.getBoundingClientRect().width <= innerWidth))
    await page.locator('.motion-toggle').click()
    for (const width of [768, 320, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.locator('.home-ocean canvas').count(), 1)
    }
    await page.locator('.home-header nav a').click()
    await page.waitForFunction(() => scrollY > 100)
    await page.reload()
    await waitForFish(page)
    await page.waitForFunction(() => document.querySelector('.home-ocean').dataset.release === 'released')
    await capture(page, `${label}-deep-reload`)
    for (let visit = 0; visit < 3; visit++) {
      await page.locator('a[data-route][href="/forllm"]').click()
      assert.equal(await page.locator('.home-ocean').count(), 0)
      assert.equal(await page.evaluate(() => window.__homeScenes.size), 0)
      assert.equal(await page.locator('html').evaluate(el => el.classList.contains('home-active')), false)
      await page.goBack()
      await waitForFish(page)
      assert.equal(await page.locator('.home-ocean canvas').count(), 1)
      assert.equal(await page.evaluate(() => window.__homeScenes.size), 1)
    }
    await page.locator('a[data-route][href="/ar"]').click()
    assert.equal(await page.locator('.home-ocean').count(), 0)
    assert.equal(await page.evaluate(() => window.__homeScenes.size), 0)
    await page.goBack()
    await waitForFish(page)
    await page.evaluate(() => scrollTo(0, 0))
    await page.keyboard.press('PageDown')
    await page.waitForFunction(() => scrollY > 100)
    report.results.push({ label, options, passed: true, checks: 'formation/GPU bounds before release on shrink and both rotations/scroll/touch or wheel/keyboard/anchors/latch/deep reload/pause/resize/live scene ownership across route cycles' })
    await context.close()
  }
  // Deep initialization reproduces the review's near/far distribution. Freeze
  // time (not rendering) so each resize must preserve the same GPU state.
  for (const [initialWidth, initialHeight] of [[1440, 900], [390, 844], [844, 390], [320, 740]]) {
    const { context, page } = await contextFor({ viewport: { width: initialWidth, height: initialHeight } })
    await context.addInitScript(() => {
      new MutationObserver((_, observer) => {
        const profile = document.querySelector('#profile')
        if (profile) {
          profile.scrollIntoView()
          observer.disconnect()
        }
      }).observe(document, { childList: true, subtree: true })
    })
    await page.goto(`${base}/#profile`)
    await waitForFish(page)
    await page.evaluate(() => {
      const scene = [...window.__homeScenes][0]
      scene.setPaused(true)
      const gpu = scene.gpgpu
      const pixels = new Float32Array(scene.config.boidCount * 4)
      scene.renderer.readRenderTargetPixels(gpu.gpuCompute.getCurrentRenderTarget(gpu.positionVariable),
        0, 0, gpu.textureSize, gpu.textureSize, pixels)
      window.__resizeSnapshot = { scene, gpu, targets: scene.targets, pixels: Array.from(pixels) }
    })
    for (const [width, height] of [[390, 844], [844, 390], [320, 740], [1440, 900]]) {
      await page.setViewportSize({ width, height })
      await page.waitForFunction(({ width, height }) =>
        Math.abs([...window.__homeScenes][0].camera.aspect - width / height) < .001, { width, height })
      const bounds = await readProjection(page)
      assert.equal(bounds.released, true)
      assert.ok(bounds.minX > .8 && bounds.x < .96 && bounds.y < .7, JSON.stringify(bounds))
      assert.equal(await page.evaluate(() => {
        const { scene, gpu, targets, pixels } = window.__resizeSnapshot
        const current = new Float32Array(pixels.length)
        scene.renderer.readRenderTargetPixels(gpu.gpuCompute.getCurrentRenderTarget(gpu.positionVariable),
          0, 0, gpu.textureSize, gpu.textureSize, current)
        return scene === [...window.__homeScenes][0] && scene.gpgpu === gpu && scene.targets === targets &&
          current.every((value, i) => value === pixels[i])
      }), true, 'resize must preserve scene, targets, simulation and positions')
      const name = `released-${initialWidth}x${initialHeight}-to-${width}x${height}`
      await capture(page, name)
      report.results.push({ label: name, passed: true, projection: bounds })
    }
    await context.close()
  }
  for (const mode of ['reduced-motion', 'webgl-unavailable', 'float-target-unavailable', 'shader-failure', 'context-loss']) {
    const { context, page } = await contextFor({ viewport: { width: 390, height: 844 }, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' })
    if (mode === 'webgl-unavailable') await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/.test(type) ? null : original.call(this, type, ...args)
      }
    })
    if (mode === 'float-target-unavailable') await page.addInitScript(() => {
      const original = WebGL2RenderingContext.prototype.getExtension
      WebGL2RenderingContext.prototype.getExtension = function (name) {
        return name === 'EXT_color_buffer_float' ? null : original.call(this, name)
      }
    })
    if (mode === 'shader-failure') await page.addInitScript(() => {
      WebGL2RenderingContext.prototype.compileShader = function () { throw new Error('Injected compile failure') }
    })
    await page.goto(base)
    if (mode === 'context-loss') {
      await waitForFish(page)
      await page.locator('.home-ocean canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
    }
    await page.waitForTimeout(1500)
    assert.equal(await page.locator('.home-ocean canvas').count(), 0)
    assert.equal(await page.locator('h1').textContent(), 'YuugouOhno')
    await capture(page, mode)
    await page.locator('.home-header nav a').click()
    await page.waitForFunction(() => scrollY > 100)
    assert.ok(await page.locator('#profile h2').isVisible())
    report.results.push({ mode, passed: true })
    await context.close()
  }
  assert.deepEqual(errors, [])
  report.status = 'passed; images require human inspection'
} catch (error) {
  report.status = 'failed or blocked'
  report.error = error.message.split('Call log:')[0].slice(0, 6000)
  process.exitCode = 1
} finally {
  await browser?.close()
  await writeFile(`${output}/browser-results.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(report.status)
}
