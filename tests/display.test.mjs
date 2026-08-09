import assert from "node:assert/strict";
import test from "node:test";
import { renderFieldRgba } from "../src/core/display.js";
import { paintStampInto } from "../src/core/drawing.js";
import { fft2dField } from "../src/core/fft.js";

test("worker-side screen rendering preserves an inter-bin double-hole minimum", () => {
  const sourceSize = 256;
  const fftSize = 512;
  const amplitude = new Float32Array(sourceSize * sourceSize);
  const phase = new Float32Array(sourceSize * sourceSize);
  for (const x of [82.5, 174.5]) {
    paintStampInto({
      amplitude,
      phase,
      size: sourceSize,
      x,
      y: 128.5,
      radius: 16,
      tool: "circle",
      transmission: 1,
    });
  }
  const field = fft2dField(amplitude, phase, sourceSize, fftSize);
  // At zoom 1.38 the first zero for a 92-pixel separation lands exactly
  // five output pixels from the centre of the 440-pixel observation screen.
  const pixels = renderFieldRgba(field, {
    wavelength: 532,
    focalLength: 1.2,
    whiteLight: false,
    zoom: 1.38,
    displayMode: "linear",
  });
  const centre = (220 * 440 + 220) * 4;
  const firstMinimum = (220 * 440 + 225) * 4;
  assert.ok(pixels[centre + 1] > 240, "central maximum should remain bright");
  assert.ok(
    pixels[firstMinimum] + pixels[firstMinimum + 1] + pixels[firstMinimum + 2] <= 2,
    "analytic zero should render black",
  );
});
