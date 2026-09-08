import * as THREE from 'three'
import { GPGPUSimulation } from './GPGPUSimulation.js'
import { FishMesh } from './FishMesh.js'
import { advanceRelease, easeRelease } from './homeMotion.js'
import { createNameTargets } from './nameTargets.js'
import { fitNameToViewport } from './homeLayout.js'

// Home owns this scene; AR has its own scene, mesh and simulation.
export class Scene {
  constructor(container, hero, visit, onFailure) {
    Object.assign(this, { container, hero, visit, onFailure })
    this.config = { boidCount: 1024, groupCount: 3, sharkCount: 0 }
    this.elapsed = 0
    this.blend = 0
    this.paused = false
    this.disposed = false
    this.frame = 0
    this.lastTime = 0
    this.onVisibility = () => {
      cancelAnimationFrame(this.frame)
      this.lastTime = 0
      if (!document.hidden && !this.paused) this.frame = requestAnimationFrame(this.animate)
    }
    this.onContextLost = (event) => {
      event.preventDefault()
      this.onFailure()
    }
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.debug.onShaderError = () => { throw new Error('Home fish shader compilation failed') }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setClearColor(0x0a0a1a, 0)
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost)
    this.container.appendChild(this.renderer.domElement)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(50, 1, .1, 600)
    this.camera.position.z = 100
    this.worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(25)) * 100
    this.resize()
    this.readProgress()
    // Deep restored positions start already released, with fish in background lanes.
    this.blend = this.visit.released ? 1 : this.targetBlend
    this.fishMesh = new FishMesh(this.config, null)
    this.gpgpu = new GPGPUSimulation(this.renderer, this.config, this.fishMesh.groupIds)
    this.gpgpu.init(this.targets, this.blend, this.worldWidth)
    // Compile both compute shaders while Home still owns the initialization catch.
    this.gpgpu.update(0, 0, this.blend)
    this.fishMesh.setGPGPU(this.gpgpu)
    this.fishMesh.setScale(this.fishScale)
    this.fishMesh.setViewport(this.viewportFit)
    this.scene.add(this.fishMesh.mesh)
    this.fishMesh.update(0)
    this.renderer.render(this.scene, this.camera)
    this.resizeObserver = new ResizeObserver(() => {
      try {
        this.resize()
      } catch (error) {
        console.warn('Home fish resize failed; HTML remains available.', error)
        this.onFailure()
      }
    })
    this.resizeObserver.observe(this.container)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.frame = requestAnimationFrame(this.animate)
  }

  readProgress() {
    const rect = this.hero.getBoundingClientRect()
    const state = advanceRelease(this.visit.released, -rect.top / Math.max(1, rect.height))
    this.visit.released = state.released
    this.targetBlend = state.amount
    // Inspectable state for browser verification; no global scene handle.
    this.container.dataset.release = state.released ? 'released' : 'forming'
  }

  resize() {
    if (this.disposed) return
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    if (!this.targets) {
      // Wrapping is chosen once per visit. Reflowing target indices on resize
      // would scatter letters while the fish swim to their new assignments.
      this.targets = createNameTargets(this.config.boidCount, width, height, this.worldHeight)
      this.formationWidth = Math.min(this.worldHeight * width / height * .9, 135)
      this.worldWidth = this.worldHeight * width / height
      this.fishScale = this.formationWidth / 270
    }
    this.viewportFit = fitNameToViewport(this.formationWidth, width, height, this.worldHeight, this.worldWidth)
    if (this.gpgpu) {
      this.fishMesh.setViewport(this.viewportFit)
      // Apply projection and presentation together, without a simulation step
      // or a frame showing the old formation outside the new camera bounds.
      this.renderer.render(this.scene, this.camera)
    }
  }

  animate = (time) => {
    if (this.disposed || this.paused || document.hidden) return
    const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, 1 / 60) : 0
    this.lastTime = time
    this.elapsed += delta
    this.readProgress()
    this.blend = easeRelease(this.blend, this.targetBlend, delta)
    this.container.dataset.blend = this.blend.toFixed(3)
    try {
      this.gpgpu.update(delta, this.elapsed, this.blend)
      this.fishMesh.update(this.elapsed)
      this.renderer.render(this.scene, this.camera)
      this.frame = requestAnimationFrame(this.animate)
    } catch (error) {
      console.warn('Home fish stopped; HTML remains available.', error)
      this.onFailure()
    }
  }

  setPaused(paused) {
    this.paused = paused
    this.onVisibility()
    return paused
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver?.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.fishMesh?.dispose()
    this.gpgpu?.dispose()
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost)
      this.renderer.dispose()
      this.renderer.forceContextLoss()
      this.renderer.domElement.remove()
    }
  }
}
