import * as THREE from 'three'

// Tags towed behind specific boids: a rope from the tail, then the word as a
// flexible ribbon that keeps following the rope (it twists and shows its back).
// Boid positions live on the GPU, so the texture rows holding the tagged boids
// are read back each frame.
// Call update() before the simulation step: it reads the previous step's result
// (already finished, so no stall) and extrapolates by velocity to catch up.
export class FishTags {
  // `tags`: strings become ribbons; null makes a bare rope whose end can carry
  // something else (see getAnchor).
  constructor(renderer, scene, gpgpu, tags, startIndex) {
    this.renderer = renderer
    this.scene = scene
    this.gpgpu = gpgpu
    this.startIndex = startIndex

    this.ropeSegments = 14
    this.ropeSegmentLength = 0.26
    this.labelSegments = 16
    this.labelHeight = 1.6
    this.stiffness = 2.5 // how fast the rope straightens behind the fish (1/s)

    // Read whole rows (row-major, so boid i sits at i * 4) up to the last tagged boid
    const width = gpgpu.textureSize
    const count = Math.min(tags.length, width * width - startIndex)
    const last = startIndex + count
    this.readHeight = Math.ceil(last / width)
    this.readWidth = this.readHeight > 1 ? width : last
    this.posBuffer = new Float32Array(this.readWidth * this.readHeight * 4)
    this.velBuffer = new Float32Array(this.readWidth * this.readHeight * 4)

    this.items = tags.slice(0, count).map((text, i) =>
      this.createItem(text, startIndex + i)
    )
  }

