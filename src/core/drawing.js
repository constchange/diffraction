export function pointInShape(tool, dx, dy, radius) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (tool === "rectangle") return ax <= radius && ay <= radius * 0.58;
  if (tool === "square") return ax <= radius && ay <= radius;
  if (tool === "hexagon") {
    return ax <= radius && ay <= radius * 0.86 && ax * 0.58 + ay <= radius * 0.86;
  }
  if (tool === "triangle") {
    const top = -radius;
    const bottom = radius;
    if (dy < top || dy > bottom) return false;
    const halfWidth = ((dy - top) / (bottom - top)) * radius;
    return ax <= halfWidth;
  }
  return dx * dx + dy * dy <= radius * radius;
}

function applyCoverage(amplitude, phase, index, value, coverage, erasing) {
  if (coverage <= 0) return;
  if (erasing) {
    amplitude[index] *= 1 - coverage;
  } else {
    amplitude[index] = amplitude[index] * (1 - coverage) + value * coverage;
  }
  phase[index] = 0;
}

function shapeCoverage(tool, pixelX, pixelY, centreX, centreY, radius) {
  let inside = 0;
  const samples = 4;
  for (let sy = 0; sy < samples; sy += 1) {
    const y = pixelY + (sy + 0.5) / samples;
    for (let sx = 0; sx < samples; sx += 1) {
      const x = pixelX + (sx + 0.5) / samples;
      if (pointInShape(tool, x - centreX, y - centreY, radius)) inside += 1;
    }
  }
  return inside / (samples * samples);
}

export function paintStampInto({ amplitude, phase, size, x: centreX, y: centreY, radius, tool, transmission }) {
  const minimumX = Math.max(0, Math.floor(centreX - radius - 1));
  const maximumX = Math.min(size - 1, Math.ceil(centreX + radius + 1));
  const minimumY = Math.max(0, Math.floor(centreY - radius - 1));
  const maximumY = Math.min(size - 1, Math.ceil(centreY + radius + 1));
  const activeTool = tool === "eraser" ? "brush" : tool;
  const value = tool === "eraser" ? 0 : Math.max(0, Math.min(1, transmission));

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const coverage = shapeCoverage(activeTool, x, y, centreX, centreY, radius);
      applyCoverage(amplitude, phase, y * size + x, value, coverage, tool === "eraser");
    }
  }
  return { amplitude, phase };
}

export function paintRectangleInto({ amplitude, phase, size, from, to, transmission }) {
  const left = Math.max(0, Math.min(from.x, to.x));
  const right = Math.min(size, Math.max(from.x, to.x));
  const top = Math.max(0, Math.min(from.y, to.y));
  const bottom = Math.min(size, Math.max(from.y, to.y));
  if (right <= left || bottom <= top) return { amplitude, phase };

  const minimumX = Math.max(0, Math.floor(left));
  const maximumX = Math.min(size - 1, Math.ceil(right) - 1);
  const minimumY = Math.max(0, Math.floor(top));
  const maximumY = Math.min(size - 1, Math.ceil(bottom) - 1);
  const value = Math.max(0, Math.min(1, transmission));

  for (let y = minimumY; y <= maximumY; y += 1) {
    const verticalCoverage = Math.max(0, Math.min(y + 1, bottom) - Math.max(y, top));
    for (let x = minimumX; x <= maximumX; x += 1) {
      const horizontalCoverage = Math.max(0, Math.min(x + 1, right) - Math.max(x, left));
      applyCoverage(
        amplitude,
        phase,
        y * size + x,
        value,
        horizontalCoverage * verticalCoverage,
        false,
      );
    }
  }
  return { amplitude, phase };
}

function distanceToSegment(px, py, fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - fromX, py - fromY);
  const t = Math.max(0, Math.min(1, ((px - fromX) * dx + (py - fromY) * dy) / lengthSquared));
  return Math.hypot(px - (fromX + t * dx), py - (fromY + t * dy));
}

