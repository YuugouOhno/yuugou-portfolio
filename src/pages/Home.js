import { Scene } from '../webgl/Scene.js'
import { App } from '../components/App.js'

let scene = null

export function homePage() {
  const appContainer = document.getElementById('app')
  appContainer.innerHTML = ''

  // Initialize WebGL Boids simulation
  scene = new Scene()
  scene.init()

  // Mount page content
  appContainer.appendChild(App())

  // Wheel scroll → camera orbit (skip if over control UI)
  const onWheel = (e) => {
    if (e.target.closest('#control-container')) return
    e.preventDefault()
    scene.orbit(e.deltaX, e.deltaY)
  }
  window.addEventListener('wheel', onWheel, { passive: false })

  // Return cleanup function
  return () => {
    window.removeEventListener('wheel', onWheel)
    if (scene) {
      scene.dispose()
      scene = null
    }
    appContainer.innerHTML = ''
  }
}
