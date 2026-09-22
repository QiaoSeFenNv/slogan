/**
 * Renderer — draws the deformed slime mesh to a Canvas 2D context.
 *
 * Three layers, drawn back-to-front:
 *   1. Body    — triangle-strip mesh of the grid points, radial gradient fill.
 *   2. Bubbles — 30 static circles inside the body for "gel" feel.
 *   3. Highlight — soft white ellipse in the upper-left for surface gloss.
 *
 * Pure JS, no uni-app / DOM dependencies beyond reading the canvas dims.
 */

/**
 * Pre-generate 30 bubble positions for a given (width, height). Positions are
 * in normalized [0,1] coordinates so the same bubbles work at any canvas size.
 */
function makeBubbles(width, height, count = 30, seed = 1337) {
  // Mulberry32 deterministic PRNG so the bubble layout doesn't flicker
  let t = seed >>> 0
  function rand() {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const bubbles = []
  for (let i = 0; i < count; i++) {
    bubbles.push({
      nx: 0.1 + rand() * 0.8,        // normalized x [0.1, 0.9]
      ny: 0.1 + rand() * 0.8,        // normalized y [0.1, 0.9]
      r: 4 + rand() * 10,            // radius in px at 800px width
      color: rand() > 0.5 ? 'highlight' : 'shadow',
    })
  }
  return bubbles
}

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas  target canvas
   * @param {import('./physics.js').PhysicsEngine} engine
   * @param {object} theme  one of the entries from `themes.js`
   */
  constructor(canvas, engine, theme) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.engine = engine
    this.theme = theme
    this.bubbles = makeBubbles(canvas.width, canvas.height)
    this.bubbleScale = canvas.width / 800 // scale radii with canvas size
  }

  /**
   * Swap the active theme.
   */
  setTheme(theme) {
    this.theme = theme
  }

  /**
   * Render one frame. Call from RAF loop.
   */
  render() {
    const { ctx, canvas } = this
    if (!ctx) return
    // Clear with a soft background
    ctx.fillStyle = '#FFE4E1'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    this.drawBody()
    this.drawBubbles()
    this.drawHighlight()
  }

  /**
   * Draw the slime body as a triangle mesh, filled with a radial gradient.
   * Uses the displaced (x, y) of each grid point.
   */
  drawBody() {
    const { ctx, engine, theme } = this
    const grid = engine.grid
    const n = engine.gridSize

    if (n < 2) return

    // Build the path as a series of triangle strips (row by row).
    ctx.beginPath()
    for (let j = 0; j < n; j++) {
      ctx.moveTo(grid[0][j].x, grid[0][j].y)
      for (let i = 1; i < n; i++) {
        ctx.lineTo(grid[i][j].x, grid[i][j].y)
      }
    }
    ctx.closePath()

    // Radial gradient: center light, edges deeper
    const cx = this.canvas.width / 2
    const cy = this.canvas.height / 2
    const innerR = Math.min(this.canvas.width, this.canvas.height) * 0.1
    const outerR = Math.max(this.canvas.width, this.canvas.height) * 0.7
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
    grad.addColorStop(0, theme.primary)
    grad.addColorStop(0.6, theme.secondary)
    grad.addColorStop(1, theme.shadow)
    ctx.fillStyle = grad
    ctx.globalAlpha = 0.78
    ctx.fill()
    ctx.globalAlpha = 1
  }

  /**
   * Draw 30 static "air bubbles" inside the slime. Each bubble is positioned
   * by mapping its normalized coords into the *current* grid space using a
   * bilinear interpolation of the displaced mesh.
   */
  drawBubbles() {
    const { ctx, engine, theme } = this
    const n = engine.gridSize - 1
    if (n < 1) return

    for (const b of this.bubbles) {
      // Sample the mesh at normalized position (b.nx, b.ny) via bilinear interp.
      const fx = b.nx * n
      const fy = b.ny * n
      const i0 = Math.floor(fx)
      const j0 = Math.floor(fy)
      const i1 = Math.min(i0 + 1, n)
      const j1 = Math.min(j0 + 1, n)
      const u = fx - i0
      const v = fy - j0
      const p00 = engine.grid[i0][j0]
      const p10 = engine.grid[i1][j0]
      const p01 = engine.grid[i0][j1]
      const p11 = engine.grid[i1][j1]
      const w00 = (1 - u) * (1 - v)
      const w10 = u * (1 - v)
      const w01 = (1 - u) * v
      const w11 = u * v
      const x = p00.x * w00 + p10.x * w10 + p01.x * w01 + p11.x * w11
      const y = p00.y * w00 + p10.y * w10 + p01.y * w01 + p11.y * w11

      const r = b.r * this.bubbleScale
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = b.color === 'highlight' ? theme.highlight : theme.shadow
      ctx.globalAlpha = 0.18
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  /**
   * Soft white highlight ellipse near the upper-left of the slime.
   * Coords follow the deformed surface (use the average position of the
   * top-row grid points as the anchor).
   */
  drawHighlight() {
    const { ctx, engine, theme } = this
    const n = engine.gridSize - 1
    if (n < 1) return
    // Anchor: average of the leftmost-top quadrant
    let ax = 0, ay = 0, count = 0
    for (let i = 0; i <= Math.max(2, Math.floor(n / 3)); i++) {
      for (let j = 0; j <= Math.max(2, Math.floor(n / 3)); j++) {
        ax += engine.grid[i][j].x
        ay += engine.grid[i][j].y
        count++
      }
    }
    ax /= count
    ay /= count

    const w = this.canvas.width * 0.4
    const h = this.canvas.height * 0.18
    ctx.save()
    ctx.translate(ax, ay)
    ctx.rotate(-0.4)
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h))
    grad.addColorStop(0, 'rgba(255,255,255,0.55)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}