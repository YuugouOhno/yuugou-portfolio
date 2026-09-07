// Optional browser verification; keep Playwright outside application dependencies.
// Start `npm run dev -- --host 127.0.0.1` separately, then:
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/home-browser.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const output = 'docs/home-prototype/evidence'
const base = process.env.HOME_TEST_URL || 'http://127.0.0.1:5173'
const report = { environment: { platform: process.platform, node: process.version }, results: [], status: 'running' }
await mkdir(output, { recursive: true })
let browser
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE
  const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright')
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  report.environment.browser = browser.version()
  report.environment.mode = 'headless desktop browser; mobile viewport/touch emulation, not physical devices'
  const errors = []
  async function contextFor(options = {}) {
    const context = await browser.newContext(options)
    // Isolate existing third-party scripts from local visual verification.
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue() : route.abort())
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    return { context, page }
  }
  async function capture(page, name) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: horizontal overflow`)
    await page.screenshot({ path: `${output}/${name}.png` })
  }
  const waitForFish = page => page.waitForSelector('.has-fish .home-ocean canvas')
  for (const [label, options] of [
    ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
    ['mobile-emulated', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ]) {
    const { context, page } = await contextFor(options)
    await page.goto(base)
    await waitForFish(page)
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.locator('h1').textContent(), 'YuugouOhno')
    await capture(page, `${label}-formation`)
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
      assert.equal(await page.locator('html').evaluate(el => el.classList.contains('home-active')), false)
      await page.goBack()
      await waitForFish(page)
      assert.equal(await page.locator('.home-ocean canvas').count(), 1)
    }
    await page.locator('a[data-route][href="/ar"]').click()
    assert.equal(await page.locator('.home-ocean').count(), 0)
    await page.goBack()
    await waitForFish(page)
    await page.evaluate(() => scrollTo(0, 0))
    await page.keyboard.press('PageDown')
    await page.waitForFunction(() => scrollY > 100)
    report.results.push({ label, options, passed: true, checks: 'formation/scroll/touch or wheel/keyboard/anchors/latch/deep reload/pause/resize/route cycles' })
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
