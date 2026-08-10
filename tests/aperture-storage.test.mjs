import assert from "node:assert/strict";
import test from "node:test";
import {
  APERTURE_STORAGE_KEY,
  decodeAperture,
  decodeScreenDefinition,
  encodeAperture,
  encodeScreenDefinition,
  readLocalApertures,
  writeLocalApertures,
} from "../src/core/apertureStorage.js";

test("compact aperture storage preserves amplitude and wrapped phase", () => {
  const size = 8;
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  for (let index = 0; index < amplitude.length; index += 1) {
    amplitude[index] = index / (amplitude.length - 1);
    phase[index] = -Math.PI + (2 * Math.PI * index) / (phase.length - 1);
  }

  const restored = decodeAperture(encodeAperture({ amplitude, phase }, size), size);
  for (let index = 0; index < amplitude.length; index += 1) {
    assert.ok(Math.abs(restored.amplitude[index] - amplitude[index]) <= 1 / 255 + 1e-6);
    const phaseError = Math.abs(Math.atan2(
      Math.sin(restored.phase[index] - phase[index]),
      Math.cos(restored.phase[index] - phase[index]),
    ));
    assert.ok(phaseError <= Math.PI / 32767 + 1e-5);
  }
});

test("local aperture collection rejects a sixth save", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const items = Array.from({ length: 5 }, (_, index) => ({
    id: String(index),
    data: { size: 8 },
  }));
  writeLocalApertures(storage, items);
  assert.equal(readLocalApertures(storage, 8).length, 5);
  assert.ok(values.has(APERTURE_STORAGE_KEY));
  assert.throws(() => writeLocalApertures(storage, [...items, items[0]]), /最多保存 5 个/);
});

test("screen definitions preserve function text without rasterizing it", () => {
  const formula = String.raw`\operatorname{rect}\left(\frac{x}{0.2}\right)`;
  const encoded = encodeScreenDefinition({ mode: "function", formula }, 256);
  assert.deepEqual(encoded, {
    format: "fraunhofer-formula-v1",
    size: 256,
    formula,
  });
  assert.deepEqual(decodeScreenDefinition(encoded, 256), { mode: "function", formula });
  assert.equal("amplitude" in encoded, false);
  assert.equal("phase" in encoded, false);
});

test("legacy raster saves load as drawing-mode definitions", () => {
  const size = 8;
  const aperture = {
    amplitude: new Float32Array(size * size),
    phase: new Float32Array(size * size),
  };
  aperture.amplitude[12] = 0.75;
  const restored = decodeScreenDefinition(encodeAperture(aperture, size), size);
  assert.equal(restored.mode, "draw");
  assert.ok(Math.abs(restored.aperture.amplitude[12] - 0.75) <= 1 / 255);
});
