import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrandedPatternCanvas,
  createBrandedPatternCanvasFromFrame,
  createBrandedPatternDataUrl,
  drawExportWatermark,
  EXPORT_IMAGE_SIZE,
  EXPORT_WATERMARK,
} from "../src/core/exportPattern.js";

function createRecordingContext() {
  const calls = [];
  const context = {
    calls,
    font: "",
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
  assert.equal(result.width, EXPORT_IMAGE_SIZE);
  assert.equal(result.height, EXPORT_IMAGE_SIZE);
  assert.deepEqual(context.calls[0], ["drawImage", sourceCanvas, 0, 0, EXPORT_IMAGE_SIZE, EXPORT_IMAGE_SIZE]);
  assert.ok(context.calls.some((call) => call[0] === "fillText" && call[1] === EXPORT_WATERMARK));
  assert.equal(createBrandedPatternDataUrl(sourceCanvas), "data:image/png;base64,preview");
});

test("the 1024px export watermark is frameless Times-style text in the lower-right image area", () => {
  const context = createRecordingContext();
  const bounds = drawExportWatermark(context, EXPORT_IMAGE_SIZE, EXPORT_IMAGE_SIZE);

  assert.equal(EXPORT_WATERMARK, "夫朗禾费衍射仿真 (c)2026, Qi Hui Academy");
  assert.match(context.font, /italic 600 .*Times New Roman/);
  assert.ok(bounds.height >= 34 && bounds.height <= 38, "watermark should stay modest at 1024px");
  assert.ok(bounds.x > 450, "watermark should stay away from the central diffraction maximum");
  assert.ok(bounds.y > 950, "watermark should sit near the lower image edge");
  assert.ok(bounds.x + bounds.width <= EXPORT_IMAGE_SIZE);
  assert.ok(bounds.y + bounds.height <= EXPORT_IMAGE_SIZE);
  assert.equal(context.calls.some((call) => ["fill", "stroke", "fillRect"].includes(call[0])), false, "watermark should have no frame or badge");
});

test("a high-resolution worker frame is exported without falling back to the display canvas", () => {
  const { context, exportCanvas, sourceCanvas } = createCanvasFixture();
  const bitmap = { width: EXPORT_IMAGE_SIZE, height: EXPORT_IMAGE_SIZE };
  const result = createBrandedPatternCanvasFromFrame(
    { bitmap, width: EXPORT_IMAGE_SIZE, height: EXPORT_IMAGE_SIZE },
    sourceCanvas.ownerDocument,
  );

  assert.equal(result, exportCanvas);
  assert.deepEqual(context.calls[0], ["drawImage", bitmap, 0, 0, EXPORT_IMAGE_SIZE, EXPORT_IMAGE_SIZE]);
  assert.ok(context.calls.some((call) => call[0] === "fillText" && call[1] === EXPORT_WATERMARK));
});
