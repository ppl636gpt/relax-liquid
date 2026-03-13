import type { FeedbackAdapter, PlatformCapabilities } from '../types.ts'
import { clamp } from '../utils/math.ts'

type AudioCtor = typeof AudioContext

function getAudioCtor(): AudioCtor | undefined {
  return window.AudioContext || (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext
}

export class WebFeedbackAdapter implements FeedbackAdapter {
  private audioContext?: AudioContext
  private enabled = true
  private audioPitch = 1
  private audioPulseRate = 1
  private nextAudioPulseAt = 0
  private readonly capabilities: PlatformCapabilities

  constructor(capabilities: PlatformCapabilities) {
    this.capabilities = capabilities
  }

  async prime(): Promise<void> {
    if (!this.capabilities.audio) {
      return
    }

    const AudioContextCtor = getAudioCtor()
    if (!AudioContextCtor) {
      return
    }

    this.audioContext ??= new AudioContextCtor()
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  pulse(intensity: number, pointerSpeed = 0): void {
    if (!this.enabled) {
      return
    }

    const safeIntensity = clamp(intensity, 0, 1)

    if (this.capabilities.vibration) {
      navigator.vibrate(Math.round(14 + safeIntensity * 34))
      return
    }

    if (!this.capabilities.audio || !this.audioContext || this.audioContext.state !== 'running' || pointerSpeed <= 0) {
      return
    }

    const nowMs = performance.now()
    const gatedInterval = clamp(240 - this.audioPulseRate * 55 - pointerSpeed * 180, 36, 260)
    if (nowMs < this.nextAudioPulseAt) {
      return
    }
    this.nextAudioPulseAt = nowMs + gatedInterval

    const now = this.audioContext.currentTime
    const gainNode = this.audioContext.createGain()
    const filterNode = this.audioContext.createBiquadFilter()
    const oscillator = this.audioContext.createOscillator()

    filterNode.type = 'bandpass'
    filterNode.frequency.value = 420 + this.audioPitch * 250 + safeIntensity * 120 + pointerSpeed * 160
    filterNode.Q.value = 0.9

    oscillator.type = 'triangle'
    oscillator.frequency.value = 170 + this.audioPitch * 160 + safeIntensity * 110 + pointerSpeed * 140

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.018 + safeIntensity * 0.026, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

    oscillator.connect(filterNode)
    filterNode.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    oscillator.start(now)
    oscillator.stop(now + 0.16)
  }

  setAudioProfile(pitch: number, pulseRate: number): void {
    this.audioPitch = clamp(pitch, 0.5, 2.4)
    this.audioPulseRate = clamp(pulseRate, 0.2, 3.6)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  destroy(): void {
    void this.audioContext?.close()
  }
}
