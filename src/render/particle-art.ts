import type { LargeParticleVariant, ParticleKind } from '../types.ts'

export function createParticleTexture(kind: ParticleKind, variant: LargeParticleVariant = 'star'): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const size = kind === 'large' ? 96 : kind === 'medium' ? 48 : 24
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D недоступен для генерации текстуры.')
  }

  const center = size / 2

  if (kind === 'glitter') {
    const gradient = context.createRadialGradient(center, center, 0, center, center, center)
    gradient.addColorStop(0, 'rgba(255,255,255,0.85)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.34)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(center, center, center * 0.9, 0, Math.PI * 2)
    context.fill()
    return canvas
  }

  if (kind === 'medium') {
    const gradient = context.createRadialGradient(center * 0.82, center * 0.82, 0, center, center, center)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.92)')
    gradient.addColorStop(0.7, 'rgba(212, 252, 255, 0.52)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(center, center, center * 0.92, 0, Math.PI * 2)
    context.fill()
    return canvas
  }

  context.translate(center, center)
  context.shadowColor = 'rgba(255,255,255,0.38)'
  context.shadowBlur = 18
  context.fillStyle = 'rgba(255,255,255,0.95)'

  if (variant === 'heart') {
    drawHeartPath(context, center * 0.68)
  } else {
    drawStarPath(context, 5, center * 0.72, center * 0.33)
  }

  context.fill()
  context.shadowBlur = 0
  context.globalCompositeOperation = 'lighter'
  context.fillStyle = 'rgba(189, 245, 255, 0.42)'
  context.beginPath()
  context.arc(-center * 0.08, -center * 0.14, center * 0.18, 0, Math.PI * 2)
  context.fill()

  return canvas
}

export function createLiquidBaseTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D недоступен для генерации жидкой текстуры.')
  }

  const gradient = context.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.18)')
  gradient.addColorStop(1, 'rgba(255,255,255,0.58)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 512, 512)

  for (let index = 0; index < 22; index += 1) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const radius = 28 + Math.random() * 80
    const bubble = context.createRadialGradient(x, y, 0, x, y, radius)
    bubble.addColorStop(0, 'rgba(255,255,255,0.28)')
    bubble.addColorStop(0.8, 'rgba(255,255,255,0.02)')
    bubble.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = bubble
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }

  return canvas
}

export function createShimmerTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D недоступен для генерации шиммера.')
  }

  context.fillStyle = 'rgba(255,255,255,0)'
  context.fillRect(0, 0, 256, 256)

  for (let index = 0; index < 120; index += 1) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const radius = 2 + Math.random() * 10
    const alpha = 0.02 + Math.random() * 0.08
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }

  return canvas
}

function drawHeartPath(context: CanvasRenderingContext2D, size: number): void {
  context.beginPath()
  context.moveTo(0, size * 0.92)
  context.bezierCurveTo(-size * 1.08, size * 0.2, -size * 1.12, -size * 0.72, 0, -size * 0.2)
  context.bezierCurveTo(size * 1.12, -size * 0.72, size * 1.08, size * 0.2, 0, size * 0.92)
  context.closePath()
}

function drawStarPath(
  context: CanvasRenderingContext2D,
  points: number,
  outerRadius: number,
  innerRadius: number,
): void {
  const angleStep = Math.PI / points
  context.beginPath()

  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = index * angleStep - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) {
      context.moveTo(x, y)
    } else {
      context.lineTo(x, y)
    }
  }

  context.closePath()
}
