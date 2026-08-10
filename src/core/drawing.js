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

export function constrainEllipseToCircle(from, to, size = Infinity) {
  const directionX = to.x < from.x ? -1 : 1;
  const directionY = to.y < from.y ? -1 : 1;
  const maximumX = Number.isFinite(size) ? (directionX > 0 ? size - from.x : from.x) : Infinity;
  const maximumY = Number.isFinite(size) ? (directionY > 0 ? size - from.y : from.y) : Infinity;
  const side = Math.max(0, Math.min(
    Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)),
    maximumX,
    maximumY,
  ));
  return {
    ...to,
    x: from.x + directionX * side,
    y: from.y + directionY * side,
  };
}

export function paintEllipseInto({ amplitude, phase, size, from, to, transmission }) {
  const left = Math.max(0, Math.min(from.x, to.x));
  const right = Math.min(size, Math.max(from.x, to.x));
  const top = Math.max(0, Math.min(from.y, to.y));
  const bottom = Math.min(size, Math.max(from.y, to.y));
  const radiusX = (right - left) / 2;
  const radiusY = (bottom - top) / 2;
  if (radiusX <= 0 || radiusY <= 0) return { amplitude, phase };

  const centreX = (left + right) / 2;
  const centreY = (top + bottom) / 2;
  const minimumX = Math.max(0, Math.floor(left));
  const maximumX = Math.min(size - 1, Math.ceil(right) - 1);
  const minimumY = Math.max(0, Math.floor(top));
  const maximumY = Math.min(size - 1, Math.ceil(bottom) - 1);
  const value = Math.max(0, Math.min(1, transmission));
  const samples = 4;

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      let inside = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        const dy = (y + (sy + 0.5) / samples - centreY) / radiusY;
        for (let sx = 0; sx < samples; sx += 1) {
          const dx = (x + (sx + 0.5) / samples - centreX) / radiusX;
          if (dx * dx + dy * dy <= 1) inside += 1;
        }
      }
      applyCoverage(
        amplitude,
        phase,
        y * size + x,
        value,
        inside / (samples * samples),
        false,
      );
    }
  }
  return { amplitude, phase };
}

function pointInPolygon(vertices, x, y) {
  let inside = false;
  for (let current = 0, previous = vertices.length - 1; current < vertices.length; previous = current, current += 1) {
    const currentVertex = vertices[current];
    const previousVertex = vertices[previous];
    const crosses = (currentVertex.y > y) !== (previousVertex.y > y)
      && x < ((previousVertex.x - currentVertex.x) * (y - currentVertex.y))
        / (previousVertex.y - currentVertex.y) + currentVertex.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px, py, fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - fromX, py - fromY);
  const t = Math.max(0, Math.min(1, ((px - fromX) * dx + (py - fromY) * dy) / lengthSquared));
  return Math.hypot(px - (fromX + t * dx), py - (fromY + t * dy));
}

function distanceToPolygonEdge(vertices, x, y) {
  let distance = Infinity;
  for (let index = 0; index < vertices.length; index += 1) {
    const from = vertices[index];
    const to = vertices[(index + 1) % vertices.length];
    distance = Math.min(distance, distanceToSegment(x, y, from.x, from.y, to.x, to.y));
  }
  return distance;
}

