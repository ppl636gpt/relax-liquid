type ExtendedOrientation = {
  lock?: (direction: string) => Promise<void>
  unlock?: () => void
}

export class OrientationLock {
  private locked = false
  private requested = false

  private get screenOrientation(): ExtendedOrientation | undefined {
    return ('orientation' in screen ? screen.orientation : undefined) as ExtendedOrientation | undefined
  }

  async lock(direction: string = 'portrait'): Promise<boolean> {
    const orientation = this.screenOrientation
    if (!orientation || typeof orientation.lock !== 'function') {
      return false
    }

    try {
      await orientation.lock(direction)
      this.locked = true
      return true
    } catch {
      return false
    }
  }

  async requestLock(direction: string = 'portrait'): Promise<void> {
    if (this.locked || this.requested) {
      return
    }

    this.requested = true
    await this.lock(direction)
  }

  unlock(): void {
    if (!this.locked) {
      return
    }

    const orientation = this.screenOrientation
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock()
    }

    this.locked = false
    this.requested = false
  }
}
