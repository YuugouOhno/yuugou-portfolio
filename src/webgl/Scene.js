import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GPGPUSimulation } from './GPGPUSimulation.js'
import { FishMesh } from './FishMesh.js'
import { Hero } from '../components/Hero/Hero.js'

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
      sphereRadius: 45,
      groupCount: 5,    // 0-2: normal fish, 3: density shark, 4: isolation shark
      sharkCount: 2,
    }

    // Quaternion-based camera orbit: camera always looks at origin from radius 85.
    // orientation/targetOrientation encode both position and roll on the sphere.
    const _heroQ = this._computeLookAtQuat(new THREE.Vector3(
      Math.sin(Math.PI * 0.18), Math.cos(Math.PI * 0.18), 0
    ))
    this.cam = {
      orientation:       _heroQ.clone(),
      targetOrientation: _heroQ.clone(),
      radius:            85,
    }

    // Depth-based content: each item appears when accumulatedTheta ≈ depth.
    // loop:true items repeat every `period` radians (default 2π).
    this.contentItems = [
      { name: 'hero', depth: 0, loop: true, period: Math.PI * 2 },
      // { name: 'works',   depth: Math.PI * 0.8  },
      // { name: 'contact', depth: Math.PI * 1.6  },
      // { name: 'about',   depth: Math.PI * 2.4  },
      // { name: 'skills',  depth: Math.PI * 3.2  },
    ]
    this.accumulatedTheta = 0

    this.cssRenderer = null
    this.cssScene = null

    this.speedDownTimeout = null

    // Mouse interaction
    this.mouse = new THREE.Vector2()
    this.mouse3D = new THREE.Vector3()
    this.raycaster = new THREE.Raycaster()
    this.interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

    // Interaction settings
    this.interactionMode = 2 // 0: off, 1: repel, 2: attract
    this.interactionStrength = 4.5

    // Bound event handler references for correct removal
    this._onResize    = this.onResize.bind(this)
    this._onMouseMove = this.onMouseMove.bind(this)
  }

  init() {
    this.initRenderer()
    this.initScene()
    this.initCamera()
    this.initGPGPU()
    this.initFishMesh()
    this.initCSS3D()
    this.initWhale()
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
    this._updateCameraPosition()
  }

  // Build a lookAt quaternion: camera at normalizedPos (unit vector) looking at origin.
  _computeLookAtQuat(normalizedPos) {
    const m = new THREE.Matrix4()
    m.lookAt(normalizedPos, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))
    return new THREE.Quaternion().setFromRotationMatrix(m)
  }

  // Apply stored quaternion directly — no lookAt() needed, no singularities.
  _updateCameraPosition() {
    const { orientation, radius } = this.cam
    // Default position (0,0,radius) rotated by orientation = actual world position.
    this.camera.position.set(0, 0, radius).applyQuaternion(orientation)
    this.camera.quaternion.copy(orientation)
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

  initWhale() {
    this.whaleAngle = 0
    this.whalePos   = new THREE.Vector3()
    this.whaleMesh  = null
    this.whaleAnimMixer = null
    this.whaleOrbitRadius = 40

    const loader = new GLTFLoader()
    loader.load('/model/whale.glb', (gltf) => {
      if (this.disposed) return
      const whale = gltf.scene
      whale.scale.setScalar(1.0)
      this.scene.add(whale)
      this.whaleMesh = whale

      if (gltf.animations.length > 0) {
        this.whaleAnimMixer = new THREE.AnimationMixer(whale)
        this.whaleAnimMixer.clipAction(gltf.animations[0]).play()
      }
    })
  }

  initCSS3D() {
    this.cssRenderer = new CSS3DRenderer()
    this.cssRenderer.setSize(window.innerWidth, window.innerHeight)
    const cssEl = this.cssRenderer.domElement
    cssEl.style.position = 'fixed'
    cssEl.style.top = '0'
    cssEl.style.left = '0'
    cssEl.style.zIndex = '1'
    cssEl.style.pointerEvents = 'none'
    document.body.appendChild(cssEl)

    this.cssScene = new THREE.Scene()
    this.contentObjects = []
    this.createContentPanels()
  }

  createContentPanels() {
    const contentRadius = 50
    const numStrips = 20
    const totalVerticalArc = 0.93
    const visibleWindow = totalVerticalArc * 1.5

    const panelCssWidth = 1200
    const fovRad = (60 * Math.PI) / 180
    const panelDist = this.cam.radius - contentRadius
    const visibleWidth = 2 * Math.tan(fovRad / 2) * panelDist * (window.innerWidth / window.innerHeight)
    const scale = visibleWidth / panelCssWidth
    const arcLenPerStrip = (contentRadius * totalVerticalArc) / numStrips
    const stripCssHeight = Math.round(arcLenPerStrip / scale)

    // Precomputed per-strip angle offsets from panel center (reused for all items)
    const stripAlphas = Array.from({ length: numStrips }, (_, i) =>
      ((i + 0.5) / numStrips - 0.5) * totalVerticalArc
    )

    this._panelCfg = { contentRadius, visibleWindow }

    for (const item of this.contentItems) {
      if (item.name === 'hero') {
        const heroSection = Hero()
        const card = heroSection.querySelector('.hero-card')
        card.style.visibility = 'hidden'
        const heroObj = new CSS3DObject(card)
        heroObj.scale.setScalar(0.07)
        this.cssScene.add(heroObj)
        this.contentObjects.push({
          depth:      item.depth,
          loop:       item.loop ?? false,
          period:     item.period ?? Math.PI * 2,
          name:       item.name,
          elements:   [card],
          objects:    [heroObj],
          stripAlphas:[0],
        })
        continue
      }

      const elements = []
      const objects  = []

      for (let i = 0; i < numStrips; i++) {
        const el = document.createElement('div')
        const isMiddle = i === Math.floor(numStrips / 2)
        el.style.cssText = `
          width: ${panelCssWidth}px;
          height: ${stripCssHeight}px;
          background: rgba(10, 10, 40, 0.72);
          border-left:  2px solid rgba(255,255,255,0.4);
          border-right: 2px solid rgba(255,255,255,0.4);
          ${i === 0             ? 'border-top:    2px solid rgba(255,255,255,0.4);' : ''}
          ${i === numStrips - 1 ? 'border-bottom: 2px solid rgba(255,255,255,0.4);' : ''}
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 80px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          padding: 0 80px;
          box-sizing: border-box;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          visibility: hidden;
        `
        if (isMiddle) el.textContent = item.name

        const obj = new CSS3DObject(el)
        obj.scale.setScalar(scale)
        this.cssScene.add(obj)
        elements.push(el)
        objects.push(obj)
      }

      this.contentObjects.push({
        depth:      item.depth,
        loop:       item.loop ?? false,
        period:     item.period ?? Math.PI * 2,
        name:       item.name,
        elements,
        objects,
        stripAlphas,
      })
    }
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
    this.gpgpu.setSpeed(40, 10)
    this.speedDownTimeout = setTimeout(() => {
      if (!this.disposed) this.animateSpeedDown(40, 10, 1000, speedSlider)
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

      if (progress < 1 && !this.disposed) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }

  addEventListeners() {
    window.addEventListener('resize', this._onResize)
    window.addEventListener('mousemove', this._onMouseMove)
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


  onResize() {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
    if (this.cssRenderer) this.cssRenderer.setSize(width, height)
  }

  // Camera-local orbit:
  //   vertical   → pitch around camera's local X (right)  → pole-to-pole on current meridian
  //   horizontal → yaw   around camera's local Y (up)     → orbit along current "equator"
  orbit(deltaX, deltaY) {
    const sensitivity = 0.003
    const cappedDY = Math.sign(deltaY) * Math.min(Math.abs(deltaY), 100)
    const cappedDX = Math.sign(deltaX) * Math.min(Math.abs(deltaX), 100)

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.cam.targetOrientation)
    const worldY   = new THREE.Vector3(0, 1, 0)

    const vertQuat  = new THREE.Quaternion().setFromAxisAngle(camRight, cappedDY * sensitivity)
    const horizQuat = new THREE.Quaternion().setFromAxisAngle(worldY,   cappedDX * sensitivity)

    this.cam.targetOrientation.premultiply(horizQuat).premultiply(vertQuat)
    this.accumulatedTheta += cappedDY * sensitivity
  }

  animate() {
    if (this.disposed) return

    this.animationFrameId = requestAnimationFrame(this.animate.bind(this))

    const delta   = this.clock.getDelta()
    const elapsed = this.clock.getElapsedTime()

    // Smooth camera slerp toward target (exponential, frame-rate independent)
    const lerpFactor = 1 - Math.exp(-8 * delta)
    this.cam.orientation.slerp(this.cam.targetOrientation, lerpFactor)
    this._updateCameraPosition()

    // Update GPGPU simulation
    if (this.gpgpu) {
      this.gpgpu.update(delta, elapsed)
    }

    // Update fish mesh uniforms
    if (this.fishMesh) {
      this.fishMesh.update(elapsed)
    }

    // Update whale circular orbit
    this.whaleAngle += delta * 0.35
    const wr = this.whaleOrbitRadius
    this.whalePos.set(
      Math.cos(this.whaleAngle) * wr,
      0,
      Math.sin(this.whaleAngle) * wr
    )
    if (this.whaleMesh) {
      this.whaleMesh.position.copy(this.whalePos)
      this.whaleMesh.lookAt(
        Math.cos(this.whaleAngle + 0.01) * wr,
        0,
        Math.sin(this.whaleAngle + 0.01) * wr
      )
    }
    if (this.whaleAnimMixer) this.whaleAnimMixer.update(delta)
    if (this.gpgpu) this.gpgpu.setPredatorPosition(this.whalePos)

    this.renderer.render(this.scene, this.camera)

    // Place CSS3D content relative to camera forward direction based on accumulated scroll depth.
    if (this.contentObjects?.length) {
      const { contentRadius, visibleWindow } = this._panelCfg

      const camFwd   = this.camera.position.clone().normalize()
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.cam.orientation)

      for (const item of this.contentObjects) {
        let depthDiff
        if (item.loop) {
          const period = item.period ?? Math.PI * 2
          const phase = ((this.accumulatedTheta - item.depth) % period + period) % period
          // Wrap to [-period/2, period/2] so nearest occurrence is always used
          depthDiff = phase <= period / 2 ? -phase : period - phase
        } else {
          depthDiff = item.depth - this.accumulatedTheta
        }
        const isVisible = Math.abs(depthDiff) < visibleWindow

        for (const el of item.elements) {
          el.style.visibility = isVisible ? '' : 'hidden'
        }

        if (isVisible) {
          item.objects.forEach((obj, i) => {
            const angle = depthDiff + item.stripAlphas[i]
            const offsetQuat = new THREE.Quaternion().setFromAxisAngle(camRight, angle)
            const stripDir   = camFwd.clone().applyQuaternion(offsetQuat)

            obj.position.copy(stripDir.clone().multiplyScalar(contentRadius))
            obj.quaternion.copy(this.cam.orientation)
          })
        }
      }
    }

    if (this.cssRenderer) this.cssRenderer.render(this.cssScene, this.camera)
  }

  dispose() {
    this.disposed = true

    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }

    // Cancel pending timers
    clearTimeout(this.speedDownTimeout)

    // Remove event listeners (same references as registered)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('mousemove', this._onMouseMove)

    // Dispose GPGPU
    if (this.gpgpu) {
      this.gpgpu.dispose()
    }

    // Dispose fish mesh
    if (this.fishMesh) {
      this.fishMesh.dispose()
    }

    // Dispose whale
    if (this.whaleMesh) {
      this.scene.remove(this.whaleMesh)
      this.whaleMesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) obj.material.dispose()
      })
      this.whaleMesh = null
    }
    if (this.whaleAnimMixer) {
      this.whaleAnimMixer.stopAllAction()
      this.whaleAnimMixer = null
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

    // Dispose CSS3D renderer
    if (this.cssRenderer) {
      this.cssRenderer.domElement.remove()
      this.cssRenderer = null
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
