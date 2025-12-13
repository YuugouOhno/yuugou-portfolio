import { ARScene } from '../../webgl/ar/ARScene.js'
import { ARBoids } from '../../webgl/ar/ARBoids.js'
import { CardAnimation } from '../../webgl/ar/CardAnimation.js'

export const AR_MODES = {
  INITIALIZING: 'INITIALIZING',
  CARD: 'CARD',
  FISH: 'FISH',
  ERROR: 'ERROR'
}

export class ARController {
  constructor() {
    this.mode = AR_MODES.INITIALIZING
    this.listeners = []

    this.arScene = null
    this.arBoids = null
    this.cardAnimation = null

    // Performance settings
    this.boidCount = this.getOptimalBoidCount()
  }

  getOptimalBoidCount() {
    // Detect device capability
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const cores = navigator.hardwareConcurrency || 4
    const isLowEnd = cores <= 4

    if (isLowEnd) return 64
    if (isMobile) return 256
    return 512
  }

  async checkDemoMode() {
    // Check if .mind file exists
    try {
      const response = await fetch('/targets/business-card.mind', { method: 'HEAD' })
      if (!response.ok) return true
      // Check content-type to make sure it's not HTML (404 page)
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/html')) return true
      return false
    } catch {
      return true
    }
  }

  async initDemoMode(container) {
    console.log('[ARController] Demo mode - MindAR target not found')

    // Create a simple Three.js scene without MindAR
    const THREE = await this.loadThree()

    // Setup renderer
    this.demoRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.demoRenderer.setSize(window.innerWidth, window.innerHeight)
    this.demoRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.demoRenderer.domElement)

    // Setup scene
    this.demoScene = new THREE.Scene()

    // Setup camera
    this.demoCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    this.demoCamera.position.set(0, 0, 0)

