import { clamp } from '../utils/math.ts'
import type { PlatformCapabilities } from '../types.ts'

export type TiltCallback = (x: number, y: number) => void

type DeviceMotionPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export class TiltAdapter {
  private active = false
  private onTilt?: TiltCallback
  private lastX = 0
  private lastY = 0
  private smoothX = 0
  private smoothY = 0
  private readonly capabilities: PlatformCapabilities
  private readonly boundMotionHandler: (event: DeviceMotionEvent) => void

  constructor(capabilities: PlatformCapabilities) {
    this.capabilities = capabilities
    this.boundMotionHandler = (event) => this.handleMotionEvent(event)
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

  private handleMotionEvent(event: DeviceMotionEvent): void {
    const acceleration = event.accelerationIncludingGravity
    if (!acceleration) {
      return
    }

    const gX = clamp((acceleration.x ?? 0) / 9.81, -1, 1)
    const gY = clamp((acceleration.y ?? 0) / 9.81, -1, 1)
    const { x: downX, y: downY } = this.mapGravityToScreen(gX, gY)
    this.pushTilt(downX, downY)
  }

  private mapGravityToScreen(gX: number, gY: number): { x: number; y: number } {
    const angle = this.getScreenAngle()

    if (angle === 90) {
      return {
        x: clamp(-gY, -1, 1),
        y: clamp(-gX, -1, 1),
      }
    }

    if (angle === 180) {
      return {
        x: clamp(-gX, -1, 1),
        y: clamp(gY, -1, 1),
      }
    }

    if (angle === 270) {
      return {
        x: clamp(gY, -1, 1),
        y: clamp(gX, -1, 1),
      }
    }

    return {
      x: clamp(gX, -1, 1),
      y: clamp(-gY, -1, 1),
    }
  }

  private getScreenAngle(): 0 | 90 | 180 | 270 {
    const orientationAngle = screen.orientation?.angle
    if (orientationAngle === 0 || orientationAngle === 90 || orientationAngle === 180 || orientationAngle === 270) {
      return orientationAngle
    }

    const legacyAngle = (window as Window & { orientation?: number }).orientation
    if (legacyAngle === 0 || legacyAngle === 90 || legacyAngle === -90 || legacyAngle === 180) {
      if (legacyAngle === -90) {
        return 270
      }
      return legacyAngle
    }

    return 0
  }

  private pushTilt(x: number, y: number): void {
    const alpha = 0.2
    this.smoothX += (x - this.smoothX) * alpha
    this.smoothY += (y - this.smoothY) * alpha

    const filteredX = clamp(this.smoothX, -1, 1)
    const filteredY = clamp(this.smoothY, -1, 1)
    const magnitude = Math.hypot(filteredX, filteredY)

    const downX = magnitude < 0.06 ? 0 : filteredX
    const downY = magnitude < 0.06 ? 0 : filteredY

    const deltaX = Math.abs(downX - this.lastX)
    const deltaY = Math.abs(downY - this.lastY)
    if (deltaX < 0.004 && deltaY < 0.004) {
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
    window.addEventListener('devicemotion', this.boundMotionHandler)
  }

  stop(): void {
    if (!this.active) {
      return
    }

    this.active = false
    this.onTilt = undefined
    window.removeEventListener('devicemotion', this.boundMotionHandler)
    this.lastX = 0
    this.lastY = 0
    this.smoothX = 0
    this.smoothY = 0
  }

  destroy(): void {
    this.stop()
  }
}
