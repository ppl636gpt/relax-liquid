export interface CoverRect {
  width: number
  height: number
  x: number
  y: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16)
}

export function createSeededRandom(seed: string): () => number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  let state = hash >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function computeCoverRect(
  frameWidth: number,
  frameHeight: number,
  assetWidth: number,
  assetHeight: number,
): CoverRect {
  const frameRatio = frameWidth / frameHeight
  const assetRatio = assetWidth / assetHeight

  if (assetRatio > frameRatio) {
    const height = frameHeight
    const width = height * assetRatio
    return {
      width,
      height,
      x: (frameWidth - width) * 0.5,
      y: 0,
    }
  }

  const width = frameWidth
  const height = width / assetRatio
  return {
    width,
    height,
    x: 0,
    y: (frameHeight - height) * 0.5,
  }
}
