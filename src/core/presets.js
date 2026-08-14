function slitArrayLatex(count, spacing, width) {
  const centre = (count - 1) / 2;
  const slits = Array.from({ length: count }, (_, index) => {
    const position = (index - centre) * spacing;
    const signedPosition = position >= 0 ? `x-${position.toFixed(4)}` : `x+${Math.abs(position).toFixed(4)}`;
    return String.raw`\operatorname{rect}\left(\frac{${signedPosition}}{${width}}\right)`;
  });
  return String.raw`\operatorname{rect}\left(\frac{y}{1.16}\right)\cdot\left[${slits.join("+")}\right]`;
}

const VORTEX_PHASE_LATEX = String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.42}\right)\cdot e^{i\,3\operatorname{atan2}(y,x)}`;

export const COMMON_LIBRARY_PRESETS = Object.freeze([
  {
    id: "single-slit",
    name: "单缝",
    description: "窄缝衍射",
    latex: String.raw`\operatorname{rect}\left(\frac{x}{0.10}\right)\cdot\operatorname{rect}\left(\frac{y}{1.16}\right)`,
  },
  {
    id: "equal-double-slit",
    name: "等宽双缝",
    description: "相同缝宽",
    latex: slitArrayLatex(2, 0.36, 0.09),
  },
  {
    id: "unequal-double-slit",
    name: "不等宽双缝",
    description: "不同缝宽",
    latex: String.raw`\operatorname{rect}\left(\frac{y}{1.16}\right)\cdot\left[\operatorname{rect}\left(\frac{x-0.20}{0.07}\right)+\operatorname{rect}\left(\frac{x+0.20}{0.13}\right)\right]`,
  },
  {
    id: "five-slits",
    name: "5条缝",
    description: "多缝干涉",
    latex: slitArrayLatex(5, 0.18, 0.055),
  },
  {
    id: "rectangular-aperture",
    name: "矩孔",
    description: "矩形孔径",
    latex: String.raw`\operatorname{rect}\left(\frac{x}{0.52}\right)\cdot\operatorname{rect}\left(\frac{y}{0.30}\right)`,
  },
  {
    id: "circular-aperture",
    name: "圆孔",
    description: "艾里斑",
    latex: String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.34}\right)`,
  },
  {
    id: "binary-grating-16",
    name: "普通光栅（16线）",
    description: "等宽等距狭缝",
    latex: slitArrayLatex(16, 0.11, 0.035),
  },
  {
    id: "cosine-grating-16",
    name: "余弦光栅（16线）",
    description: "正弦振幅调制",
    latex: String.raw`\operatorname{rect}\left(\frac{y}{1.16}\right)\cdot\frac{1+\cos\left(16\pi x\right)}{2}`,
  },
  {
    id: "vortex",
    name: "涡旋相位",
    description: "三阶螺旋相位",
    latex: VORTEX_PHASE_LATEX,
  },
  {
    id: "annular-aperture",
    name: "环形孔",
    description: "环形通光带",
    latex: String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.48}\right)-\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.26}\right)`,
  },
  {
    id: "gaussian-aperture",
    name: "高斯孔径",
    description: "柔边振幅窗",
    latex: String.raw`e^{-5\left(x^2+y^2\right)}`,
  },
  {
    id: "cosine-zone-plate",
    name: "余弦波带片",
    description: "同心二次条纹",
    latex: String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.58}\right)\cdot\frac{1+\cos\left(22\cdot\pi\cdot\left(x^2+y^2\right)\right)}{2}`,
  },
]);

export const FORMULA_PRESETS = [
  {
    id: "circle",
    name: "圆孔",
    latex: String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.34}\right)`,
  },
  {
    id: "double-slit",
    name: "双缝",
    latex: COMMON_LIBRARY_PRESETS.find((preset) => preset.id === "equal-double-slit").latex,
  },
  {
    id: "square",
    name: "方孔",
    latex: String.raw`\operatorname{rect}\left(\frac{x}{0.56}\right)\cdot\operatorname{rect}\left(\frac{y}{0.56}\right)`,
  },
  {
    id: "vortex",
    name: "涡旋相位",
    latex: VORTEX_PHASE_LATEX,
  },
];
