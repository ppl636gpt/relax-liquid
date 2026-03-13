import { clamp } from '../utils/math.ts'

export interface InteractionPayload {
  x: number
  y: number
  dx: number
  dy: number
  force: number
  pressed: boolean
}

interface InputControllerHandlers {
  onPrime: () => void | Promise<void>
  onInteraction: (payload: InteractionPayload) => void
  onRelease: () => void
}

export class InputController {
  private activePointerId: number | null = null
  private lastX = 0
  private lastY = 0
  private lastTime = 0
  private readonly element: HTMLElement
  private readonly handlers: InputControllerHandlers

  private readonly onPointerDown = (event: PointerEvent) => {
    this.activePointerId = event.pointerId
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.lastTime = performance.now()
    this.element.setPointerCapture(event.pointerId)
    void this.handlers.onPrime()
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    const now = performance.now()
    const dx = event.clientX - this.lastX
    const dy = event.clientY - this.lastY
    const dt = Math.max(8, now - this.lastTime)
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.lastTime = now

    const pressed = this.activePointerId === event.pointerId
    const velocity = Math.hypot(dx, dy) / dt
    const force = clamp((pressed ? 0.2 : 0.08) + velocity * (pressed ? 0.4 : 0.18), 0.05, pressed ? 1.2 : 0.32)

    this.handlers.onInteraction({
      x: event.clientX,
      y: event.clientY,
      dx,
      dy,
      force,
      pressed,
    })
  }

  private readonly onPointerUp = (event: PointerEvent) => {
    if (this.activePointerId !== event.pointerId) {
      return
    }

    this.handlers.onRelease()
    this.activePointerId = null
    this.element.releasePointerCapture(event.pointerId)
  }

  constructor(
    element: HTMLElement,
    handlers: InputControllerHandlers,
  ) {
    this.element = element
    this.handlers = handlers
    this.element.addEventListener('pointerdown', this.onPointerDown)
    this.element.addEventListener('pointermove', this.onPointerMove)
    this.element.addEventListener('pointerup', this.onPointerUp)
    this.element.addEventListener('pointercancel', this.onPointerUp)
    this.element.addEventListener('pointerleave', this.onPointerUp)
  }

  destroy(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown)
    this.element.removeEventListener('pointermove', this.onPointerMove)
    this.element.removeEventListener('pointerup', this.onPointerUp)
    this.element.removeEventListener('pointercancel', this.onPointerUp)
    this.element.removeEventListener('pointerleave', this.onPointerUp)
  }
}
