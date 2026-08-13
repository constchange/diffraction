import { fft1d } from "./fft.js";

export const SPATIAL_FILTER_SIZE = 256;
export const SPATIAL_FFT_SIZE = 512;
export const SPATIAL_SPECTRUM_ZOOM = 1.45;
const FRAUNHOFER_BASE_SAMPLING = 0.66;

function assertField(field, size, label) {
  if (!field || field.amplitude?.length !== size * size || field.phase?.length !== size * size) {
    throw new Error(`${label}数组尺寸与采样尺寸不一致`);
  }
}

function fft2dInPlace(real, imag, size, inverse = false) {
  const rowR = new Float64Array(size);
  const rowI = new Float64Array(size);
  const transform = (targetR, targetI) => {
    if (!inverse) {
      fft1d(targetR, targetI);
      return;
    }
    for (let index = 0; index < targetI.length; index += 1) targetI[index] *= -1;
    fft1d(targetR, targetI);
    for (let index = 0; index < targetR.length; index += 1) {
      targetR[index] /= targetR.length;
      targetI[index] /= -targetI.length;
    }
  };

  for (let y = 0; y < size; y += 1) {
    const offset = y * size;
    rowR.set(real.subarray(offset, offset + size));
    rowI.set(imag.subarray(offset, offset + size));
    transform(rowR, rowI);
    real.set(rowR, offset);
    imag.set(rowI, offset);
  }

  const columnR = new Float64Array(size);
  const columnI = new Float64Array(size);
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      const index = y * size + x;
      columnR[y] = real[index];
      columnI[y] = imag[index];
    }
    transform(columnR, columnI);
    for (let y = 0; y < size; y += 1) {
      const index = y * size + x;
      real[index] = columnR[y];
      imag[index] = columnI[y];
    }
  }
}

function sampleFilterComplex(filterField, filterSize, fftSize, fftX, fftY, outsideTransmission = 1) {
  // The editable filter covers the same central frequency window shown by the
  // Fraunhofer observation screen at its default scale. Mapping the mask back
  // to the padded FFT keeps drawing coordinates and displayed frequencies in
  // exact agreement.
  const destinationSpectrumSize = (filterSize * SPATIAL_SPECTRUM_ZOOM) / FRAUNHOFER_BASE_SAMPLING;
  const maskX = filterSize / 2 + ((fftX - fftSize / 2) * destinationSpectrumSize) / fftSize;
  const maskY = filterSize / 2 + ((fftY - fftSize / 2) * destinationSpectrumSize) / fftSize;
  if (maskX < 0 || maskY < 0 || maskX > filterSize - 1 || maskY > filterSize - 1) {
    // The drawn mask represents only the visible central frequency window.
    // Frequencies outside that window retain their transmission instead of
    // inheriting an arbitrarily clamped edge pixel.
    return { real: Math.max(0, Math.min(1, outsideTransmission)), imag: 0 };
  }
  const x0 = Math.max(0, Math.min(filterSize - 1, Math.floor(maskX)));
  const y0 = Math.max(0, Math.min(filterSize - 1, Math.floor(maskY)));
  const x1 = Math.min(filterSize - 1, x0 + 1);
  const y1 = Math.min(filterSize - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, maskX - x0));
  const ty = Math.max(0, Math.min(1, maskY - y0));

  const sample = (x, y) => {
    const index = y * filterSize + x;
    const amplitude = Math.max(0, Math.min(1, filterField.amplitude[index]));
    const phase = filterField.phase[index];
    return { real: amplitude * Math.cos(phase), imag: amplitude * Math.sin(phase) };
  };
  const topLeft = sample(x0, y0);
  const topRight = sample(x1, y0);
  const bottomLeft = sample(x0, y1);
  const bottomRight = sample(x1, y1);
  const interpolate = (key) => {
    const top = topLeft[key] + (topRight[key] - topLeft[key]) * tx;
    const bottom = bottomLeft[key] + (bottomRight[key] - bottomLeft[key]) * tx;
    return top + (bottom - top) * ty;
  };
  return { real: interpolate("real"), imag: interpolate("imag") };
}

