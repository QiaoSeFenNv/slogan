/**
 * Smoke test for the physics engine.
 *
 * Run with: node test-physics.js
 *
 * Simulates a single press at the canvas center for 500 frames, then release,
 * then 500 frames of rebound. Prints the first/last displacement values.
 *
 * Pure Node — does not import any uni-app / browser module.
 */

import { PhysicsEngine } from './src/utils/physics.js'

const WIDTH = 800
const HEIGHT = 600
const FRAME_RATE = 60
const DT = 1 / FRAME_RATE

const engine = new PhysicsEngine(WIDTH, HEIGHT, 20)

const samples = []
const centerX = WIDTH / 2
const centerY = HEIGHT / 2

// Phase 1 — press for 500 frames (downward push into the surface)
engine.press(centerX, centerY, 1)
for (let f = 0; f < 500; f++) {
  engine.update(DT)
  if (f < 5 || f === 499) {
    samples.push({ frame: f, phase: 'press', maxDisp: engine.maxDisplacement().toFixed(2) })
  }
}

// Phase 2 — release and watch rebound for 500 frames
engine.release()
for (let f = 0; f < 500; f++) {
  engine.update(DT)
  if (f < 5 || f === 60 || f === 120 || f === 180 || f === 240 || f === 300 || f === 499) {
    samples.push({ frame: f, phase: 'rebound', maxDisp: engine.maxDisplacement().toFixed(2) })
  }
}

console.log('=== Physics smoke test ===')
console.log(`gridSize=${engine.gridSize}, elasticity=${engine.elasticity}, damping=${engine.damping}, plasticity=${engine.plasticity}, maxDeform=${engine.maxDeform}`)
console.log('---')
console.log('phase    | frame | max displacement (px)')
for (const s of samples) {
  console.log(`${s.phase.padEnd(8)} | ${String(s.frame).padStart(5)} | ${s.maxDisp}`)
}

// Estimate rebound time: first frame after release where maxDisp < 1 px
let reboundFrames = -1
engine.press(centerX, centerY, 1)
for (let f = 0; f < 500; f++) engine.update(DT)
engine.release()
for (let f = 0; f < 60 * 8; f++) {
  engine.update(DT)
  if (engine.maxDisplacement() < 1) {
    reboundFrames = f
    break
  }
}
console.log('---')
console.log(`rebound to <1px: ${reboundFrames === -1 ? '>8s' : (reboundFrames / FRAME_RATE).toFixed(2) + 's'}`)