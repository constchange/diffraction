# 启慧研习院 · 夫朗禾费衍射仿真

一个纯前端、可绘制复振幅屏函数的夫朗禾费衍射实验。衍射图样由浏览器内的二维 FFT 实时计算，不依赖后端服务。

## 本地开发

```bash
npm install
npm run dev
```

质量检查：

```bash
npm test
npm run build
npm run test:sites
```

## 功能结构

- `src/components/FraunhoferLab.jsx`：独立实验组件，可被更大 React 应用直接导入。
- `src/components/ApertureEditor.jsx`：画笔、橡皮、圆/方/长方/六边形/三角形与透光率编辑。
- `src/core/formula.js`：LaTeX 屏函数转换、复数求值与内置屏函数预设。
- `src/workers/`：复屏函数求值与二维 FFT 均在 Web Worker 中执行，避免阻塞界面。
- `src/embed.jsx`：面向非 React 宿主的挂载入口。

屏函数坐标约定为 `x,y ∈ [-1,1]`，支持 `rect`、`circ`、`tri`、`sin`、`cos`、`exp`、`sqrt`、`abs`、`atan2` 与复数单位 `i`。屏函数的模会被限制到 `[0,1]`，相位参与衍射计算但不在衍射屏灰度预览中显示。

## 数值与实时策略

- 绘图显示使用 768² 平滑画布，物理屏函数保留 256² 的带面积覆盖率采样；连续笔迹按线段胶囊栅格化，避免逐点圆章带来的粗糙和形状漂移。
- 绘图过程只更新编辑器本地缓冲区，物理计算以固定 100 ms 节拍读取最新状态，不会向 Worker 堆积过期任务。
- 拖动期间使用 512² 零填充复数 FFT；停止编辑 700 ms 后才执行一次 1024² 精细 FFT。
- 复光场、光屏插值和颜色合成都保留在 Worker 内；主线程只接收可直接绘制的 `ImageBitmap`，不会让大型复数数组进入 React 状态。
- 光屏先对复振幅作插值，再求模平方，最后才进行线性或增强显示映射；理论零光强不会再被“先取对数、后缩放”的旧流程抬亮。

## 腾讯 EdgeOne Pages 准备

项目是无后端的 Vite 静态应用，构建命令为 `npm run build`，静态发布目录为 `dist/client`。`base` 使用相对路径，便于从 GitHub 连接腾讯 EdgeOne Pages，并部署在独立域名或子路径。

## 嵌入其他网页

生产构建会额外输出稳定入口 `dist/client/embed.js`。宿主页面可使用 ES Module：

```html
<div id="diffraction-lab"></div>
<script type="module">
  import { mountFraunhoferLab } from "/path/to/embed.js";
  const unmount = mountFraunhoferLab(document.querySelector("#diffraction-lab"));
  // 页面销毁时调用 unmount();
</script>
```

也可以用普通模块标签加载后，从 `window.FraunhoferLabEmbed.mountFraunhoferLab(...)` 调用；这为不方便使用命名导入的宿主保留了稳定入口。

入口会自动注入一次作用域化界面样式和 KaTeX 样式；返回值负责清理 React 根节点。Web Worker 和图片资源由构建器以相对模块 URL 引用，适合与宿主程序分开发布。