export function createSpatialObject(size = SPATIAL_FILTER_SIZE, kind = "academy") {
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    const ny = (2 * (y + 0.5)) / size - 1;
    for (let x = 0; x < size; x += 1) {
      const nx = (2 * (x + 0.5)) / size - 1;
      const index = y * size + x;
      if (kind === "grid") {
        amplitude[index] = Math.abs((x % 32) - 16) < 3 || Math.abs((y % 32) - 16) < 3 ? 1 : 0;
      } else if (kind === "rings") {
        const radius = Math.hypot(nx, ny);
        amplitude[index] = radius < 0.72 && Math.sin(radius * 52) > 0.22 ? 1 : 0;
      } else if (kind === "edges") {
        const diamond = Math.abs(nx) + Math.abs(ny) < 0.68;
        const square = Math.abs(nx) < 0.32 && Math.abs(ny) < 0.32;
        amplitude[index] = diamond && !square ? 1 : 0;
      } else {
        const vertical = Math.abs(nx) < 0.1 && Math.abs(ny) < 0.54;
        const horizontal = Math.abs(ny) < 0.1 && Math.abs(nx) < 0.54;
        const topBar = Math.abs(ny + 0.58) < 0.035 && Math.abs(nx) < 0.62;
        amplitude[index] = vertical || horizontal || topBar ? 1 : 0;
      }
    }
  }

  return { amplitude, phase };
}

export function createSpatialFilter(size = SPATIAL_FILTER_SIZE, kind = "open", options = {}) {
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  const radius = Number(options.radius ?? 0.2);
  const slit = Number(options.slit ?? 0.12);
  const notchPosition = Number(options.notchPosition ?? 0.31);
  const notchRadius = Number(options.notchRadius ?? 0.055);
  const abbeOrder = Number(options.abbeOrder ?? 1);

  for (let y = 0; y < size; y += 1) {
    const fy = (y + 0.5 - size / 2) / (size / 2);
    for (let x = 0; x < size; x += 1) {
      const fx = (x + 0.5 - size / 2) / (size / 2);
      const index = y * size + x;
      const distance = Math.hypot(fx, fy);
      if (kind === "blocked") amplitude[index] = 0;
      else if (kind === "low-pass") amplitude[index] = distance <= radius ? 1 : 0;
      else if (kind === "high-pass") amplitude[index] = distance >= radius ? 1 : 0;
      else if (kind === "horizontal") amplitude[index] = Math.abs(fy) <= slit ? 1 : 0;
      else if (kind === "vertical") amplitude[index] = Math.abs(fx) <= slit ? 1 : 0;
      else if (kind === "notch") {
        const atPositive = Math.hypot(fx - notchPosition, fy) <= notchRadius;
        const atNegative = Math.hypot(fx + notchPosition, fy) <= notchRadius;
        amplitude[index] = atPositive || atNegative ? 0 : 1;
      } else if (kind === "abbe") {
        const zero = distance <= 0.055;
        const firstX = Math.min(
          Math.hypot(fx - 0.0625, fy),
          Math.hypot(fx + 0.0625, fy),
        ) <= 0.055;
        const firstY = Math.min(
          Math.hypot(fx, fy - 0.0625),
          Math.hypot(fx, fy + 0.0625),
        ) <= 0.055;
        const second = Math.min(
          Math.hypot(fx - 0.125, fy),
          Math.hypot(fx + 0.125, fy),
          Math.hypot(fx, fy - 0.125),
          Math.hypot(fx, fy + 0.125),
        ) <= 0.035;
        amplitude[index] = zero || (abbeOrder >= 1 && (firstX || firstY)) || (abbeOrder >= 2 && second) ? 1 : 0;
      } else if (kind === "phase-contrast") {
        amplitude[index] = 1;
        phase[index] = distance <= radius ? Math.PI / 2 : 0;
      } else amplitude[index] = 1;
    }
  }
  return { amplitude, phase };
}

