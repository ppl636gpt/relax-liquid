export type BackgroundMode = 'default' | 'custom'
export type ParticleKind = 'glitter' | 'medium' | 'large'
export type LargeParticleVariant = 'heart' | 'star'

export interface ParticleTuning {
  glitter: number
  medium: number
  large: number
}

export interface AppSettings {
  liquidColor: string
  liquidOpacity: number
  particleCounts: ParticleTuning
  particleSpeed: ParticleTuning
  backgroundMode: BackgroundMode
  customBackgroundId: string | null
  audioEnabled: boolean
  motionEnabled: boolean
}

export interface ParticleState {
  id: number
  kind: ParticleKind
  x: number
  y: number
  z: number
  size: number
  rotation: number
  angularVelocity: number
  settling: number
  response: number
  sparklePhase: number
}

export interface PlatformCapabilities {
  webgl: boolean
  vibration: boolean
  motion: boolean
  audio: boolean
  pointerType: 'touch' | 'mouse' | 'hybrid'
}

export interface FeedbackAdapter {
  prime(): Promise<void>
  pulse(intensity: number): void
  setEnabled(enabled: boolean): void
  destroy(): void
}

export interface MotionAdapter {
  requestAccess(): Promise<boolean>
  start(onShake: (intensity: number) => void): void
  stop(): void
  destroy(): void
}
