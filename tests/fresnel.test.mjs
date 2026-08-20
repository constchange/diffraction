import assert from "node:assert/strict";
import test from "node:test";
import {
  createFresnelAperture,
  fresnelPropagate,
  referenceFresnelNumber,
  renderFresnelField,
} from "../src/core/fresnel.js";

function intensity(field, index) {
  return field.real[index] ** 2 + field.imag[index] ** 2;
}

test("zero-distance Fresnel propagation reconstructs the complex aperture", () => {
  const size = 32;
  const aperture = createFresnelAperture(size, "rings");
  const result = fresnelPropagate(aperture, { size, fftSize: 64, distanceM: 0 });
  for (let index = 0; index < aperture.amplitude.length; index += 1) {
    assert.ok(Math.abs(result.real[index] - aperture.amplitude[index]) < 1e-6);
    assert.ok(Math.abs(result.imag[index]) < 1e-6);
  }
});

test("a circular aperture produces a finite centrosymmetric Fresnel field", () => {
  const size = 48;
  const aperture = createFresnelAperture(size, "circle");
  const result = fresnelPropagate(aperture, {
    size,
    fftSize: 64,
    wavelengthNm: 532,
    distanceM: 0.7,
    planeWidthMm: 7,
  });
  assert.ok(result.peakIntensity > 0);
  assert.ok(result.real.every(Number.isFinite));
  assert.ok(result.imag.every(Number.isFinite));
  for (let y = 4; y < size - 4; y += 5) {
    for (let x = 4; x < size - 4; x += 5) {
      const opposite = (size - 1 - y) * size + size - 1 - x;
      const current = y * size + x;
      assert.ok(Math.abs(intensity(result, current) - intensity(result, opposite)) < 2e-5);
    }
  }
});

test("distance and wavelength change the near-field intensity distribution", () => {
  const size = 32;
  const aperture = createFresnelAperture(size, "double-hole");
  const near = fresnelPropagate(aperture, { size, fftSize: 64, distanceM: 0.2, wavelengthNm: 532 });
  const far = fresnelPropagate(aperture, { size, fftSize: 64, distanceM: 1.2, wavelengthNm: 650 });
  let difference = 0;
  for (let index = 0; index < near.real.length; index += 1) {
    difference += Math.abs(intensity(near, index) - intensity(far, index));
  }
  assert.ok(difference > 1);
});

test("Fresnel rendering stays bounded and preserves a black background", () => {
  const size = 32;
  const aperture = createFresnelAperture(size, "single-slit");
  const field = fresnelPropagate(aperture, { size, fftSize: 64, distanceM: 0.6 });
  const pixels = renderFresnelField(field, 632, "enhanced");
  assert.equal(pixels.length, size * size * 4);
  assert.ok(pixels.every((value) => value >= 0 && value <= 255));
  for (let index = 3; index < pixels.length; index += 4) assert.equal(pixels[index], 255);
});

test("reference Fresnel number follows inverse wavelength-distance scaling", () => {
  const base = referenceFresnelNumber(8, 500, 0.5);
  assert.ok(Math.abs(referenceFresnelNumber(8, 500, 1) - base / 2) < 1e-12);
  assert.ok(Math.abs(referenceFresnelNumber(8, 1000, 0.5) - base / 2) < 1e-12);
});

test("every Fresnel aperture preset is nonempty, bounded, and structurally distinct", () => {
  const kinds = ["circle", "square", "single-slit", "double-hole", "rings"];
  const signatures = new Set();
  for (const kind of kinds) {
    const aperture = createFresnelAperture(64, kind);
    let open = 0;
    let weightedSignature = 0;
    for (let index = 0; index < aperture.amplitude.length; index += 1) {
      const value = aperture.amplitude[index];
      assert.ok(value >= 0 && value <= 1);
      assert.equal(aperture.phase[index], 0);
      if (value > 0) open += 1;
      weightedSignature += value * ((index % 67) + 1);
    }
    assert.ok(open > 0 && open < aperture.amplitude.length);
    signatures.add(`${open}:${weightedSignature}`);
  }
  assert.equal(signatures.size, kinds.length);
});
