# 启慧研习院 · 波动光学实验室

一个包含夫朗禾费衍射与 4f 空间滤波的交互式波动光学实验网页。两个实验都由浏览器内的二维 FFT 实时计算；第三个菲涅尔衍射实验已预留为后续同级标签。

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

- `src/components/ExperimentWorkspace.jsx`：实验标签页外壳，切换时保留夫朗禾费实验状态。
- `src/components/FraunhoferLab.jsx`：独立实验组件，可被更大 React 应用直接导入。
- `src/components/SpatialFilteringLab.jsx`：物面、频谱/滤波面、像面组成的 4f 空间滤波实验。
- `src/core/spatialFilter.js`：复振幅物场、复滤波函数、正逆二维 FFT 与强度渲染。
- `src/components/ApertureEditor.jsx`：画笔、橡皮、圆/方/长方/六边形/三角形与透光率编辑。
- `src/core/formula.js`：LaTeX 屏函数转换、复数求值与内置屏函数预设。
- `src/workers/`：复屏函数求值与二维 FFT 均在 Web Worker 中执行，避免阻塞界面。
- `src/embed.jsx`：面向非 React 宿主的挂载入口。
- `src/components/CommunityApertures.jsx`：公共衍射屏的浏览、上传、覆盖、删除与载入界面。
- `edge-functions/api/community-apertures/`：EdgeOne 服务端 API，执行 IP 上传档位、首次引导、审核与 CloudBase RPC 调用。
- 官网仓库 `cloudbase/migrations/20261114020000_diffraction_community.sql`：独立的 `diffraction_private` 数据结构和受控 RPC；本仓库的 `supabase/` 仅保留旧部署历史。

屏函数坐标约定为 `x,y ∈ [-1,1]`，支持 `rect`、`circ`、`tri`、`sin`、`cos`、`exp`、`sqrt`、`abs`、`atan2` 与复数单位 `i`。屏函数的模会被限制到 `[0,1]`，相位参与衍射计算但不在衍射屏灰度预览中显示。

## 数值与实时策略

- 绘图显示使用 768² 平滑画布，物理屏函数保留 256² 的带面积覆盖率采样；连续笔迹按线段胶囊栅格化，避免逐点圆章带来的粗糙和形状漂移。
- 绘图过程只更新编辑器本地缓冲区，物理计算以固定 100 ms 节拍读取最新状态，不会向 Worker 堆积过期任务。
- 拖动期间使用 512² 零填充复数 FFT；停止编辑 700 ms 后才执行一次 1024² 精细 FFT。
- 复光场、光屏插值和颜色合成都保留在 Worker 内；主线程只接收可直接绘制的 `ImageBitmap`，不会让大型复数数组进入 React 状态。
- 光屏先对复振幅作插值，再求模平方，最后才进行线性或增强显示映射；理论零光强不会再被“先取对数、后缩放”的旧流程抬亮。

## 腾讯 EdgeOne Pages 准备

项目是无后端的 Vite 静态应用。腾讯 EdgeOne Pages 使用以下构建设置：

```text
构建命令：npm run build
输出目录：dist/client
```

默认资源基路径为 `/`，适合绑定在独立域名根路径，避免静态资源被错误解析成 `/assets/assets/...`。如果需要部署到子路径，可在构建环境中设置 `VITE_BASE_PATH=/子路径/`。

### 公共衍射屏数据库

公共空间使用官网的 CloudBase PostgreSQL 环境，但数据全部位于独立的 `diffraction_private` schema。迁移只能通过官网仓库的 `cloudbase/migrations/` 和发布设施执行；数据表不授权浏览器读写。EdgeOne 同源函数以 CloudBase 的公开匿名凭据调用 `public.diffraction_community_call`，并提供仅服务端持有的模块令牌。数据库只存该令牌的 SHA-256 哈希，不存明文。

EdgeOne 项目环境变量为：

```text
CLOUDBASE_ENV=官网 CloudBase 环境 ID
CLOUDBASE_PUBLISHABLE_KEY_1=公开凭据前半段
CLOUDBASE_PUBLISHABLE_KEY_2=公开凭据后半段
DIFFRACTION_SERVER_TOKEN=独立生成的高熵服务端令牌
```

CloudBase 公开凭据拆成两段，是因为 EdgeOne 对单个环境变量有 1000 字符限制。两段拼接后仍只是 `anon` 凭据；真正的访问控制依赖模块令牌和数据库私有表权限。旧的 `SUPABASE_URL`、`SUPABASE_KEY` 应在新部署核验后移除。

公共空间使用 `request.eo.clientIp` 获取 EdgeOne 提供的真实客户端 IP，再由 CloudBase 私有库中的盐计算 HMAC-SHA-256 摘要。数据库不保存原始 IP，轮换模块令牌也不会改变档位归属；唯一约束保证每个 IP 摘要拥有独立的十个上传档位。首次访问引导也只登记这份摘要。公共列表分页且只返回 48×48 预览，点击载入时才按存档类型获取完整复振幅数据或 LaTeX 屏函数文本。

基础审核覆盖昵称/名称敏感词与已知违规图样哈希。词库位于 `diffraction_private.blocked_terms`；把已确认违规图样的 `pattern_hash` 写入 `diffraction_private.blocked_pattern_hashes` 后，数据库触发器会清除已有同哈希作品，服务端也会拒绝后续上传。该本地规则方案不能替代专业语义内容审核服务。

旧 Supabase 项目地址目前无法解析，且未找到旧数据和 IP 盐备份。本次 CloudBase 库从空数据重新启用；旧作品及原有 IP 档位不能自动继承。若以后找回备份，需另行设计合并，不能直接覆盖已启用的新盐。

## 嵌入其他网页

生产构建会额外输出稳定入口 `dist/client/embed.js`。宿主页面可使用 ES Module：

```html
<div id="diffraction-lab"></div>
<script type="module">
  import { mountFraunhoferLab } from "/path/to/embed.js";
  const unmount = mountFraunhoferLab(document.querySelector("#diffraction-lab"), {
    communityApiBase: "/api/community-apertures",
  });
  // 页面销毁时调用 unmount();
</script>
```

也可以用普通模块标签加载后，从 `window.FraunhoferLabEmbed.mountFraunhoferLab(...)` 调用；这为不方便使用命名导入的宿主保留了稳定入口。

如果希望嵌入包含两个实验标签的完整工作区，改用 `mountOpticsWorkspace(...)`：

```html
<script type="module">
  import { mountOpticsWorkspace } from "/path/to/embed.js";
  mountOpticsWorkspace(document.querySelector("#diffraction-lab"), {
    initialExperiment: "spatial-filter",
    communityApiBase: "/api/community-apertures",
  });
</script>
```

入口会自动注入一次作用域化界面样式和 KaTeX 样式；返回值负责清理 React 根节点。Web Worker 和图片资源由构建器以相对模块 URL 引用，适合与宿主程序分开发布。
