// AR Boids - Combines GPGPU simulation and Fish mesh for AR
import { ARGPGPUSimulation } from './ARGPGPUSimulation.js'
import { ARFishMesh } from './ARFishMesh.js'

export class ARBoids {
  constructor(config = {}) {
    this.config = {
      boidCount: config.boidCount || 256,
      innerRadius: config.innerRadius || 0.5,  // meters
      outerRadius: config.outerRadius || 2.0,  // meters
      groupCount: config.groupCount || 3,
      ...config
    }

    this.gpgpu = null
    this.fishMesh = null
    this.visible = false
    this.initialized = false
  }

  async init(renderer) {
    if (this.initialized) return true

    try {
      // Create fish mesh first to get group IDs
      this.fishMesh = new ARFishMesh(this.config, null)

      // Create GPGPU simulation with matching group IDs
      this.gpgpu = new ARGPGPUSimulation(renderer, this.config, this.fishMesh.groupIds)
      const success = await this.gpgpu.init()

      if (!success) {
        console.error('[ARBoids] Failed to initialize GPGPU')
        return false
      }

      // Connect fish mesh to GPGPU
      this.fishMesh.setGPGPU(this.gpgpu)

      this.initialized = true
      console.log(`[ARBoids] Initialized with ${this.config.boidCount} boids`)

      return true
    } catch (error) {
      console.error('[ARBoids] Init error:', error)
      return false
    }
  }

  show() {
    this.visible = true
    if (this.fishMesh) {
      this.fishMesh.show()
    }
  }

  hide() {
    this.visible = false
    if (this.fishMesh) {
      this.fishMesh.hide()
    }
  }

  update(delta, elapsed) {
    if (!this.visible || !this.initialized) return

    // Update GPGPU simulation
    if (this.gpgpu) {
      this.gpgpu.update(delta, elapsed)
    }

    // Update fish mesh
    if (this.fishMesh) {
      this.fishMesh.update(elapsed)
    }
  }

  getMesh() {
    return this.fishMesh ? this.fishMesh.getMesh() : null
  }

  setScale(scale) {
    if (this.fishMesh) {
      this.fishMesh.setScale(scale)
    }
  }

  setSpeed(maxSpeed, minSpeed) {
    if (this.gpgpu) {
      this.gpgpu.setSpeed(maxSpeed, minSpeed)
    }
  }

  setShellRadius(innerRadius, outerRadius) {
    if (this.gpgpu) {
      this.gpgpu.setShellRadius(innerRadius, outerRadius)
    }
  }

  dispose() {
    if (this.gpgpu) {
      this.gpgpu.dispose()
      this.gpgpu = null
    }

    if (this.fishMesh) {
      this.fishMesh.dispose()
      this.fishMesh = null
    }

    this.initialized = false
    console.log('[ARBoids] Disposed')
  }
}
