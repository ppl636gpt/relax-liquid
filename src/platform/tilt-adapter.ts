import { clamp } from '../utils/math.ts'
import type { PlatformCapabilities } from '../types.ts'

export type TiltCallback = (x: number, y: number) => void

type DeviceOrientationPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export class TiltAdapter {
  private active = false
  private onTilt?: TiltCallback
  private lastX = 0
  private lastY = 0
  private readonly boundHandler: (event: DeviceOrientationEvent) => void
  private readonly capabilities: PlatformCapabilities

  constructor(capabilities: PlatformCapabilities) {
    this.capabilities = capabilities
    this.boundHandler = (event) => this.handleEvent(event)
  }

  async requestAccess(): Promise<boolean> {
    if (!this.capabilities.motion) {
      return false
    }

    const OrientationCtor = DeviceOrientationEvent as DeviceOrientationPermission
    if (typeof OrientationCtor.requestPermission === 'function') {
      const result = await OrientationCtor.requestPermission()
      return result === 'granted'
    }

    return true
  }

  private handleEvent(event: DeviceOrientationEvent): void {
    const gamma = clamp((event.gamma ?? 0) / 45, -1, 1)
    const beta = clamp((event.beta ?? 0) / 45, -1, 1)
    const deltaX = Math.abs(gamma - this.lastX)
    const deltaY = Math.abs(beta - this.lastY)
    if (deltaX < 0.005 && deltaY < 0.005) {
      return
    }

    this.lastX = gamma
    this.lastY = beta
    this.onTilt?.(gamma, beta)
  }

  start(onTilt: TiltCallback): void {
    if (this.active || !this.capabilities.motion) {
      return
    }

    this.active = true
    this.onTilt = onTilt
    window.addEventListener('deviceorientation', this.boundHandler)
  }

  stop(): void {
    if (!this.active) {
      return
    }

    this.active = false
    this.onTilt = undefined
    window.removeEventListener('deviceorientation', this.boundHandler)
    this.lastX = 0
    this.lastY = 0
  }

  destroy(): void {
    this.stop()
  }
}
