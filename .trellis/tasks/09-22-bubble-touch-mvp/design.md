# Bubble Touch MVP — Technical Design

## 1. Architecture Overview

uni-app Vue 3 单页应用，分层结构：

```
┌─────────────────────────────────────────┐
│  pages/index/index.vue                 │  ← 视图层：Canvas + 主题按钮
├─────────────────────────────────────────┤
│  Renderer (renderer.js)                │  ← 渲染层：Canvas 2D 绘制
├─────────────────────────────────────────┤
│  PhysicsEngine (physics.js)            │  ← 物理层：弹簧-阻尼-塑性网格
├─────────────────────────────────────────┤
│  SpringDamperPlastic (point.js)        │  ← 数据层：单点状态机
└─────────────────────────────────────────┘
```

单向数据流：触摸事件 → PhysicsEngine 写入形变 → Renderer 每帧读取状态 → Canvas 绘制。

## 2. 项目结构

```
E:/slogan/
├── src/
│   ├── pages/
│   │   └── index/
│   │       └── index.vue           # 主页面（Canvas + UI）
│   ├── static/
│   │   └── themes.js                # 3 种主题色定义
│   ├── utils/
│   │   ├── physics.js               # PhysicsEngine 类
│   │   ├── point.js                 # SpringDamperPlastic 类
│   │   ├── renderer.js              # Renderer 类
│   │   └── input.js                 # 触摸/鼠标事件归一化
│   ├── App.vue                      # uni-app 根组件
│   └── main.js                      # Vue 入口
├── pages.json                       # uni-app 页面配置
├── manifest.json                    # uni-app 应用配置（H5 优先）
├── package.json                     # 依赖（HBuilderX 自动生成）
└── index.html                       # H5 入口（编译产物，非手写）
```

## 3. 核心数据模型

### 3.1 SpringDamperPlastic（单点）

```js
class SpringDamperPlastic {
  constructor(restX, restY) {
    this.restX = restX;              // 静止位置 X
    this.restY = restY;              // 静止位置 Y
    this.x = restX;                  // 当前 X
    this.y = restY;                  // 当前 Y
    this.vx = 0;                     // X 方向速度
    this.vy = 0;                     // Y 方向速度
    this.pressed = false;            // 是否被按压
    this.pressX = 0;                 // 按压中心 X
    this.pressY = 0;                 // 按压中心 Y
    this.pressStrength = 0;          // 当前按压强度（0-1）
  }

  applyPress(pressX, pressY, strength) { ... }
  release() { ... }
  update(dt, elasticity, damping, plasticity, maxDeform) { ... }
}
```

**update 物理积分（弹簧-阻尼-塑性）：**

```js
update(dt, elasticity, damping, plasticity, maxDeform) {
  // 弹簧力 = -displacement * elasticity（指向静止位置）
  // 阻尼力 = -velocity * damping（减缓运动）
  const fx = -(this.x - this.restX) * elasticity - this.vx * damping;
  const fy = -(this.y - this.restY) * elasticity - this.vy * damping;

  // 半隐式 Euler 积分
  this.vx += fx * dt;
  this.vy += fy * dt;
  this.x += this.vx * dt;
  this.y += this.vy * dt;

  // 塑性形变：按住时累加，松手后保留一段时间
  if (this.pressed && this.pressStrength > 0) {
    const dx = this.x - this.pressX;
    const dy = this.y - this.pressY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const deform = this.pressStrength * plasticity * maxDeform;
    this.x -= dx * deform * 0.1;   // 向按压中心拉一点
    this.y -= dy * deform * 0.1;
  }
}
```

### 3.2 PhysicsEngine（网格）

```js
class PhysicsEngine {
  constructor(width, height, gridSize = 20) {
    this.grid = [];                 // 二维数组 [gridSize][gridSize]
    this.pressPoints = [];           // 当前按压点列表
    this.gridSize = gridSize;
    this.elasticity = 0.4;
    this.damping = 0.1;
    this.plasticity = 0.3;
    this.maxDeform = 0.6;
    this.init(width, height);
  }

  init(width, height) {
    const stepX = width / (this.gridSize - 1);
    const stepY = height / (this.gridSize - 1);
    for (let i = 0; i < this.gridSize; i++) {
      this.grid[i] = [];
      for (let j = 0; j < this.gridSize; j++) {
        this.grid[i][j] = new SpringDamperPlastic(
          i * stepX, j * stepY
        );
      }
    }
  }

  // 给定屏幕坐标 (x, y)，找到最近的网格点并设置 pressStrength
  press(x, y, strength) {
    // ...遍历网格点，根据距离衰减设置 pressStrength
  }

  release() { ... }
  update(dt) { ... }
}
```

**距离衰减函数（影响半径）：**

```js
// 按压点周围的影响按高斯衰减
function gaussian(distance, radius) {
  return Math.exp(-(distance * distance) / (2 * radius * radius));
}
```

影响半径：`radius = min(width, height) * 0.15`（屏幕短边的 15%）。

### 3.3 Renderer（渲染）

