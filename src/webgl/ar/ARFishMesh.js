// AR-specific Fish Mesh
import * as THREE from 'three'
import fishVertex from '../../glsl/fish/fish.vert?raw'
import fishFragment from '../../glsl/fish/fish.frag?raw'

export class ARFishMesh {
  constructor(config, gpgpu) {
    this.config = config
    this.gpgpu = gpgpu
    this.THREE = THREE

    this.mesh = null
    this.material = null
    this.groupIds = null

    this.init()
  }

  init() {
    const THREE = this.THREE
    const count = this.config.boidCount
    const textureSize = Math.ceil(Math.sqrt(count))
    const groupCount = this.config.groupCount || 3

    // Group colors - purple spectrum (same as original)
    const groupColors = [
      new THREE.Color().setHSL(0.92, 0.8, 0.55), // Red-Purple (Magenta)
      new THREE.Color().setHSL(0.83, 0.8, 0.55), // Purple
      new THREE.Color().setHSL(0.72, 0.8, 0.55), // Blue-Purple (Violet)
    ]

    // Base geometry for AR (in meters, but visible)
    const baseGeometry = new THREE.ConeGeometry(0.1, 0.4, 4)
    baseGeometry.rotateX(Math.PI / 2)

    // Create instanced geometry
    const geometry = new THREE.InstancedBufferGeometry()
    geometry.index = baseGeometry.index
    geometry.attributes.position = baseGeometry.attributes.position
    geometry.attributes.normal = baseGeometry.attributes.normal

    // Instance attributes
    const references = new Float32Array(count * 2)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const seeds = new Float32Array(count)
    const groupIds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // UV reference to lookup in GPGPU texture
      const x = (i % textureSize) / textureSize
      const y = Math.floor(i / textureSize) / textureSize
      references[i * 2 + 0] = x
      references[i * 2 + 1] = y

      // Assign group ID
      const groupId = Math.floor(Math.random() * groupCount)
      groupIds[i] = groupId

      // Color based on group
      const baseColor = groupColors[groupId % groupColors.length]
      const hsl = {}
      baseColor.getHSL(hsl)
      const color = new THREE.Color().setHSL(
        hsl.h + (Math.random() - 0.5) * 0.03,
        hsl.s + (Math.random() - 0.5) * 0.1,
        hsl.l + (Math.random() - 0.5) * 0.1
      )
      colors[i * 3 + 0] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      // Random size variation
      sizes[i] = 0.8 + Math.random() * 0.4

      // Random seed for individual variation
      seeds[i] = Math.random()
    }

    // Store group IDs for GPGPU initialization
    this.groupIds = groupIds

    geometry.setAttribute(
      'aReference',
      new THREE.InstancedBufferAttribute(references, 2)
    )
    geometry.setAttribute(
      'aColor',
      new THREE.InstancedBufferAttribute(colors, 3)
    )
    geometry.setAttribute(
      'aSize',
      new THREE.InstancedBufferAttribute(sizes, 1)
    )
    geometry.setAttribute(
      'aSeed',
      new THREE.InstancedBufferAttribute(seeds, 1)
    )

    // Shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: fishVertex,
      fragmentShader: fishFragment,
      uniforms: {
        uTime: { value: 0.0 },
        uScale: { value: 1.0 },
        texturePosition: { value: null },
        textureVelocity: { value: null },
      },
      side: THREE.DoubleSide,
      transparent: true, // Enable for better AR blending
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.frustumCulled = false
  }

  setGPGPU(gpgpu) {
    this.gpgpu = gpgpu
  }

  setScale(scale) {
    this.material.uniforms.uScale.value = scale
  }

  show() {
    if (this.mesh) {
      this.mesh.visible = true
    }
  }

  hide() {
    if (this.mesh) {
      this.mesh.visible = false
    }
  }

  update(elapsed) {
    if (!this.material || !this.gpgpu) return

    this.material.uniforms.uTime.value = elapsed
    this.material.uniforms.texturePosition.value = this.gpgpu.getPositionTexture()
    this.material.uniforms.textureVelocity.value = this.gpgpu.getVelocityTexture()
  }

  getMesh() {
    return this.mesh
  }

  dispose() {
    if (this.mesh) {
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose()
      }
      this.mesh = null
    }

    if (this.material) {
      this.material.dispose()
      this.material = null
    }
  }
}