    // Add lights
    const ambient = new THREE.AmbientLight(0x404060, 0.5)
    this.demoScene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 1)
    directional.position.set(5, 10, 5)
    this.demoScene.add(directional)

    // Initialize boids
    await this.initDemoBoids()

    // Start animation
    this.demoMode = true
    this.demoClock = new THREE.Clock()
    this.animateDemo()

    // Handle resize
    this.resizeHandler = () => {
      this.demoCamera.aspect = window.innerWidth / window.innerHeight
      this.demoCamera.updateProjectionMatrix()
      this.demoRenderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', this.resizeHandler)

    this.setMode(AR_MODES.FISH)
    return true
  }

  async loadThree() {
    const THREE = await import('three')
    return THREE
  }

  async initDemoBoids() {
    const { ARBoids } = await import('../../webgl/ar/ARBoids.js')

    this.arBoids = new ARBoids({
      boidCount: this.boidCount,
      innerRadius: 1.0,
      outerRadius: 4.0,
      groupCount: 3
    })

    const success = await this.arBoids.init(this.demoRenderer)
    if (success) {
      const mesh = this.arBoids.getMesh()
      if (mesh) {
        this.demoScene.add(mesh)
      }
      this.arBoids.show()
    }
  }

  animateDemo() {
    if (!this.demoMode) return

    requestAnimationFrame(() => this.animateDemo())

    const delta = this.demoClock.getDelta()
    const elapsed = this.demoClock.getElapsedTime()

    // Slowly rotate camera around origin
    this.demoCamera.position.x = Math.sin(elapsed * 0.1) * 0.5
    this.demoCamera.position.z = Math.cos(elapsed * 0.1) * 0.5
    this.demoCamera.lookAt(0, 0, 0)

    // Update boids
    if (this.arBoids) {
      this.arBoids.update(delta, elapsed)
    }

    this.demoRenderer.render(this.demoScene, this.demoCamera)
  }

  async init(container) {
    this.setMode(AR_MODES.INITIALIZING)

    // Check if we should use demo mode (no MindAR target)
    const useDemoMode = await this.checkDemoMode()

    try {
      if (useDemoMode) {
        // Demo mode: Just show fish without MindAR
        await this.initDemoMode(container)
        return true
      }

      // Initialize AR scene
      this.arScene = new ARScene(container, {
        imageTargetSrc: '/targets/business-card.mind'
      })

      this.arScene.onModeChange = (mode) => {
        if (mode === 'CARD') {
          this.setMode(AR_MODES.CARD)
          this.showCardAnimation()
          this.hideBoids()
        } else {
          this.setMode(AR_MODES.FISH)
          this.hideCardAnimation()
          this.showBoids()
        }
      }

      this.arScene.onError = (error) => {
        console.error('AR Error:', error)
        this.setMode(AR_MODES.ERROR)
      }

      // Initialize AR scene (loads MindAR)
      const initSuccess = await this.arScene.init()
      if (!initSuccess) {
        this.setMode(AR_MODES.ERROR)
        return false
      }

      // Setup animation update callback
      this.arScene.onUpdate = (delta, elapsed) => {
        this.update(delta, elapsed)
      }

      // Initialize AR Boids
      await this.initBoids()

      // Initialize Card Animation
      this.initCardAnimation()

      // Start AR
      const startSuccess = await this.arScene.start()
      if (!startSuccess) {
        this.setMode(AR_MODES.ERROR)
        return false
      }

      // Default to FISH mode (no card detected initially)
      this.setMode(AR_MODES.FISH)

      return true

    } catch (error) {
      console.error('ARController init error:', error)
      this.setMode(AR_MODES.ERROR)
      return false
    }
  }

  update(delta, elapsed) {
    // Update boids if visible
    if (this.arBoids && this.mode === AR_MODES.FISH) {
      this.arBoids.update(delta, elapsed)
    }

    // Update card animation if visible
    if (this.cardAnimation && this.mode === AR_MODES.CARD) {
      this.cardAnimation.update(elapsed)
    }
  }

  showBoids() {
    if (this.arBoids) {
      this.arBoids.show()
    }
  }

  hideBoids() {
    if (this.arBoids) {
      this.arBoids.hide()
    }
  }

  showCardAnimation() {
    if (this.cardAnimation) {
      this.cardAnimation.show()
    }
  }

  hideCardAnimation() {
    if (this.cardAnimation) {
      this.cardAnimation.hide()
    }
  }

  async initBoids() {
    try {
      this.arBoids = new ARBoids({
        boidCount: this.boidCount,
        innerRadius: 0.5,  // 50cm from user
        outerRadius: 2.5,  // 2.5m from user
        groupCount: 3
      })

      const renderer = this.arScene.getRenderer()
      const success = await this.arBoids.init(renderer)

      if (success) {
        // Add boids mesh to scene
        const mesh = this.arBoids.getMesh()
        if (mesh) {
          this.arScene.addToScene(mesh)
        }
        // Start visible since we default to FISH mode
        this.arBoids.show()
        console.log('[ARController] Boids initialized')
      } else {
        console.warn('[ARController] Boids initialization failed')
      }
    } catch (error) {
      console.error('[ARController] Boids init error:', error)
    }
  }

  initCardAnimation() {
    try {
      this.cardAnimation = new CardAnimation()
      this.cardAnimation.init()

      // Add card animation to anchor group
      const group = this.cardAnimation.getGroup()
      if (group) {
        this.arScene.addToCard(group)
      }

      // Start hidden since we default to FISH mode
      this.cardAnimation.hide()
      console.log('[ARController] Card animation initialized')
    } catch (error) {
      console.error('[ARController] Card animation init error:', error)
    }
  }

  setMode(mode) {
    if (this.mode === mode) return
    this.mode = mode
    this.notify()
    console.log('[ARController] Mode changed to:', mode)
  }

  subscribe(callback) {
    this.listeners.push(callback)
    // Immediately call with current mode
    callback(this.mode)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  notify() {
    this.listeners.forEach(l => l(this.mode))
  }

  dispose() {
    // Stop demo mode
    this.demoMode = false

    // Remove resize handler
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
    }

    // Dispose boids
    if (this.arBoids) {
      this.arBoids.dispose()
      this.arBoids = null
    }

    // Dispose card animation
    if (this.cardAnimation) {
      this.cardAnimation.dispose()
      this.cardAnimation = null
    }

    // Dispose AR scene
    if (this.arScene) {
      this.arScene.dispose()
      this.arScene = null
    }

    // Dispose demo renderer
    if (this.demoRenderer) {
      this.demoRenderer.dispose()
      this.demoRenderer.domElement.remove()
      this.demoRenderer = null
    }

    this.listeners = []
    console.log('[ARController] Disposed')
  }
}
