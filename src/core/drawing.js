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

export function paintStamp({ aperture, ...stamp }) {
  return paintStampInto({
    ...stamp,
    amplitude: new Float32Array(aperture.amplitude),
    phase: new Float32Array(aperture.phase),
  });
}