export function paintPolygonInto({
  amplitude,
  phase,
  size,
  vertices,
  filled,
  lineWidth,
  transmission,
}) {
  if (!vertices || vertices.length < 3) return { amplitude, phase };
  const radius = Math.max(0.5, lineWidth / 2);
  const padding = filled ? 1 : radius + 1;
  const minimumX = Math.max(0, Math.floor(Math.min(...vertices.map((point) => point.x)) - padding));
  const maximumX = Math.min(size - 1, Math.ceil(Math.max(...vertices.map((point) => point.x)) + padding));
  const minimumY = Math.max(0, Math.floor(Math.min(...vertices.map((point) => point.y)) - padding));
  const maximumY = Math.min(size - 1, Math.ceil(Math.max(...vertices.map((point) => point.y)) + padding));
  const value = Math.max(0, Math.min(1, transmission));
  const samples = filled ? 4 : 2;

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      let inside = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const sampleX = x + (sx + 0.5) / samples;
          const sampleY = y + (sy + 0.5) / samples;
          const covered = filled
            ? pointInPolygon(vertices, sampleX, sampleY)
            : distanceToPolygonEdge(vertices, sampleX, sampleY) <= radius;
          if (covered) inside += 1;
        }
      }
      applyCoverage(
        amplitude,
        phase,
        y * size + x,
        value,
        inside / (samples * samples),
        false,
      );
    }
  }
  return { amplitude, phase };
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
  if (operation.kind === "ellipse") {
    return paintEllipseInto({
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
  if (operation.kind === "polygon") {
    return paintPolygonInto({
      amplitude,
      phase,
      size,
      vertices: operation.vertices.map((point) => ({
        x: point.x + offsetX,
        y: point.y + offsetY,
      })),
      filled: operation.filled,
      lineWidth: operation.lineWidth,
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
    if (["rectangle", "ellipse"].includes(operation.kind)) {
      left = Math.min(left, operation.from.x, operation.to.x);
      right = Math.max(right, operation.from.x, operation.to.x);
      top = Math.min(top, operation.from.y, operation.to.y);
      bottom = Math.max(bottom, operation.from.y, operation.to.y);
      continue;
    }
    if (operation.kind === "polygon") {
      const padding = operation.filled ? 0 : operation.lineWidth / 2;
      left = Math.min(left, ...operation.vertices.map((point) => point.x - padding));
      right = Math.max(right, ...operation.vertices.map((point) => point.x + padding));
      top = Math.min(top, ...operation.vertices.map((point) => point.y - padding));
      bottom = Math.max(bottom, ...operation.vertices.map((point) => point.y + padding));
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

export function repeatApertureSelectionInto({
  amplitude,
  phase,
  size,
  bounds,
  count,
  spacing,
  direction,
}) {
  if (!bounds) return { amplitude, phase };

  const left = Math.max(0, Math.min(size, Math.floor(bounds.left)));
  const right = Math.max(0, Math.min(size, Math.ceil(bounds.right)));
  const top = Math.max(0, Math.min(size, Math.floor(bounds.top)));
  const bottom = Math.max(0, Math.min(size, Math.ceil(bounds.bottom)));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return { amplitude, phase };

  // Snapshot the complex screen function so overlapping copies cannot change
  // the source data used by later copies.
  const sourceAmplitude = new Float32Array(width * height);
  const sourcePhase = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = (top + y) * size + left;
    sourceAmplitude.set(amplitude.subarray(sourceStart, sourceStart + width), y * width);
    sourcePhase.set(phase.subarray(sourceStart, sourceStart + width), y * width);
  }

  const repeatCount = Math.max(0, Math.floor(count));
  const gap = Math.max(0, Math.round(spacing));
  const stepX = direction === "horizontal" ? width + gap : 0;
  const stepY = direction === "vertical" ? height + gap : 0;
  for (let copy = 1; copy <= repeatCount; copy += 1) {
    const destinationLeft = left + stepX * copy;
    const destinationTop = top + stepY * copy;
    for (let y = 0; y < height; y += 1) {
      const destinationY = destinationTop + y;
      if (destinationY < 0 || destinationY >= size) continue;
      for (let x = 0; x < width; x += 1) {
        const destinationX = destinationLeft + x;
        if (destinationX < 0 || destinationX >= size) continue;
        const sourceIndex = y * width + x;
        const destinationIndex = destinationY * size + destinationX;
        amplitude[destinationIndex] = sourceAmplitude[sourceIndex];
        phase[destinationIndex] = sourcePhase[sourceIndex];
      }
    }
  }

  return { amplitude, phase };
}

export function constrainPointToAxis(from, to) {
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
    return { ...to, y: from.y };
  }
  return { ...to, x: from.x };
}

export function resizedSelectionBounds(bounds, handle, point, size, lockAspect = false) {
  if (!bounds || !new Set(["nw", "ne", "se", "sw"]).has(handle)) return bounds;
  const originalWidth = Math.max(1, bounds.right - bounds.left);
  const originalHeight = Math.max(1, bounds.bottom - bounds.top);
  const growsRight = handle.endsWith("e");
  const growsDown = handle.startsWith("s");
  const anchorX = growsRight ? bounds.left : bounds.right;
  const anchorY = growsDown ? bounds.top : bounds.bottom;
  const maximumWidth = growsRight ? size - anchorX : anchorX;
  const maximumHeight = growsDown ? size - anchorY : anchorY;
  const requestedWidth = growsRight ? point.x - anchorX : anchorX - point.x;
  const requestedHeight = growsDown ? point.y - anchorY : anchorY - point.y;
  let width = Math.max(1, Math.min(maximumWidth, requestedWidth));
  let height = Math.max(1, Math.min(maximumHeight, requestedHeight));

  if (lockAspect) {
    const requestedScale = Math.max(width / originalWidth, height / originalHeight);
    const maximumScale = Math.min(maximumWidth / originalWidth, maximumHeight / originalHeight);
    const minimumScale = Math.max(1 / originalWidth, 1 / originalHeight);
    const scale = Math.max(minimumScale, Math.min(maximumScale, requestedScale));
    width = Math.max(1, Math.round(originalWidth * scale));
    height = Math.max(1, Math.round(originalHeight * scale));
  } else {
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
  }

  return {
    left: growsRight ? anchorX : anchorX - width,
    right: growsRight ? anchorX + width : anchorX,
    top: growsDown ? anchorY : anchorY - height,
    bottom: growsDown ? anchorY + height : anchorY,
  };
}

export function scaleApertureSelection({ amplitude, phase, size, bounds, targetBounds }) {
  if (!bounds || !targetBounds) return { amplitude, phase };
  const sourceLeft = Math.max(0, Math.min(size, Math.floor(bounds.left)));
  const sourceRight = Math.max(0, Math.min(size, Math.ceil(bounds.right)));
  const sourceTop = Math.max(0, Math.min(size, Math.floor(bounds.top)));
  const sourceBottom = Math.max(0, Math.min(size, Math.ceil(bounds.bottom)));
  const targetLeft = Math.max(0, Math.min(size, Math.floor(targetBounds.left)));
  const targetRight = Math.max(0, Math.min(size, Math.ceil(targetBounds.right)));
  const targetTop = Math.max(0, Math.min(size, Math.floor(targetBounds.top)));
  const targetBottom = Math.max(0, Math.min(size, Math.ceil(targetBounds.bottom)));
  const sourceWidth = sourceRight - sourceLeft;
  const sourceHeight = sourceBottom - sourceTop;
  const targetWidth = targetRight - targetLeft;
  const targetHeight = targetBottom - targetTop;
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { amplitude, phase };
  }

  const sourceReal = new Float32Array(sourceWidth * sourceHeight);
  const sourceImaginary = new Float32Array(sourceWidth * sourceHeight);
  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      const source = (sourceTop + y) * size + sourceLeft + x;
      const destination = y * sourceWidth + x;
      sourceReal[destination] = amplitude[source] * Math.cos(phase[source]);
      sourceImaginary[destination] = amplitude[source] * Math.sin(phase[source]);
    }
  }

  const nextAmplitude = new Float32Array(amplitude);
  const nextPhase = new Float32Array(phase);
  for (let y = sourceTop; y < sourceBottom; y += 1) {
    nextAmplitude.fill(0, y * size + sourceLeft, y * size + sourceRight);
    nextPhase.fill(0, y * size + sourceLeft, y * size + sourceRight);
  }

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.max(0, Math.min(
      sourceHeight - 1,
      ((y + 0.5) * sourceHeight) / targetHeight - 0.5,
    ));
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(sourceHeight - 1, y0 + 1);
    const blendY = sourceY - y0;
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.max(0, Math.min(
        sourceWidth - 1,
        ((x + 0.5) * sourceWidth) / targetWidth - 0.5,
      ));
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const blendX = sourceX - x0;
      const topLeft = y0 * sourceWidth + x0;
      const topRight = y0 * sourceWidth + x1;
      const bottomLeft = y1 * sourceWidth + x0;
      const bottomRight = y1 * sourceWidth + x1;
      const topReal = sourceReal[topLeft] + (sourceReal[topRight] - sourceReal[topLeft]) * blendX;
      const topImaginary = sourceImaginary[topLeft]
        + (sourceImaginary[topRight] - sourceImaginary[topLeft]) * blendX;
      const bottomReal = sourceReal[bottomLeft]
        + (sourceReal[bottomRight] - sourceReal[bottomLeft]) * blendX;
      const bottomImaginary = sourceImaginary[bottomLeft]
        + (sourceImaginary[bottomRight] - sourceImaginary[bottomLeft]) * blendX;
      const real = topReal + (bottomReal - topReal) * blendY;
      const imaginary = topImaginary + (bottomImaginary - topImaginary) * blendY;
      const destination = (targetTop + y) * size + targetLeft + x;
      const modulus = Math.hypot(real, imaginary);
      nextAmplitude[destination] = Math.min(1, modulus);
      nextPhase[destination] = modulus > 1e-7 ? Math.atan2(imaginary, real) : 0;
    }
  }

  return { amplitude: nextAmplitude, phase: nextPhase };
}

export function moveApertureSelection({ amplitude, phase, size, bounds, offsetX, offsetY }) {
  const dx = Math.round(offsetX);
  const dy = Math.round(offsetY);
  const nextAmplitude = new Float32Array(amplitude);
  const nextPhase = new Float32Array(phase);

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const sourceIndex = y * size + x;
      nextAmplitude[sourceIndex] = 0;
      nextPhase[sourceIndex] = 0;
    }
  }

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    const destinationY = y + dy;
    if (destinationY < 0 || destinationY >= size) continue;
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const destinationX = x + dx;
      if (destinationX < 0 || destinationX >= size) continue;
      const sourceIndex = y * size + x;
      const destinationIndex = destinationY * size + destinationX;
      nextAmplitude[destinationIndex] = amplitude[sourceIndex];
      nextPhase[destinationIndex] = phase[sourceIndex];
    }
  }

  return { amplitude: nextAmplitude, phase: nextPhase };
}

export function paintStamp({ aperture, ...stamp }) {
  return paintStampInto({
    ...stamp,
    amplitude: new Float32Array(aperture.amplitude),
    phase: new Float32Array(aperture.phase),
  });
}
