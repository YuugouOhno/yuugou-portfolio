import * as THREE from 'three'
import { GPGPUSimulation } from './GPGPUSimulation.js'
import { FishMesh } from './FishMesh.js'

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
      boidCount: 64, // Must be power of 2 (texture size = sqrt(boidCount))
      bounds: new THREE.Vector3(50, 30, 50),
    }
  }

  init() {
    this.initRenderer()
    this.initScene()
    this.initCamera()
    this.initGPGPU()
    this.initFishMesh()
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
    this.camera.position.set(0, 30, 80)
    this.camera.lookAt(0, 0, 0)
  }

  initGPGPU() {
    this.gpgpu = new GPGPUSimulation(this.renderer, this.config)
    this.gpgpu.init()
  }

  initFishMesh() {
    this.fishMesh = new FishMesh(this.config, this.gpgpu)
    this.scene.add(this.fishMesh.mesh)
  }

  addEventListeners() {
    window.addEventListener('resize', this.onResize.bind(this))
  }

  onResize() {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this))

    const delta = this.clock.getDelta()
    const elapsed = this.clock.getElapsedTime()

    // Update GPGPU simulation
    if (this.gpgpu) {
      this.gpgpu.update(delta, elapsed)
    }

    // Update fish mesh uniforms
    if (this.fishMesh) {
      this.fishMesh.update(elapsed)
    }

    this.renderer.render(this.scene, this.camera)
  }
}
