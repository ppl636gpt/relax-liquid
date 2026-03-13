import { del, get, set } from 'idb-keyval'

import type { AppSettings } from '../types.ts'
import { DEFAULT_SETTINGS, createDefaultSettings } from './defaults.ts'

const SETTINGS_KEY = 'liquid:settings'
const CUSTOM_BACKGROUND_PREFIX = 'liquid:background:'

function mergeSettings(saved: Partial<AppSettings> | null): AppSettings {
  if (!saved) {
    return createDefaultSettings()
  }

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    particleCounts: {
      ...DEFAULT_SETTINGS.particleCounts,
      ...saved.particleCounts,
    },
    particleSpeed: {
      ...DEFAULT_SETTINGS.particleSpeed,
      ...saved.particleSpeed,
    },
  }
}

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const maxSide = 2048
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D недоступен для ресайза фона.')
  }

  context.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Не удалось сериализовать фон.'))
          return
        }
        resolve(result)
      },
      'image/webp',
      0.92,
    )
  })

  bitmap.close()
  return blob
}

export class SettingsStore {
  load(): AppSettings {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    return mergeSettings(raw ? (JSON.parse(raw) as Partial<AppSettings>) : null)
  }

  save(settings: AppSettings): void {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }

  async saveCustomBackground(file: File): Promise<string> {
    const id = `custom-${Date.now()}`
    const blob = await resizeImage(file)
    await set(`${CUSTOM_BACKGROUND_PREFIX}${id}`, blob)
    return id
  }

  async getCustomBackgroundUrl(id: string | null): Promise<string | null> {
    if (!id) {
      return null
    }

    const blob = await get<Blob>(`${CUSTOM_BACKGROUND_PREFIX}${id}`)
    return blob ? URL.createObjectURL(blob) : null
  }

  async deleteCustomBackground(id: string | null): Promise<void> {
    if (!id) {
      return
    }

    await del(`${CUSTOM_BACKGROUND_PREFIX}${id}`)
  }
}
