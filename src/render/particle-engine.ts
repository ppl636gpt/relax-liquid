import type { AppSettings, ParticleKind, ParticleShape, ParticleState } from '../types.ts'
import { clamp, createSeededRandom, lerp } from '../utils/math.ts'
import type { FluidField } from './fluid-field.ts'

interface InternalParticleState extends ParticleState {
  vx: number
  vy: number
  drift: number
  colorTimer: number
  colorInterval: number
  stretchAmplitude: number
  stretchRate: number
}

const KIND_ORDER: ParticleKind[] = ['glitter', 'medium', 'large']
const BRIGHT_PALETTE = ['#59d7d2', '#7ab8f5', '#f1a5c6', '#ac9bea', '#74c8a1', '#f4c96b']
const WHITE = '#ffffff'

function pickFromPalette(value: number): string {
  const normalized = value - Math.floor(value)
  const index = Math.floor(normalized * BRIGHT_PALETTE.length) % BRIGHT_PALETTE.length
  return BRIGHT_PALETTE[index]
}

function pickShape(kind: ParticleKind, random: () => number): ParticleShape {
  if (kind === 'glitter') {
    return random() < 0.5 ? 'circle' : 'square'
  }

  if (kind === 'medium') {
    const roll = random()
    if (roll < 1 / 3) {
      return 'circle'
    }
    if (roll < 2 / 3) {
      return 'square'
    }
    return 'star6'
  }

  return random() < 0.5 ? 'star5' : 'heart'
}

function baseSizeFor(kind: ParticleKind, random: () => number): number {
  if (kind === 'glitter') {
    return lerp(5.4, 16.8, random())
  }

  if (kind === 'medium') {
    return lerp(5.6, 13.2, random())
  }

  return lerp(14, 30, random())
}

export class ParticleEngine {
  private width = 1
  private height = 1
  private particlesByKind: Record<ParticleKind, InternalParticleState[]> = {
    glitter: [],
    medium: [],
    large: [],
  }
  private orderedParticles: InternalParticleState[] = []
  private nextId = 1

  setViewport(width: number, height: number): void {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
  }

  sync(settings: AppSettings): void {
    for (const kind of KIND_ORDER) {
      const current = this.particlesByKind[kind]
      const targetCount = settings.particleCounts[kind]

      if (current.length > targetCount) {
        this.particlesByKind[kind] = current.slice(0, targetCount)
      } else if (current.length < targetCount) {
        const additions: InternalParticleState[] = []
        for (let index = current.length; index < targetCount; index += 1) {
          additions.push(this.createParticle(kind, index))
        }
        this.particlesByKind[kind] = current.concat(additions)
      }
    }

    this.orderedParticles = KIND_ORDER.flatMap((kind) => this.particlesByKind[kind]).sort((left, right) => left.z - right.z)
  }

  update(dt: number, field: FluidField, settings: AppSettings, time: number): void {
    for (const particle of this.orderedParticles) {
      const fieldSample = field.sample(particle.x, particle.y, particle.z)
      const kindSpeed = settings.particleSpeed[particle.kind]
      const inertia = particle.kind === 'glitter' ? 0.88 : particle.kind === 'medium' ? 0.915 : 0.948
      const noiseX = Math.sin(time * (0.55 + particle.z * 0.24) + particle.sparklePhase) * 0.018
      const noiseY = Math.cos(time * (0.48 + particle.z * 0.2) + particle.sparklePhase * 1.3) * 0.018
      const flowScale = dt * 60

      particle.vx = particle.vx * inertia + (fieldSample.x * particle.response * kindSpeed + noiseX) * flowScale * 0.85
      particle.vy =
        particle.vy * inertia +
        (fieldSample.y * particle.response * kindSpeed + noiseY + particle.drift * 0.004) * flowScale * 0.82

      particle.x += particle.vx * lerp(0.8, 1.18, particle.z)
      particle.y += particle.vy * lerp(0.78, 1.05, particle.z)

      const margin = particle.size * 1.5
      if (particle.x < margin) {
        particle.x = margin
        particle.vx *= -0.22
      } else if (particle.x > this.width - margin) {
        particle.x = this.width - margin
        particle.vx *= -0.22
      }

      if (particle.y < margin) {
        particle.y = margin
        particle.vy *= -0.2
      } else if (particle.y > this.height - margin) {
        particle.y = this.height - margin
        particle.vy *= -0.28
      }

      particle.rotation += particle.angularVelocity * flowScale + particle.vx * 0.00035
      particle.scaleX = clamp(1 + Math.sin(time * particle.stretchRate + particle.sparklePhase) * particle.stretchAmplitude, 0.58, 1.72)
      particle.scaleY = 1

      particle.colorTimer += dt
      if (particle.colorTimer >= particle.colorInterval) {
        particle.colorTimer = 0
        this.advanceColors(particle)
      }
    }
  }

