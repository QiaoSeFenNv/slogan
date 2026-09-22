/**
 * InputHandler — normalizes mouse + touch events into a single press/release
 * stream. The caller wires DOM events (or uni-app Canvas @touchstart / etc.)
 * to onPress / onMove / onRelease callbacks. Coordinates are returned in
 * canvas (internal) pixels.
 *
 * H5-only: uni-app's H5 build fires both mouse and touch events on canvases
 * depending on device. We accept both, but ignore synthetic mouse events that
 * follow a touch (browsers fire "compat" mouse events after touchend).
 */

/**
 * @typedef {object} InputCallbacks
 * @property {(x:number, y:number) => void} onPress
 * @property {(x:number, y:number) => void} onMove
 * @property {() => void} onRelease
 */

export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {InputCallbacks} cbs
   */
  constructor(canvas, cbs) {
    this.canvas = canvas
    this.cbs = cbs
    /** @type {string|null} 'mouse' | 'touch' | null — which input is currently active */
    this.activeSource = null
    this.bindEvents()
  }

  /**
   * Translate a DOM MouseEvent / Touch to canvas-internal (x, y).
   * Uses bounding rect + devicePixelRatio so high-DPI canvases work.
   */
  toCanvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    const sx = this.canvas.width / rect.width
    const sy = this.canvas.height / rect.height
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    }
  }

  bindEvents() {
    const canvas = this.canvas

    // Mouse
    canvas.addEventListener('mousedown', (e) => {
      // Ignore if a touch session is already active
      if (this.activeSource === 'touch') return
      this.activeSource = 'mouse'
      e.preventDefault()
      const { x, y } = this.toCanvasCoords(e.clientX, e.clientY)
      this.cbs.onPress(x, y)
    })
    canvas.addEventListener('mousemove', (e) => {
      if (this.activeSource !== 'mouse') return
      const { x, y } = this.toCanvasCoords(e.clientX, e.clientY)
      this.cbs.onMove(x, y)
    })
    const onMouseUp = () => {
      if (this.activeSource !== 'mouse') return
      this.activeSource = null
      this.cbs.onRelease()
    }
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    // Prevent the right-click menu on canvas so right-button doesn't break UX
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      this.activeSource = 'touch'
      e.preventDefault()
      if (e.touches.length === 0) return
      const t = e.touches[0]
      const { x, y } = this.toCanvasCoords(t.clientX, t.clientY)
      this.cbs.onPress(x, y)
    }, { passive: false })
    canvas.addEventListener('touchmove', (e) => {
      if (this.activeSource !== 'touch') return
      e.preventDefault()
      if (e.touches.length === 0) return
      const t = e.touches[0]
      const { x, y } = this.toCanvasCoords(t.clientX, t.clientY)
      this.cbs.onMove(x, y)
    }, { passive: false })
    const onTouchEnd = (e) => {
      if (this.activeSource !== 'touch') return
      e.preventDefault()
      this.activeSource = null
      this.cbs.onRelease()
    }
    canvas.addEventListener('touchend', onTouchEnd)
    canvas.addEventListener('touchcancel', onTouchEnd)

    // Safety: if the window loses focus, release so we don't get stuck pressed
    window.addEventListener('blur', () => {
      if (this.activeSource !== null) {
        this.activeSource = null
        this.cbs.onRelease()
      }
    })
  }
}