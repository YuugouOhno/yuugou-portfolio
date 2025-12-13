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

      // Setup anchor for image target
      this.setupAnchor()

      return true
    } catch (error) {
      console.error('ARScene init error:', error)
      if (this.onError) this.onError(error)
      return false
    }
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

    // Render
    this.renderer.render(this.scene, this.camera)
  }

  // Add content to the card anchor group
  addToCard(object) {
    if (this.cardGroup) {
      this.cardGroup.add(object)
    }
  }

  // Add content to the main scene (for fish AR)
  addToScene(object) {
    if (this.scene) {
      this.scene.add(object)
    }
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
