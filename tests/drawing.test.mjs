import assert from "node:assert/strict";
import test from "node:test";
import {
  moveApertureSelection,
  paintPolygonInto,
  paintRectangleInto,
  paintSegmentInto,
  paintStamp,
  paintStampInto,
  pointInShape,
  repeatApertureSelectionInto,
  repeatDrawingUnitInto,
} from "../src/core/drawing.js";

test("all built-in shape masks include their centre", () => {
  for (const shape of ["brush", "circle", "square", "rectangle", "hexagon", "triangle"]) {
    assert.equal(pointInShape(shape, 0, 0, 10), true, `${shape} should include centre`);
  }
});

test("a translucent stamp writes modulus and resets painted phase", () => {
  const size = 16;
  const aperture = {
    amplitude: new Float32Array(size * size),
    phase: new Float32Array(size * size).fill(1.4),
  };
  const result = paintStamp({ aperture, size, x: 8, y: 8, radius: 3, tool: "circle", transmission: 0.45 });
  assert.ok(Math.abs(result.amplitude[8 * size + 8] - 0.45) < 1e-6);
  assert.equal(result.phase[8 * size + 8], 0);
  assert.equal(result.amplitude[0], 0);
});

test("eraser makes the selected region completely opaque", () => {
  const size = 16;
  const aperture = {
    amplitude: new Float32Array(size * size).fill(1),
    phase: new Float32Array(size * size),
  };
  const result = paintStamp({ aperture, size, x: 8, y: 8, radius: 2, tool: "eraser", transmission: 1 });
  assert.equal(result.amplitude[8 * size + 8], 0);
  assert.equal(result.amplitude[0], 1);
});

test("a stroke can batch many stamps into one pair of buffers", () => {
  const size = 32;
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);

  for (let x = 5; x <= 27; x += 2) {
    paintStampInto({ amplitude, phase, size, x, y: 16, radius: 2, tool: "brush", transmission: 0.8 });
  }

  assert.ok(Math.abs(amplitude[16 * size + 5] - 0.8) < 1e-6);
  assert.ok(Math.abs(amplitude[16 * size + 16] - 0.8) < 1e-6);
  assert.ok(Math.abs(amplitude[16 * size + 27] - 0.8) < 1e-6);
});

test("continuous strokes are rasterized as a single smooth capsule", () => {
  const size = 40;
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  paintSegmentInto({
    amplitude,
    phase,
    size,
    from: { x: 5.5, y: 20.5 },
    to: { x: 34.5, y: 20.5 },
    radius: 3,
    tool: "brush",
    transmission: 0.75,
  });
  for (let x = 6; x <= 34; x += 1) {
    assert.ok(Math.abs(amplitude[20 * size + x] - 0.75) < 1e-6);
  }
});

test("anti-aliased built-in shapes remain exact integer translations", () => {
  const size = 96;
  const first = new Float32Array(size * size);
  const second = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  paintStampInto({ amplitude: first, phase, size, x: 30.5, y: 48.5, radius: 13, tool: "circle", transmission: 1 });
  paintStampInto({ amplitude: second, phase: new Float32Array(phase.length), size, x: 62.5, y: 48.5, radius: 13, tool: "circle", transmission: 1 });
  for (let y = 34; y <= 62; y += 1) {
    for (let x = 16; x <= 44; x += 1) {
      assert.equal(first[y * size + x], second[y * size + x + 32]);
    }
  }
  assert.ok(first.some((value) => value > 0 && value < 1), "shape edge should contain partial coverage");
});

test("a dragged rectangle uses its two opposite vertices and exact edge coverage", () => {
  const size = 16;
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size).fill(0.8);
  paintRectangleInto({
    amplitude,
    phase,
    size,
    from: { x: 2.25, y: 3.5 },
    to: { x: 8.75, y: 10.5 },
    transmission: 1,
  });

  assert.equal(amplitude[5 * size + 5], 1);
  assert.ok(Math.abs(amplitude[3 * size + 2] - 0.375) < 1e-6);
  assert.equal(amplitude[2 * size + 2], 0);
  assert.equal(phase[5 * size + 5], 0);
});

