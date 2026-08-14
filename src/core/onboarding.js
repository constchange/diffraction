export const ONBOARDING_STORAGE_KEY = "fraunhofer-onboarding-seen-v1";

export const ONBOARDING_STEPS = Object.freeze([
  {
    id: "draw",
    selector: '[data-tour="draw-tool"]',
    eyebrow: "从这里开始",
    title: "画出你的衍射屏",
    description: "用画笔、直线和几何形状绘制透光区域；下方还能调节尺寸与透光率。",
  },
  {
    id: "selection",
    selector: '[data-tour="selection-tool"]',
    eyebrow: "精细编辑",
    title: "选区、移动与缩放",
    description: "先用矩形选框圈住内容，再切换移动或缩放工具；按住 Shift 可保持比例。",
  },
  {
    id: "repeat",
    selector: '[data-tour="repeat-unit"]',
    eyebrow: "快速构造阵列",
    title: "重复当前单元",
    description: "选中一个单元后，可沿横向或纵向设置副本数量与间距，生成规则光栅。",
  },
  {
    id: "function",
    selector: '[data-tour="function-mode"]',
    eyebrow: "另一种编辑方式",
    title: "直接输入屏函数",
    description: "切换到屏函数模式，用 LaTeX 复函数精确描述振幅与相位分布。",
  },
  {
    id: "common-library",
    selector: '[data-tour="common-library"]',
    eyebrow: "从经典实验开始",
    title: "打开常用库",
    description: "一键载入单缝、双缝、圆孔、矩孔和 16 线光栅等经典屏函数，立即观察远场图样。",
  },
  {
    id: "creative-center",
    selector: '[data-tour="creative-center"]',
    eyebrow: "分享与发现",
    title: "探索创意中心",
    description: "上传当前衍射屏，也可以按名称浏览并载入其他同学分享的作品。",
  },
  {
    id: "local-save",
    selector: '[data-tour="local-save"]',
    eyebrow: "留住实验进度",
    title: "使用本地存取",
    description: "把常用衍射屏保存在当前浏览器，之后可随时载入继续实验。",
  },
  {
    id: "export",
    selector: '[data-tour="export"]',
    eyebrow: "记录观察结果",
    title: "导出高清图片",
    description: "一键保存带署名的 1024×1024 光屏图样，便于整理笔记与实验报告。",
  },
]);

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function calculateTourPlacement(
  targetRect,
  viewport,
  panel = { width: 340, height: 206 },
) {
  const margin = 12;
  const gap = 18;
  const width = Math.min(panel.width, Math.max(280, viewport.width - margin * 2));
  const height = panel.height;
  const belowSpace = viewport.height - targetRect.bottom - gap - margin;
  const aboveSpace = targetRect.top - gap - margin;
  const side = belowSpace >= height || belowSpace >= aboveSpace ? "below" : "above";
  const preferredTop = side === "below"
    ? targetRect.bottom + gap
    : targetRect.top - gap - height;

  return {
    side,
    width,
    left: clamp(
      targetRect.left + targetRect.width / 2 - width / 2,
      margin,
      Math.max(margin, viewport.width - width - margin),
    ),
    top: clamp(preferredTop, margin, Math.max(margin, viewport.height - height - margin)),
  };
}
