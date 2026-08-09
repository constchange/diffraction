export const SCREEN_SIZE = 440;

const WHITE_SPECTRUM = [420, 455, 490, 530, 570, 610, 650, 680];
const BASE_SAMPLING = 0.66;
const ENHANCEMENT_STRENGTH = 110;

export function wavelengthToRgb(wavelength) {
  let red = 0;
  let green = 0;
  let blue = 0;
  if (wavelength >= 380 && wavelength < 440) {
    red = -(wavelength - 440) / 60;
    blue = 1;
  } else if (wavelength < 490) {
    green = (wavelength - 440) / 50;
    blue = 1;
  } else if (wavelength < 510) {
    green = 1;
    blue = -(wavelength - 510) / 20;
  } else if (wavelength < 580) {
    red = (wavelength - 510) / 70;
    green = 1;
  } else if (wavelength < 645) {
    red = 1;
    green = -(wavelength - 645) / 65;
  } else if (wavelength <= 700) {
    red = 1;
  }
  const edge = wavelength < 420
    ? 0.35 + (0.65 * (wavelength - 380)) / 40
    : wavelength > 650
      ? 0.35 + (0.65 * (700 - wavelength)) / 50
      : 1;
  return [
    Math.round(255 * red * edge),
    Math.round(255 * green * edge),
    Math.round(255 * blue * edge),
  ];
}

function toneMap(value, displayMode) {
  const safe = Math.max(0, value);
  if (displayMode === "linear") return Math.min(1, safe);
  return Math.min(
    1,
    Math.log1p(ENHANCEMENT_STRENGTH * safe) / Math.log1p(ENHANCEMENT_STRENGTH),
  );
}

function coordinateTable(canvasSize, fieldSize, physicalScale) {
  const first = new Int32Array(canvasSize);
  const second = new Int32Array(canvasSize);
  const fraction = new Float32Array(canvasSize);
  const valid = new Uint8Array(canvasSize);
  const destinationSize = (canvasSize * physicalScale) / BASE_SAMPLING;
  const centre = fieldSize / 2;
  for (let output = 0; output < canvasSize; output += 1) {
    const source = centre + ((output - canvasSize / 2) * fieldSize) / destinationSize;
    if (source < 0 || source > fieldSize - 1) continue;
    const lower = Math.floor(source);
    first[output] = lower;
    second[output] = Math.min(fieldSize - 1, lower + 1);
    fraction[output] = source - lower;
    valid[output] = 1;
  }
  return { first, second, fraction, valid };
}

function interpolateIntensity(field, xTable, yTable, x, y) {
  if (!xTable.valid[x] || !yTable.valid[y]) return 0;
  const { real, imag, size } = field;
  const x0 = xTable.first[x];
  const x1 = xTable.second[x];
  const y0 = yTable.first[y];
  const y1 = yTable.second[y];
  const tx = xTable.fraction[x];
  const ty = yTable.fraction[y];
  const topLeft = y0 * size + x0;
  const topRight = y0 * size + x1;
  const bottomLeft = y1 * size + x0;
  const bottomRight = y1 * size + x1;
  const topR = real[topLeft] + (real[topRight] - real[topLeft]) * tx;
  const bottomR = real[bottomLeft] + (real[bottomRight] - real[bottomLeft]) * tx;
  const topI = imag[topLeft] + (imag[topRight] - imag[topLeft]) * tx;
  const bottomI = imag[bottomLeft] + (imag[bottomRight] - imag[bottomLeft]) * tx;
  const r = topR + (bottomR - topR) * ty;
  const i = topI + (bottomI - topI) * ty;
  return r * r + i * i;
}

export function renderFieldRgba(field, params, width = SCREEN_SIZE, height = SCREEN_SIZE) {
  const {
    wavelength = 532,
    focalLength = 1.2,
    whiteLight = false,
    zoom = 1.45,
    displayMode = "enhanced",
  } = params;
  const wavelengths = whiteLight ? WHITE_SPECTRUM : [wavelength];
  const samplers = wavelengths.map((lambda) => {
    const physicalScale = (lambda / 532) * (focalLength / 1.2) * zoom;
    return {
      color: wavelengthToRgb(lambda).map((channel) => channel / 255),
      x: coordinateTable(width, field.size, physicalScale),
      y: coordinateTable(height, field.size, physicalScale),
    };
  });
  const whiteNormalization = whiteLight
    ? samplers.reduce(
        (sum, sampler) => sum.map((value, index) => value + sampler.color[index]),
        [0, 0, 0],
      )
    : [1, 1, 1];
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (!whiteLight) {
        const sampler = samplers[0];
        const level = toneMap(interpolateIntensity(field, sampler.x, sampler.y, x, y), displayMode);
        pixels[offset] = Math.round(255 * sampler.color[0] * level);
        pixels[offset + 1] = Math.round(255 * sampler.color[1] * level);
        pixels[offset + 2] = Math.round(255 * sampler.color[2] * level);
        pixels[offset + 3] = 255;
        continue;
      }

      let red = 0;
      let green = 0;
      let blue = 0;
      for (const sampler of samplers) {
        const intensity = interpolateIntensity(field, sampler.x, sampler.y, x, y);
        red += sampler.color[0] * intensity;
        green += sampler.color[1] * intensity;
        blue += sampler.color[2] * intensity;
      }
      pixels[offset] = Math.round(255 * toneMap(red / whiteNormalization[0], displayMode));
      pixels[offset + 1] = Math.round(255 * toneMap(green / whiteNormalization[1], displayMode));
      pixels[offset + 2] = Math.round(255 * toneMap(blue / whiteNormalization[2], displayMode));
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}
