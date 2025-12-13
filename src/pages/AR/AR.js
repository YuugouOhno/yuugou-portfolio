import './AR.css'
import { StartScreen } from './components/StartScreen.js'
import { AROverlay } from './components/AROverlay.js'
import { ARController } from './ARController.js'

let controller = null

export function arPage() {
  const appContainer = document.getElementById('app')
  appContainer.innerHTML = ''

  // Create AR page container
  const arPage = document.createElement('div')
  arPage.id = 'ar-page'
  appContainer.appendChild(arPage)

  // Create AR container for MindAR
  const arContainer = document.createElement('div')
  arContainer.className = 'ar-container'
  arPage.appendChild(arContainer)

  // Create overlay for UI
  const overlay = AROverlay()
  arPage.appendChild(overlay)

  // Initialize controller
  controller = new ARController()

  // Subscribe to mode changes
  controller.subscribe((mode) => {
    overlay.updateMode(mode)
  })

  // Show start screen
  const startScreen = StartScreen({
    onStart: async () => {
      startScreen.remove()
      overlay.show()

      const success = await controller.init(arContainer)
      if (!success) {
        showError(arPage, 'Failed to start AR. Please check camera permissions.')
      }
    }
  })
  arPage.appendChild(startScreen)

  // Return cleanup function
  return () => {
    if (controller) {
      controller.dispose()
      controller = null
    }
    appContainer.innerHTML = ''
  }
}

function showError(container, message) {
  const errorDiv = document.createElement('div')
  errorDiv.className = 'ar-error'
  errorDiv.innerHTML = `
    <h2>Error</h2>
    <p>${message}</p>
    <button class="ar-retry-btn" onclick="window.location.reload()">Retry</button>
  `
  container.appendChild(errorDiv)
}
