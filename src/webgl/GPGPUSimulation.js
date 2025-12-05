import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'

// Shader imports
import positionFragment from '../glsl/boids/position.frag?raw'
import velocityFragment from '../glsl/boids/velocity.frag?raw'

export class GPGPUSimulation {
  constructor(renderer, config, groupIds = null) {
    this.renderer = renderer
    this.config = config
    this.groupIds = groupIds

    // Texture size (must be power of 2)
    this.textureSize = Math.ceil(Math.sqrt(config.boidCount))

    this.gpuCompute = null

    // Variables
    this.positionVariable = null
    this.velocityVariable = null
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
      velocityFragment,
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
    }
  }

  fillPositionTexture(texture) {
    const data = texture.image.data

    // Start in a tight cluster (10% of bounds) for dramatic spread effect
    const spawnRadius = 8

    for (let i = 0; i < data.length; i += 4) {
      // Random position in small sphere at center
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = Math.random() * spawnRadius

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

      // Random initial velocity
      data[i + 0] = (Math.random() - 0.5) * 2 // vx
      data[i + 1] = (Math.random() - 0.5) * 2 // vy
      data[i + 2] = (Math.random() - 0.5) * 2 // vz

      // Use shared group IDs if available, otherwise random
      if (this.groupIds && boidIndex < this.groupIds.length) {
        data[i + 3] = this.groupIds[boidIndex]
      } else {
        data[i + 3] = Math.floor(Math.random() * groupCount)
      }
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
    uniforms.uMaxSpeed = { value: 20.0 }
    uniforms.uMinSpeed = { value: 5.0 }

    // Wall avoidance
    uniforms.uWallWeight = { value: 2.0 }

    // Mouse interaction
    uniforms.uMouse = { value: new THREE.Vector3() }
    uniforms.uMouseRayDir = { value: new THREE.Vector3(0, 0, -1) }
    uniforms.uMouseWeight = { value: 0.0 }
    uniforms.uInteractionType = { value: 0 } // 0=none, 1=avoid, 2=attract
  }

  update(delta, elapsed) {
    if (!this.gpuCompute) return

    // Update uniforms
    const posUniforms = this.positionVariable.material.uniforms
    const velUniforms = this.velocityVariable.material.uniforms

    posUniforms.uTime.value = elapsed
    posUniforms.uDelta.value = delta

    velUniforms.uTime.value = elapsed
    velUniforms.uDelta.value = delta

    // Compute
    this.gpuCompute.compute()
  }

  getPositionTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture
  }

  getVelocityTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture
  }

  setMouseInteraction(position, rayDir, type, weight) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uMouse.value.copy(position)
    velUniforms.uMouseRayDir.value.copy(rayDir)
    velUniforms.uInteractionType.value = type
    velUniforms.uMouseWeight.value = weight
  }

  setSpeed(maxSpeed, minSpeed) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uMaxSpeed.value = maxSpeed
    velUniforms.uMinSpeed.value = minSpeed
  }

  setSeparationDistance(dist) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uSeparationDistance.value = dist
  }

  setSeparation(weight) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uSeparationWeight.value = weight
  }

  setAlignmentDistance(dist) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uAlignmentDistance.value = dist
  }

  setAlignment(weight) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uAlignmentWeight.value = weight
  }

  setCohesionDistance(dist) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uCohesionDistance.value = dist
  }

  setCohesion(weight) {
    const velUniforms = this.velocityVariable.material.uniforms
    velUniforms.uCohesionWeight.value = weight
  }
}
