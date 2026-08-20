import assert from "node:assert/strict";
import test from "node:test";
import {
  fraunhoferObservationWidthMm,
  niceScaleBar,
  spatialSpectrumWidthPerMm,
} from "../src/core/coordinates.js";

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
