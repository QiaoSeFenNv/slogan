# Bubble Touch MVP — Implementation Plan

## 实施原则

1. **每步可验证**：每完成一步，跑一下确认能跑，再进下一步
2. **物理引擎优先**：先把纯 JS 的物理引擎写出来（不依赖 uni-app），便于单独调试手感
3. **降级路径必备**：如果 HBuilderX 出问题，提供纯 npm + vite 命令行方案

## 步骤清单

### Step 1: 搭建 uni-app 项目骨架

**目标：** `npm run dev:h5` 能跑出空白页

**操作：**
- 创建 `package.json`（依赖：`@dcloudio/uni-app`、`@dcloudio/uni-h5`、`vue`、`vite`）
- 创建 `src/main.js`、`src/App.vue`
- 创建 `pages.json`、`manifest.json`（按 design.md §6.1 / §6.2）
- 创建 `src/pages/index/index.vue`（空白 `<view>` 即可）
- 创建 `index.html`（H5 入口）
- 创建 `vite.config.js`

**验证命令：**
```bash
cd E:/slogan
npm install
npm run dev:h5
# 浏览器打开 http://localhost:8080，能看到空白页
```

**风险：** HBuilderX 不强制要求，但用 vite + 命令行也行。如果 npm install 慢，换淘宝镜像。

**回滚：** 直接 `rm -rf node_modules` 不影响项目代码。

---

### Step 2: 实现物理引擎核心（无 uni-app 依赖）

**目标：** 写一个独立的 `physics.js`，能在 Node.js 中跑起来做单元冒烟测试

**文件：**
- `src/utils/point.js` — `SpringDamperPlastic` 类
- `src/utils/physics.js` — `PhysicsEngine` 类

**验证：**
- Node.js 写一个 50 行的脚本 `test-physics.js`，模拟 1000 帧的按压+松开循环，输出每帧的形变数据
- **人工检查：** 形变曲线是否符合预期（按下时位移增大、松开后按指数衰减到 0）

**风险：** 物理参数可能手感不对。**这就是为什么物理引擎先单独写** —— 可以在没有 UI 的情况下，用图形化工具（matplotlib/Plotly）画出形变曲线调试。

**回滚：** 文件单独写在一个目录，删掉不影响其他步骤。

---

### Step 3: 实现渲染层

**目标：** Canvas 2D 能画出形变后的网格

**文件：**
- `src/utils/renderer.js` — `Renderer` 类

**实现：**
- `render()` 方法每帧调用，清屏 + 画主体 + 画气泡 + 画高光
- **画主体：** 用三角形带（triangle strip）连接相邻网格点，填充径向渐变
- **画气泡：** 30 个静态圆，alpha 较低
- **画高光：** 左上角 ellipse，white alpha 0.3

**验证：**
- 在 `index.vue` 中 hardcode 一个网格（比如 5×5，全部向下偏移 10px），调用 Renderer 渲染
- 浏览器里能看到网格被画出

**风险：** Canvas 渲染性能。三角形带的 draw call 数量 = (N-1)² × 2，20×20 网格是 722 个三角形，H5 应该没问题。

---

### Step 4: 集成触摸事件

**目标：** 手指按下能看到凹陷

**文件：**
- `src/utils/input.js` — 输入归一化
- `src/pages/index/index.vue` — 绑定事件 + 主循环

**实现：**
- `input.js` 暴露 `onPress / onMove / onRelease` 三个回调
- `index.vue` 在 `onReady` 中：
  - 获取 Canvas 2D context
  - 初始化 PhysicsEngine + Renderer
  - 启动 RAF 循环（每帧调用 `engine.update(dt)` + `renderer.render()`）
  - 绑定触摸事件 → input.js → physics.press/release

**验证：**
- Chrome DevTools 切到手机模式
- 鼠标按下 Canvas，能看到形变
- 鼠标松开，能看到回弹

**风险：** uni-app Canvas 在 H5 端的坐标系统（CSS px vs canvas internal px）需要转换。**用 clientX/Y 直接传**，避免 dp/px 换算问题。

