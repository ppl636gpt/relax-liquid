import backgroundUrl from '../assets/daisy-background.png'
import { InputController } from '../input/input-controller.ts'
import { detectCapabilities } from '../platform/capabilities.ts'
import { WebFeedbackAdapter } from '../platform/feedback.ts'
import { WebMotionAdapter } from '../platform/motion.ts'
import { OrientationLock } from '../platform/orientation-lock.ts'
import { TiltAdapter } from '../platform/tilt-adapter.ts'
import { FluidField } from '../render/fluid-field.ts'
import { ParticleEngine } from '../render/particle-engine.ts'
import { CanvasSceneRenderer } from '../render/canvas-scene-renderer.ts'
import { PixiSceneRenderer } from '../render/pixi-scene-renderer.ts'
import { createDefaultSettings } from '../settings/defaults.ts'
import { SettingsStore } from '../settings/store.ts'
import type { AppSettings } from '../types.ts'
import { clamp } from '../utils/math.ts'

type SceneRenderer = CanvasSceneRenderer | PixiSceneRenderer

interface Controls {
  panel: HTMLElement
  toggleButton: HTMLButtonElement
  status: HTMLElement
  liquidColor: HTMLInputElement
  liquidOpacity: HTMLInputElement
  glitterCount: HTMLInputElement
  mediumCount: HTMLInputElement
  largeCount: HTMLInputElement
  glitterSpeed: HTMLInputElement
  mediumSpeed: HTMLInputElement
  largeSpeed: HTMLInputElement
  backgroundMode: HTMLSelectElement
  backgroundUpload: HTMLInputElement
  resetButton: HTMLButtonElement
  audioEnabled: HTMLInputElement
  motionEnabled: HTMLInputElement
}

export class LiquidApp {
  private readonly capabilities = detectCapabilities()
  private readonly settingsStore = new SettingsStore()
  private readonly feedback = new WebFeedbackAdapter(this.capabilities)
  private readonly motion = new WebMotionAdapter(this.capabilities)
  private readonly orientationLock = new OrientationLock()
  private readonly tiltAdapter = new TiltAdapter(this.capabilities)
  private readonly fluidField = new FluidField()
  private readonly particleEngine = new ParticleEngine()
  private readonly renderer: SceneRenderer
  private readonly input: InputController

  private settings: AppSettings = createDefaultSettings()
  private frameHandle = 0
  private lastFrame = 0
  private loopTime = 0
  private loopRunning = false
  private backgroundObjectUrl: string | null = null
  private readonly sceneHost: HTMLElement
  private readonly controls: Controls

