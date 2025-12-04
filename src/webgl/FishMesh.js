import * as THREE from 'three'

// Shader imports
import fishVertex from '../glsl/fish/fish.vert?raw'
import fishFragment from '../glsl/fish/fish.frag?raw'

export class FishMesh {
  constructor(config, gpgpu) {
    this.config = config
    this.gpgpu = gpgpu

    this.mesh = null
    this.material = null

    this.init()
  }

  init() {
    const count = this.config.boidCount
    const textureSize = Math.ceil(Math.sqrt(count))

    // Base geometry (simple cone/pyramid for fish shape)
    const baseGeometry = new THREE.ConeGeometry(0.3, 1.5, 4)
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

    for (let i = 0; i < count; i++) {
      // UV reference to lookup in GPGPU texture
      const x = (i % textureSize) / textureSize
      const y = Math.floor(i / textureSize) / textureSize
      references[i * 2 + 0] = x
      references[i * 2 + 1] = y

      // Random base color (ocean blues and teals)
      const hue = 0.5 + Math.random() * 0.15
      const saturation = 0.6 + Math.random() * 0.3
      const lightness = 0.4 + Math.random() * 0.2
      const color = new THREE.Color().setHSL(hue, saturation, lightness)
      colors[i * 3 + 0] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      // Random size variation
      sizes[i] = 0.8 + Math.random() * 0.4

      // Random seed for individual variation
      seeds[i] = Math.random()
    }

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
        texturePosition: { value: null },
        textureVelocity: { value: null },
        textureExtra: { value: null },
        uColorMode: { value: 0 }, // 0=base, 1=velocity, 2=team, 3=mix
      },
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.frustumCulled = false
  }

  update(elapsed) {
    if (!this.material || !this.gpgpu) return

    this.material.uniforms.uTime.value = elapsed
    this.material.uniforms.texturePosition.value = this.gpgpu.getPositionTexture()
    this.material.uniforms.textureVelocity.value = this.gpgpu.getVelocityTexture()
    this.material.uniforms.textureExtra.value = this.gpgpu.getExtraTexture()
  }
}