---

### Step 5: 主题切换

**目标：** 3 个按钮，点击切换颜色

**文件：**
- `src/static/themes.js`
- `src/pages/index/index.vue` — 加按钮 + 切换逻辑

**实现：**
- 主题对象 `{ primary, secondary, highlight, shadow }`
- 切换时只更新 `renderer.theme = themes[name]`，下一帧自动生效
- 按钮放在右下角，半透明，emoji 标识（🌸 / 🌊 / 💜）

**验证：** 点击 3 个按钮，颜色正确切换，控制台无报错。

---

### Step 6: 性能调优 + 手感调参

**目标：** FPS ≥ 50，回弹时间 3-5 秒

**操作：**
- Chrome DevTools Performance 录制 10 秒按压+松开循环
- 看 PhysicsEngine.update 和 Renderer.render 各自耗时
- 如果掉帧：减小网格到 16×16
- 如果手感不对：调整 elasticity / damping / plasticity

**物理参数暴露：** 在 URL 加 `?elasticity=0.4&damping=0.1`，运行时读取覆盖默认值，方便对比测试。

**验证：**
- Performance 录制 FPS ≥ 50
- 用秒表测松开后回弹到底的时间，在 3-5 秒区间

---

### Step 7: 跨浏览器烟测

**目标：** Chrome / Edge / Safari 都能跑

**操作：**
- Edge 打开 `http://localhost:8080`，跑一遍
- Safari（如果可用）打开同一地址，跑一遍
- 检查控制台无报错

---

### Step 8: 写 README + 提交

**目标：** 项目能交付给别人接手

**文件：**
- `README.md` — 如何启动、如何调参、项目结构
- git init + 第一次 commit（如果项目需要 git）

---

## 验证矩阵

| 步骤 | 验证方式 | 通过标准 |
|------|----------|----------|
| 1 | `npm run dev:h5` 打开 | 看到空白页 |
| 2 | Node.js 跑物理引擎冒烟 | 形变曲线合理 |
| 3 | 浏览器渲染硬编码网格 | 看到网格 |
| 4 | 鼠标按下 Canvas | 看到形变 + 回弹 |
| 5 | 点击 3 个按钮 | 颜色切换正确 |
| 6 | Performance 录制 | FPS ≥ 50，回弹 3-5 秒 |
| 7 | 3 个浏览器跑一遍 | 都正常 |
| 8 | README 可读 | 新人能 10 分钟启动 |

## 风险与回滚

| 风险 | 触发条件 | 回滚动作 |
|------|----------|----------|
| HBuilderX / npm install 失败 | `npm install` 报错 | 切换到纯 npm + vite 命令行方案（design.md §1 已留降级路径）|
| 物理引擎手感完全不对 | Step 2 冒烟测试形变曲线异常 | 回 Step 2 重写 update 函数，参考方案 §五.2 算法 |
| Canvas 渲染性能差 | Performance 录制 FPS < 30 | 降级到 16×16 网格 |
| uni-app 事件回调异常 | 控制台报错 | 直接用 `addEventListener` 在 mounted 钩子里手动绑，不走 uni-app 模板语法 |
| 跨浏览器差异 | Safari 报错 | 在 input.js 中加 Safari 特定 workaround |

## 时间预估

| 步骤 | 预估时间 | 累计 |
|------|----------|------|
| 1 | 2h（npm install 慢可能要 3h）| 2h |
| 2 | 3h | 5h |
| 3 | 2h | 7h |
| 4 | 2h | 9h |
| 5 | 1h | 10h |
| 6 | 2h（可能多轮调参）| 12h |
| 7 | 1h | 13h |
| 8 | 1h | 14h |
| **合计** | **~2 个工作日** | - |

## 完成定义（Definition of Done）

✅ PRD 中所有 Acceptance Criteria 都勾选通过
✅ 在 Chrome 中能完整体验按压 + 慢回弹
✅ 3 个主题可切换
✅ README 写好
✅ trellis Phase 3.4 commit 完成
