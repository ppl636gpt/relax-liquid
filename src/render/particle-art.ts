import type { ParticleKind, ParticleShape, ParticleState } from '../types.ts'

export function getColorZones(particle: Pick<ParticleState, 'kind' | 'primaryColor' | 'secondaryColor' | 'segmentColors'>): string[] {
  if (particle.kind === 'glitter') {
    return [particle.primaryColor]
  }

  if (particle.kind === 'medium') {
    return [particle.primaryColor, particle.secondaryColor]
  }

  const normalizedSegments = particle.segmentColors.length === 5 ? particle.segmentColors : ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff']
  return normalizedSegments
}

export function createParticleTexture(
  kind: ParticleKind,
  shape: ParticleShape,
  colors: string[],
): HTMLCanvasElement {
  const size = kind === 'glitter' ? 48 : kind === 'medium' ? 72 : 136
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D недоступен для генерации текстуры.')
  }

  const radius = size * 0.42
  context.translate(size / 2, size / 2)
  context.shadowColor = 'rgba(255,255,255,0.22)'
  context.shadowBlur = kind === 'large' ? 7 : 4
  drawSegmentedShape(context, shape, radius, colors)

  return canvas
}

export function drawSegmentedShape(
  context: CanvasRenderingContext2D,
  shape: ParticleShape,
  radius: number,
  colors: string[],
): void {
  if (colors.length <= 1) {
    context.fillStyle = colors[0] ?? '#ffffff'
    drawShapePath(context, shape, radius)
    context.fill()
    return
  }

  context.save()
  drawShapePath(context, shape, radius)
  context.clip()

  if (colors.length === 2) {
    context.fillStyle = colors[0]
    context.fillRect(-radius * 1.2, -radius * 1.2, radius * 1.2, radius * 2.4)
    context.fillStyle = colors[1]
    context.fillRect(0, -radius * 1.2, radius * 1.2, radius * 2.4)
    context.restore()
    return
  }

  const segmentCount = colors.length
  for (let index = 0; index < segmentCount; index += 1) {
    const start = -Math.PI / 2 + (index / segmentCount) * Math.PI * 2
    const end = -Math.PI / 2 + ((index + 1) / segmentCount) * Math.PI * 2
    context.beginPath()
    context.moveTo(0, 0)
    context.arc(0, 0, radius * 2.2, start, end)
    context.closePath()
    context.fillStyle = colors[index]
    context.fill()
  }

  context.restore()
}

export function drawShapePath(context: CanvasRenderingContext2D, shape: ParticleShape, radius: number): void {
  if (shape === 'circle') {
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.closePath()
    return
  }

  if (shape === 'square') {
    context.beginPath()
    context.rect(-radius, -radius, radius * 2, radius * 2)
    context.closePath()
    return
  }

  if (shape === 'heart') {
    drawHeartPath(context, radius)
    return
  }

  if (shape === 'star6') {
    drawStarPath(context, 6, radius, radius * 0.52)
    return
  }

  drawStarPath(context, 5, radius, radius * 0.48)
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
