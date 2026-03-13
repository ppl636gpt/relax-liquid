import type { AppSettings } from '../types.ts'

export const DEFAULT_SETTINGS: AppSettings = {
  liquidColor: '#79d8dc',
  liquidOpacity: 35,
  particleCounts: {
    glitter: 900,
    medium: 220,
    large: 36,
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
