// Card Animation - Placeholder animation for business card AR
// Shows animated rings and particles when card is detected
import * as THREE from 'three'

export class CardAnimation {
  constructor() {
    this.THREE = THREE

    this.group = null
    this.rings = []
    this.particles = null
    this.visible = false
    this.initialized = false
  }

  init() {
    if (this.initialized) return
    const THREE = this.THREE

    this.group = new THREE.Group()

    // Create animated rings
    this.createRings()

    // Create particle system
    this.createParticles()

    // Create center glow
    this.createCenterGlow()

    this.initialized = true
    console.log('[CardAnimation] Initialized')
  }

  createRings() {
    const THREE = this.THREE
    const ringCount = 3
    const colors = [0x6366f1, 0x8b5cf6, 0xa855f7] // Purple gradient

    for (let i = 0; i < ringCount; i++) {
      const geometry = new THREE.RingGeometry(0.3 + i * 0.15, 0.32 + i * 0.15, 64)
      const material = new THREE.MeshBasicMaterial({
        color: colors[i],
        transparent: true,
        opacity: 0.6 - i * 0.15,
        side: THREE.DoubleSide,
      })

      const ring = new THREE.Mesh(geometry, material)
      ring.rotation.x = -Math.PI / 2 // Lay flat on card
      ring.position.y = 0.01 + i * 0.005 // Slight offset above card

      // Store initial scale for animation
      ring.userData = {
        baseScale: 1.0,
        phaseOffset: i * (Math.PI * 2 / ringCount),
        speed: 1.5 - i * 0.3
      }

      this.rings.push(ring)
      this.group.add(ring)
    }
  }

  createParticles() {
    const THREE = this.THREE
    const particleCount = 50

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    const phases = new Float32Array(particleCount)

    const color = new THREE.Color()

    for (let i = 0; i < particleCount; i++) {
      // Random position in cylinder above card
      const angle = Math.random() * Math.PI * 2
      const radius = 0.2 + Math.random() * 0.4
      const height = Math.random() * 0.3

      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = height
      positions[i * 3 + 2] = Math.sin(angle) * radius

      // Purple-ish colors
      color.setHSL(0.75 + Math.random() * 0.1, 0.8, 0.6 + Math.random() * 0.2)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      sizes[i] = 0.02 + Math.random() * 0.02
      phases[i] = Math.random() * Math.PI * 2
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1))

    // Store original positions for animation
    this.originalPositions = positions.slice()
    this.phases = phases

    const material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    })

    this.particles = new THREE.Points(geometry, material)
    this.group.add(this.particles)
  }

  createCenterGlow() {
    const THREE = this.THREE

    // Create a glowing center sphere
    const geometry = new THREE.SphereGeometry(0.08, 16, 16)
    const material = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.5,
    })

    this.centerGlow = new THREE.Mesh(geometry, material)
    this.centerGlow.position.y = 0.1
    this.group.add(this.centerGlow)

    // Add outer glow
    const outerGeo = new THREE.SphereGeometry(0.12, 16, 16)
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.2,
    })
    this.outerGlow = new THREE.Mesh(outerGeo, outerMat)
    this.outerGlow.position.y = 0.1
    this.group.add(this.outerGlow)
  }

  show() {
    this.visible = true
    if (this.group) {
      this.group.visible = true
    }
  }

  hide() {
    this.visible = false
    if (this.group) {
      this.group.visible = false
    }
  }

  update(elapsed) {
    if (!this.visible || !this.initialized) return

    // Animate rings - pulsing scale and rotation
    this.rings.forEach((ring, i) => {
      const { phaseOffset, speed } = ring.userData
      const pulse = 1.0 + Math.sin(elapsed * speed + phaseOffset) * 0.1
      ring.scale.set(pulse, pulse, 1)
      ring.rotation.z = elapsed * 0.5 * (i % 2 === 0 ? 1 : -1)
    })

    // Animate particles - floating up and swirling
    if (this.particles && this.originalPositions) {
      const positions = this.particles.geometry.attributes.position.array

      for (let i = 0; i < positions.length / 3; i++) {
        const phase = this.phases[i]
        const ox = this.originalPositions[i * 3]
        const oy = this.originalPositions[i * 3 + 1]
        const oz = this.originalPositions[i * 3 + 2]

        // Add floating motion
        positions[i * 3] = ox + Math.sin(elapsed * 2 + phase) * 0.05
        positions[i * 3 + 1] = oy + Math.sin(elapsed * 1.5 + phase * 2) * 0.05
        positions[i * 3 + 2] = oz + Math.cos(elapsed * 2 + phase) * 0.05
      }

      this.particles.geometry.attributes.position.needsUpdate = true
    }

    // Animate center glow
    if (this.centerGlow) {
      const glowPulse = 1.0 + Math.sin(elapsed * 3) * 0.2
      this.centerGlow.scale.setScalar(glowPulse)
      this.centerGlow.material.opacity = 0.4 + Math.sin(elapsed * 2) * 0.2
    }

    if (this.outerGlow) {
      const outerPulse = 1.0 + Math.sin(elapsed * 2 + 1) * 0.3
      this.outerGlow.scale.setScalar(outerPulse)
    }
  }

  getGroup() {
    return this.group
  }

  dispose() {
    if (this.group) {
      this.group.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose()
        }
        if (object.material) {
          object.material.dispose()
        }
      })
      this.group = null
    }

    this.rings = []
    this.particles = null
    this.centerGlow = null
    this.outerGlow = null
    this.initialized = false

    console.log('[CardAnimation] Disposed')
  }
}
