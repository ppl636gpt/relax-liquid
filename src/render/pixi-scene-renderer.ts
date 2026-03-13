import {
  Application,
  BlurFilter,
  Container,
  Graphics,
  Sprite,
  Texture,
  TilingSprite,
} from 'pixi.js'

import type { AppSettings, ParticleState } from '../types.ts'
import { computeCoverRect, hexToNumber, lerp } from '../utils/math.ts'
import { createLiquidBaseTexture, createParticleTexture, createShimmerTexture } from './particle-art.ts'

interface PixiParticle extends ParticleState {}

export interface RenderFrame {
  settings: AppSettings
  particles: readonly PixiParticle[]
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

export class PixiSceneRenderer {
  private readonly app: Application

  private readonly stageRoot = new Container()
  private readonly backgroundLayer = new Container()
  private readonly liquidLayer = new Container()
  private readonly particleLayer = new Container()
  private readonly highlightLayer = new Container()
  private readonly backgroundSprite = new Sprite(Texture.WHITE)
  private readonly tintSprite = new Sprite(Texture.from(createLiquidBaseTexture()))
  private readonly shimmerSprite = new TilingSprite(Texture.from(createShimmerTexture()), 1, 1)
  private readonly rippleGraphics = new Graphics()
  private readonly glossGraphics = new Graphics()
  private readonly particleSprites = new Map<number, Sprite>()
  private readonly particleTextureSignatures = new Map<number, string>()
  private readonly generatedTextures = new Map<string, Texture>()

  private viewportWidth = 1
  private viewportHeight = 1
  private readonly host: HTMLElement

  constructor(host: HTMLElement) {
    this.host = host
    this.app = new Application({
      antialias: true,
      autoDensity: true,
      backgroundAlpha: 0,
      autoStart: false,
      resizeTo: host,
    })
    this.rippleGraphics.filters = [new BlurFilter(18, 6)]
    this.glossGraphics.filters = [new BlurFilter(24, 6)]
  }

  mount(): void {
    this.host.appendChild(this.app.view as HTMLCanvasElement)
    this.app.stage.addChild(this.stageRoot)
    this.stageRoot.addChild(this.backgroundLayer, this.liquidLayer, this.particleLayer, this.highlightLayer)

    this.backgroundSprite.alpha = 1
    this.backgroundLayer.addChild(this.backgroundSprite)

    this.tintSprite.alpha = 0.28
    this.liquidLayer.addChild(this.tintSprite, this.shimmerSprite)
    this.highlightLayer.addChild(this.rippleGraphics, this.glossGraphics)
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width
    this.viewportHeight = height
    this.shimmerSprite.width = width
    this.shimmerSprite.height = height
    this.tintSprite.width = width
    this.tintSprite.height = height
    this.layoutBackground()
  }

  syncParticles(particles: readonly PixiParticle[]): void {
    const ids = new Set(particles.map((particle) => particle.id))

    for (const [id, sprite] of this.particleSprites) {
      if (!ids.has(id)) {
        sprite.destroy()
        this.particleSprites.delete(id)
        this.particleTextureSignatures.delete(id)
      }
    }

    for (const particle of particles) {
      if (this.particleSprites.has(particle.id)) {
        continue
      }

      const sprite = new Sprite(Texture.WHITE)
      sprite.anchor.set(0.5)
      sprite.alpha = 1
      this.particleLayer.addChild(sprite)
      this.particleSprites.set(particle.id, sprite)
    }
  }

  async setBackground(url: string): Promise<void> {
    this.backgroundSprite.texture = Texture.from(url)
    if (this.backgroundSprite.texture.baseTexture.valid) {
      this.layoutBackground()
      return
    }

    await new Promise<void>((resolve) => {
      this.backgroundSprite.texture.baseTexture.once('loaded', () => {
        this.layoutBackground()
        resolve()
      })
    })
  }

  render(frame: RenderFrame): void {
    this.tintSprite.tint = hexToNumber(frame.settings.liquidColor)
    this.tintSprite.alpha = 0.04 + Math.min(0.9, frame.settings.liquidOpacity / 400 * 1.08)

    this.shimmerSprite.tilePosition.x += 0.18 + frame.energy * 44
    this.shimmerSprite.tilePosition.y += 0.08 + frame.energy * 26
    this.shimmerSprite.alpha = 0.08 + Math.min(0.14, frame.energy * 54)

    for (const particle of frame.particles) {
      const sprite = this.particleSprites.get(particle.id)
      if (!sprite) {
        continue
      }

      const signature = `${particle.kind}:${particle.shape}:${particle.color}`
      const previousSignature = this.particleTextureSignatures.get(particle.id)
      if (signature !== previousSignature) {
        sprite.texture = this.getTexture(signature, particle.kind, particle.shape, particle.color)
        this.particleTextureSignatures.set(particle.id, signature)
      }

      const depthScale = lerp(0.76, 1.24, particle.z)
      const baseScale = (particle.size / Math.max(sprite.texture.width, sprite.texture.height)) * depthScale
      sprite.position.set(particle.x, particle.y)
      sprite.rotation = particle.rotation
      sprite.scale.set(baseScale * particle.scaleX, baseScale * particle.scaleY)
      sprite.alpha = 1
      sprite.tint = 0xffffff
    }

    this.rippleGraphics.clear()
    this.glossGraphics.clear()

    for (const wave of frame.waves) {
      const alpha = wave.life * (0.05 + wave.strength * 0.14)
      this.rippleGraphics.lineStyle(2 + wave.strength * 2, 0xffffff, alpha)
      this.rippleGraphics.drawCircle(wave.x, wave.y, wave.radius)

      this.glossGraphics.beginFill(0xffffff, alpha * 0.28)
      this.glossGraphics.drawEllipse(wave.x, wave.y - wave.radius * 0.08, wave.radius * 0.52, wave.radius * 0.16)
      this.glossGraphics.endFill()
    }

    this.app.render()
  }

  destroy(): void {
    for (const texture of this.generatedTextures.values()) {
      texture.destroy(true)
    }
    this.generatedTextures.clear()

    this.app.destroy(true, { children: true, texture: false, baseTexture: false })
  }

  getElement(): HTMLElement {
    return this.app.view as HTMLCanvasElement
  }

  private layoutBackground(): void {
    const texture = this.backgroundSprite.texture
    const assetWidth = texture.baseTexture.realWidth || 1024
    const assetHeight = texture.baseTexture.realHeight || 1536
    const rect = computeCoverRect(this.viewportWidth, this.viewportHeight, assetWidth, assetHeight)
    this.backgroundSprite.width = rect.width
    this.backgroundSprite.height = rect.height
    this.backgroundSprite.position.set(rect.x, rect.y)
  }

  private getTexture(signature: string, kind: PixiParticle['kind'], shape: PixiParticle['shape'], color: string): Texture {
    const cached = this.generatedTextures.get(signature)
    if (cached) {
      return cached
    }

    const texture = Texture.from(createParticleTexture(kind, shape, color))
    this.generatedTextures.set(signature, texture)
    return texture
  }
}
