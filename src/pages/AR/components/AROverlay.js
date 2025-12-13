import { Router } from '../../../router/Router.js'

const MODE_LABELS = {
  INITIALIZING: 'Initializing...',
  CARD: 'Card Detected',
  FISH: 'Fish Mode',
  ERROR: 'Error'
}

const MODE_HINTS = {
  INITIALIZING: 'Setting up AR experience...',
  CARD: 'Move your card to see the animation',
  FISH: 'Point camera at business card to switch mode',
  ERROR: 'Something went wrong'
}

export function AROverlay() {
  const overlay = document.createElement('div')
  overlay.className = 'ar-overlay'
  overlay.style.display = 'none'

  overlay.innerHTML = `
    <a href="/" class="ar-back-link">
      <span>&larr;</span>
      <span>Back</span>
    </a>
    <div class="ar-mode-indicator">
      <span class="ar-mode-label">Initializing...</span>
    </div>
    <div class="ar-hint">
      <span class="ar-hint-text">Setting up AR experience...</span>
    </div>
    <div class="ar-debug" style="display: none;">
      <span class="ar-fps">FPS: --</span>
    </div>
  `

  // Handle back link
  const backLink = overlay.querySelector('.ar-back-link')
  backLink.style.pointerEvents = 'auto'
  backLink.addEventListener('click', (e) => {
    e.preventDefault()
    const router = Router.getInstance()
    if (router) {
      router.navigate('/')
    } else {
      window.location.href = '/'
    }
  })

  const modeLabel = overlay.querySelector('.ar-mode-label')
  const hintText = overlay.querySelector('.ar-hint-text')

  overlay.updateMode = (mode) => {
    modeLabel.textContent = MODE_LABELS[mode] || mode
    hintText.textContent = MODE_HINTS[mode] || ''

    // Update indicator color based on mode
    const indicator = overlay.querySelector('.ar-mode-indicator')
    indicator.classList.remove('mode-card', 'mode-fish', 'mode-error')
    if (mode === 'CARD') {
      indicator.classList.add('mode-card')
    } else if (mode === 'FISH') {
      indicator.classList.add('mode-fish')
    } else if (mode === 'ERROR') {
      indicator.classList.add('mode-error')
    }
  }

  overlay.show = () => {
    overlay.style.display = 'block'
  }

  overlay.hide = () => {
    overlay.style.display = 'none'
  }

  // FPS counter
  let frameCount = 0
  let lastTime = performance.now()
  const fpsElement = overlay.querySelector('.ar-fps')
  const debugElement = overlay.querySelector('.ar-debug')

  overlay.updateFPS = () => {
    frameCount++
    const now = performance.now()
    if (now - lastTime >= 1000) {
      const fps = Math.round(frameCount * 1000 / (now - lastTime))
      fpsElement.textContent = `FPS: ${fps}`
      frameCount = 0
      lastTime = now
    }
  }

  overlay.showDebug = () => {
    debugElement.style.display = 'block'
  }

  overlay.hideDebug = () => {
    debugElement.style.display = 'none'
  }

  return overlay
}
