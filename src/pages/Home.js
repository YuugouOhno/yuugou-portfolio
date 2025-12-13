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

  // Return cleanup function
  return () => {
    if (scene) {
      scene.dispose()
      scene = null
    }
    appContainer.innerHTML = ''
  }
}
