export const FORMULA_PRESETS = [
  {
    id: "circle",
    name: "圆孔",
    latex: String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.34}\right)`,
  },
  {
    id: "double-slit",
    name: "双缝",
    latex: String.raw`\operatorname{rect}\left(\frac{y}{1.16}\right)\cdot\left[\operatorname{rect}\left(\frac{x-0.18}{0.09}\right)+\operatorname{rect}\left(\frac{x+0.18}{0.09}\right)\right]`,
  },
  {
    id: "square",
    name: "方孔",
    latex: String.raw`\operatorname{rect}\left(\frac{x}{0.56}\right)\cdot\operatorname{rect}\left(\frac{y}{0.56}\right)`,
  },
  {
    id: "vortex",
    name: "涡旋相位",
    latex: String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.42}\right)\cdot e^{i\,3\operatorname{atan2}(y,x)}`,
  },
];
