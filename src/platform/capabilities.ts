import type { PlatformCapabilities } from '../types.ts'

export function detectCapabilities(): PlatformCapabilities {
  const canvas = document.createElement('canvas')
  const hasWebGL =
    Boolean(canvas.getContext('webgl2')) || Boolean(canvas.getContext('webgl')) || Boolean(canvas.getContext('experimental-webgl'))
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const fine = window.matchMedia('(pointer: fine)').matches

  return {
    webgl: hasWebGL,
    vibration: typeof navigator.vibrate === 'function',
    motion: typeof DeviceMotionEvent !== 'undefined',
    audio: Boolean(window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext),
    pointerType: coarse && fine ? 'hybrid' : coarse ? 'touch' : 'mouse',
  }
}
