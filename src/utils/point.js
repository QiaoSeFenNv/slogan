/**
 * SpringDamperPlastic — single grid point.
 *
 * Maintains a 2D position that is pulled back to its rest position by a
 * spring force, damped by velocity. While pressed, an additional force
 * pulls the point toward the press center.
 *
 * The visible "slow rebound" comes from a `plasticOffset` that biases the
 * rest position toward where the point was last pressed. After release the
 * offset drains back to zero at `drainRate` per second — this is what
 * produces the 3-5s rebound feel. The spring itself is critically damped so
 * the surface never oscillates visibly.
 *
 * Pure JS, no uni-app / DOM dependencies — unit-testable in Node.
 */
export class SpringDamperPlastic {
  /**
   * @param {number} restX  rest position X (canvas px)
   * @param {number} restY  rest position Y (canvas px)
   */
  constructor(restX, restY) {
    this.restX = restX
    this.restY = restY
    this.x = restX
    this.y = restY
    this.vx = 0
    this.vy = 0

    /** @type {boolean} whether the press center is currently affecting this point */
    this.pressed = false
    /** @type {number} press center X */
    this.pressX = 0
    /** @type {number} press center Y */
    this.pressY = 0
    /** @type {number} current press strength 0..1 */
    this.pressStrength = 0
    /**
     * Offset added to the rest position while pressed.
     * After release this drains back to 0 at `drainRate` per second, producing
     * the visible slow-rebound of the rest position.
     * @type {{x:number, y:number}}
     */
    this.plasticOffset = { x: 0, y: 0 }
  }

  /**
   * Update this point's position by one physics step.
   *
   * The spring constant and damping are scaled *internally* to keep the
   * visible spring response critically damped regardless of the user-facing
   * elasticity/damping parameters. The user-facing `damping` parameter
   * influences the rebound via `drainRate` (slower drain → longer rebound).
   * The user-facing `elasticity` parameter modulates the press-pull scale
   * (higher elasticity → stiffer, less pull → shallower indent).
   *
   * @param {number} dt          time delta in seconds
   * @param {number} elasticity  stiffness toward press center (0..1; default 0.4)
   * @param {number} damping     rebound rate (0..1; higher → faster rebound)
   * @param {number} plasticity  press-center pull coefficient (0..1)
   * @param {number} maxDeform   maximum deformation scalar (0..1)
   */
  update(dt, elasticity, damping, plasticity, maxDeform) {
    // Effective rest position: spring target = rest + plasticOffset.
    const effRestX = this.restX + this.plasticOffset.x
    const effRestY = this.restY + this.plasticOffset.y

    // Internal spring constants: scale up so the visible spring tracks
    // the slow-moving plastic offset without oscillation. With k=80 and
    // c=18 (≈ 2*sqrt(k)) the spring is critically damped.
    const k = 80
    const c = 18

    let fx = -(this.x - effRestX) * k - this.vx * c
    let fy = -(this.y - effRestY) * k - this.vy * c

    // Press attraction: while pressed, pull toward the press center.
    // The pull strength depends on closeness, pressStrength,
    // plasticity, maxDeform, and a screen-radius scale.
    // elasticity (0..1) is interpreted as a "stiffness" knob: higher
    // elasticity → the surface resists deformation more, so the press
    // pulls the point less far. 0.4 → 1.0, 0.5 → 0.7, 0.3 → 1.3.
    if (this.pressed && this.pressStrength > 0) {
      const dx = this.x - this.pressX
      const dy = this.y - this.pressY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const radius = 220 // ~ screen short side * 0.15 at typical mobile size
      if (dist < radius * 1.5) {
        const closeness = Math.max(0, 1 - dist / radius)
        const stiffness = Math.max(0.2, 1 - (elasticity - 0.4) * 1.5)
        const pullStrength = this.pressStrength * plasticity * maxDeform * closeness * stiffness
        const nx = dist > 1e-2 ? dx / dist : 0
        const ny = dist > 1e-2 ? dy / dist : 0
        // The press strength is multiplied by 600 to convert from a
        // dimensionless coefficient into a pixel-scale force on the spring.
        fx -= nx * pullStrength * 600
        fy -= ny * pullStrength * 600
      }
    }

    // Semi-implicit Euler integration
    this.vx += fx * dt
    this.vy += fy * dt
    this.x += this.vx * dt
    this.y += this.vy * dt

    // Plastic offset update
    if (this.pressed && this.pressStrength > 0) {
      // While pressed, let the plastic offset relax toward the current
      // displacement (so release remembers where we are).
      const dx = this.x - this.restX
      const dy = this.y - this.restY
      const k = 1 - Math.exp(-dt * 8)
      this.plasticOffset.x += (dx - this.plasticOffset.x) * k
      this.plasticOffset.y += (dy - this.plasticOffset.y) * k
    } else {
      // After release, drain the plastic offset back to 0.
      // Visible rebound time ≈ -ln(0.05) / drainRate ≈ 3/drainRate seconds.
      //  - drainRate=0.6  → ~5s rebound
      //  - drainRate=1.0  → ~3s rebound
      // damping=0.1 → drainRate ≈ 0.7 (≈ 4s rebound).
      const drainRate = 0.4 + damping * 3 // maps damping=0.1 → 0.7
      const k = 1 - Math.exp(-dt * drainRate)
      this.plasticOffset.x -= this.plasticOffset.x * k
      this.plasticOffset.y -= this.plasticOffset.y * k
      if (Math.abs(this.plasticOffset.x) < 0.01) this.plasticOffset.x = 0
      if (Math.abs(this.plasticOffset.y) < 0.01) this.plasticOffset.y = 0
    }

    // Clamp displacement so a single point cannot fly off-screen
    const maxOffset = 400
    const ox = this.x - this.restX
    const oy = this.y - this.restY
    if (Math.abs(ox) > maxOffset) {
      this.x = this.restX + Math.sign(ox) * maxOffset
      this.vx = 0
    }
    if (Math.abs(oy) > maxOffset) {
      this.y = this.restY + Math.sign(oy) * maxOffset
      this.vy = 0
    }
  }

  /**
   * Mark this point as affected by a press.
   * @param {number} pressX  press center X
   * @param {number} pressY  press center Y
   * @param {number} strength press strength 0..1
   */
  applyPress(pressX, pressY, strength) {
    this.pressed = true
    this.pressX = pressX
    this.pressY = pressY
    this.pressStrength = strength
  }

  /**
   * Release the press on this point. Plastic deformation is retained.
   */
  release() {
    this.pressed = false
    this.pressStrength = 0
  }

  /**
   * Total displacement magnitude from true rest, in pixels.
   * @returns {number}
   */
  displacement() {
    const dx = this.x - this.restX
    const dy = this.y - this.restY
    return Math.sqrt(dx * dx + dy * dy)
  }
}