  getParticles(): readonly InternalParticleState[] {
    return this.orderedParticles
  }

  private createParticle(kind: ParticleKind, index: number): InternalParticleState {
    const random = createSeededRandom(`${kind}-${index}`)
    const z = random()
    const shape = pickShape(kind, random)
    const size = baseSizeFor(kind, random)

    const base: InternalParticleState = {
      id: this.nextId++,
      kind,
      shape,
      x: random() * this.width,
      y: random() * this.height,
      z,
      size,
      scaleX: 1,
      scaleY: 1,
      rotation: random() * Math.PI * 2,
      angularVelocity: kind === 'large' ? lerp(-0.014, 0.014, random()) : lerp(-0.008, 0.008, random()),
      settling: 0,
      response: kind === 'glitter' ? lerp(1.1, 1.35, random()) : kind === 'medium' ? lerp(0.76, 0.96, random()) : lerp(0.42, 0.64, random()),
      sparklePhase: random() * Math.PI * 2,
      colorTick: Math.floor(random() * 9),
      primaryColor: BRIGHT_PALETTE[Math.floor(random() * BRIGHT_PALETTE.length)],
      secondaryColor: BRIGHT_PALETTE[Math.floor(random() * BRIGHT_PALETTE.length)],
      segmentColors: kind === 'large' ? Array.from({ length: 5 }, (_, segment) => BRIGHT_PALETTE[(Math.floor(random() * 1000) + segment) % BRIGHT_PALETTE.length]) : [],
      vx: (random() - 0.5) * 0.4,
      vy: (random() - 0.5) * 0.2,
      drift: random() - 0.5,
      colorTimer: 0,
      colorInterval: kind === 'glitter' ? lerp(0.1, 0.2, random()) : kind === 'medium' ? lerp(0.22, 0.42, random()) : lerp(0.2, 0.46, random()),
      stretchAmplitude: kind === 'glitter' ? lerp(0.18, 0.42, random()) : kind === 'medium' ? lerp(0.14, 0.34, random()) : lerp(0.1, 0.2, random()),
      stretchRate: kind === 'glitter' ? lerp(4.5, 8.2, random()) : kind === 'medium' ? lerp(2.8, 5.2, random()) : lerp(1.6, 3.2, random()),
    }

    this.advanceColors(base)
    return base
  }

  private advanceColors(particle: InternalParticleState): void {
    particle.colorTick += 1

    if (particle.kind === 'glitter') {
      const color = this.pickAnimatedColor(particle, particle.colorTick)
      particle.primaryColor = color
      particle.secondaryColor = color
      particle.segmentColors = [color]
      return
    }

    if (particle.kind === 'medium') {
      particle.primaryColor = this.pickAnimatedColor(particle, particle.colorTick)
      particle.secondaryColor = this.pickAnimatedColor(particle, particle.colorTick + 1)
      particle.segmentColors = [particle.primaryColor, particle.secondaryColor]
      return
    }

    const segmentIndex = Math.floor((Math.sin(particle.colorTick * 2.13 + particle.sparklePhase) * 0.5 + 0.5) * 5) % 5
    const nextSegments = particle.segmentColors.length === 5 ? [...particle.segmentColors] : Array.from({ length: 5 }, () => WHITE)
    nextSegments[segmentIndex] = this.pickAnimatedColor(particle, particle.colorTick + segmentIndex)
    particle.segmentColors = nextSegments
    particle.primaryColor = nextSegments[0]
    particle.secondaryColor = nextSegments[1]
  }

  private pickAnimatedColor(particle: InternalParticleState, tick: number): string {
    if (tick % 3 === 0) {
      return WHITE
    }

    const wave = Math.sin(tick * 1.618 + particle.sparklePhase * 1.43 + particle.drift * 3.1)
    return pickFromPalette(wave * 0.5 + 0.5)
  }
}
