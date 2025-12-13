import * as THREE from 'three'
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js'

export class ARScene {
  constructor(container, options = {}) {
    this.container = container
    this.options = {
      imageTargetSrc: options.imageTargetSrc || '/targets/business-card.mind',
      maxTrack: options.maxTrack || 1,
      ...options
    }

    this.mindarThree = null
    this.renderer = null
    this.scene = null
    this.camera = null

    this.anchor = null
    this.cardGroup = null

    // State
    this.isRunning = false
    this.mode = 'FISH' // 'CARD' | 'FISH'

    // Callbacks
    this.onModeChange = null
    this.onError = null
    this.onUpdate = null

    // Animation
    this.clock = null
    this.animationFrameId = null
  }

  async init() {
    try {
      this.clock = new THREE.Clock()

      this.mindarThree = new MindARThree({
        container: this.container,
        imageTargetSrc: this.options.imageTargetSrc,
        maxTrack: this.options.maxTrack,
        uiLoading: 'no',
        uiScanning: 'no',
        uiError: 'no',
      })

      // Get Three.js components from MindAR
      this.renderer = this.mindarThree.renderer
      this.scene = this.mindarThree.scene
      this.camera = this.mindarThree.camera

      // Create a separate scene and camera for fish mode (not dependent on AR tracking)
      this.fishScene = new THREE.Scene()
      this.fishCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
      this.fishCamera.position.set(0, 0, 0)

      // Device orientation for fish camera
      this.deviceOrientation = { alpha: 0, beta: 0, gamma: 0 }
      this.setupDeviceOrientation()

      // Setup anchor for image target
      this.setupAnchor()

      return true
    } catch (error) {
      console.error('ARScene init error:', error)
      if (this.onError) this.onError(error)
      return false
    }
  }

  setupDeviceOrientation() {
    // Request permission on iOS 13+
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires permission
      this.needsOrientationPermission = true
    } else {
      // Android and older iOS
      this.startDeviceOrientation()
    }
  }

  async requestOrientationPermission() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission()
        if (permission === 'granted') {
          this.startDeviceOrientation()
          return true
        }
      } catch (e) {
        console.warn('[ARScene] DeviceOrientation permission denied:', e)
      }
    }
    return false
  }

  startDeviceOrientation() {
    window.addEventListener('deviceorientation', (event) => {
      this.deviceOrientation.alpha = event.alpha || 0  // Compass direction (0-360)
      this.deviceOrientation.beta = event.beta || 0    // Front/back tilt (-180 to 180)
      this.deviceOrientation.gamma = event.gamma || 0  // Left/right tilt (-90 to 90)
    }, true)
    console.log('[ARScene] Device orientation listener started')
  }

  updateFishCameraOrientation() {
    const { alpha, beta, gamma } = this.deviceOrientation

    // If no device orientation data, use a default view (looking forward)
    if (alpha === 0 && beta === 0 && gamma === 0) {
      this.fishCamera.position.set(0, 0, 0)
      this.fishCamera.rotation.set(0, 0, 0)
      return
    }

    // Convert degrees to radians
    const alphaRad = THREE.MathUtils.degToRad(alpha)
    const betaRad = THREE.MathUtils.degToRad(beta)
    const gammaRad = THREE.MathUtils.degToRad(gamma)

    // Create quaternion from device orientation
    // This follows the W3C Device Orientation spec for a phone in portrait mode
    const euler = new THREE.Euler()
    const quaternion = new THREE.Quaternion()
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)) // -90° around X

    // Set euler angles (ZXY order for device orientation)
    euler.set(betaRad, alphaRad, -gammaRad, 'YXZ')
    quaternion.setFromEuler(euler)

    // Adjust for screen orientation (assuming portrait)
    quaternion.multiply(q1)

    // Apply to camera
    this.fishCamera.quaternion.copy(quaternion)
    this.fishCamera.position.set(0, 0, 0)
  }

  setupAnchor() {
    // Add anchor for the first image target (index 0)
    this.anchor = this.mindarThree.addAnchor(0)

    // Create a group to hold card AR content
    this.cardGroup = new THREE.Group()
    this.anchor.group.add(this.cardGroup)

    // Event handlers for target detection
    this.anchor.onTargetFound = () => {
      console.log('[ARScene] Target found')
      this.mode = 'CARD'
      if (this.onModeChange) this.onModeChange('CARD')
    }

    this.anchor.onTargetLost = () => {
      console.log('[ARScene] Target lost')
      this.mode = 'FISH'
      if (this.onModeChange) this.onModeChange('FISH')
    }
  }

  async start() {
    if (this.isRunning) return

    try {
      await this.mindarThree.start()
      this.isRunning = true
      this.clock.start()
      this.animate()
      console.log('[ARScene] Started')
      return true
    } catch (error) {
      console.error('[ARScene] Start error:', error)
      if (this.onError) this.onError(error)
      return false
    }
  }

  stop() {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    if (this.mindarThree) {
      this.mindarThree.stop()
    }

    console.log('[ARScene] Stopped')
  }

  pause() {
    if (this.mindarThree) {
      this.mindarThree.pause(true) // Keep video running
    }
  }

  resume() {
    if (this.mindarThree) {
      this.mindarThree.unpause()
    }
  }

  animate() {
    if (!this.isRunning) return

    this.animationFrameId = requestAnimationFrame(() => this.animate())

    const delta = this.clock.getDelta()
    const elapsed = this.clock.getElapsedTime()

    // Update callbacks for external animation
    if (this.onUpdate) {
      this.onUpdate(delta, elapsed)
    }

    // Render MindAR scene (camera feed + card overlay)
    this.renderer.autoClear = true
    this.renderer.render(this.scene, this.camera)

    // If in FISH mode, also render fish scene on top (without clearing)
    if (this.mode === 'FISH' && this.fishScene.children.length > 0) {
      // Apply device orientation to fish camera
      this.updateFishCameraOrientation()

      this.renderer.autoClear = false
      this.renderer.clearDepth() // Clear depth so fish render on top
      this.renderer.render(this.fishScene, this.fishCamera)
    }
  }

  // Add content to the card anchor group
  addToCard(object) {
    if (this.cardGroup) {
      this.cardGroup.add(object)
    }
  }

  // Add content to the main scene (for card AR)
  addToScene(object) {
    if (this.scene) {
      this.scene.add(object)
    }
  }

  // Add content to fish scene (rendered when no card detected)
  addToFishScene(object) {
    if (this.fishScene) {
      this.fishScene.add(object)
    }
  }

  getFishScene() {
    return this.fishScene
  }

  getFishCamera() {
    return this.fishCamera
  }

  // Remove from scene
  removeFromScene(object) {
    if (this.scene) {
      this.scene.remove(object)
    }
  }

  getRenderer() {
    return this.renderer
  }

  getScene() {
    return this.scene
  }

  getCamera() {
    return this.camera
  }

  getCardGroup() {
    return this.cardGroup
  }

  getTHREE() {
    return THREE
  }

  dispose() {
    this.stop()

    // Dispose Three.js objects
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

    if (this.renderer) {
      this.renderer.dispose()
    }

    this.mindarThree = null
    this.renderer = null
    this.scene = null
    this.camera = null
    this.anchor = null
    this.cardGroup = null

    console.log('[ARScene] Disposed')
  }
}
