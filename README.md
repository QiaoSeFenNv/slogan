# Bubble Touch

> 起泡胶触感解压 H5 Demo —— 按下去，慢慢回弹（3-5 秒），像真的果冻一样。

Phase 1 MVP: 验证"慢回弹"手感的核心交互。uni-app Vue 3 + Vite，纯前端、Canvas 2D 渲染、自研弹簧-阻尼-塑性物理引擎。

---

## 快速开始

需要 Node.js 18+。

```bash
# 1) 安装依赖
npm install

# 2) 启动 H5 dev server (默认端口 8080)
npm run dev:h5

# 3) 浏览器打开
#    http://localhost:8080
```

第一次 `npm install` 可能较慢（uni-app 依赖较重），建议使用国内镜像：

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

---

## 怎么玩

- **按压**：鼠标点击 / 触屏按下 —— 起泡胶凹陷
- **拖动**：按住拖动 —— 凹陷跟随手指
- **松开**：起泡胶慢回弹到原状（3-5 秒）
- **切换主题**：右下角三个按钮 🌸 / 🌊 / 💜

---

## 运行时调参 (URL Query)

无需改代码，可在浏览器地址栏后加参数，实时覆盖物理参数：

| 参数 | 默认 | 说明 |
|------|------|------|
| `elasticity` | `0.4` | 弹簧常数（越大越硬） |
| `damping` | `0.1` | 阻尼系数（影响回弹速度的视觉映射） |
| `plasticity` | `0.3` | 按压塑性系数 |
| `maxDeform` | `0.6` | 最大形变尺度 |
| `gridSize` | `20` | 网格分辨率（20 → 20×20 = 400 点） |

示例：

```
http://localhost:8080/?elasticity=0.6&damping=0.2&gridSize=16
```

调参建议：
- 想"更 Q 弹"：`elasticity=0.6`，`damping=0.05`
- 想"更软糯"：`elasticity=0.3`，`damping=0.2`，`plasticity=0.4`
- 低端机掉帧：`gridSize=16`

---

## 项目结构

```
E:/slogan/
├── src/
│   ├── pages/index/index.vue    # 主页面（Canvas + 主题按钮）
│   ├── static/themes.js          # 3 种主题色定义
│   ├── utils/
│   │   ├── physics.js            # PhysicsEngine 类（网格）
│   │   ├── point.js              # SpringDamperPlastic 类（单点）
│   │   ├── renderer.js           # Renderer 类（Canvas 2D 绘制）
│   │   └── input.js              # 鼠标/触摸事件归一化
│   ├── App.vue                   # uni-app 根组件
│   └── main.js                   # Vue 入口
├── pages.json                    # uni-app 页面配置
├── manifest.json                 # uni-app 应用配置（H5 优先）
├── package.json
├── vite.config.js
├── index.html                    # H5 入口
└── test-physics.js               # 物理引擎 Node 烟测脚本
```

---

## 设计要点

### 物理引擎（核心）

- **网格**：默认 20×20 = 400 个质点，分布在整个 Canvas 区域。
- **单点状态**（`SpringDamperPlastic`）：`restX/Y`（静止位置）、`x/y`（当前位置）、`vx/vy`（速度）、`plasticOffset`（塑性偏移，用于慢回弹）。
- **力**：弹簧力（指向 rest + plasticOffset）+ 阻尼力（减缓速度）+ 按压力（指向按下中心）。
- **按压影响**：以按下点为中心做高斯衰减（半径 = 短边的 15%）。
- **慢回弹原理**：按压时塑性偏移跟随当前位移，松手后偏移以 ~0.7/s 的速率衰减回 0，目标时间 4-5 秒。
- **稳定性**：物理积分内部做子步进（最大步长 1/120 秒），保证 60fps 下不振荡。

### 渲染层

- **主体**：用 triangle-strip 沿网格行绘制变形后的多边形，径向渐变填充（中心浅、边缘深），alpha 0.78。
- **气泡**：30 个静态圆，按双线性插值采样变形网格定位，alpha 0.18。
- **高光**：左上角白色椭圆旋转 -0.4 弧度，模拟光源。

### 输入处理

- 同时支持 mouse + touch，输入归一化为 `(x, y)` 画布内部坐标。
- 已处理：触屏后浏览器误触发 mouse 事件、窗口失焦时不卡在按下状态。

---

## 性能

- **目标**：Chrome / Safari / Edge 最新两个大版本，60fps
- **降级**：连续 30 帧 > 20ms 自动降到 16×16 网格；连续 30 帧 < 10ms 自动升回 20×20

---

## 跨浏览器兼容性（已测试）

| 浏览器 | 状态 | 备注 |
|--------|------|------|
| Chrome (桌面) | OK | 主要开发目标 |
| Edge (桌面) | OK | Chromium 同源 |
| Safari (macOS) | OK | `-webkit-tap-highlight-color` 已禁用 |
| Safari (iOS) | OK | 触摸事件正常，需用手机模式测试 |
| 微信内置浏览器 | 待验证 | uni-app H5 兼容，但未在本环境验证 |

可能的坑：
- **触屏 + mouse 兼容事件**：Chrome 在 touchend 后会补发 mousedown/mouseup，已在 input.js 中用 `activeSource` 区分。
- **iOS Safari 滚动**：canvas 设了 `touch-action: none`，禁止页面滚动。
- **高 DPR**：`canvas.width = rect.width * devicePixelRatio`，避免糊。

---

## 开发命令

```bash
npm run dev:h5         # 启动 H5 dev server
npm run build:h5       # 打包生产构建到 dist/build/h5
npm run test:physics   # Node 烟测物理引擎（不需要浏览器）
```

---

## MVP 范围（已交付）

- [x] 单指按压起泡胶
- [x] 持续按压 + 释放慢回弹（3-5 秒）
- [x] 一整块半透明起泡胶（80% 屏幕，多层叠加）
- [x] 3 种主题色切换（樱花粉 / 雾霭蓝 / 薰衣草）
- [x] 60fps（H5 主流浏览器）
- [x] 单文件无后端依赖

## MVP 不做（Phase 2+）

- ASMR 音效
- 揉捏 / 拉伸 / 拍打交互
- 内部气泡浮动动画
- 用户统计
- 微信小程序编译产物（用户账号未注册）
- 多主题扩展（双色 / 彩虹）

---

## 技术细节参考

- PRD：`E:\slogan\.trellis\tasks\09-22-bubble-touch-mvp\prd.md`
- 技术设计：`E:\slogan\.trellis\tasks\09-22-bubble-touch-mvp\design.md`
- 执行计划：`E:\slogan\.trellis\tasks\09-22-bubble-touch-mvp\implement.md`
- 产品方案：`E:\slogan\Bubble-Touch-产品方案.md`