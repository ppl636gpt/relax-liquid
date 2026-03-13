import './style.css'

import { registerSW } from 'virtual:pwa-register'

import { LiquidApp } from './app/liquid-app.ts'

const appRoot = document.querySelector<HTMLDivElement>('#app')

if (!appRoot) {
  throw new Error('Root container #app не найден.')
}

appRoot.innerHTML = `
  <div class="shell">
    <div class="scene-shell" id="scene-shell">
      <div class="scene-host" id="scene-host"></div>

      <button class="settings-toggle" id="settings-toggle" type="button" aria-label="Открыть настройки">
        <span aria-hidden="true">&#9881;</span>
      </button>

      <aside class="settings-panel" id="settings-panel" aria-label="Настройки жидкости">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Liquid Garden</p>
            <h1>Вязкая жидкость</h1>
          </div>
          <p class="status" id="status-line"></p>
        </div>

        <div class="field">
          <div class="field-head">
            <span>Цвет жидкости</span>
          </div>
          <div class="color-swatches" id="color-swatches">
            <button class="swatch" type="button" data-color="#59d7d2" aria-label="Бирюзовый"></button>
            <button class="swatch" type="button" data-color="#7ab8f5" aria-label="Небесно-голубой"></button>
            <button class="swatch" type="button" data-color="#f1a5c6" aria-label="Розовый"></button>
            <button class="swatch" type="button" data-color="#ac9bea" aria-label="Лавандовый"></button>
            <button class="swatch" type="button" data-color="#74c8a1" aria-label="Мятный"></button>
            <button class="swatch" type="button" data-color="#f4c96b" aria-label="Золотисто-персиковый"></button>
          </div>
        </div>

        <label class="field">
          <div class="field-head">
            <span>Прозрачность</span>
            <output id="liquid-opacity-value"></output>
          </div>
          <input id="liquid-opacity" type="range" min="0" max="400" step="1" value="35" />
        </label>

        <div class="field-group">
          <label class="field">
            <div class="field-head">
              <span>Глиттер</span>
              <output id="glitter-count-value"></output>
            </div>
            <input id="glitter-count" type="range" min="300" max="7200" step="50" value="4500" />
          </label>
          <label class="field">
            <div class="field-head">
              <span>Скорость глиттера</span>
              <output id="glitter-speed-value"></output>
            </div>
            <input id="glitter-speed" type="range" min="0.35" max="3.2" step="0.05" value="1.35" />
          </label>
        </div>

        <div class="field-group">
          <label class="field">
            <div class="field-head">
              <span>Средние частицы</span>
              <output id="medium-count-value"></output>
            </div>
            <input id="medium-count" type="range" min="120" max="2600" step="20" value="1100" />
          </label>
          <label class="field">
            <div class="field-head">
              <span>Скорость средних</span>
              <output id="medium-speed-value"></output>
            </div>
            <input id="medium-speed" type="range" min="0.25" max="2.6" step="0.05" value="1" />
          </label>
        </div>

        <div class="field-group">
          <label class="field">
            <div class="field-head">
              <span>Крупные формы</span>
              <output id="large-count-value"></output>
            </div>
            <input id="large-count" type="range" min="20" max="520" step="5" value="180" />
          </label>
          <label class="field">
            <div class="field-head">
              <span>Скорость крупных</span>
              <output id="large-speed-value"></output>
            </div>
            <input id="large-speed" type="range" min="0.15" max="2" step="0.05" value="0.65" />
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
          <span>Звук (fallback при отсутствии vibration API)</span>
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
    colorSwatches: Array.from(document.querySelectorAll<HTMLButtonElement>('.swatch')),
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
    valueOutputs: {
      liquidOpacity: document.querySelector<HTMLOutputElement>('#liquid-opacity-value')!,
      glitterCount: document.querySelector<HTMLOutputElement>('#glitter-count-value')!,
      mediumCount: document.querySelector<HTMLOutputElement>('#medium-count-value')!,
      largeCount: document.querySelector<HTMLOutputElement>('#large-count-value')!,
      glitterSpeed: document.querySelector<HTMLOutputElement>('#glitter-speed-value')!,
      mediumSpeed: document.querySelector<HTMLOutputElement>('#medium-speed-value')!,
      largeSpeed: document.querySelector<HTMLOutputElement>('#large-speed-value')!,
    },
  },
)

void liquidApp.init()

registerSW({
  immediate: true,
})

window.addEventListener('beforeunload', () => {
  liquidApp.destroy()
})
