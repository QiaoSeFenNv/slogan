<template>
  <view class="container">
    <canvas
      canvas-id="bubbleCanvas"
      class="bubble-canvas"
      id="bubbleCanvas"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    />
    <view class="theme-switcher">
      <button class="theme-btn sakura" @click="setTheme('sakura')">🌸</button>
      <button class="theme-btn mist" @click="setTheme('mist')">🌊</button>
      <button class="theme-btn lavender" @click="setTheme('lavender')">💜</button>
    </view>
  </view>
</template>

<script>
import { PhysicsEngine } from '@/utils/physics.js'
import { Renderer } from '@/utils/renderer.js'
import { InputHandler } from '@/utils/input.js'
import { themes } from '@/static/themes.js'

export default {
  data() {
    return {
      currentThemeName: 'sakura',
      // Held in data so they survive re-renders, but mutated as raw JS objects.
      engine: null,
      renderer: null,
      rafId: null,
      lastFrameTs: 0,
    }
  },
  computed: {
    theme() {
      return themes[this.currentThemeName]
    },
  },
  onReady() {
    // uni-app's H5 canvas: the @click canvas-id element is wrapped in a view.
    // We get the underlying DOM element via querySelector on H5.
    // Use nextTick to ensure the canvas is in the DOM.
    this.$nextTick(() => {
      this.initCanvas()
    })
  },
  onUnload() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  },
  methods: {
    initCanvas() {
      // In H5, the <canvas canvas-id="bubbleCanvas"> element is reachable via
      // document.querySelector('[canvas-id=bubbleCanvas]') OR via the DOM id we
      // attached ('id="bubbleCanvas"').
      const canvas = document.querySelector('[canvas-id="bubbleCanvas"]')
        || document.getElementById('bubbleCanvas')
      if (!canvas) {
        console.error('[BubbleTouch] canvas element not found')
        return
      }

      // Size the canvas backing store to its CSS box * devicePixelRatio so it
      // looks sharp on retina / mobile.
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))

      // Apply URL-query overrides to physics params (Step 6)
      const params = new URLSearchParams(window.location.search)
      const overrides = {}
      if (params.has('elasticity')) overrides.elasticity = parseFloat(params.get('elasticity'))
      if (params.has('damping')) overrides.damping = parseFloat(params.get('damping'))
      if (params.has('plasticity')) overrides.plasticity = parseFloat(params.get('plasticity'))
      if (params.has('maxDeform')) overrides.maxDeform = parseFloat(params.get('maxDeform'))
      if (params.has('gridSize')) overrides.gridSize = parseInt(params.get('gridSize'), 10)

      // Init physics + renderer
      const gridSize = overrides.gridSize || 20
      this.engine = new PhysicsEngine(canvas.width, canvas.height, gridSize)
      Object.assign(this.engine, overrides)
      if (overrides.gridSize) this.engine.init(canvas.width, canvas.height)

      this.renderer = new Renderer(canvas, this.engine, themes[this.currentThemeName])

      // Hook input
      // eslint-disable-next-line no-new
      new InputHandler(canvas, {
        onPress: (x, y) => this.engine && this.engine.press(x, y, 1),
        onMove: (x, y) => this.engine && this.engine.move(x, y, 1),
        onRelease: () => this.engine && this.engine.release(),
      })

      // Start RAF loop
      this.lastFrameTs = performance.now()
      const tick = (ts) => {
        const dt = (ts - this.lastFrameTs) / 1000
        this.lastFrameTs = ts
        if (this.engine && this.renderer) {
          const start = performance.now()
          this.engine.update(dt)
          this.renderer.render()
          const frameMs = performance.now() - start
          this.engine.reportFrameTiming(frameMs)
        }
        this.rafId = requestAnimationFrame(tick)
      }
      this.rafId = requestAnimationFrame(tick)
    },
    setTheme(name) {
      if (!themes[name]) return
      this.currentThemeName = name
      if (this.renderer) {
        this.renderer.setTheme(themes[name])
      }
    },
    onTouchStart(e) {
      // Defensive fallback for environments where the DOM InputHandler
      // doesn't fire (e.g. wrapped canvas in some uni-app builds).
      if (e && e.touches && e.touches[0] && this.engine) {
        const t = e.touches[0]
        // Convert clientX/Y to canvas-internal coords.
        const canvas = this.renderer && this.renderer.canvas
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const sx = canvas.width / rect.width
          const sy = canvas.height / rect.height
          this.engine.press((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy, 1)
        }
      }
    },
    onTouchMove(e) {
      if (e && e.touches && e.touches[0] && this.engine) {
        const t = e.touches[0]
        const canvas = this.renderer && this.renderer.canvas
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const sx = canvas.width / rect.width
          const sy = canvas.height / rect.height
          this.engine.move((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy, 1)
        }
      }
    },
    onTouchEnd() {
      if (this.engine) this.engine.release()
    },
    onMouseDown(e) {
      if (!this.engine || !this.renderer) return
      const canvas = this.renderer.canvas
      const rect = canvas.getBoundingClientRect()
      const sx = canvas.width / rect.width
      const sy = canvas.height / rect.height
      this.engine.press((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy, 1)
    },
    onMouseMove(e) {
      if (!this.engine) return
      // Buttons bitfield: bit 1 = left button held
      if ((e.buttons & 1) !== 1) return
      const canvas = this.renderer.canvas
      const rect = canvas.getBoundingClientRect()
      const sx = canvas.width / rect.width
      const sy = canvas.height / rect.height
      this.engine.move((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy, 1)
    },
    onMouseUp() {
      if (this.engine) this.engine.release()
    },
  },
}
</script>

<style>
.container {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #FFE4E1;
  overflow: hidden;
}
.bubble-canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  background: #FFE4E1;
}
.theme-switcher {
  position: fixed;
  right: 24rpx;
  bottom: 48rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  z-index: 10;
}
.theme-btn {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.7);
  font-size: 40rpx;
  line-height: 80rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
}
.theme-btn:active {
  background: rgba(255, 255, 255, 0.95);
  transform: scale(0.95);
}
</style>