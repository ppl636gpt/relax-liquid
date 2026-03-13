import type { AppSettings, ParticleState } from '../types.ts'
import { computeCoverRect, hexToNumber, lerp } from '../utils/math.ts'
import { drawSegmentedShape, getColorZones } from './particle-art.ts'

interface CanvasParticle extends ParticleState {}

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
    gradient.addColorStop(0, `${frame.settings.liquidColor}22`)
    gradient.addColorStop(0.5, `${frame.settings.liquidColor}66`)
    gradient.addColorStop(1, `${frame.settings.liquidColor}a6`)
    context.globalAlpha = 0.06 + Math.min(0.92, frame.settings.liquidOpacity / 400 * 1.08)
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
      const depthScale = lerp(0.75, 1.22, particle.z)
      const radius = particle.size * depthScale
      context.save()
      context.translate(particle.x, particle.y)
      context.rotate(particle.rotation)
      context.scale(particle.scaleX, particle.scaleY)
      context.globalAlpha = 1
      drawSegmentedShape(context, particle.shape, radius, getColorZones(particle))
      context.restore()
    }

    context.globalAlpha = 0.05 + Math.min(0.22, frame.energy * 60)
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
}
