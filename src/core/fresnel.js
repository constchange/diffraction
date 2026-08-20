import { fft1d } from "./fft.js";
import { wavelengthToRgb } from "./display.js";

export const FRESNEL_SIZE = 256;
export const FRESNEL_FFT_SIZE = 512;

function assertPowerOfTwo(value, label) {
  if (!Number.isInteger(value) || value < 2 || (value & (value - 1)) !== 0) {
    throw new Error(`${label}必须是 2 的整数次幂`);
  }
}

function assertAperture(aperture, size) {
  if (!aperture || aperture.amplitude?.length !== size * size || aperture.phase?.length !== size * size) {
    throw new Error("菲涅尔衍射屏数组尺寸与采样尺寸不一致");
  }
}

function fft2dInPlace(real, imag, size, inverse = false) {
  const rowReal = new Float64Array(size);
  const rowImag = new Float64Array(size);
  const transform = (targetReal, targetImag) => {
    if (!inverse) {
      fft1d(targetReal, targetImag);
      return;
    }
    for (let index = 0; index < targetImag.length; index += 1) targetImag[index] *= -1;
    fft1d(targetReal, targetImag);
    for (let index = 0; index < targetReal.length; index += 1) {
      targetReal[index] /= targetReal.length;
      targetImag[index] /= -targetImag.length;
    }
  };

  for (let y = 0; y < size; y += 1) {
    const offset = y * size;
    rowReal.set(real.subarray(offset, offset + size));
    rowImag.set(imag.subarray(offset, offset + size));
    transform(rowReal, rowImag);
    real.set(rowReal, offset);
    imag.set(rowImag, offset);
  }

  const columnReal = new Float64Array(size);
  const columnImag = new Float64Array(size);
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      const index = y * size + x;
      columnReal[y] = real[index];
      columnImag[y] = imag[index];
    }
    transform(columnReal, columnImag);
    for (let y = 0; y < size; y += 1) {
      const index = y * size + x;
      real[index] = columnReal[y];
      imag[index] = columnImag[y];
    }
  }
}

export function createFresnelAperture(size = FRESNEL_SIZE, kind = "circle") {
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const ny = (2 * (y + 0.5)) / size - 1;
    for (let x = 0; x < size; x += 1) {
      const nx = (2 * (x + 0.5)) / size - 1;
      const index = y * size + x;
      if (kind === "square") {
        amplitude[index] = Math.abs(nx) <= 0.28 && Math.abs(ny) <= 0.28 ? 1 : 0;
      } else if (kind === "single-slit") {
        amplitude[index] = Math.abs(nx) <= 0.045 && Math.abs(ny) <= 0.58 ? 1 : 0;
      } else if (kind === "double-hole") {
        const left = Math.hypot(nx + 0.25, ny) <= 0.12;
        const right = Math.hypot(nx - 0.25, ny) <= 0.12;
        amplitude[index] = left || right ? 1 : 0;
      } else if (kind === "rings") {
        const radius = Math.hypot(nx, ny);
        amplitude[index] = radius <= 0.48 && Math.cos(54 * radius) >= 0 ? 1 : 0;
      } else {
        amplitude[index] = Math.hypot(nx, ny) <= 0.3 ? 1 : 0;
      }
    }
  }
  return { amplitude, phase };
}

