import assert from "node:assert/strict";
import test from "node:test";
import {
  APERTURE_STORAGE_KEY,
  decodeAperture,
  encodeAperture,
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
