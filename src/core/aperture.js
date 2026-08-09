export const APERTURE_SIZE = 256;

export function createAperture(size = APERTURE_SIZE, kind = "double-slit") {
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    const ny = (2 * (y + 0.5)) / size - 1;
    for (let x = 0; x < size; x += 1) {
      const nx = (2 * (x + 0.5)) / size - 1;
      const index = y * size + x;
      if (kind === "circle") {
        amplitude[index] = Math.hypot(nx, ny) <= 0.34 ? 1 : 0;
      } else {
        const inVerticalRange = Math.abs(ny) <= 0.58;
        const inLeftSlit = Math.abs(nx + 0.18) <= 0.045;
        const inRightSlit = Math.abs(nx - 0.18) <= 0.045;
        amplitude[index] = inVerticalRange && (inLeftSlit || inRightSlit) ? 1 : 0;
      }
    }
  }
  return { amplitude, phase };
}

export function apertureStats(amplitude) {
  let sum = 0;
  let active = 0;
  for (let i = 0; i < amplitude.length; i += 1) {
    const value = amplitude[i];
    sum += value;
    if (value > 0.001) active += 1;
  }
  return {
    meanTransmission: sum / amplitude.length,
    activeRatio: active / amplitude.length,
  };
}
