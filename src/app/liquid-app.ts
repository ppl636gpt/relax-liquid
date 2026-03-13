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

interface ValueOutputs {
  liquidOpacity: HTMLOutputElement
  glitterCount: HTMLOutputElement
  mediumCount: HTMLOutputElement
  largeCount: HTMLOutputElement
  glitterSpeed: HTMLOutputElement
  mediumSpeed: HTMLOutputElement
  largeSpeed: HTMLOutputElement
}

interface Controls {
  panel: HTMLElement
  toggleButton: HTMLButtonElement
  status: HTMLElement
  colorSwatches: HTMLButtonElement[]
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
  valueOutputs: ValueOutputs
}

const ALLOWED_SWATCHES = new Set(['#59d7d2', '#7ab8f5', '#f1a5c6', '#ac9bea', '#74c8a1', '#f4c96b'])

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
  private motionActive = false
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
    const magnitude = Math.hypot(x, y)
    if (magnitude < 0.07) {
      this.fluidField.setGravity(0, 0)
      return
    }
    this.fluidField.setGravity(y * 0.003, -x * 0.0032)
  }

  private readonly handleDocumentPointerDown = (event: PointerEvent) => {
    if (!this.controls.panel.classList.contains('is-open')) {
      return
    }

    const target = event.target
    if (!(target instanceof Node)) {
      return
    }

    if (this.controls.panel.contains(target) || this.controls.toggleButton.contains(target)) {
      return
    }

    this.controls.panel.classList.remove('is-open')
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
        if (pressed && force > 0.52) {
          this.feedback.pulse(clamp(force, 0, 1))
        }
      },
      onRelease: () => {},
    })
  }

  async init(): Promise<void> {
    this.settings = this.settingsStore.load()
    const safeColor = this.settings.liquidColor.toLowerCase()
    if (!ALLOWED_SWATCHES.has(safeColor)) {
      this.settings.liquidColor = '#59d7d2'
    } else {
      this.settings.liquidColor = safeColor
    }

    this.settings.motionEnabled = false
    this.motionActive = false

    this.renderer.mount()
    this.applySize()
    this.particleEngine.sync(this.settings)
    this.renderer.syncParticles(this.particleEngine.getParticles())
    this.syncControls()
    this.bindControls()

    await this.loadBackground()
    this.feedback.setEnabled(this.settings.audioEnabled)

    window.addEventListener('resize', this.applySize)
    window.addEventListener('pageshow', this.handlePageShow)
    window.addEventListener('pagehide', this.handlePageHide)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    document.addEventListener('pointerdown', this.handleDocumentPointerDown)

    this.startLoop()
    this.updateStatus()
  }

  destroy(): void {
    this.orientationLock.unlock()
    this.tiltAdapter.destroy()
    this.fluidField.setGravity(0, 0)
    this.pauseScene()
    window.removeEventListener('resize', this.applySize)
    window.removeEventListener('pageshow', this.handlePageShow)
    window.removeEventListener('pagehide', this.handlePageHide)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown)
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

    for (const swatch of this.controls.colorSwatches) {
      const color = swatch.dataset.color?.toLowerCase() ?? ''
      swatch.style.backgroundColor = color
      swatch.addEventListener('click', () => {
        if (!ALLOWED_SWATCHES.has(color)) {
          return
        }
        this.settings.liquidColor = color
        this.updateActiveSwatch()
        this.persist()
      })
    }

    this.controls.liquidOpacity.addEventListener('input', (event) => {
      this.settings.liquidOpacity = Number((event.currentTarget as HTMLInputElement).value)
      this.updateValueOutputs()
      this.persist()
    })

    this.bindNumericControl(this.controls.glitterCount, 'particleCounts', 'glitter', this.controls.valueOutputs.glitterCount)
    this.bindNumericControl(this.controls.mediumCount, 'particleCounts', 'medium', this.controls.valueOutputs.mediumCount)
    this.bindNumericControl(this.controls.largeCount, 'particleCounts', 'large', this.controls.valueOutputs.largeCount)
    this.bindNumericControl(this.controls.glitterSpeed, 'particleSpeed', 'glitter', this.controls.valueOutputs.glitterSpeed)
    this.bindNumericControl(this.controls.mediumSpeed, 'particleSpeed', 'medium', this.controls.valueOutputs.mediumSpeed)
    this.bindNumericControl(this.controls.largeSpeed, 'particleSpeed', 'large', this.controls.valueOutputs.largeSpeed)

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
      const previousMode = this.settings.backgroundMode

      try {
        const id = await this.settingsStore.saveCustomBackground(file)
        this.settings.customBackgroundId = id
        this.settings.backgroundMode = 'custom'
        this.controls.backgroundMode.value = 'custom'
        const applied = await this.loadBackground()
        if (!applied) {
          throw new Error('Фон не применился после загрузки.')
        }
        this.persist()
        if (previousId && previousId !== id) {
          await this.settingsStore.deleteCustomBackground(previousId)
        }
      } catch {
        this.settings.customBackgroundId = previousId
        this.settings.backgroundMode = previousMode
        this.controls.backgroundMode.value = previousMode
        await this.loadBackground()
        this.updateStatus('Не удалось загрузить фон. Возвращён дефолтный режим.')
      } finally {
        input.value = ''
      }
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
      await this.enableMotion(false)
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
    output: HTMLOutputElement,
  ): void {
    element.addEventListener('input', (event) => {
      const target = event.currentTarget as HTMLInputElement
      const numericValue = Number(target.value)
      this.settings[group][key] = numericValue
      output.value = this.formatValue(numericValue)

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
      this.motionActive = false
      this.motion.stop()
      this.tiltAdapter.stop()
      this.fluidField.setGravity(0, 0)
      return false
    }

    const granted = await this.motion.requestAccess()
    if (!granted) {
      this.settings.motionEnabled = false
      this.motionActive = false
      return false
    }

    this.settings.motionEnabled = true
    this.motionActive = true
    this.motion.start((intensity) => {
      this.fluidField.addShake(intensity)
      this.feedback.pulse(0.35 + intensity * 0.5)
    })

    if (await this.tiltAdapter.requestAccess()) {
      this.tiltAdapter.start(this.handleTilt)
    }

    return true
  }

  private async loadBackground(): Promise<boolean> {
    if (this.backgroundObjectUrl) {
      URL.revokeObjectURL(this.backgroundObjectUrl)
      this.backgroundObjectUrl = null
    }

    if (this.settings.backgroundMode === 'custom' && this.settings.customBackgroundId) {
      try {
        const url = await this.settingsStore.getCustomBackgroundUrl(this.settings.customBackgroundId)
        if (url) {
          this.backgroundObjectUrl = url
          await this.renderer.setBackground(url)
          this.updateStatus('Используется ваш фон.')
          return true
        }
      } catch {
        this.updateStatus('Ошибка применения пользовательского фона.')
      }
    }

    this.settings.backgroundMode = 'default'
    this.controls.backgroundMode.value = 'default'
    await this.renderer.setBackground(backgroundUrl)
    this.updateStatus()
    return false
  }

  private persist(): void {
    this.settingsStore.save(this.settings)
    this.updateStatus()
  }

  private syncControls(): void {
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
    this.updateValueOutputs()
    this.updateActiveSwatch()
  }

  private updateValueOutputs(): void {
    const outputs = this.controls.valueOutputs
    outputs.liquidOpacity.value = this.formatValue(this.settings.liquidOpacity)
    outputs.glitterCount.value = this.formatValue(this.settings.particleCounts.glitter)
    outputs.mediumCount.value = this.formatValue(this.settings.particleCounts.medium)
    outputs.largeCount.value = this.formatValue(this.settings.particleCounts.large)
    outputs.glitterSpeed.value = this.formatValue(this.settings.particleSpeed.glitter)
    outputs.mediumSpeed.value = this.formatValue(this.settings.particleSpeed.medium)
    outputs.largeSpeed.value = this.formatValue(this.settings.particleSpeed.large)
  }

  private updateActiveSwatch(): void {
    const activeHex = this.settings.liquidColor.toLowerCase()
    for (const swatch of this.controls.colorSwatches) {
      const swatchColor = swatch.dataset.color?.toLowerCase()
      swatch.classList.toggle('is-active', swatchColor === activeHex)
    }
  }

  private formatValue(value: number): string {
    if (Number.isInteger(value)) {
      return String(value)
    }

    return value.toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')
  }

  private updateStatus(message?: string): void {
    this.controls.status.textContent =
      message ??
      `${this.capabilities.webgl ? 'WebGL' : 'Canvas'} • ${this.capabilities.pointerType} • ${
        this.capabilities.vibration ? 'vibration' : this.capabilities.audio ? 'audio fallback' : 'silent'
      }${this.motionActive ? ' • motion on' : ''}`
  }
}
