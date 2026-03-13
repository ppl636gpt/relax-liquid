import type { AppSettings } from '../types.ts'

export const DEFAULT_SETTINGS: AppSettings = {
  liquidColor: '#59d7d2',
  liquidOpacity: 35,
  particleCounts: {
    glitter: 4500,
    medium: 1100,
    large: 180,
  },
  particleSpeed: {
    glitter: 1.35,
    medium: 1,
    large: 0.65,
  },
  backgroundMode: 'default',
  customBackgroundId: null,
  audioEnabled: true,
  motionEnabled: false,
}

export function createDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    particleCounts: {
      ...DEFAULT_SETTINGS.particleCounts,
    },
    particleSpeed: {
      ...DEFAULT_SETTINGS.particleSpeed,
    },
  }
}
