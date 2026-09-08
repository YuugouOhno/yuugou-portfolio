import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import positionFragment from '../glsl/boids/home-position.frag?raw'
import velocityFragment from '../glsl/boids/home-velocity.frag?raw'

export class GPGPUSimulation {
  constructor(renderer, config, groupIds) {
    Object.assign(this, { renderer, config, groupIds })
    this.textureSize = Math.ceil(Math.sqrt(config.boidCount))
  }

  init(targets, released, worldWidth) {
    if (!this.renderer.capabilities.isWebGL2 || !this.renderer.extensions.has('EXT_color_buffer_float')) {
      throw new Error('Home fish need WebGL 2 float render targets')
    }
    this.gpuCompute = new GPUComputationRenderer(this.textureSize, this.textureSize, this.renderer)
    this.targetTexture = this.gpuCompute.createTexture()
    this.targetTexture.image.data.set(targets)
    this.targetTexture.needsUpdate = true
    const positions = this.gpuCompute.createTexture()
    const velocities = this.gpuCompute.createTexture()
    positions.image.data.set(targets)
    for (let i = 0; i < targets.length / 4; i++) {
      const offset = i * 4
      velocities.image.data[offset] = .01
      velocities.image.data[offset + 3] = this.groupIds[i]
      if (released >= 1) {
        const side = targets[offset] < 0 ? -1 : 1
        // Same near/far lanes as the steering shader, inside the view even on
        // a deep restore. Their simulation coordinates survive every resize.
        positions.image.data[offset] = side * worldWidth * (i % 5 ? 1.15 : .6)
        positions.image.data[offset + 1] = ((i * .618) % 1 - .5) * 72
        positions.image.data[offset + 2] = i % 5 ? -160 : -35
      }
    }
    this.positionVariable = this.gpuCompute.addVariable('texturePosition', positionFragment, positions)
    this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', velocityFragment, velocities)
    for (const variable of [this.positionVariable, this.velocityVariable]) {
      this.gpuCompute.setVariableDependencies(variable, [this.positionVariable, this.velocityVariable])
      Object.assign(variable.material.uniforms, {
        uDelta: { value: 0 }, uTime: { value: 0 }, uRelease: { value: released },
        uTargets: { value: this.targetTexture }, uWorldWidth: { value: worldWidth },
      })
    }
    const error = this.gpuCompute.init()
    if (error) throw new Error(error)
  }

  update(delta, elapsed, release) {
    for (const variable of [this.positionVariable, this.velocityVariable]) {
      const uniforms = variable.material.uniforms
      uniforms.uDelta.value = delta
      uniforms.uTime.value = elapsed
      uniforms.uRelease.value = release
    }
    this.gpuCompute.compute()
  }

  getPositionTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture
  }

  getVelocityTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture
  }

  dispose() {
    this.targetTexture?.dispose()
    // r152 disposes both ping-pong targets and initial textures; variable
    // shader materials remain owned by this simulation.
    this.positionVariable?.material.dispose()
    this.velocityVariable?.material.dispose()
    this.gpuCompute?.dispose()
    this.gpuCompute = null
  }
}
