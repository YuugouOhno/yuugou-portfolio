// AR-specific GPGPU Simulation with spherical shell bounds
import * as THREE from 'three'
import positionFragment from '../../glsl/boids/position.frag?raw'
import velocitySphericalFragment from '../../glsl/boids/velocity-spherical.frag?raw'

export class ARGPGPUSimulation {
  constructor(renderer, config, groupIds = null) {
    this.renderer = renderer
    this.config = config
    this.groupIds = groupIds
    this.THREE = THREE

    // Texture size (must be power of 2)
    this.textureSize = Math.ceil(Math.sqrt(config.boidCount))

    this.gpuCompute = null

    // Variables
    this.positionVariable = null
    this.velocityVariable = null
  }

  async init() {
    // Dynamically import GPUComputationRenderer
    // This needs to work with MindAR's Three.js version
    const { GPUComputationRenderer } = await import('three/addons/misc/GPUComputationRenderer.js')

    this.gpuCompute = new GPUComputationRenderer(
      this.textureSize,
      this.textureSize,
      this.renderer
    )

    // Check for WebGL 2 support
    if (!this.renderer.capabilities.isWebGL2) {
      console.error('WebGL 2 is required for GPGPU simulation')
      return false
    }

    // Create initial textures
    const positionTexture = this.gpuCompute.createTexture()
    const velocityTexture = this.gpuCompute.createTexture()

    // Fill textures with initial data
    this.fillPositionTexture(positionTexture)
    this.fillVelocityTexture(velocityTexture)

    // Add variables
    this.positionVariable = this.gpuCompute.addVariable(
      'texturePosition',
      positionFragment,
      positionTexture
    )

    this.velocityVariable = this.gpuCompute.addVariable(
      'textureVelocity',
      velocitySphericalFragment,
      velocityTexture
    )

    // Set dependencies
    this.gpuCompute.setVariableDependencies(this.positionVariable, [
      this.positionVariable,
      this.velocityVariable,
    ])

    this.gpuCompute.setVariableDependencies(this.velocityVariable, [
      this.positionVariable,
      this.velocityVariable,
    ])

    // Add uniforms
    this.addUniforms(this.positionVariable)
    this.addUniforms(this.velocityVariable)

    // Initialize
    const error = this.gpuCompute.init()
    if (error !== null) {
      console.error('GPUComputationRenderer error:', error)
      return false
    }

    return true
  }

  fillPositionTexture(texture) {
    const data = texture.image.data
    const innerRadius = this.config.innerRadius || 0.5
    const outerRadius = this.config.outerRadius || 2.0
    const midRadius = (innerRadius + outerRadius) / 2

    for (let i = 0; i < data.length; i += 4) {
      // Random position on spherical shell
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      // Random radius between inner and outer
      const r = innerRadius + Math.random() * (outerRadius - innerRadius)

      data[i + 0] = r * Math.sin(phi) * Math.cos(theta) // x
      data[i + 1] = r * Math.sin(phi) * Math.sin(theta) // y
      data[i + 2] = r * Math.cos(phi) // z
      data[i + 3] = Math.random() * Math.PI * 2 // animation phase
    }
  }

  fillVelocityTexture(texture) {
    const data = texture.image.data
    const groupCount = this.config.groupCount || 3

    for (let i = 0; i < data.length; i += 4) {
      const boidIndex = i / 4

      // Random initial velocity (slower for AR)
      data[i + 0] = (Math.random() - 0.5) * 0.5 // vx
      data[i + 1] = (Math.random() - 0.5) * 0.5 // vy
      data[i + 2] = (Math.random() - 0.5) * 0.5 // vz

      // Use shared group IDs if available, otherwise random
      if (this.groupIds && boidIndex < this.groupIds.length) {
        data[i + 3] = this.groupIds[boidIndex]
      } else {
        data[i + 3] = Math.floor(Math.random() * groupCount)
      }
    }
  }

  addUniforms(variable) {
    const THREE = this.THREE
    const uniforms = variable.material.uniforms

    // Time
    uniforms.uTime = { value: 0.0 }
    uniforms.uDelta = { value: 0.0 }

    // Spherical shell bounds
    uniforms.uInnerRadius = { value: this.config.innerRadius || 0.5 }
    uniforms.uOuterRadius = { value: this.config.outerRadius || 2.0 }

    // Boids parameters
    uniforms.uSeparationDistance = { value: 1.0 }
    uniforms.uAlignmentDistance = { value: 2.0 }
    uniforms.uCohesionDistance = { value: 3.0 }

    uniforms.uSeparationWeight = { value: 1.5 }
    uniforms.uAlignmentWeight = { value: 1.0 }
    uniforms.uCohesionWeight = { value: 1.0 }

    // Speed limits
    uniforms.uMaxSpeed = { value: 3.0 }
    uniforms.uMinSpeed = { value: 0.5 }

    // Wall avoidance (spherical shell)
    uniforms.uWallWeight = { value: 3.0 }
  }

  update(delta, elapsed) {
    if (!this.gpuCompute) return

    // Update uniforms
    const posUniforms = this.positionVariable.material.uniforms
    const velUniforms = this.velocityVariable.material.uniforms

    posUniforms.uTime.value = elapsed
    posUniforms.uDelta.value = Math.min(delta, 0.1) // Cap delta to prevent jumps

    velUniforms.uTime.value = elapsed
    velUniforms.uDelta.value = Math.min(delta, 0.1)

    // Compute
    this.gpuCompute.compute()
  }

  getPositionTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture
  }

  getVelocityTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture
  }

  setSpeed(maxSpeed, minSpeed) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uMaxSpeed.value = maxSpeed
    velUniforms.uMinSpeed.value = minSpeed
  }

  setShellRadius(innerRadius, outerRadius) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uInnerRadius.value = innerRadius
    velUniforms.uOuterRadius.value = outerRadius
  }

  dispose() {
    if (this.gpuCompute) {
      // Dispose render targets
      if (this.positionVariable) {
        const posRT = this.gpuCompute.getCurrentRenderTarget(this.positionVariable)
        if (posRT) posRT.dispose()
      }
      if (this.velocityVariable) {
        const velRT = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable)
        if (velRT) velRT.dispose()
      }

      // Dispose materials
      if (this.positionVariable?.material) {
        this.positionVariable.material.dispose()
      }
      if (this.velocityVariable?.material) {
        this.velocityVariable.material.dispose()
      }

      this.gpuCompute = null
    }
  }
}