test("a drawing unit repeats with an edge-to-edge gap in either direction", () => {
  const size = 48;
  const horizontal = new Float32Array(size * size);
  repeatDrawingUnitInto({
    amplitude: horizontal,
    phase: new Float32Array(horizontal.length),
    size,
    operations: [{ kind: "stamp", x: 8, y: 8, radius: 2, tool: "circle", transmission: 1 }],
    count: 2,
    spacing: 3,
    direction: "horizontal",
  });
  assert.equal(horizontal[8 * size + 15], 1);
  assert.equal(horizontal[8 * size + 22], 1);

  const vertical = new Float32Array(size * size);
  repeatDrawingUnitInto({
    amplitude: vertical,
    phase: new Float32Array(vertical.length),
    size,
    operations: [{ kind: "rectangle", from: { x: 5, y: 5 }, to: { x: 9, y: 11 }, transmission: 0.7 }],
    count: 1,
    spacing: 4,
    direction: "vertical",
  });
  assert.ok(Math.abs(vertical[15 * size + 6] - 0.7) < 1e-6);
});

test("a rectangular selection repeats its complete complex aperture data", () => {
  const size = 12;
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  amplitude[2 * size + 2] = 0.25;
  amplitude[2 * size + 3] = 0.75;
  amplitude[3 * size + 2] = 1;
  phase[2 * size + 2] = 0.4;
  phase[2 * size + 3] = -0.8;
  phase[3 * size + 2] = 1.2;

  repeatApertureSelectionInto({
    amplitude,
    phase,
    size,
    bounds: { left: 2, right: 4, top: 2, bottom: 4 },
    count: 2,
    spacing: 1,
    direction: "horizontal",
  });

  for (const offsetX of [3, 6]) {
    assert.equal(amplitude[2 * size + 2 + offsetX], 0.25);
    assert.equal(amplitude[2 * size + 3 + offsetX], 0.75);
    assert.equal(amplitude[3 * size + 2 + offsetX], 1);
    assert.ok(Math.abs(phase[2 * size + 2 + offsetX] - 0.4) < 1e-6);
    assert.ok(Math.abs(phase[2 * size + 3 + offsetX] + 0.8) < 1e-6);
    assert.ok(Math.abs(phase[3 * size + 2 + offsetX] - 1.2) < 1e-6);
  }
});

test("filled and outlined polygons rasterize different interiors", () => {
  const size = 32;
  const vertices = [{ x: 6, y: 6 }, { x: 26, y: 8 }, { x: 16, y: 26 }];
  const filled = new Float32Array(size * size);
  paintPolygonInto({
    amplitude: filled,
    phase: new Float32Array(filled.length),
    size,
    vertices,
    filled: true,
    lineWidth: 2,
    transmission: 1,
  });
  assert.equal(filled[14 * size + 16], 1);

  const outlined = new Float32Array(size * size);
  paintPolygonInto({
    amplitude: outlined,
    phase: new Float32Array(outlined.length),
    size,
    vertices,
    filled: false,
    lineWidth: 2,
    transmission: 1,
  });
  assert.equal(outlined[14 * size + 16], 0);
  assert.ok(outlined[7 * size + 12] > 0);
});

test("moving a rectangular selection cuts and pastes amplitude and phase", () => {
  const size = 12;
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  amplitude[3 * size + 4] = 0.75;
  phase[3 * size + 4] = 1.2;
  amplitude[3 * size + 8] = 0.4;

  const moved = moveApertureSelection({
    amplitude,
    phase,
    size,
    bounds: { left: 3, top: 2, right: 6, bottom: 5 },
    offsetX: 3,
    offsetY: 2,
  });

  assert.equal(moved.amplitude[3 * size + 4], 0);
  assert.equal(moved.phase[3 * size + 4], 0);
  assert.equal(moved.amplitude[5 * size + 7], 0.75);
  assert.ok(Math.abs(moved.phase[5 * size + 7] - 1.2) < 1e-6);
  assert.ok(Math.abs(moved.amplitude[3 * size + 8] - 0.4) < 1e-6);
});
