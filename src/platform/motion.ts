import type { MotionAdapter, PlatformCapabilities } from '../types.ts'
import { clamp } from '../utils/math.ts'

type DeviceMotionPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export class WebMotionAdapter implements MotionAdapter {
  private active = false
  private onShake?: (intensity: number) => void
  private lastMagnitude = 0
  private cooldownUntil = 0
  private readonly capabilities: PlatformCapabilities
  private readonly handler = (event: DeviceMotionEvent) => {
    const acceleration = event.accelerationIncludingGravity
    if (!acceleration) {
      return
    }

    const magnitude = Math.sqrt(
      (acceleration.x ?? 0) ** 2 +
        (acceleration.y ?? 0) ** 2 +
        (acceleration.z ?? 0) ** 2,
    )

    const delta = Math.abs(magnitude - this.lastMagnitude)
    this.lastMagnitude = magnitude

    const now = performance.now()
    if (delta > 12.5 && now > this.cooldownUntil) {
      this.cooldownUntil = now + 650
      this.onShake?.(clamp((delta - 12.5) / 18, 0, 1))
    }
  }

  constructor(capabilities: PlatformCapabilities) {
    this.capabilities = capabilities
  }

  async requestAccess(): Promise<boolean> {
    if (!this.capabilities.motion) {
      return false
    }

    const MotionCtor = DeviceMotionEvent as DeviceMotionPermission
    if (typeof MotionCtor.requestPermission === 'function') {
      const result = await MotionCtor.requestPermission()
      return result === 'granted'
    }

    return true
  }

  start(onShake: (intensity: number) => void): void {
    if (this.active || !this.capabilities.motion) {
      return
    }

    this.onShake = onShake
    this.active = true
    window.addEventListener('devicemotion', this.handler)
  }

  stop(): void {
    if (!this.active) {
      return
    }

    this.active = false
    window.removeEventListener('devicemotion', this.handler)
  }

  destroy(): void {
    this.stop()
  }
}