  createItem(text, boidIndex) {
    const label = text === null ? null : this.createLabelTexture(text)
    const labelSegments = label ? this.labelSegments : 0
    const labelWidth = label ? this.labelHeight * label.aspect : 0

    // Knot spacing: rope part, then the ribbon part
    const spacing = [
      ...Array(this.ropeSegments).fill(this.ropeSegmentLength),
      ...Array(labelSegments).fill(labelWidth / this.labelSegments),
    ]
    const points = Array.from({ length: spacing.length + 1 }, () => new THREE.Vector3())

    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((this.ropeSegments + 1) * 3), 3)
    )
    const line = new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
    )
    line.frustumCulled = false
    this.scene.add(line)

    const item = {
      boidIndex,
      points,
      spacing,
      labelSegments,
      line,
      ribbon: null,
      up: new THREE.Vector3(0, 1, 0),
      back: new THREE.Vector3(0, 0, 1),
      anchor: { position: new THREE.Vector3(), tangent: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
      initialized: false,
    }
    if (!label) return item

    // Ribbon: two vertices (top/bottom) per label knot
    const cols = this.labelSegments + 1
    const ribbonGeometry = new THREE.BufferGeometry()
    ribbonGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cols * 2 * 3), 3))
    const uvs = new Float32Array(cols * 2 * 2)
    const indices = []
    for (let j = 0; j < cols; j++) {
      const u = j / this.labelSegments
      uvs.set([u, 1, u, 0], j * 4)
      if (j < this.labelSegments) {
        const a = j * 2, b = a + 1, c = a + 2, d = a + 3
        indices.push(a, b, c, b, d, c)
      }
    }
    ribbonGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    ribbonGeometry.setIndex(indices)

    const ribbon = new THREE.Mesh(
      ribbonGeometry,
      new THREE.MeshBasicMaterial({
        map: label.texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    ribbon.frustumCulled = false
    this.scene.add(ribbon)
    item.ribbon = ribbon
    return item
  }

  // Rope-end pose of the i-th item: position, direction away from the fish, and up
  getAnchor(i) {
    return this.items[i].anchor
  }

  setRopeVisible(i, visible) {
    this.items[i].line.visible = visible
  }

  setLabelVisible(i, visible) {
    if (this.items[i].ribbon) this.items[i].ribbon.visible = visible
  }

  // Index of the visible ribbon hit by the ray, or -1
  pick(raycaster) {
    const ribbons = this.items.map((item) => item.ribbon).filter((r) => r?.visible)
    // Ribbons deform every frame, so the cached bounds are stale
    ribbons.forEach((r) => r.geometry.computeBoundingSphere())
    const hit = raycaster.intersectObjects(ribbons, false)[0]
    return hit ? this.items.findIndex((item) => item.ribbon === hit.object) : -1
  }

  createLabelTexture(text) {
    const fontSize = 64
    const padX = 8
    const padY = 10
    const font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif`

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = font
    const w = Math.ceil(ctx.measureText(text).width) + padX * 2
    const h = fontSize + padY * 2
    canvas.width = w
    canvas.height = h

    ctx.font = font
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, padX, h / 2 + 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    return { texture, aspect: w / h }
  }

  update(delta) {
    if (!this.items.length || !this.gpgpu.gpuCompute) return

    const posRT = this.gpgpu.gpuCompute.getCurrentRenderTarget(this.gpgpu.positionVariable)
    const velRT = this.gpgpu.gpuCompute.getCurrentRenderTarget(this.gpgpu.velocityVariable)
    this.renderer.readRenderTargetPixels(posRT, 0, 0, this.readWidth, this.readHeight, this.posBuffer)
    this.renderer.readRenderTargetPixels(velRT, 0, 0, this.readWidth, this.readHeight, this.velBuffer)

    const pos = new THREE.Vector3()
    const back = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const up = new THREE.Vector3()

    for (const item of this.items) {
      const o = item.boidIndex * 4
      pos.fromArray(this.posBuffer, o)
      back.fromArray(this.velBuffer, o)
      pos.addScaledVector(back, delta)
      if (back.lengthSq() < 1e-6) back.set(0, 0, 1)
      back.normalize().negate()

      // Ease the tail direction so the rope doesn't snap on sharp turns
      if (item.initialized) {
        item.back.lerp(back, 1 - Math.exp(-12 * delta)).normalize()
        back.copy(item.back)
      } else {
        item.back.copy(back)
      }

      // Rope starts at the tail
      const { points, spacing } = item
      points[0].copy(pos).addScaledVector(back, 1.0)

      if (!item.initialized) {
        for (let k = 1; k < points.length; k++) {
          points[k].copy(points[k - 1]).addScaledVector(back, spacing[k - 1])
        }
        item.initialized = true
      }

      // Follow-the-leader: each knot keeps a fixed distance from the one ahead.
      // It is also eased toward straight behind the knot ahead, so the rope keeps
      // trailing even when the fish circles inside the rope's length.
      const straighten = 1 - Math.exp(-this.stiffness * delta)
      for (let k = 1; k < points.length; k++) {
        if (k === 1) dir.copy(back)
        else dir.subVectors(points[k - 1], points[k - 2]).normalize()
        tangent.copy(points[k - 1]).addScaledVector(dir, spacing[k - 1])
        points[k].lerp(tangent, straighten)

        dir.subVectors(points[k], points[k - 1])
        const len = dir.length()
        if (len > spacing[k - 1]) {
          points[k].copy(points[k - 1]).addScaledVector(dir, spacing[k - 1] / len)
        }
      }

      const lineAttr = item.line.geometry.attributes.position
      for (let k = 0; k <= this.ropeSegments; k++) {
        lineAttr.setXYZ(k, points[k].x, points[k].y, points[k].z)
      }
      lineAttr.needsUpdate = true

      // Ribbon: carry the "up" side along the knots (and across frames) so it
      // twists smoothly instead of flipping to face the camera
      const ribbonAttr = item.ribbon?.geometry.attributes.position
      const half = this.labelHeight / 2
      up.copy(item.up)
      for (let j = 0; j <= item.labelSegments; j++) {
        const k = this.ropeSegments + j
        const prev = points[Math.max(k - 1, 0)]
        const next = points[Math.min(k + 1, points.length - 1)]
        tangent.subVectors(next, prev).normalize()

        up.addScaledVector(tangent, -up.dot(tangent))
        if (up.lengthSq() < 1e-6) up.set(0, 1, 0).addScaledVector(tangent, -tangent.y)
        up.normalize()
        if (j === 0) {
          item.up.copy(up)
          item.anchor.position.copy(points[k])
          item.anchor.tangent.copy(tangent)
          item.anchor.up.copy(up)
        }
        if (!ribbonAttr) continue

        const p = points[k]
        ribbonAttr.setXYZ(j * 2, p.x + up.x * half, p.y + up.y * half, p.z + up.z * half)
        ribbonAttr.setXYZ(j * 2 + 1, p.x - up.x * half, p.y - up.y * half, p.z - up.z * half)
      }
      if (ribbonAttr) ribbonAttr.needsUpdate = true
    }
  }

  dispose() {
    for (const item of this.items) {
      this.scene.remove(item.line)
      item.line.geometry.dispose()
      item.line.material.dispose()
      if (!item.ribbon) continue
      this.scene.remove(item.ribbon)
      item.ribbon.geometry.dispose()
      item.ribbon.material.map.dispose()
      item.ribbon.material.dispose()
    }
    this.items = []
  }
}
