import type { AppSettings, LargeParticleVariant, ParticleKind, ParticleState } from '../types.ts'
import { createSeededRandom, lerp } from '../utils/math.ts'
import type { FluidField } from './fluid-field.ts'

interface InternalParticleState extends ParticleState {
  variant: LargeParticleVariant
  vx: number
  vy: number
  drift: number
}

const KIND_ORDER: ParticleKind[] = ['glitter', 'medium', 'large']

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
        (fieldSample.y * particle.response * kindSpeed + particle.settling * flowScale + noiseY + particle.drift * 0.004) * flowScale * 0.82

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

      if (particle.kind === 'large') {
        particle.rotation += particle.angularVelocity * flowScale + particle.vx * 0.0005
      } else if (particle.kind === 'medium') {
        particle.rotation += particle.angularVelocity * flowScale * 0.35
      }
    }
  }

  getParticles(): readonly InternalParticleState[] {
    return this.orderedParticles
  }

  private createParticle(kind: ParticleKind, index: number): InternalParticleState {
    const random = createSeededRandom(`${kind}-${index}`)
    const z = random()
    const baseSize =
      kind === 'glitter'
        ? lerp(0.9, 2.1, random())
        : kind === 'medium'
          ? lerp(2.8, 6.6, random())
          : lerp(14, 28, random())

    return {
      id: this.nextId++,
      kind,
      x: random() * this.width,
      y: random() * this.height,
      z,
      size: baseSize,
      rotation: random() * Math.PI * 2,
      angularVelocity: kind === 'large' ? lerp(-0.014, 0.014, random()) : lerp(-0.004, 0.004, random()),
      settling: kind === 'glitter' ? lerp(0.006, 0.012, random()) : kind === 'medium' ? lerp(0.01, 0.021, random()) : lerp(0.02, 0.032, random()),
      response: kind === 'glitter' ? lerp(1.1, 1.35, random()) : kind === 'medium' ? lerp(0.76, 0.96, random()) : lerp(0.42, 0.64, random()),
      sparklePhase: random() * Math.PI * 2,
      variant: index % 2 === 0 ? 'star' : 'heart',
      vx: (random() - 0.5) * 0.4,
      vy: (random() - 0.5) * 0.2,
      drift: random() - 0.5,
    }
  }
}
