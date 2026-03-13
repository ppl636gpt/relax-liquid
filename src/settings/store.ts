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
    audioPitch: typeof saved.audioPitch === 'number' ? saved.audioPitch : DEFAULT_SETTINGS.audioPitch,
    audioPulseRate: typeof saved.audioPulseRate === 'number' ? saved.audioPulseRate : DEFAULT_SETTINGS.audioPulseRate,
  }
}

function decodeImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Не удалось декодировать изображение.'))
    }
    image.src = objectUrl
  })
}

async function resizeImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap | null = null
  let image: HTMLImageElement | null = null

  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      bitmap = null
    }
  }

  if (!bitmap) {
    image = await decodeImageFile(file)
  }

  const sourceWidth = bitmap?.width ?? image?.naturalWidth ?? 0
  const sourceHeight = bitmap?.height ?? image?.naturalHeight ?? 0
  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new Error('Некорректный размер изображения.')
  }

  const maxSide = 2048
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D недоступен для ресайза фона.')
  }

  if (bitmap) {
    context.drawImage(bitmap, 0, 0, width, height)
  } else if (image) {
    context.drawImage(image, 0, 0, width, height)
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result)
          return
        }

        canvas.toBlob(
          (fallback) => {
            if (!fallback) {
              reject(new Error('Не удалось сериализовать фон.'))
              return
            }
            resolve(fallback)
          },
          'image/png',
        )
      },
      'image/jpeg',
      0.92,
    )
  })

  bitmap?.close()
  return blob
}

export class SettingsStore {
  load(): AppSettings {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return createDefaultSettings()
    }

    try {
      return mergeSettings(JSON.parse(raw) as Partial<AppSettings>)
    } catch {
      return createDefaultSettings()
    }
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
