import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GPGPUSimulation } from './GPGPUSimulation.js'
import { FishMesh } from './FishMesh.js'
import { FishTags } from './FishTags.js'
import { tags } from '../data/tags.js'
import { Hero } from '../components/Hero/Hero.js'
import { TagPanel, TAG_TITLE_LINE, TAG_PANEL_PAD } from '../components/TagPanel/TagPanel.js'

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
      tagCount: tags.length + 1, // boids right after the sharks tow a tag (+1 for the card)
    }

    // Quaternion-based camera orbit: camera always looks at origin from radius 85.
    // orientation/targetOrientation encode both position and roll on the sphere.
    // Start level with the whale's orbit (y = 0), so it swims horizontally across the screen
    const _heroQ = this._computeLookAtQuat(new THREE.Vector3(0, 0, 1))
    this.cam = {
      orientation:       _heroQ.clone(),
      targetOrientation: _heroQ.clone(),
      radius:            85,
    }

    // Popouts: the profile card and one panel per tag. Each is either towed by a
    // fish or pulled out in front of the camera; only one can be in front.
    //   front → toTowed → towed → toFront → front
    // Scrolling the camera is allowed only while every popout is towed.
    this.popouts = []
    this.popoutDuration = 1.4 // seconds
    this.frontRadius = 50     // distance from origin, along the camera direction

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
    this.initFishTags()
    this.initCSS3D()
    this.initWhale()
    this.initSpeedIntro()
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

  initFishTags() {
    // Last slot is a bare rope for the profile card
    this.fishTags = new FishTags(this.renderer, this.scene, this.gpgpu, [...tags.map((t) => t.title), null], this.config.sharkCount)
    this.cardTagIndex = tags.length
  }

  initWhale() {
    // Start front-right of the center, heading left across the view
    this.whaleAngle = Math.PI / 2 - 0.6
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
    this.createPopouts()
  }

  createPopouts() {
    // Profile card: starts in front, towed whole by a bare rope
    const heroSection = Hero({
      onClose: () => this.closePopout(card),
      onSummon: () => this.openPopout(card),
    })
    const card = this.addPopout({
      element: heroSection.querySelector('.hero-card'),
      ropeIndex: this.cardTagIndex,
      state: 'front',
      frontScale: () => 0.07,
      towedScale: () => 0.016,
      // attach by the middle of the card's leading edge
      attach: (el) => ({ x: -el.offsetWidth / 2, y: 0 }),
    })

    // If nobody touches the card, it joins the school on its own
    this.cardAutoCloseTimeout = setTimeout(() => {
      if (!this.disposed) this.closePopout(card)
    }, 10000)

    // Tags: hidden until clicked; the ribbon is drawn by FishTags meanwhile
    tags.forEach(({ title, body }, i) => {
      const element = TagPanel({
        title,
        body,
        onClose: () => this.closePopout(popout),
      })
      const popout = this.addPopout({
        element,
        ropeIndex: i,
        state: 'towed',
        // 1 CSS px = 1 screen px in front
        frontScale: () => this._unitsPerPx(),
        // title line box matches the ribbon height
        towedScale: () => this.fishTags.labelHeight / TAG_TITLE_LINE,
        // attach by the left of the title line
        attach: () => ({ x: -this._panelSize().width / 2 + TAG_PANEL_PAD, y: -this._panelSize().height / 2 + TAG_PANEL_PAD + TAG_TITLE_LINE / 2 }),
        isTag: true,
      })
    })

    // Clicking empty space closes the front popout, or opens the tag that was hit
    this._onCanvasClick = (e) => {
      if (this._drag.moved) return
      const front = this.popouts.find((p) => p.state === 'front' || p.state === 'toFront')
      if (front) return this.closePopout(front)
      const hit = this._pickTag(e)
      if (hit) this.openPopout(hit)
    }
    this.renderer.domElement.addEventListener('click', this._onCanvasClick)
  }

  addPopout({ element, ropeIndex, state, frontScale, towedScale, attach, isTag = false }) {
    const object = new CSS3DObject(element)
    this.cssScene.add(object)
    const popout = { element, object, ropeIndex, state, t: 0, frontScale, towedScale, attach, isTag }
    this.popouts.push(popout)
    if (state === 'front') {
      this.fishTags.setRopeVisible(ropeIndex, false)
    } else {
      element.classList.add('is-towed')
    }
    return popout
  }

  openPopout(popout) {
    clearTimeout(this.cardAutoCloseTimeout)
    if (popout.state === 'toTowed') return this._reversePopout(popout, 'toFront')
    if (popout.state !== 'towed') return
    if (this.popouts.some((p) => p.state !== 'towed')) return
    if (popout.isTag) {
      const { width, height } = this._panelSize()
      popout.element.style.width = `${width}px`
      popout.element.style.height = `${height}px`
      popout.element.style.visibility = 'visible'
      popout.element.querySelector('.tag-panel-body').scrollTop = 0
      this.fishTags.setLabelVisible(popout.ropeIndex, false)
      popout.element.classList.add('is-open')
    }
    popout.element.classList.remove('is-towed')
    popout.state = 'toFront'
    popout.t = 0
  }

  closePopout(popout) {
    clearTimeout(this.cardAutoCloseTimeout)
    if (popout.state === 'toFront') return this._reversePopout(popout, 'toTowed')
    if (popout.state !== 'front') return
    popout.element.classList.add('is-towed')
    popout.element.classList.remove('is-open')
    this.fishTags.setRopeVisible(popout.ropeIndex, true)
    popout.state = 'toTowed'
    popout.t = 0
  }

  // Turn around mid-flight; the easing is symmetric, so 1 - t keeps the pose continuous
  _reversePopout(popout, state) {
    popout.state = state
    popout.t = 1 - popout.t
    const toFront = state === 'toFront'
    popout.element.classList.toggle('is-towed', !toFront)
    if (popout.isTag) popout.element.classList.toggle('is-open', toFront)
  }

  _pickTag(event) {
    const ndc = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const i = this.fishTags.pick(this.raycaster)
    return i < 0 ? null : this.popouts.find((p) => p.isTag && p.ropeIndex === i)
  }

  // World units per screen pixel at the front distance
  _unitsPerPx() {
    const dist = this.cam.radius - this.frontRadius
    return (2 * Math.tan((this.camera.fov * Math.PI) / 360) * dist) / window.innerHeight
  }

  _panelSize() {
    return {
      width: Math.min(560, window.innerWidth - 32),
      height: Math.min(520, window.innerHeight * 0.7),
    }
  }

  _frontPose(popout, out) {
    out.position.copy(this.camera.position).normalize().multiplyScalar(this.frontRadius)
    out.quaternion.copy(this.cam.orientation)
    out.scale = popout.frontScale()
    return out
  }

  // Pose hanging off the end of the rope, attached at popout.attach() (CSS px from center, y down)
  _towedPose(popout, out) {
    const { position, tangent, up } = this.fishTags.getAnchor(popout.ropeIndex)
    const z = new THREE.Vector3().crossVectors(tangent, up)
    out.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, up, z))
    out.scale = popout.towedScale()
    const a = popout.attach(popout.element)
    out.position.copy(position)
      .addScaledVector(tangent, -a.x * out.scale)
      .addScaledVector(up, a.y * out.scale)
    return out
  }

  updatePopouts(delta) {
    const from = this._poseA ??= { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
    const to = this._poseB ??= { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }

    for (const p of this.popouts) {
      // Hidden tag panels: the ribbon stands in for them
      if (p.isTag && p.state === 'towed') continue

      let k = 0
      if (p.state === 'toFront' || p.state === 'toTowed') {
        p.t = Math.min(p.t + delta / this.popoutDuration, 1)
        // Ease in-out cubic
        k = p.t < 0.5 ? 4 * p.t ** 3 : 1 - (-2 * p.t + 2) ** 3 / 2
      }

      if (p.state === 'front' || p.state === 'toFront') {
        this._towedPose(p, from)
        this._frontPose(p, to)
        if (p.state === 'front') k = 1
      } else {
        this._frontPose(p, from)
        this._towedPose(p, to)
        if (p.state === 'towed') k = 1
      }

      p.object.position.lerpVectors(from.position, to.position, k)
      p.object.quaternion.slerpQuaternions(from.quaternion, to.quaternion, k)
      p.object.scale.setScalar(from.scale + (to.scale - from.scale) * k)

      if (p.t >= 1 && p.state === 'toFront') {
        p.state = 'front'
        this.fishTags.setRopeVisible(p.ropeIndex, false)
      } else if (p.t >= 1 && p.state === 'toTowed') {
        p.state = 'towed'
        if (p.isTag) {
          p.element.style.visibility = 'hidden'
          this.fishTags.setLabelVisible(p.ropeIndex, true)
        }
      }
    }
  }

  initSpeedIntro() {
    // Start fast, then slow down
    this.gpgpu.setSpeed(40, 10)
    this.speedDownTimeout = setTimeout(() => {
      if (!this.disposed) this.animateSpeedDown(40, 10, 1000)
    }, 3000)
  }

  animateSpeedDown(from, to, duration) {
    const startTime = performance.now()
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentSpeed = from + (to - from) * eased

      this.gpgpu.setSpeed(currentSpeed, currentSpeed * 0.25)

      if (progress < 1 && !this.disposed) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }

  addEventListeners() {
    window.addEventListener('resize', this._onResize)
    window.addEventListener('mousemove', this._onMouseMove)

    // Drag to orbit: the scene follows the pointer, like grabbing it.
    // A drag that moved is not a click (so it won't open or close popouts).
    const canvas = this.renderer.domElement
    canvas.style.touchAction = 'none'
    this._drag = { active: false, moved: false, x: 0, y: 0 }
    this._onPointerDown = (e) => {
      this._drag = { active: true, moved: false, x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
    }
    this._onPointerMove = (e) => {
      const d = this._drag
      if (!d.active) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) < 5) return
      d.moved = true
      d.x = e.clientX
      d.y = e.clientY
      this.orbit(-dx, -dy)
    }
    this._onPointerUp = () => {
      this._drag.active = false
    }
    canvas.addEventListener('pointerdown', this._onPointerDown)
    canvas.addEventListener('pointermove', this._onPointerMove)
    canvas.addEventListener('pointerup', this._onPointerUp)
    canvas.addEventListener('pointercancel', this._onPointerUp)
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
    if (this.popouts.some((p) => p.state !== 'towed')) return

    const sensitivity = 0.003
    const cappedDY = Math.sign(deltaY) * Math.min(Math.abs(deltaY), 100)
    const cappedDX = Math.sign(deltaX) * Math.min(Math.abs(deltaX), 100)

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.cam.targetOrientation)
    const camUp    = new THREE.Vector3(0, 1, 0).applyQuaternion(this.cam.targetOrientation)

    const vertQuat  = new THREE.Quaternion().setFromAxisAngle(camRight, cappedDY * sensitivity)
    const horizQuat = new THREE.Quaternion().setFromAxisAngle(camUp,    cappedDX * sensitivity)

    this.cam.targetOrientation.premultiply(horizQuat).premultiply(vertQuat)
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

    // Tags read the previous step's positions, so update them before the next step
    if (this.fishTags) this.fishTags.update(delta)

    // Update GPGPU simulation
    if (this.gpgpu) {
      this.gpgpu.update(delta, elapsed)
    }

    // Update fish mesh uniforms
    if (this.fishMesh) {
      this.fishMesh.update(elapsed)
    }

    // Update whale circular orbit
    this.whaleAngle += delta * 0.175
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
    if (this.whaleAnimMixer) this.whaleAnimMixer.update(delta * 0.5) // tail beat matches the slower swim
    if (this.gpgpu) this.gpgpu.setPredatorPosition(this.whalePos)

    this.renderer.render(this.scene, this.camera)

    this.updatePopouts(delta)

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
    clearTimeout(this.cardAutoCloseTimeout)

    // Remove event listeners (same references as registered)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('mousemove', this._onMouseMove)
    const canvas = this.renderer?.domElement
    if (canvas) {
      canvas.removeEventListener('pointerdown', this._onPointerDown)
      canvas.removeEventListener('pointermove', this._onPointerMove)
      canvas.removeEventListener('pointerup', this._onPointerUp)
      canvas.removeEventListener('pointercancel', this._onPointerUp)
    }

    // Dispose GPGPU
    if (this.gpgpu) {
      this.gpgpu.dispose()
    }

    if (this.fishTags) {
      this.fishTags.dispose()
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

    if (this._onCanvasClick) {
      this.renderer.domElement.removeEventListener('click', this._onCanvasClick)
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
  }
}
