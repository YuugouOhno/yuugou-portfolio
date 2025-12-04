import './style.css'
import { Scene } from './webgl/Scene.js'
import { App } from './components/App.js'

// Background: WebGL Boids simulation
const scene = new Scene()
scene.init()

// Foreground: Page content
document.getElementById('app').appendChild(App())