  private readonly handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted || document.visibilityState === 'visible') {
      void this.orientationLock.requestLock()
      this.resumeScene()
    }
  }

  private readonly handlePageHide = () => {
    this.orientationLock.unlock()
    this.pauseScene()
  }

  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void this.orientationLock.requestLock()
      this.resumeScene()
    } else {
      this.pauseScene()
    }
  }

  private readonly handlePrime = async () => {
    await this.feedback.prime()
    void this.orientationLock.requestLock()
  }

  private readonly handleTilt = (x: number, y: number) => {
    this.fluidField.setTiltBias(x * -0.62, y * 0.35)
  }

  constructor(
    sceneHost: HTMLElement,
    controls: Controls,
  ) {
    this.sceneHost = sceneHost
    this.controls = controls
    this.renderer = this.capabilities.webgl ? new PixiSceneRenderer(sceneHost) : new CanvasSceneRenderer(sceneHost)
    this.input = new InputController(sceneHost, {
      onPrime: this.handlePrime,
      onInteraction: ({ x, y, dx, dy, force, pressed }) => {
        this.fluidField.addImpulse(x, y, dx, dy, force)
        if (pressed && force > 0.64) {
          this.feedback.pulse(clamp(force, 0, 1))
        }
      },
      onRelease: () => {
        this.feedback.pulse(0.18)
      },
    })
  }

  async init(): Promise<void> {
    this.settings = this.settingsStore.load()
    this.renderer.mount()
    this.applySize()
    this.particleEngine.sync(this.settings)
    this.renderer.syncParticles(this.particleEngine.getParticles())
    this.syncControls()
    this.bindControls()

    await this.loadBackground()
    this.feedback.setEnabled(this.settings.audioEnabled)

    if (this.settings.motionEnabled) {
      await this.enableMotion(true)
    }

    window.addEventListener('resize', this.applySize)
    window.addEventListener('pageshow', this.handlePageShow)
    window.addEventListener('pagehide', this.handlePageHide)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.startLoop()
    this.updateStatus()
  }

  destroy(): void {
    this.orientationLock.unlock()
    this.tiltAdapter.destroy()
    this.fluidField.setTiltBias(0, 0)
    this.pauseScene()
    window.removeEventListener('resize', this.applySize)
    window.removeEventListener('pageshow', this.handlePageShow)
    window.removeEventListener('pagehide', this.handlePageHide)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.input.destroy()
    this.motion.destroy()
    this.feedback.destroy()
    this.renderer.destroy()
    if (this.backgroundObjectUrl) {
      URL.revokeObjectURL(this.backgroundObjectUrl)
    }
  }

  private readonly applySize = () => {
    const width = this.sceneHost.clientWidth
    const height = this.sceneHost.clientHeight
    this.fluidField.resize(width, height)
    this.particleEngine.setViewport(width, height)
    this.renderer.resize(width, height)
  }

  private startLoop(): void {
    if (this.loopRunning) {
      return
    }

    this.loopRunning = true
    const tick = (timestamp: number) => {
      if (!this.lastFrame) {
        this.lastFrame = timestamp
      }

      const dt = clamp((timestamp - this.lastFrame) / 1000, 1 / 120, 1 / 24)
      this.lastFrame = timestamp
      this.loopTime += dt

      this.fluidField.step(dt)
      this.particleEngine.update(dt, this.fluidField, this.settings, this.loopTime)

      this.renderer.render({
        settings: this.settings,
        particles: this.particleEngine.getParticles(),
        energy: this.fluidField.getEnergy(),
        waves: this.fluidField.getWaves(),
        time: this.loopTime,
      })

      this.frameHandle = requestAnimationFrame(tick)
    }

    this.frameHandle = requestAnimationFrame(tick)
  }

  private stopLoop(): void {
    if (!this.loopRunning) {
      return
    }

    cancelAnimationFrame(this.frameHandle)
    this.frameHandle = 0
    this.loopRunning = false
    this.lastFrame = 0
  }

  private resumeScene(): void {
    this.applySize()
    this.renderer.resize(this.sceneHost.clientWidth, this.sceneHost.clientHeight)
    this.particleEngine.setViewport(this.sceneHost.clientWidth, this.sceneHost.clientHeight)
    this.lastFrame = 0
    this.stopLoop()
    this.startLoop()
  }

  private pauseScene(): void {
    this.stopLoop()
  }

  private bindControls(): void {
    this.controls.toggleButton.addEventListener('click', () => {
      this.controls.panel.classList.toggle('is-open')
    })

    this.controls.liquidColor.addEventListener('input', (event) => {
      this.settings.liquidColor = (event.currentTarget as HTMLInputElement).value
      this.persist()
    })

    this.controls.liquidOpacity.addEventListener('input', (event) => {
      this.settings.liquidOpacity = Number((event.currentTarget as HTMLInputElement).value)
      this.persist()
    })

    this.bindNumericControl(this.controls.glitterCount, 'particleCounts', 'glitter')
    this.bindNumericControl(this.controls.mediumCount, 'particleCounts', 'medium')
    this.bindNumericControl(this.controls.largeCount, 'particleCounts', 'large')
    this.bindNumericControl(this.controls.glitterSpeed, 'particleSpeed', 'glitter')
    this.bindNumericControl(this.controls.mediumSpeed, 'particleSpeed', 'medium')
    this.bindNumericControl(this.controls.largeSpeed, 'particleSpeed', 'large')

    this.controls.backgroundMode.addEventListener('change', async (event) => {
      this.settings.backgroundMode = (event.currentTarget as HTMLSelectElement).value as AppSettings['backgroundMode']
      await this.loadBackground()
      this.persist()
    })

    this.controls.backgroundUpload.addEventListener('change', async (event) => {
      const input = event.currentTarget as HTMLInputElement
      const file = input.files?.[0]
      if (!file) {
        return
      }

      const previousId = this.settings.customBackgroundId
      const id = await this.settingsStore.saveCustomBackground(file)
      this.settings.customBackgroundId = id
      this.settings.backgroundMode = 'custom'
      this.controls.backgroundMode.value = 'custom'
      await this.loadBackground()
      this.persist()
      if (previousId && previousId !== id) {
        await this.settingsStore.deleteCustomBackground(previousId)
      }
      input.value = ''
    })

    this.controls.resetButton.addEventListener('click', async () => {
      const previousBackground = this.settings.customBackgroundId
      this.settings = createDefaultSettings()
      this.settings.backgroundMode = 'default'
      this.settings.customBackgroundId = null
      this.syncControls()
      await this.loadBackground()
      if (previousBackground) {
        await this.settingsStore.deleteCustomBackground(previousBackground)
      }
      this.particleEngine.sync(this.settings)
      this.renderer.syncParticles(this.particleEngine.getParticles())
      this.feedback.setEnabled(this.settings.audioEnabled)
      this.motion.stop()
      this.tiltAdapter.stop()
      this.fluidField.setTiltBias(0, 0)
      this.persist()
      this.updateStatus()
    })

    this.controls.audioEnabled.addEventListener('change', (event) => {
      this.settings.audioEnabled = (event.currentTarget as HTMLInputElement).checked
      this.feedback.setEnabled(this.settings.audioEnabled)
      this.persist()
    })

    this.controls.motionEnabled.addEventListener('change', async (event) => {
      const enabled = (event.currentTarget as HTMLInputElement).checked
      const applied = await this.enableMotion(enabled)
      this.controls.motionEnabled.checked = applied
      this.persist()
      this.updateStatus()
    })
  }

  private bindNumericControl(
    element: HTMLInputElement,
    group: 'particleCounts' | 'particleSpeed',
    key: 'glitter' | 'medium' | 'large',
  ): void {
    element.addEventListener('input', (event) => {
      const target = event.currentTarget as HTMLInputElement
      const numericValue = Number(target.value)
      this.settings[group][key] = numericValue

      if (group === 'particleCounts') {
        this.particleEngine.sync(this.settings)
        this.renderer.syncParticles(this.particleEngine.getParticles())
      }

      this.persist()
    })
  }

  private async enableMotion(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      this.settings.motionEnabled = false
      this.motion.stop()
      this.tiltAdapter.stop()
      this.fluidField.setTiltBias(0, 0)
      return false
    }

    const granted = await this.motion.requestAccess()
    if (!granted) {
      this.settings.motionEnabled = false
      return false
    }

    this.settings.motionEnabled = true
    this.motion.start((intensity) => {
      this.fluidField.addShake(intensity)
      this.feedback.pulse(0.35 + intensity * 0.5)
    })

    if (await this.tiltAdapter.requestAccess()) {
      this.tiltAdapter.start(this.handleTilt)
    }

    return true
  }

  private async loadBackground(): Promise<void> {
    if (this.backgroundObjectUrl) {
      URL.revokeObjectURL(this.backgroundObjectUrl)
      this.backgroundObjectUrl = null
    }

    if (this.settings.backgroundMode === 'custom' && this.settings.customBackgroundId) {
      const url = await this.settingsStore.getCustomBackgroundUrl(this.settings.customBackgroundId)
      if (url) {
        this.backgroundObjectUrl = url
        await this.renderer.setBackground(url)
        this.updateStatus('Используется ваш фон.')
        return
      }
    }

    this.settings.backgroundMode = 'default'
    await this.renderer.setBackground(backgroundUrl)
    this.updateStatus()
  }

  private persist(): void {
    this.settingsStore.save(this.settings)
    this.updateStatus()
  }

  private syncControls(): void {
    this.controls.liquidColor.value = this.settings.liquidColor
    this.controls.liquidOpacity.value = String(this.settings.liquidOpacity)
    this.controls.glitterCount.value = String(this.settings.particleCounts.glitter)
    this.controls.mediumCount.value = String(this.settings.particleCounts.medium)
    this.controls.largeCount.value = String(this.settings.particleCounts.large)
    this.controls.glitterSpeed.value = String(this.settings.particleSpeed.glitter)
    this.controls.mediumSpeed.value = String(this.settings.particleSpeed.medium)
    this.controls.largeSpeed.value = String(this.settings.particleSpeed.large)
    this.controls.backgroundMode.value = this.settings.backgroundMode
    this.controls.audioEnabled.checked = this.settings.audioEnabled
    this.controls.motionEnabled.checked = this.settings.motionEnabled
  }

  private updateStatus(message?: string): void {
    this.controls.status.textContent =
      message ??
      `${this.capabilities.webgl ? 'WebGL' : 'Canvas'} • ${this.capabilities.pointerType} • ${
        this.capabilities.vibration ? 'vibration' : this.capabilities.audio ? 'audio' : 'silent'
      }${this.settings.motionEnabled ? ' • motion on' : ''}`
  }
}
