import assert from "node:assert/strict";
import test from "node:test";
import {
  coordinateScaleLatex,
  coordinateUnitLatex,
  fraunhoferObservationWidthMm,
  niceScaleBar,
  spatialSpectrumWidthPerMm,
} from "../src/core/coordinates.js";

test("coordinate labels use explicit LaTeX units", () => {
  assert.equal(coordinateUnitLatex("mm"), String.raw`\mathrm{mm}`);
  assert.equal(coordinateUnitLatex("inverse-mm"), String.raw`\mathrm{mm}^{-1}`);
  assert.equal(coordinateScaleLatex(1, "mm"), String.raw`1\,\mathrm{mm}`);
  assert.equal(coordinateScaleLatex(1, "inverse-mm"), String.raw`1\,(\mathrm{mm}^{-1})`);
});

test("Fraunhofer observation coordinates shrink inversely with viewing zoom", () => {
  const base = fraunhoferObservationWidthMm(1);
  assert.ok(base > 10 && base < 15);
  assert.ok(Math.abs(fraunhoferObservationWidthMm(2) - base / 2) < 1e-12);
});

test("spatial Fourier window has a calibrated reciprocal-millimetre span", () => {
  const span = spatialSpectrumWidthPerMm(8);
  assert.ok(Math.abs(span - 14.56551724137931) < 1e-10);
  assert.ok(Math.abs(spatialSpectrumWidthPerMm(16) - span / 2) < 1e-12);
});

test("scale bars choose a compact 1-2-5 engineering length", () => {
  assert.equal(niceScaleBar(9.3), 2);
  assert.equal(niceScaleBar(4), 1);
  assert.equal(niceScaleBar(0.8), 0.2);
});
