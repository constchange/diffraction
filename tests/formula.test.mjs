import assert from "node:assert/strict";
import test from "node:test";
import { evaluateScreenFunction, latexToExpression } from "../src/core/formula.js";
import { COMMON_LIBRARY_PRESETS, FORMULA_PRESETS } from "../src/core/presets.js";

test("LaTeX fractions and optical helper functions are converted", () => {
  const expression = latexToExpression(String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.4}\right)`);
  assert.match(expression, /circ/);
  assert.match(expression, /sqrt/);
  assert.doesNotMatch(expression, /\\frac/);
});

test("circle preset creates a bounded greyscale aperture", () => {
  const { amplitude } = evaluateScreenFunction(FORMULA_PRESETS[0].latex, 32);
  assert.equal(amplitude.length, 1024);
  assert.ok(amplitude.some((value) => value === 1));
  assert.ok(amplitude.some((value) => value === 0));
  assert.ok(amplitude.every((value) => value >= 0 && value <= 1));
});

test("complex vortex preset keeps phase while displaying unit modulus", () => {
  const { amplitude, phase } = evaluateScreenFunction(FORMULA_PRESETS[3].latex, 32);
  const activePhases = [];
  for (let index = 0; index < amplitude.length; index += 1) {
    if (amplitude[index] > 0.9) activePhases.push(phase[index]);
  }
  assert.ok(activePhases.length > 20);
  assert.ok(Math.max(...activePhases) - Math.min(...activePhases) > 3);
});

test("the common library provides eight valid function-mode optical screens", () => {
  assert.deepEqual(
    COMMON_LIBRARY_PRESETS.map((preset) => preset.name),
    ["单缝", "等宽双缝", "不等宽双缝", "5条缝", "矩孔", "圆孔", "普通光栅（16线）", "余弦光栅（16线）"],
  );
  for (const preset of COMMON_LIBRARY_PRESETS) {
    assert.ok(preset.latex.length > 0 && preset.latex.length <= 1200, `${preset.name} formula length`);
    const { amplitude, phase } = evaluateScreenFunction(preset.latex, 64);
    assert.equal(amplitude.length, 64 * 64);
    assert.ok(amplitude.some((value) => value > 0), `${preset.name} should transmit light`);
    assert.ok(amplitude.every((value) => value >= 0 && value <= 1), `${preset.name} amplitude bounds`);
    assert.ok(phase.every(Number.isFinite), `${preset.name} phase values`);
  }
});