export function paintSegmentInto({ amplitude, phase, size, from, to, radius, tool, transmission }) {
  const minimumX = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius - 1));
  const maximumX = Math.min(size - 1, Math.ceil(Math.max(from.x, to.x) + radius + 1));
  const minimumY = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius - 1));
  const maximumY = Math.min(size - 1, Math.ceil(Math.max(from.y, to.y) + radius + 1));
  const value = tool === "eraser" ? 0 : Math.max(0, Math.min(1, transmission));
  const samples = 2;

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      let inside = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (distanceToSegment(px, py, from.x, from.y, to.x, to.y) <= radius) inside += 1;
        }
      }
      applyCoverage(
        amplitude,
        phase,
        y * size + x,
        value,
        inside / (samples * samples),
        tool === "eraser",
      );
    }
  }
  return { amplitude, phase };
}

export function paintDrawingOperationInto({ amplitude, phase, size, operation, offsetX = 0, offsetY = 0 }) {
  if (operation.kind === "rectangle") {
    return paintRectangleInto({
      amplitude,
      phase,
      size,
      from: { x: operation.from.x + offsetX, y: operation.from.y + offsetY },
      to: { x: operation.to.x + offsetX, y: operation.to.y + offsetY },
      transmission: operation.transmission,
    });
  }
  if (operation.kind === "segment") {
    return paintSegmentInto({
      amplitude,
      phase,
      size,
      from: { x: operation.from.x + offsetX, y: operation.from.y + offsetY },
      to: { x: operation.to.x + offsetX, y: operation.to.y + offsetY },
      radius: operation.radius,
      tool: operation.tool,
      transmission: operation.transmission,
    });
  }
  return paintStampInto({
    amplitude,
    phase,
    size,
    x: operation.x + offsetX,
    y: operation.y + offsetY,
    radius: operation.radius,
    tool: operation.tool,
    transmission: operation.transmission,
  });
}

export function drawingUnitBounds(operations) {
  if (!operations.length) return null;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const operation of operations) {
    if (operation.kind === "rectangle") {
      left = Math.min(left, operation.from.x, operation.to.x);
      right = Math.max(right, operation.from.x, operation.to.x);
      top = Math.min(top, operation.from.y, operation.to.y);
      bottom = Math.max(bottom, operation.from.y, operation.to.y);
      continue;
    }
    const minimumX = operation.kind === "segment"
      ? Math.min(operation.from.x, operation.to.x) - operation.radius
      : operation.x - operation.radius;
    const maximumX = operation.kind === "segment"
      ? Math.max(operation.from.x, operation.to.x) + operation.radius
      : operation.x + operation.radius;
    const minimumY = operation.kind === "segment"
      ? Math.min(operation.from.y, operation.to.y) - operation.radius
      : operation.y - operation.radius;
    const maximumY = operation.kind === "segment"
      ? Math.max(operation.from.y, operation.to.y) + operation.radius
      : operation.y + operation.radius;
    left = Math.min(left, minimumX);
    right = Math.max(right, maximumX);
    top = Math.min(top, minimumY);
    bottom = Math.max(bottom, maximumY);
  }
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

export function repeatDrawingUnitInto({
  amplitude,
  phase,
  size,
  operations,
  count,
  spacing,
  direction,
}) {
  const bounds = drawingUnitBounds(operations);
  if (!bounds) return { amplitude, phase };
  const repeatCount = Math.max(0, Math.floor(count));
  const gap = Math.max(0, spacing);
  const stepX = direction === "horizontal" ? bounds.width + gap : 0;
  const stepY = direction === "vertical" ? bounds.height + gap : 0;
  for (let copy = 1; copy <= repeatCount; copy += 1) {
    for (const operation of operations) {
      paintDrawingOperationInto({
        amplitude,
        phase,
        size,
        operation,
        offsetX: stepX * copy,
        offsetY: stepY * copy,
      });
    }
  }
  return { amplitude, phase };
}

export function paintStamp({ aperture, ...stamp }) {
  return paintStampInto({
    ...stamp,
    amplitude: new Float32Array(aperture.amplitude),
    phase: new Float32Array(aperture.phase),
  });
}