export function spatialFilterField(
  objectField,
  filterField,
  size = SPATIAL_FILTER_SIZE,
  fftSize = SPATIAL_FFT_SIZE,
  outsideTransmission = 1,
) {
  assertField(objectField, size, "物面");
  assertField(filterField, size, "滤波器");
  if (fftSize < size || (fftSize & (fftSize - 1)) !== 0) {
    throw new Error("空间滤波 FFT 尺寸必须是不小于物面的 2 的整数次幂");
  }
  const spectrumReal = new Float64Array(fftSize * fftSize);
  const spectrumImag = new Float64Array(fftSize * fftSize);
  const objectOffset = Math.floor((fftSize - size) / 2);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceIndex = y * size + x;
      const paddedX = x + objectOffset;
      const paddedY = y + objectOffset;
      const paddedIndex = paddedY * fftSize + paddedX;
      const sign = (paddedX + paddedY) % 2 === 0 ? 1 : -1;
      const amplitude = Math.max(0, Math.min(1, objectField.amplitude[sourceIndex]));
      const phase = objectField.phase[sourceIndex];
      spectrumReal[paddedIndex] = sign * amplitude * Math.cos(phase);
      spectrumImag[paddedIndex] = sign * amplitude * Math.sin(phase);
    }
  }
  fft2dInPlace(spectrumReal, spectrumImag, fftSize, false);

  const filteredReal = new Float64Array(fftSize * fftSize);
  const filteredImag = new Float64Array(fftSize * fftSize);
  let maximumSpectrumIntensity = 0;
  for (let y = 0; y < fftSize; y += 1) {
    for (let x = 0; x < fftSize; x += 1) {
      const index = y * fftSize + x;
      const spectrumIntensity = spectrumReal[index] ** 2 + spectrumImag[index] ** 2;
      if (spectrumIntensity > maximumSpectrumIntensity) maximumSpectrumIntensity = spectrumIntensity;
      const filter = sampleFilterComplex(filterField, size, fftSize, x, y, outsideTransmission);
      filteredReal[index] = spectrumReal[index] * filter.real - spectrumImag[index] * filter.imag;
      filteredImag[index] = spectrumReal[index] * filter.imag + spectrumImag[index] * filter.real;
    }
  }
  fft2dInPlace(filteredReal, filteredImag, fftSize, true);

  const imageReal = new Float32Array(size * size);
  const imageImag = new Float32Array(size * size);
  const outputSpectrumReal = new Float32Array(fftSize * fftSize);
  const outputSpectrumImag = new Float32Array(fftSize * fftSize);
  const spectrumNormalizer = maximumSpectrumIntensity > 0 ? 1 / Math.sqrt(maximumSpectrumIntensity) : 0;
  for (let index = 0; index < outputSpectrumReal.length; index += 1) {
    outputSpectrumReal[index] = spectrumReal[index] * spectrumNormalizer;
    outputSpectrumImag[index] = spectrumImag[index] * spectrumNormalizer;
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const outputIndex = y * size + x;
      const paddedX = x + objectOffset;
      const paddedY = y + objectOffset;
      const paddedIndex = paddedY * fftSize + paddedX;
      const sign = (paddedX + paddedY) % 2 === 0 ? 1 : -1;
      imageReal[outputIndex] = filteredReal[paddedIndex] * sign;
      imageImag[outputIndex] = filteredImag[paddedIndex] * sign;
    }
  }
  return {
    spectrum: { real: outputSpectrumReal, imag: outputSpectrumImag, size: fftSize },
    image: { real: imageReal, imag: imageImag, size },
  };
}

function intensityRange(field) {
  let maximum = 0;
  for (let index = 0; index < field.real.length; index += 1) {
    const value = field.real[index] ** 2 + field.imag[index] ** 2;
    if (value > maximum) maximum = value;
  }
  return maximum;
}

export function renderSpatialField(field, mode = "image", color = [218, 238, 255]) {
  const maximum = intensityRange(field);
  const pixels = new Uint8ClampedArray(field.size * field.size * 4);
  const logDenominator = Math.log1p(Math.max(maximum, 1) * 0.08);
  for (let index = 0; index < field.real.length; index += 1) {
    const intensity = field.real[index] ** 2 + field.imag[index] ** 2;
    const level = maximum <= 0
      ? 0
      : mode === "spectrum"
        ? Math.log1p(intensity * 0.08) / logDenominator
        : Math.sqrt(intensity / maximum);
    const offset = index * 4;
    pixels[offset] = Math.round(color[0] * Math.min(1, level));
    pixels[offset + 1] = Math.round(color[1] * Math.min(1, level));
    pixels[offset + 2] = Math.round(color[2] * Math.min(1, level));
    pixels[offset + 3] = 255;
  }
  return pixels;
}
