import assert from "node:assert/strict";
import test from "node:test";
import {
  createSpatialFilter,
  createSpatialObject,
  spatialFilterField,
} from "../src/core/spatialFilter.js";
import { fft2dField } from "../src/core/fft.js";
import { imageDataToAmplitudeField } from "../src/core/imageField.js";

function imageIntensity(field) {
  return field.real.map((value, index) => value ** 2 + field.imag[index] ** 2);
}

test("an image preset becomes a bounded grayscale amplitude field", () => {
  const image = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      255, 0, 0, 255,
      0, 255, 0, 255,
    ]),
  };
  const field = imageDataToAmplitudeField(image, 2);
  assert.deepEqual(Array.from(field.phase), [0, 0, 0, 0]);
  assert.equal(field.amplitude[0], 0);
  assert.equal(field.amplitude[1], 1);
  assert.ok(field.amplitude[2] > 0.21 && field.amplitude[2] < 0.22);
  assert.ok(field.amplitude[3] > 0.71 && field.amplitude[3] < 0.72);
});

test("an open 4f filter reconstructs the input complex field", () => {
  const size = 32;
  const object = createSpatialObject(size, "edges");
  const filter = createSpatialFilter(size, "open");
  const result = spatialFilterField(object, filter, size);
  for (let index = 0; index < object.amplitude.length; index += 1) {
    assert.ok(Math.abs(result.image.real[index] - object.amplitude[index]) < 1e-5);
    assert.ok(Math.abs(result.image.imag[index]) < 1e-5);
  }
});

test("a high-pass filter suppresses a uniform object's central field", () => {
  const size = 64;
  const object = {
    amplitude: new Float32Array(size * size).fill(1),
    phase: new Float32Array(size * size),
  };
  const filter = createSpatialFilter(size, "high-pass", { radius: 0.2 });
  const result = spatialFilterField(object, filter, size);
  const intensity = imageIntensity(result.image);
  let centralSum = 0;
  let centralCount = 0;
  let totalSum = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = intensity[y * size + x];
      totalSum += value;
      if (x >= size / 4 && x < (3 * size) / 4 && y >= size / 4 && y < (3 * size) / 4) {
        centralSum += value;
        centralCount += 1;
      }
    }
  }
  assert.ok(centralSum / centralCount < totalSum / intensity.length);
});

test("spatial filter presets produce bounded complex transmittance", () => {
  for (const kind of ["low-pass", "high-pass", "horizontal", "vertical", "notch", "abbe", "phase-contrast"]) {
    const filter = createSpatialFilter(32, kind);
    assert.equal(filter.amplitude.length, 32 * 32);
    assert.ok(filter.amplitude.every((value) => value >= 0 && value <= 1));
    assert.ok(filter.phase.every(Number.isFinite));
  }
});

test("the 4f Fourier plane matches the Fraunhofer FFT intensity", () => {
  const size = 32;
  const fftSize = 64;
  const object = createSpatialObject(size, "edges");
  const filter = createSpatialFilter(size, "open");
  const spatial = spatialFilterField(object, filter, size, fftSize).spectrum;
  const fraunhofer = fft2dField(object.amplitude, object.phase, size, fftSize);
  for (let index = 0; index < spatial.real.length; index += 1) {
    const spatialIntensity = spatial.real[index] ** 2 + spatial.imag[index] ** 2;
    const fraunhoferIntensity = fraunhofer.real[index] ** 2 + fraunhofer.imag[index] ** 2;
    assert.ok(Math.abs(spatialIntensity - fraunhoferIntensity) < 1e-5);
  }
});
