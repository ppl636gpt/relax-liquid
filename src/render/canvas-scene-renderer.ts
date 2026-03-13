import type { AppSettings, LargeParticleVariant, ParticleState } from '../types.ts'
import { computeCoverRect, hexToNumber, lerp } from '../utils/math.ts'

interface CanvasParticle extends ParticleState {
  variant: LargeParticleVariant
}

interface RenderFrame {
  settings: AppSettings
  particles: readonly CanvasParticle[]
  energy: number
  waves: ReadonlyArray<{
    x: number
    y: number
    radius: number
    strength: number
    life: number
  }>
  time: number
}

export class CanvasSceneRenderer {
  private readonly canvas = document.createElement('canvas')
  private readonly context = this.canvas.getContext('2d')
  private image: HTMLImageElement | null = null
  private width = 1
  private height = 1
  private readonly host: HTMLElement

  constructor(host: HTMLElement) {
    this.host = host
    this.canvas.className = 'scene-canvas'
  }

  mount(): void {
    if (!this.context) {
      throw new Error('Canvas 2D renderer недоступен.')
    }

    this.host.appendChild(this.canvas)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(width * ratio)
    this.canvas.height = Math.round(height * ratio)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  syncParticles(): void {}

  async setBackground(url: string): Promise<void> {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    this.image = image
  }

  render(frame: RenderFrame): void {
    if (!this.context) {
      return
    }

    const context = this.context
    context.clearRect(0, 0, this.width, this.height)

    if (this.image) {
      const rect = computeCoverRect(this.width, this.height, this.image.width, this.image.height)
      context.drawImage(this.image, rect.x, rect.y, rect.width, rect.height)
    }

    const gradient = context.createLinearGradient(0, 0, 0, this.height)
    gradient.addColorStop(0, `${frame.settings.liquidColor}18`)
    gradient.addColorStop(0.5, `${frame.settings.liquidColor}44`)
    gradient.addColorStop(1, `${frame.settings.liquidColor}66`)
    context.globalAlpha = 0.14 + frame.settings.liquidOpacity / 100 * 0.58
    context.fillStyle = gradient
    context.fillRect(0, 0, this.width, this.height)

    context.globalAlpha = 1
    for (const wave of frame.waves) {
      context.strokeStyle = `rgba(255,255,255,${wave.life * (0.08 + wave.strength * 0.12)})`
      context.lineWidth = 2 + wave.strength * 2
      context.beginPath()
      context.ellipse(wave.x, wave.y, wave.radius, wave.radius * 0.6, 0, 0, Math.PI * 2)
      context.stroke()
    }

    for (const particle of frame.particles) {
      const sparkle = 1 + Math.sin(frame.time * (1 + particle.z) + particle.sparklePhase + particle.rotation * 4) * (particle.kind === 'large' ? 0.4 : particle.kind === 'medium' ? 0.2 : 0.06)
      const radius = particle.size * lerp(0.75, 1.2, particle.z) * sparkle
      context.save()
      context.translate(particle.x, particle.y)
      context.rotate(particle.rotation)
      context.globalAlpha = lerp(0.2, 0.95, particle.z) * sparkle
      context.fillStyle = particle.kind === 'glitter' ? 'rgba(255,255,255,0.72)' : particle.kind === 'medium' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.98)'
      if (particle.kind === 'large') {
        if (particle.variant === 'heart') {
          this.drawHeart(context, radius)
        } else {
          this.drawStar(context, radius)
        }
      } else {
        context.beginPath()
        context.arc(0, 0, radius, 0, Math.PI * 2)
        context.fill()
      }
      context.restore()
    }

    context.globalAlpha = 0.04 + Math.min(0.12, frame.energy * 60)
    context.fillStyle = `#${hexToNumber(frame.settings.liquidColor).toString(16).padStart(6, '0')}`
    context.fillRect(0, 0, this.width, this.height)
    context.globalAlpha = 1
  }

  destroy(): void {
    this.canvas.remove()
  }

  getElement(): HTMLElement {
    return this.canvas
  }

  private drawHeart(context: CanvasRenderingContext2D, radius: number): void {
    context.beginPath()
    context.moveTo(0, radius)
    context.bezierCurveTo(-radius * 1.1, radius * 0.2, -radius * 1.2, -radius * 0.7, 0, -radius * 0.2)
    context.bezierCurveTo(radius * 1.2, -radius * 0.7, radius * 1.1, radius * 0.2, 0, radius)
    context.closePath()
    context.fill()
  }

  private drawStar(context: CanvasRenderingContext2D, radius: number): void {
    context.beginPath()
    for (let index = 0; index < 10; index += 1) {
      const currentRadius = index % 2 === 0 ? radius : radius * 0.46
      const angle = index * (Math.PI / 5) - Math.PI / 2
      const x = Math.cos(angle) * currentRadius
      const y = Math.sin(angle) * currentRadius
      if (index === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
    }
    context.closePath()
    context.fill()
  }
}