export function fresnelPropagate(aperture, {
  size = FRESNEL_SIZE,
  fftSize = FRESNEL_FFT_SIZE,
  wavelengthNm = 532,
  distanceM = 0.8,
  planeWidthMm = 8,
} = {}) {
  assertAperture(aperture, size);
  assertPowerOfTwo(fftSize, "菲涅尔 FFT 尺寸");
  if (fftSize < size) throw new Error("菲涅尔 FFT 尺寸不得小于衍射屏尺寸");
  if (!(wavelengthNm >= 380 && wavelengthNm <= 700)) throw new Error("波长必须位于可见光范围");
  if (!(distanceM >= 0)) throw new Error("传播距离不得为负数");
  if (!(planeWidthMm > 0)) throw new Error("衍射屏物理宽度必须大于零");

  const real = new Float64Array(fftSize * fftSize);
  const imag = new Float64Array(fftSize * fftSize);
  const offset = Math.floor((fftSize - size) / 2);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceIndex = y * size + x;
      const targetIndex = (y + offset) * fftSize + x + offset;
      const amplitude = Math.max(0, Math.min(1, aperture.amplitude[sourceIndex]));
      const phase = aperture.phase[sourceIndex];
      real[targetIndex] = amplitude * Math.cos(phase);
      imag[targetIndex] = amplitude * Math.sin(phase);
    }
  }

  fft2dInPlace(real, imag, fftSize, false);
  const wavelengthM = wavelengthNm * 1e-9;
  const samplePitchM = (planeWidthMm * 1e-3) / size;
  const frequencyStep = 1 / (fftSize * samplePitchM);
  for (let y = 0; y < fftSize; y += 1) {
    const fy = (y < fftSize / 2 ? y : y - fftSize) * frequencyStep;
    for (let x = 0; x < fftSize; x += 1) {
      const fx = (x < fftSize / 2 ? x : x - fftSize) * frequencyStep;
      const index = y * fftSize + x;
      const transferPhase = -Math.PI * wavelengthM * distanceM * (fx * fx + fy * fy);
      const cosine = Math.cos(transferPhase);
      const sine = Math.sin(transferPhase);
      const sourceReal = real[index];
      const sourceImag = imag[index];
      real[index] = sourceReal * cosine - sourceImag * sine;
      imag[index] = sourceReal * sine + sourceImag * cosine;
    }
  }
  fft2dInPlace(real, imag, fftSize, true);

  const outputReal = new Float32Array(size * size);
  const outputImag = new Float32Array(size * size);
  let peakIntensity = 0;
  let totalIntensity = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const outputIndex = y * size + x;
      const paddedIndex = (y + offset) * fftSize + x + offset;
      const valueReal = real[paddedIndex];
      const valueImag = imag[paddedIndex];
      outputReal[outputIndex] = valueReal;
      outputImag[outputIndex] = valueImag;
      const intensity = valueReal * valueReal + valueImag * valueImag;
      if (intensity > peakIntensity) peakIntensity = intensity;
      totalIntensity += intensity;
    }
  }

  return {
    real: outputReal,
    imag: outputImag,
    size,
    peakIntensity,
    totalIntensity,
    samplePitchM,
  };
}

export function renderFresnelField(field, wavelengthNm = 532, displayMode = "enhanced") {
  const color = wavelengthToRgb(wavelengthNm);
  const maximum = Math.max(0, Number(field.peakIntensity) || 0);
  const pixels = new Uint8ClampedArray(field.size * field.size * 4);
  for (let index = 0; index < field.real.length; index += 1) {
    const intensity = field.real[index] ** 2 + field.imag[index] ** 2;
    const normalized = maximum > 0 ? intensity / maximum : 0;
    const level = displayMode === "linear"
      ? Math.min(1, normalized)
      : Math.log1p(70 * Math.max(0, normalized)) / Math.log1p(70);
    const offset = index * 4;
    pixels[offset] = Math.round(color[0] * level);
    pixels[offset + 1] = Math.round(color[1] * level);
    pixels[offset + 2] = Math.round(color[2] * level);
    pixels[offset + 3] = 255;
  }
  return pixels;
}

export function referenceFresnelNumber(planeWidthMm, wavelengthNm, distanceM) {
  if (!(planeWidthMm > 0) || !(wavelengthNm > 0) || !(distanceM > 0)) return Infinity;
  const referenceRadiusM = planeWidthMm * 1e-3 * 0.25;
  return (referenceRadiusM * referenceRadiusM) / (wavelengthNm * 1e-9 * distanceM);
}
