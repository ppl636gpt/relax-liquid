import './style.css'

import { registerSW } from 'virtual:pwa-register'

import { LiquidApp } from './app/liquid-app.ts'

const appRoot = document.querySelector<HTMLDivElement>('#app')

if (!appRoot) {
  throw new Error('Root container #app не найден.')
}

appRoot.innerHTML = `
  <div class="shell">
    <div class="scene-shell">
      <div class="scene-host" id="scene-host"></div>

      <button class="settings-toggle" id="settings-toggle" type="button" aria-label="Открыть настройки">
        liquid
      </button>

      <aside class="settings-panel" id="settings-panel" aria-label="Настройки жидкости">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Liquid Garden</p>
            <h1>Вязкая жидкость</h1>
          </div>
          <p class="status" id="status-line"></p>
        </div>

        <label class="field">
          <span>Цвет жидкости</span>
          <input id="liquid-color" type="color" value="#79d8dc" />
        </label>

        <label class="field">
          <span>Прозрачность</span>
          <input id="liquid-opacity" type="range" min="0" max="100" step="1" value="35" />
        </label>

        <div class="field-group">
          <label class="field">
            <span>Глиттер</span>
            <input id="glitter-count" type="range" min="120" max="1400" step="20" value="900" />
          </label>
          <label class="field">
            <span>Скорость глиттера</span>
            <input id="glitter-speed" type="range" min="0.4" max="2" step="0.05" value="1.35" />
          </label>
        </div>

        <div class="field-group">
          <label class="field">
            <span>Средние частицы</span>
            <input id="medium-count" type="range" min="40" max="420" step="10" value="220" />
          </label>
          <label class="field">
            <span>Скорость средних</span>
            <input id="medium-speed" type="range" min="0.3" max="1.6" step="0.05" value="1" />
          </label>
        </div>

        <div class="field-group">
          <label class="field">
            <span>Крупные формы</span>
            <input id="large-count" type="range" min="8" max="72" step="2" value="36" />
          </label>
          <label class="field">
            <span>Скорость крупных</span>
            <input id="large-speed" type="range" min="0.2" max="1.2" step="0.05" value="0.65" />
          </label>
        </div>

        <label class="field">
          <span>Фон</span>
          <select id="background-mode">
            <option value="default">Дефолтный с ромашками</option>
            <option value="custom">Пользовательский</option>
          </select>
        </label>

        <label class="field upload-field">
          <span>Загрузить свой фон</span>
          <input id="background-upload" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>

        <label class="checkbox">
          <input id="audio-enabled" type="checkbox" checked />
          <span>Звук, когда вибрация недоступна</span>
        </label>

        <label class="checkbox">
          <input id="motion-enabled" type="checkbox" />
          <span>Shake / motion</span>
        </label>

        <button class="reset-button" id="reset-button" type="button">Сбросить до дефолта</button>
      </aside>
    </div>
  </div>
`

const liquidApp = new LiquidApp(
  document.querySelector<HTMLElement>('#scene-host')!,
  {
    panel: document.querySelector<HTMLElement>('#settings-panel')!,
    toggleButton: document.querySelector<HTMLButtonElement>('#settings-toggle')!,
    status: document.querySelector<HTMLElement>('#status-line')!,
    liquidColor: document.querySelector<HTMLInputElement>('#liquid-color')!,
    liquidOpacity: document.querySelector<HTMLInputElement>('#liquid-opacity')!,
    glitterCount: document.querySelector<HTMLInputElement>('#glitter-count')!,
    mediumCount: document.querySelector<HTMLInputElement>('#medium-count')!,
    largeCount: document.querySelector<HTMLInputElement>('#large-count')!,
    glitterSpeed: document.querySelector<HTMLInputElement>('#glitter-speed')!,
    mediumSpeed: document.querySelector<HTMLInputElement>('#medium-speed')!,
    largeSpeed: document.querySelector<HTMLInputElement>('#large-speed')!,
    backgroundMode: document.querySelector<HTMLSelectElement>('#background-mode')!,
    backgroundUpload: document.querySelector<HTMLInputElement>('#background-upload')!,
    resetButton: document.querySelector<HTMLButtonElement>('#reset-button')!,
    audioEnabled: document.querySelector<HTMLInputElement>('#audio-enabled')!,
    motionEnabled: document.querySelector<HTMLInputElement>('#motion-enabled')!,
  },
)

void liquidApp.init()

registerSW({
  immediate: true,
})

window.addEventListener('beforeunload', () => {
  liquidApp.destroy()
})
