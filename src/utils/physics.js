/**
 * PhysicsEngine — a grid of SpringDamperPlastic points driven by one or
 * more press inputs.
 *
 * Layout: gridSize × gridSize points, evenly spaced to fill (width, height).
 * Presses use a Gaussian falloff over `radius = min(width, height) * 0.15`.
 *
 * Pure JS, no uni-app / DOM dependencies — unit-testable in Node.
 */
import { SpringDamperPlastic } from './point.js'

/** Gaussian falloff: weight for a point at `distance` from press center. */
function gaussian(distance, radius) {
  return Math.exp(-(distance * distance) / (2 * radius * radius))
}

export class PhysicsEngine {
  /**
   * @param {number} width      canvas width (px)
   * @param {number} height     canvas height (px)
   * @param {number} [gridSize=20] grid resolution (e.g. 20 → 20×20)
   */
  constructor(width, height, gridSize = 20) {
    /** @type {SpringDamperPlastic[][]} */
    this.grid = []
    /** @type {{x:number, y:number, strength:number}[]} active presses */
    this.pressPoints = []

    this.gridSize = gridSize
    this.width = width
    this.height = height

    // Tunable parameters — match design.md §3.2 and decisions log Q2/Q4.
    this.elasticity = 0.4
    this.damping = 0.1
    this.plasticity = 0.3
    this.maxDeform = 0.6

    // Auto-degrade state
    this.slowFrames = 0
    this.fastFrames = 0

    this.init(width, height)
  }

  /**
   * (Re-)build the grid for the current canvas size.
   */
  init(width, height) {
    this.width = width
    this.height = height
    this.grid = []
    const stepX = width / (this.gridSize - 1)
    const stepY = height / (this.gridSize - 1)
    for (let i = 0; i < this.gridSize; i++) {
      this.grid[i] = []
      for (let j = 0; j < this.gridSize; j++) {
        this.grid[i][j] = new SpringDamperPlastic(i * stepX, j * stepY)
      }
    }
  }

  /**
   * Down-grade to a smaller grid. Keeps the parameters and rebuilds.
   * @param {number} newSize e.g. 16
   */
  degrade(newSize = 16) {
    if (newSize >= this.gridSize) return
    this.gridSize = newSize
    this.slowFrames = 0
    this.fastFrames = 0
    this.init(this.width, this.height)
  }

  /**
   * Upgrade the grid back up. Currently a no-op guard (start at 20).
   */
  upgrade(targetSize = 20) {
    if (targetSize <= this.gridSize) return
    this.gridSize = targetSize
    this.slowFrames = 0
    this.fastFrames = 0
    this.init(this.width, this.height)
  }

  /**
   * Set or update a press at canvas coordinate (x, y).
   * Strength is a 0..1 multiplier.
   * @param {number} x
   * @param {number} y
   * @param {number} [strength=1]
   */
  press(x, y, strength = 1) {
    // Replace any existing press at the same position; otherwise add a new one.
    for (let i = 0; i < this.pressPoints.length; i++) {
      if (this.pressPoints[i].x === x && this.pressPoints[i].y === y) {
        this.pressPoints[i].strength = strength
        return
      }
    }
    this.pressPoints.push({ x, y, strength })
    this.applyPresses()
  }

  /**
   * Update the most-recent press's position (used for move events).
   * If there is no active press, create one.
   */
  move(x, y, strength = 1) {
    if (this.pressPoints.length === 0) {
      this.press(x, y, strength)
      return
    }
    // Update the last press — single-finger MVP.
    const p = this.pressPoints[this.pressPoints.length - 1]
    p.x = x
    p.y = y
    p.strength = strength
    this.applyPresses()
  }

  /**
   * Release the most recent press. If none remain, releases the whole grid.
   */
  release() {
    if (this.pressPoints.length > 0) {
      this.pressPoints.pop()
    }
    this.applyPresses()
  }

  /**
   * Clear all presses (e.g. window blur).
   */
  releaseAll() {
    this.pressPoints = []
    this.applyPresses()
  }

  /**
   * Walk active presses and apply Gaussian-falloff strength to nearby grid points.
   */
  applyPresses() {
    const radius = Math.min(this.width, this.height) * 0.15
    // First release every point
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        const p = this.grid[i][j]
        p.pressed = false
        p.pressStrength = 0
      }
    }
    // Then re-apply each press additively
    for (const press of this.pressPoints) {
      for (let i = 0; i < this.gridSize; i++) {
        for (let j = 0; j < this.gridSize; j++) {
          const p = this.grid[i][j]
          const dx = p.restX - press.x
          const dy = p.restY - press.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < radius * 2.5) {
            const w = gaussian(dist, radius) * press.strength
            if (w > p.pressStrength) {
              p.pressStrength = w
            }
            p.pressed = p.pressStrength > 0.01
            p.pressX = press.x
            p.pressY = press.y
          }
        }
      }
    }
  }

  /**
   * Advance the simulation by `dt` seconds. Internally sub-steps so that
   * the per-step dt stays ≤ `maxStep` (default 1/120s) — this keeps the
   * spring system stable at 60fps regardless of elasticity.
   * @param {number} dt  frame time in seconds
   */
  update(dt) {
    if (dt > 0.05) dt = 0.05
    const maxStep = 1 / 120
    let remaining = dt
    while (remaining > 1e-6) {
      const step = Math.min(remaining, maxStep)
      for (let i = 0; i < this.gridSize; i++) {
        for (let j = 0; j < this.gridSize; j++) {
          this.grid[i][j].update(step, this.elasticity, this.damping, this.plasticity, this.maxDeform)
        }
      }
      remaining -= step
    }
  }

  /**
   * Called by the main loop with the per-frame wall-clock ms. Tracks slow/fast
   * streaks and triggers degrade / upgrade.
   * @param {number} frameMs
   */
  reportFrameTiming(frameMs) {
    if (frameMs > 20) {
      this.slowFrames++
      this.fastFrames = 0
    } else if (frameMs < 10 && this.gridSize < 20) {
      this.fastFrames++
      this.slowFrames = 0
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 1)
      this.fastFrames = Math.max(0, this.fastFrames - 1)
    }
    if (this.slowFrames >= 30 && this.gridSize > 16) {
      this.degrade(16)
    } else if (this.fastFrames >= 30 && this.gridSize < 20) {
      this.upgrade(20)
    }
  }

  /**
   * Maximum displacement across all grid points, in pixels. Used by the smoke test.
   * @returns {number}
   */
  maxDisplacement() {
    let m = 0
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        const d = this.grid[i][j].displacement()
        if (d > m) m = d
      }
    }
    return m
  }
}