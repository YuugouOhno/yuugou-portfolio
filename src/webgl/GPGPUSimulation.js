import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'

// Shader imports
import positionFragment from '../glsl/boids/position.frag?raw'
import velocityFragment from '../glsl/boids/velocity.frag?raw'
import extraFragment from '../glsl/boids/extra.frag?raw'

export class GPGPUSimulation {
  constructor(renderer, config) {
    this.renderer = renderer
    this.config = config

    // Texture size (must be power of 2)
    this.textureSize = Math.ceil(Math.sqrt(config.boidCount))

    this.gpuCompute = null

    // Variables
    this.positionVariable = null
    this.velocityVariable = null
    this.extraVariable = null
  }

  init() {
    this.gpuCompute = new GPUComputationRenderer(
      this.textureSize,
      this.textureSize,
      this.renderer
    )

    // Check for WebGL 2 support
    if (!this.renderer.capabilities.isWebGL2) {
      console.error('WebGL 2 is required for GPGPU simulation')
      return
    }

    // Create initial textures
    const positionTexture = this.gpuCompute.createTexture()
    const velocityTexture = this.gpuCompute.createTexture()
    const extraTexture = this.gpuCompute.createTexture()

    // Fill textures with initial data
    this.fillPositionTexture(positionTexture)
    this.fillVelocityTexture(velocityTexture)
    this.fillExtraTexture(extraTexture)

    // Add variables
    this.positionVariable = this.gpuCompute.addVariable(
      'texturePosition',
      positionFragment,
      positionTexture
    )

    this.velocityVariable = this.gpuCompute.addVariable(
      'textureVelocity',
      velocityFragment,
      velocityTexture
    )

    this.extraVariable = this.gpuCompute.addVariable(
      'textureExtra',
      extraFragment,
      extraTexture
    )

    // Set dependencies (each variable can read all textures)
    this.gpuCompute.setVariableDependencies(this.positionVariable, [
      this.positionVariable,
      this.velocityVariable,
      this.extraVariable,
    ])

    this.gpuCompute.setVariableDependencies(this.velocityVariable, [
      this.positionVariable,
      this.velocityVariable,
      this.extraVariable,
    ])

    this.gpuCompute.setVariableDependencies(this.extraVariable, [
      this.positionVariable,
      this.velocityVariable,
      this.extraVariable,
    ])

    // Add uniforms
    this.addUniforms(this.positionVariable)
    this.addUniforms(this.velocityVariable)
    this.addUniforms(this.extraVariable)

    // Initialize
    const error = this.gpuCompute.init()
    if (error !== null) {
      console.error('GPUComputationRenderer error:', error)
    }
  }

  fillPositionTexture(texture) {
    const data = texture.image.data
    const bounds = this.config.bounds

    for (let i = 0; i < data.length; i += 4) {
      // Random position within bounds
      data[i + 0] = (Math.random() - 0.5) * bounds.x * 2 // x
      data[i + 1] = (Math.random() - 0.5) * bounds.y * 2 // y
      data[i + 2] = (Math.random() - 0.5) * bounds.z * 2 // z
      data[i + 3] = Math.random() * Math.PI * 2 // animation phase
    }
  }

  fillVelocityTexture(texture) {
    const data = texture.image.data

    for (let i = 0; i < data.length; i += 4) {
      // Random initial velocity
      data[i + 0] = (Math.random() - 0.5) * 2 // vx
      data[i + 1] = (Math.random() - 0.5) * 2 // vy
      data[i + 2] = (Math.random() - 0.5) * 2 // vz
      data[i + 3] = 1.0 // drag coefficient
    }
  }

  fillExtraTexture(texture) {
    const data = texture.image.data

    for (let i = 0; i < data.length; i += 4) {
      data[i + 0] = Math.floor(Math.random() * 2) // team ID (0 or 1)
      data[i + 1] = 1.0 // HP (full health)
      data[i + 2] = 0.0 // state flags
      data[i + 3] = 0.0 // generic counter
    }
  }

  addUniforms(variable) {
    const uniforms = variable.material.uniforms

    // Time
    uniforms.uTime = { value: 0.0 }
    uniforms.uDelta = { value: 0.0 }

    // Bounds
    uniforms.uBounds = { value: this.config.bounds }

    // Boids parameters
    uniforms.uSeparationDistance = { value: 5.0 }
    uniforms.uAlignmentDistance = { value: 10.0 }
    uniforms.uCohesionDistance = { value: 15.0 }

    uniforms.uSeparationWeight = { value: 1.5 }
    uniforms.uAlignmentWeight = { value: 1.0 }
    uniforms.uCohesionWeight = { value: 1.0 }

    // Speed limits
    uniforms.uMaxSpeed = { value: 10.0 }
    uniforms.uMinSpeed = { value: 2.0 }

    // Wall avoidance
    uniforms.uWallWeight = { value: 2.0 }

    // Mouse interaction
    uniforms.uMouse = { value: new THREE.Vector3() }
    uniforms.uMouseWeight = { value: 0.0 }
    uniforms.uInteractionType = { value: 0 } // 0=none, 1=avoid, 2=attract

    // Shape formation (future use)
    uniforms.uShapeModeStrength = { value: 0.0 }
    uniforms.uShapeWeight = { value: 0.0 }
  }

  update(delta, elapsed) {
    if (!this.gpuCompute) return

    // Update uniforms
    const posUniforms = this.positionVariable.material.uniforms
    const velUniforms = this.velocityVariable.material.uniforms
    const extraUniforms = this.extraVariable.material.uniforms

    posUniforms.uTime.value = elapsed
    posUniforms.uDelta.value = delta

    velUniforms.uTime.value = elapsed
    velUniforms.uDelta.value = delta

    extraUniforms.uTime.value = elapsed
    extraUniforms.uDelta.value = delta

    // Compute
    this.gpuCompute.compute()
  }

  getPositionTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture
  }

  getVelocityTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture
  }

  getExtraTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.extraVariable).texture
  }
}