```js
class Renderer {
  constructor(canvas, engine, theme) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.theme = theme;
  }

  render() {
    const { ctx, engine, theme } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 画主体（多边形网格 + 颜色填充）
    this.drawBody();

    // 2. 画内部气泡（静态 30 个）
    this.drawBubbles();

    // 3. 画表面高光
    this.drawHighlight();
  }

  drawBody() {
    // 用 engine.grid 渲染多边形网格
    // - 顶点颜色按当前形变做轻微明暗变化
    // - 填充用径向渐变（中心浅、边缘深）
    // - alpha = 0.7
  }
}
```

## 4. 输入处理

`utils/input.js` 负责把 H5 / 小程序的触摸/鼠标事件归一化为 `{ x, y, strength, type }`：

```js
// H5 端：
//   - 鼠标：mousedown/mousemove/mouseup → strength = 1
//   - 触摸：touchstart/touchmove/touchend → strength = 1（未来接 force touch）
// 小程序端：
//   - 只处理 touchstart/touchmove/touchend
```

统一接口：`InputHandler.onPress(x, y)` / `onMove(x, y)` / `onRelease()`。

## 5. 主题系统

`static/themes.js`：

```js
export const themes = {
  sakura: {
    name: '樱花粉',
    primary: '#FFB6C1',
    secondary: '#FF8FAB',
    highlight: '#FFFFFF',
    shadow: '#E68A9E',
  },
  mist: {
    name: '雾霭蓝',
    primary: '#B0E0E6',
    secondary: '#87CEEB',
    highlight: '#FFFFFF',
    shadow: '#7FB8C4',
  },
  lavender: {
    name: '薰衣草',
    primary: '#E6E6FA',
    secondary: '#C8A2C8',
    highlight: '#FFFFFF',
    shadow: '#9F8FB0',
  },
};
```

切换主题时，Renderer 重新读取 `theme` 引用，无需重建 PhysicsEngine。

## 6. uni-app 集成要点

### 6.1 manifest.json

```json
{
  "name": "BubbleTouch",
  "appid": "",
  "description": "起泡胶触感解压小程序",
  "versionName": "0.1.0",
  "versionCode": "1",
  "transformPx": false,
  "app-plus": { /* 暂时不配置 */ },
  "h5": {
    "title": "Bubble Touch",
    "router": {
      "mode": "hash"
    },
    "devServer": {
      "port": 8080
    }
  },
  "vueVersion": "3"
}
```

### 6.2 pages.json

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "Bubble Touch",
        "navigationStyle": "custom"
      }
    }
  ]
}
```

### 6.3 index.vue 主页面

模板结构：

```vue
<template>
  <view class="container">
    <canvas
      canvas-id="bubbleCanvas"
      class="bubble-canvas"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
    />
    <view class="theme-switcher">
      <button @click="setTheme('sakura')">🌸</button>
      <button @click="setTheme('mist')">🌊</button>
      <button @click="setTheme('lavender')">💜</button>
    </view>
  </view>
</template>
```

生命周期：`onReady` 中获取 Canvas 2D 上下文 + 初始化 PhysicsEngine + 启动 RAF 循环。

## 7. 性能预算

| 项 | 目标 | 警戒线 |
|----|------|--------|
| 网格更新耗时 | < 4ms | > 8ms 触发掉帧 |
| 渲染耗时 | < 4ms | > 8ms 触发掉帧 |
| 总帧时间 | < 16.6ms (60fps) | > 20ms (50fps) |
| 内存占用 | < 20MB | > 50MB |

**降级策略**（在 PhysicsEngine 中实现）：
- 连续 30 帧 > 20ms → 自动减小网格到 16×16
- 连续 30 帧 < 10ms 且 < 16×16 → 自动升回 20×20

## 8. 跨平台兼容性

- **H5 端**：mouse + touch 双事件，Canvas 2D 直接使用
- **小程序端**：仅 touch，Canvas 2D 通过 uni-app 适配层
- **代码组织**：业务逻辑（physics.js、renderer.js、themes.js）写成纯 JS，不依赖 uni-app API；只有 input.js 和 index.vue 涉及平台差异

## 9. Risk & Mitigation

| 风险 | 缓解 |
|------|------|
| HBuilderX 安装/配置问题 | 提供降级路径：纯 npm + vite 命令行也能跑 |
| 20×20 网格在低端 H5 掉帧 | 实现自动降级到 16×16 |
| 第一次调参手感不对 | 物理参数暴露为运行时可调（URL query 或控制台） |
| uni-app Canvas 在不同浏览器表现差异 | 在 Chrome / Edge / Safari 三个浏览器各测一次 |

## 10. 测试策略

MVP 阶段**不做自动化测试**，原因：
- 物理引擎的"对"是手感测试，必须人眼看、人手按
- 自动化测试只能验证"代码不报错"，验证不了"像不像起泡胶"

MVP 测试清单（手动）：
1. Chrome DevTools Performance 录制 10 秒，FPS ≥ 50
2. 按压 + 松开循环 5 次，每次回弹时间在 3-5 秒
3. 切换 3 个主题，画面正确刷新
4. 用 Chrome Touch 模拟器测试触摸事件
5. 鼠标按下测试（H5 特有）
