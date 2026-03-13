import { clamp, lerp } from '../utils/math.ts'

interface Wave {
  x: number
  y: number
  radius: number
  strength: number
  life: number
  dx: number
  dy: number
}

export interface FieldSample {
  x: number
  y: number
}

export class FluidField {
  private width = 1
  private height = 1
  private cols = 1
  private rows = 1
  private vx = new Float32Array(1)
  private vy = new Float32Array(1)
  private nextVx = new Float32Array(1)
  private nextVy = new Float32Array(1)
  private time = 0
  private waves: Wave[] = []
  private energy = 0

  resize(width: number, height: number): void {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.cols = Math.max(28, Math.round(width / 42))
    this.rows = Math.max(38, Math.round(height / 36))

    const cellCount = this.cols * this.rows
    this.vx = new Float32Array(cellCount)
    this.vy = new Float32Array(cellCount)
    this.nextVx = new Float32Array(cellCount)
    this.nextVy = new Float32Array(cellCount)
    this.waves = []
  }

  addImpulse(x: number, y: number, dx: number, dy: number, force: number): void {
    const cx = clamp(Math.round((x / this.width) * (this.cols - 1)), 0, this.cols - 1)
    const cy = clamp(Math.round((y / this.height) * (this.rows - 1)), 0, this.rows - 1)
    const radius = Math.max(2, Math.round(2 + force * 4))

    for (let row = cy - radius; row <= cy + radius; row += 1) {
      if (row < 0 || row >= this.rows) {
        continue
      }

      for (let col = cx - radius; col <= cx + radius; col += 1) {
        if (col < 0 || col >= this.cols) {
          continue
        }

        const dxCell = col - cx
        const dyCell = row - cy
        const distance = Math.sqrt(dxCell ** 2 + dyCell ** 2)
        if (distance > radius) {
          continue
        }

        const weight = 1 - distance / radius
        const index = row * this.cols + col
        this.vx[index] += dx * weight * force * 0.018
        this.vy[index] += dy * weight * force * 0.018
      }
    }

    this.waves.unshift({
      x,
      y,
      radius: 24 + force * 90,
      strength: force,
      life: 1,
      dx,
      dy,
    })
    this.waves = this.waves.slice(0, 8)
  }

  addShake(intensity: number): void {
    const safeIntensity = clamp(intensity, 0, 1)
    for (let index = 0; index < 5; index += 1) {
      const x = ((index + 0.5) / 5) * this.width
      const y = this.height * (0.2 + index * 0.12)
      this.addImpulse(
        x,
        y,
        (Math.random() - 0.5) * 180 * safeIntensity,
        -60 - Math.random() * 120 * safeIntensity,
        0.55 + safeIntensity * 0.9,
      )
    }
  }

  step(dt: number): void {
    this.time += dt
    let energyAccumulator = 0

    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const index = row * this.cols + col
        const left = row * this.cols + Math.max(0, col - 1)
        const right = row * this.cols + Math.min(this.cols - 1, col + 1)
        const up = Math.max(0, row - 1) * this.cols + col
        const down = Math.min(this.rows - 1, row + 1) * this.cols + col

        const diffuseX = (this.vx[left] + this.vx[right] + this.vx[up] + this.vx[down]) * 0.25
        const diffuseY = (this.vy[left] + this.vy[right] + this.vy[up] + this.vy[down]) * 0.25
        const noiseX = Math.sin(this.time * 0.7 + col * 0.32 - row * 0.17) * 0.0009
        const noiseY = Math.cos(this.time * 0.63 - col * 0.18 + row * 0.23) * 0.0012

        this.nextVx[index] = (this.vx[index] * 0.82 + diffuseX * 0.18 + noiseX) * 0.976
        this.nextVy[index] = (this.vy[index] * 0.84 + diffuseY * 0.16 + noiseY + 0.0008) * 0.981

        energyAccumulator += Math.abs(this.nextVx[index]) + Math.abs(this.nextVy[index])
      }
    }

    ;[this.vx, this.nextVx] = [this.nextVx, this.vx]
    ;[this.vy, this.nextVy] = [this.nextVy, this.vy]

    this.waves = this.waves
      .map((wave) => ({
        ...wave,
        x: wave.x + wave.dx * dt * 0.6,
        y: wave.y + wave.dy * dt * 0.6,
        radius: wave.radius + dt * (70 + wave.strength * 45),
        life: wave.life - dt * (0.22 + wave.strength * 0.15),
      }))
      .filter((wave) => wave.life > 0.02)

    this.energy = energyAccumulator / (this.cols * this.rows)
  }

  sample(x: number, y: number, z: number): FieldSample {
    const fx = clamp((x / this.width) * (this.cols - 1), 0, this.cols - 1)
    const fy = clamp((y / this.height) * (this.rows - 1), 0, this.rows - 1)
    const left = Math.floor(fx)
    const top = Math.floor(fy)
    const right = Math.min(this.cols - 1, left + 1)
    const bottom = Math.min(this.rows - 1, top + 1)
    const tx = fx - left
    const ty = fy - top

    const a = top * this.cols + left
    const b = top * this.cols + right
    const c = bottom * this.cols + left
    const d = bottom * this.cols + right

    const vxTop = lerp(this.vx[a], this.vx[b], tx)
    const vxBottom = lerp(this.vx[c], this.vx[d], tx)
    const vyTop = lerp(this.vy[a], this.vy[b], tx)
    const vyBottom = lerp(this.vy[c], this.vy[d], tx)

    let sampleX = lerp(vxTop, vxBottom, ty)
    let sampleY = lerp(vyTop, vyBottom, ty)

    for (const wave of this.waves) {
      const dx = x - wave.x
      const dy = y - wave.y
      const distance = Math.max(1, Math.sqrt(dx ** 2 + dy ** 2))
      const ripple = Math.sin(distance * 0.08 - wave.radius * 0.05) * wave.strength * wave.life
      const falloff = Math.max(0, 1 - distance / (wave.radius + 120))
      sampleX += (-dy / distance) * ripple * falloff * 0.2
      sampleY += (dx / distance) * ripple * falloff * 0.2
    }

    const depth = lerp(0.72, 1.18, z)
    return {
      x: sampleX * depth,
      y: sampleY * depth,
    }
  }

  getWaves(): readonly Wave[] {
    return this.waves
  }

  getEnergy(): number {
    return this.energy
  }
}
