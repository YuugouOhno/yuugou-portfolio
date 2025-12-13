import * as THREE from 'three'
import { GPGPUSimulation } from './GPGPUSimulation.js'
import { FishMesh } from './FishMesh.js'

export class Scene {
  constructor() {
    this.renderer = null
    this.scene = null
    this.camera = null
    this.clock = new THREE.Clock()

    this.gpgpu = null
    this.fishMesh = null

    // Configuration
    this.config = {
      boidCount: 4096, // Must be power of 2 (texture size = sqrt(boidCount))
      bounds: new THREE.Vector3(50, 30, 50),
      groupCount: 3,
    }

    // Mouse interaction
    this.mouse = new THREE.Vector2()
    this.mouse3D = new THREE.Vector3()
    this.raycaster = new THREE.Raycaster()
    this.interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

    // Interaction settings
    this.interactionMode = 2 // 0: off, 1: repel, 2: attract
    this.interactionStrength = 4.5
  }

  init() {
    this.initRenderer()
    this.initScene()
    this.initCamera()
    this.initGPGPU()
    this.initFishMesh()
    this.initUI()
    this.addEventListeners()
    this.animate()
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document.getElementById('app').appendChild(this.renderer.domElement)
  }

  initScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a1a)

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
    this.scene.add(ambientLight)

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(10, 20, 10)
    this.scene.add(directionalLight)
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    this.camera.position.set(0, 30, 80)
    this.camera.lookAt(0, 0, 0)
  }

  initGPGPU() {
    // Create FishMesh first to generate group IDs
    this.fishMesh = new FishMesh(this.config, null)

    // Pass group IDs to GPGPU
    this.gpgpu = new GPGPUSimulation(this.renderer, this.config, this.fishMesh.groupIds)
    this.gpgpu.init()

    // Now connect FishMesh to GPGPU
    this.fishMesh.setGPGPU(this.gpgpu)
  }

  initFishMesh() {
    // FishMesh already created in initGPGPU
    this.scene.add(this.fishMesh.mesh)
  }

  initUI() {
    // Create gear button and control panel
    const container = document.createElement('div')
    container.id = 'control-container'
    container.innerHTML = `
      <button id="gear-btn">⚙</button>
      <div id="control-panel" class="hidden">
        <div class="control-header">Controls</div>
        <div class="control-row">
          <label>Speed</label>
          <input type="range" id="speed-slider" min="5" max="40" value="10" step="1">
          <span id="speed-value">10</span>
        </div>
        <div class="control-row">
          <label>Size</label>
          <input type="range" id="size-slider" min="0.5" max="3" value="1" step="0.1">
          <span id="size-value">1.0</span>
        </div>
        <div class="control-divider"></div>
        <div class="control-subheader">Boids Behavior</div>
        <div class="control-row">
          <label>Sep Dist</label>
          <input type="range" id="sep-dist-slider" min="1" max="15" value="5" step="0.5">
          <span id="sep-dist-value">5.0</span>
        </div>
        <div class="control-row">
          <label>Sep Weight</label>
          <input type="range" id="separation-slider" min="0" max="5" value="1.5" step="0.1">
          <span id="separation-value">1.5</span>
        </div>
        <div class="control-row">
          <label>Align Dist</label>
          <input type="range" id="align-dist-slider" min="1" max="20" value="10" step="0.5">
          <span id="align-dist-value">10.0</span>
        </div>
        <div class="control-row">
          <label>Align Weight</label>
          <input type="range" id="alignment-slider" min="0" max="3" value="1" step="0.1">
          <span id="alignment-value">1.0</span>
        </div>
        <div class="control-row">
          <label>Coh Dist</label>
          <input type="range" id="coh-dist-slider" min="1" max="30" value="15" step="0.5">
          <span id="coh-dist-value">15.0</span>
        </div>
        <div class="control-row">
          <label>Coh Weight</label>
          <input type="range" id="cohesion-slider" min="0" max="3" value="1" step="0.1">
          <span id="cohesion-value">1.0</span>
        </div>
        <div class="control-divider"></div>
        <div class="control-subheader">Mouse Interaction</div>
        <div class="control-row">
          <label>Mode</label>
          <div class="mode-buttons">
            <button id="mode-off" class="mode-btn">Off</button>
            <button id="mode-repel" class="mode-btn">Repel</button>
            <button id="mode-attract" class="mode-btn active">Attract</button>
          </div>
        </div>
        <div class="control-row">
          <label>Strength</label>
          <input type="range" id="strength-slider" min="0" max="20" value="4.5" step="0.5">
          <span id="strength-value">4.5</span>
        </div>
      </div>
    `
    document.body.appendChild(container)

    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      #control-container {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 1000;
      }
      #gear-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 20px;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: transform 0.3s, background 0.3s;
      }
      #gear-btn:hover {
        background: rgba(0, 0, 0, 0.9);
        transform: rotate(90deg);
      }
      #control-panel {
        position: absolute;
        bottom: 54px;
        left: 0;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 15px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        min-width: 200px;
        backdrop-filter: blur(10px);
        transition: opacity 0.3s, transform 0.3s;
      }
      #control-panel.hidden {
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
      }
      .control-header {
        font-weight: bold;
        margin-bottom: 12px;
        font-size: 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 8px;
      }
      .control-row {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        gap: 10px;
      }
      .control-row label {
        width: 70px;
        flex-shrink: 0;
      }
      .control-row input[type="range"] {
        flex: 1;
        height: 4px;
        -webkit-appearance: none;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        cursor: pointer;
      }
      .control-row input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        background: #4a9eff;
        border-radius: 50%;
        cursor: pointer;
      }
      .control-row span {
        width: 30px;
        text-align: right;
      }
      .control-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.2);
        margin: 12px 0;
      }
      .control-subheader {
        font-weight: bold;
        margin-bottom: 10px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
      }
      .mode-buttons {
        display: flex;
        gap: 4px;
        flex: 1;
      }
      .mode-btn {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: transparent;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        transition: background 0.2s, border-color 0.2s;
      }
      .mode-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .mode-btn.active {
        background: #4a9eff;
        border-color: #4a9eff;
      }
    `
    document.head.appendChild(style)

    // Toggle panel visibility
    const gearBtn = document.getElementById('gear-btn')
    const panel = document.getElementById('control-panel')
    gearBtn.addEventListener('click', () => {
      panel.classList.toggle('hidden')
    })

    // Bind slider events
    const speedSlider = document.getElementById('speed-slider')
    const sizeSlider = document.getElementById('size-slider')
    const sepDistSlider = document.getElementById('sep-dist-slider')
    const separationSlider = document.getElementById('separation-slider')
    const alignDistSlider = document.getElementById('align-dist-slider')
    const alignmentSlider = document.getElementById('alignment-slider')
    const cohDistSlider = document.getElementById('coh-dist-slider')
    const cohesionSlider = document.getElementById('cohesion-slider')

    speedSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('speed-value').textContent = value
      this.gpgpu.setSpeed(value, value * 0.25)
    })

    sizeSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('size-value').textContent = value.toFixed(1)
      this.fishMesh.setScale(value)
    })

    sepDistSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('sep-dist-value').textContent = value.toFixed(1)
      this.gpgpu.setSeparationDistance(value)
    })

    separationSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('separation-value').textContent = value.toFixed(1)
      this.gpgpu.setSeparation(value)
    })

    alignDistSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('align-dist-value').textContent = value.toFixed(1)
      this.gpgpu.setAlignmentDistance(value)
    })

    alignmentSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('alignment-value').textContent = value.toFixed(1)
      this.gpgpu.setAlignment(value)
    })

    cohDistSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('coh-dist-value').textContent = value.toFixed(1)
      this.gpgpu.setCohesionDistance(value)
    })

    cohesionSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('cohesion-value').textContent = value.toFixed(1)
      this.gpgpu.setCohesion(value)
    })

    // Mode buttons
    const modeOff = document.getElementById('mode-off')
    const modeRepel = document.getElementById('mode-repel')
    const modeAttract = document.getElementById('mode-attract')
    const modeButtons = [modeOff, modeRepel, modeAttract]

    const setActiveMode = (mode) => {
      this.interactionMode = mode
      modeButtons.forEach((btn, i) => {
        btn.classList.toggle('active', i === mode)
      })
    }

    modeOff.addEventListener('click', () => setActiveMode(0))
    modeRepel.addEventListener('click', () => setActiveMode(1))
    modeAttract.addEventListener('click', () => setActiveMode(2))

    // Strength slider
    const strengthSlider = document.getElementById('strength-slider')
    strengthSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      document.getElementById('strength-value').textContent = value.toFixed(1)
      this.interactionStrength = value
    })

    // Initial speed animation: start fast, then slow down
    console.log('[Boids] Starting with speed 40')
    this.gpgpu.setSpeed(40, 10)
    setTimeout(() => {
      console.log('[Boids] Beginning slowdown animation: 40 -> 10 over 1 second')
      this.animateSpeedDown(40, 10, 1000, speedSlider)
    }, 3000)
  }

  animateSpeedDown(from, to, duration, slider) {
    const startTime = performance.now()
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentSpeed = from + (to - from) * eased

      this.gpgpu.setSpeed(currentSpeed, currentSpeed * 0.25)
      slider.value = currentSpeed
      document.getElementById('speed-value').textContent = Math.round(currentSpeed)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        console.log('[Boids] Slowdown complete, speed now 10')
      }
    }
    requestAnimationFrame(animate)
  }

  addEventListeners() {
    window.addEventListener('resize', this.onResize.bind(this))
    window.addEventListener('mousemove', this.onMouseMove.bind(this))
    window.addEventListener('mousedown', this.onMouseDown.bind(this))
    window.addEventListener('mouseup', this.onMouseUp.bind(this))
  }

  onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    // Convert to 3D position on interaction plane
    this.raycaster.setFromCamera(this.mouse, this.camera)
    this.raycaster.ray.intersectPlane(this.interactionPlane, this.mouse3D)

    // Apply interaction based on current mode and strength
    if (this.gpgpu) {
      if (this.interactionMode === 1) {
        // Repel: use ray from camera
        this.gpgpu.setMouseInteraction(
          this.camera.position,
          this.raycaster.ray.direction,
          this.interactionMode,
          this.interactionStrength
        )
      } else {
        // Attract or Off: use point on plane
        this.gpgpu.setMouseInteraction(
          this.mouse3D,
          this.raycaster.ray.direction,
          this.interactionMode,
          this.interactionStrength
        )
      }
    }
  }

  onMouseDown() {
    // No longer used
  }

  onMouseUp() {
    // No longer used
  }

  onResize() {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
  }

  animate() {
    if (this.disposed) return

    this.animationFrameId = requestAnimationFrame(this.animate.bind(this))

    const delta = this.clock.getDelta()
    const elapsed = this.clock.getElapsedTime()

    // Update GPGPU simulation
    if (this.gpgpu) {
      this.gpgpu.update(delta, elapsed)
    }

    // Update fish mesh uniforms
    if (this.fishMesh) {
      this.fishMesh.update(elapsed)
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true

    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }

    // Remove event listeners
    window.removeEventListener('resize', this.onResize.bind(this))
    window.removeEventListener('mousemove', this.onMouseMove.bind(this))
    window.removeEventListener('mousedown', this.onMouseDown.bind(this))
    window.removeEventListener('mouseup', this.onMouseUp.bind(this))

    // Dispose GPGPU
    if (this.gpgpu) {
      this.gpgpu.dispose()
    }

    // Dispose fish mesh
    if (this.fishMesh) {
      this.fishMesh.dispose()
    }

    // Dispose scene
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose()
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
    }

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.domElement.remove()
    }

    // Remove UI
    const controlContainer = document.getElementById('control-container')
    if (controlContainer) {
      controlContainer.remove()
    }
  }
}
