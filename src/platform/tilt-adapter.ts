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
    const gammaRad = (event.gamma ?? 0) * (Math.PI / 180)
    const betaRad = (event.beta ?? 0) * (Math.PI / 180)
    const downX = clamp(Math.sin(gammaRad), -1, 1)
    const downY = clamp(Math.sin(betaRad), -1, 1)
    const deltaX = Math.abs(downX - this.lastX)
    const deltaY = Math.abs(downY - this.lastY)
    if (deltaX < 0.005 && deltaY < 0.005) {
      return
    }

    this.lastX = downX
    this.lastY = downY
    this.onTilt?.(downX, downY)
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
