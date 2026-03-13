import type { FeedbackAdapter, PlatformCapabilities } from '../types.ts'
import { clamp } from '../utils/math.ts'

type AudioCtor = typeof AudioContext

function getAudioCtor(): AudioCtor | undefined {
  return window.AudioContext || (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext
}

export class WebFeedbackAdapter implements FeedbackAdapter {
  private audioContext?: AudioContext
  private enabled = true
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

  pulse(intensity: number): void {
    if (!this.enabled) {
      return
    }

    const safeIntensity = clamp(intensity, 0, 1)

    if (this.capabilities.vibration) {
      navigator.vibrate(Math.round(14 + safeIntensity * 34))
      return
    }

    if (!this.capabilities.audio || !this.audioContext || this.audioContext.state !== 'running') {
      return
    }

    const now = this.audioContext.currentTime
    const gainNode = this.audioContext.createGain()
    const filterNode = this.audioContext.createBiquadFilter()
    const oscillator = this.audioContext.createOscillator()

    filterNode.type = 'bandpass'
    filterNode.frequency.value = 540 + safeIntensity * 260
    filterNode.Q.value = 0.85

    oscillator.type = 'triangle'
    oscillator.frequency.value = 220 + safeIntensity * 140

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.03 + safeIntensity * 0.03, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)

    oscillator.connect(filterNode)
    filterNode.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    oscillator.start(now)
    oscillator.stop(now + 0.26)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  destroy(): void {
    void this.audioContext?.close()
  }
}
