import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrandedPatternCanvas,
  createBrandedPatternDataUrl,
  drawExportWatermark,
  EXPORT_WATERMARK,
} from "../src/core/exportPattern.js";

function createRecordingContext() {
  const calls = [];
  const context = {
    calls,
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    beginPath: () => calls.push(["beginPath"]),
    closePath: () => calls.push(["closePath"]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    quadraticCurveTo: (...args) => calls.push(["quadraticCurveTo", ...args]),
    fill: () => calls.push(["fill"]),
    stroke: () => calls.push(["stroke"]),
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    fillText: (...args) => calls.push(["fillText", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
    measureText: (label) => ({ width: label.length * 11 }),
  };
  return context;
}

function createCanvasFixture(width = 440, height = 440) {
  const context = createRecordingContext();
  const exportCanvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toDataURL: (type) => `data:${type};base64,preview`,
  };
  const ownerDocument = {
    createElement: (tag) => {
      assert.equal(tag, "canvas");
      return exportCanvas;
    },
  };
  const sourceCanvas = { width, height, ownerDocument };
  return { context, exportCanvas, sourceCanvas };
}

test("exported diffraction images copy the rendered screen and embed the academy watermark", () => {
  const { context, exportCanvas, sourceCanvas } = createCanvasFixture();
  const result = createBrandedPatternCanvas(sourceCanvas);

  assert.equal(result, exportCanvas);
  assert.equal(result.width, 440);
  assert.equal(result.height, 440);
  assert.deepEqual(context.calls[0], ["drawImage", sourceCanvas, 0, 0, 440, 440]);
  assert.ok(context.calls.some((call) => call[0] === "fillText" && call[1] === EXPORT_WATERMARK));
  assert.equal(createBrandedPatternDataUrl(sourceCanvas), "data:image/png;base64,preview");
});

test("the export watermark stays compact and inside the lower-right image area", () => {
  const context = createRecordingContext();
  const bounds = drawExportWatermark(context, 440, 440);

  assert.ok(bounds.height <= 30, "watermark should remain visually compact");
  assert.ok(bounds.x > 150, "watermark should stay away from the central diffraction maximum");
  assert.ok(bounds.y > 390, "watermark should sit near the lower image edge");
  assert.ok(bounds.x + bounds.width <= 440);
  assert.ok(bounds.y + bounds.height <= 440);
});
