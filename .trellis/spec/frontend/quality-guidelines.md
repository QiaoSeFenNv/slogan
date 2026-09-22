# Quality Guidelines

> Code quality standards for frontend development in this project.

---

## Overview

This document captures quality standards and lessons learned from real implementation work in this project. Future AI assistants and developers: read this before writing or reviewing frontend code — it contains conventions that this codebase has already paid to learn.

---

## Required Patterns

### Pattern: Pure-JS physics / math engines

**What**: Physics, math, or simulation engines must be implemented as pure JavaScript modules with **zero platform dependencies**.

**Why**: Lets you unit-test them in Node.js (no Vite/uni-app/HBuilderX required), profile them with Node's perf_hooks, and reason about them in isolation. Platform-coupled engines cannot be smoke-tested without the full build pipeline.

**Example** (good):
```
src/utils/physics.js   — no @dcloudio, uni-app, or wx.* imports
src/utils/point.js     — only imports './physics.js' (or sibling pure modules)
test-physics.js        — Node script that imports utils/physics.js directly
```

**Verify**:
```bash
grep -rE "'@dcloudio|uni-app|wx\." src/utils/   # should return zero hits
```

---

### Pattern: Two-layer physics for "slow rebound" effects

**What**: When implementing a "slow bounce-back" feel (jelly, slime, soft body), do NOT use a single low-damping spring. Use a **two-layer system**:

1. **Inner layer**: critically-damped spring (`k` and `c ≈ 2√k`) drives each simulation point fast to a target position. Inner layer is **fast and stable** — never overshoots.
2. **Outer layer**: a `drainRate` slowly relaxes the plastic / target offset back to zero. This is where the visible "slow rebound" comes from.

**Why**: A single spring with low damping (e.g. `damping = 0.1`) **oscillates**. A single spring with high damping (e.g. `damping = 0.9`) **doesn't feel slow, it feels dead**. Splitting the two responsibilities lets you tune "responsiveness" (inner) and "feel" (outer) independently.

**Example** (good):
```js
// inner: critically damped, fast convergence
const stiffness = 80;
const criticalDamping = 2 * Math.sqrt(stiffness);
const fx = -k * displacement - criticalDamping * velocity;
// outer: slow plastic drain
plasticOffset *= Math.exp(-drainRate * dt);
```

**Example** (bad):
```js
// single low-damping spring: will oscillate
const fx = -elasticity * displacement - 0.1 * velocity;
```

---

## Forbidden Patterns

### Don't: Dead URL-query parameters

**What**: Don't expose parameters via URL query / runtime config that have **no observable effect** on the rendered output.

**Why**: Users will tune them and conclude "the engine is broken" when actually the parameter is wired but unused. This destroys trust faster than any other bug.

**Symptom**: `?elasticity=0.7` produces identical output to `?elasticity=0.3`.

**Instead**: Every tunable parameter exposed via URL / config must have a measurable, monotonic effect on at least one observable (deformation depth, rebound time, response speed). When in doubt, remove the parameter from the public surface.

---

### Don't: Platform imports inside engine modules

**What**: Don't import from `@dcloudio/*`, `uni-app`, or `wx.*` inside `src/utils/*.js`.

**Why**: Breaks Node-side unit testing. Forces the entire dev toolchain just to run a smoke test.

**Instead**: Keep `src/utils/*.js` pure JS. If you need a platform-specific helper (touch event normalization, file IO), put it in a thin adapter module that the engine module can import — or import the platform adapter from the page layer (`index.vue`) and pass values into the engine as plain numbers/objects.

---

## Common Mistakes

### Mistake: Treating "elasticity" and "damping" as rebound-speed knobs

**Symptom**: Tweaking `elasticity` from 0.2 to 0.7 changes the indent depth but **not** the rebound curve the user actually feels. User reports "tuning has no effect on feel".

**Cause**: With low damping, the spring oscillates around the new equilibrium and the user perceives "the same". The visible rebound time is dominated by `drainRate` (plastic release), not by `elasticity`.

**Fix**: When tuning slow-rebound feel, change `drainRate` (or equivalent plastic-relaxation parameter). When tuning "how hard you have to push to deform it", change `elasticity` and the press-pull stiffness together. Document the two as separate axes in user-facing tuning docs.

**Prevention**: Before exposing a parameter via URL query or runtime config, write a smoke test that prints a metric at three values and confirms the metric changes monotonically.

---

### Mistake: Modernizing uni-app page components to `<script setup>` "because Vue 3"

**Symptom**: After refactoring `pages/index/index.vue` to Composition API, `onReady` no longer fires, the Canvas never initializes, and the page is blank.

**Cause**: uni-app page lifecycle hooks (`onReady`, `onLoad`, `onShow`, `onUnload`) are **uni-app specific**, not Vue 3 lifecycle hooks. In `<script setup>` you must import them from `@dcloudio/uni-app`. Mixing them with `onMounted` / `onUnmounted` (which also need to be imported from `vue`) creates subtle wiring mistakes.

**Decision (this project)**: Keep uni-app page components using **Options API** (`data()`, `methods`, `onReady(...)`). uni-app's official examples and tooling assume this form. Vue 3 Composition API is fine inside child components that are NOT pages.

---

## Code Review Checklist

Before approving a frontend PR:

- [ ] Any new physics / math / simulation module in `src/utils/` is pure JS (no platform imports)
- [ ] Any new tunable parameter exposed via URL or config has a smoke-test demonstrating monotonic effect
- [ ] Any "slow bounce" or "soft body" feel uses the two-layer pattern (critically-damped inner + drain outer), NOT a single low-damping spring
- [ ] Page-level components use Options API; only child components use Composition API
- [ ] Console output is silent on a clean page load (no leftover debug `console.log`)
