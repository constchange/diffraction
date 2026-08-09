import assert from "node:assert/strict";
import test from "node:test";
import { fft1d, fft2dField, fft2dIntensity, sampleComplexIntensity } from "../src/core/fft.js";
import { paintStampInto } from "../src/core/drawing.js";

test("fft1d rejects non-power-of-two inputs", () => {
  assert.throws(() => fft1d(new Float64Array(6), new Float64Array(6)), /2 的整数次幂/);
});

test("a point aperture has a flat far-field intensity", () => {
  const size = 8;
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  amplitude[4 * size + 4] = 1;
  const intensity = fft2dIntensity(amplitude, phase, size);
  for (const value of intensity) assert.ok(Math.abs(value - 1) < 1e-6);
});

test("a uniform aperture concentrates energy at the centred origin", () => {
  const size = 8;
  const amplitude = new Float32Array(size * size).fill(1);
  const phase = new Float32Array(size * size);
  const intensity = fft2dIntensity(amplitude, phase, size);
  const centre = intensity[4 * size + 4];
  assert.ok(Math.abs(centre - 1) < 1e-6);
  assert.ok(intensity[0] < 1e-8);
});

test("diagonally separated circular apertures produce perpendicular interference fringes", () => {
  const size = 256;
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  for (const [x, y] of [[82, 174], [174, 82]]) {
    paintStampInto({ amplitude, phase, size, x, y, radius: 16, tool: "circle", transmission: 1 });
  }

  const intensity = fft2dIntensity(amplitude, phase, size);
  const centre = size / 2;
  const alongFringe = intensity[(centre + 2) * size + centre + 2];
  const acrossFringe = intensity[(centre - 2) * size + centre + 2];
  assert.ok(alongFringe > acrossFringe * 10, `${alongFringe} should exceed ${acrossFringe}`);
});

test("complex-field interpolation resolves the analytic first zero of two translated holes", () => {
  const sourceSize = 256;
  const fftSize = 512;
  const separation = 92;
  const amplitude = new Float32Array(sourceSize * sourceSize);
  const phase = new Float32Array(sourceSize * sourceSize);
  for (const x of [82.5, 174.5]) {
    paintStampInto({ amplitude, phase, size: sourceSize, x, y: 128.5, radius: 16, tool: "circle", transmission: 1 });
  }

  const field = fft2dField(amplitude, phase, sourceSize, fftSize);
  const centre = fftSize / 2;
  const analyticFirstZero = centre + fftSize / (2 * separation);
  const interpolatedMinimum = sampleComplexIntensity(field, analyticFirstZero, centre);
  const nearestBin = sampleComplexIntensity(field, Math.round(analyticFirstZero), centre);

  assert.ok(interpolatedMinimum < 1e-5, `minimum was ${interpolatedMinimum}`);
  assert.ok(nearestBin > 1e-3, "the test must exercise a zero located between FFT bins");
});
