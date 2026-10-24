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

  // Wheel scroll → camera orbit
  const onWheel = (e) => {
    // Let panel content scroll natively
    if (e.target.closest('.tag-panel-body')) return
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
