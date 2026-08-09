/**
 * Small radix-2 FFT implementation used by both the browser worker and tests.
 * The input convention is a complex aperture t(x, y). Multiplication by
 * (-1)^(x+y) moves the zero spatial frequency to the centre of the output.
 */

export function fft1d(real, imag) {
  const n = real.length;
  if (n !== imag.length || (n & (n - 1)) !== 0) {
    throw new Error("FFT 长度必须是 2 的整数次幂");
  }

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wLenR = Math.cos(angle);
    const wLenI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wr = 1;
      let wi = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const even = i + j;
        const odd = even + len / 2;
        const vr = real[odd] * wr - imag[odd] * wi;
        const vi = real[odd] * wi + imag[odd] * wr;
        const ur = real[even];
        const ui = imag[even];
        real[even] = ur + vr;
        imag[even] = ui + vi;
        real[odd] = ur - vr;
        imag[odd] = ui - vi;
        const nextWr = wr * wLenR - wi * wLenI;
        wi = wr * wLenI + wi * wLenR;
        wr = nextWr;
      }
    }
  }
}

export function fft2dField(amplitude, phase, sourceSize, fftSize = sourceSize) {
  if (amplitude.length !== sourceSize * sourceSize || phase.length !== sourceSize * sourceSize) {
    throw new Error("衍射屏数组尺寸与采样尺寸不一致");
  }
  if (fftSize < sourceSize || (fftSize & (fftSize - 1)) !== 0) {
    throw new Error("FFT 尺寸必须是不小于衍射屏的 2 的整数次幂");
  }

  const real64 = new Float64Array(fftSize * fftSize);
  const imag64 = new Float64Array(fftSize * fftSize);
  const offset = Math.floor((fftSize - sourceSize) / 2);
  let centroidWeight = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let y = 0; y < sourceSize; y += 1) {
    for (let x = 0; x < sourceSize; x += 1) {
      const sourceIndex = y * sourceSize + x;
      const paddedX = x + offset;
      const paddedY = y + offset;
      const index = paddedY * fftSize + paddedX;
      const sign = (paddedX + paddedY) % 2 === 0 ? 1 : -1;
      const a = Math.max(0, Math.min(1, amplitude[sourceIndex]));
      real64[index] = sign * a * Math.cos(phase[sourceIndex]);
      imag64[index] = sign * a * Math.sin(phase[sourceIndex]);
      centroidWeight += a;
      centroidX += a * (paddedX + 0.5);
      centroidY += a * (paddedY + 0.5);
    }
  }
  if (centroidWeight > 0) {
    centroidX /= centroidWeight;
    centroidY /= centroidWeight;
  } else {
    centroidX = fftSize / 2;
    centroidY = fftSize / 2;
  }

  const rowR = new Float64Array(fftSize);
  const rowI = new Float64Array(fftSize);
  for (let y = 0; y < fftSize; y += 1) {
    const rowOffset = y * fftSize;
    rowR.set(real64.subarray(rowOffset, rowOffset + fftSize));
    rowI.set(imag64.subarray(rowOffset, rowOffset + fftSize));
    fft1d(rowR, rowI);
    real64.set(rowR, rowOffset);
    imag64.set(rowI, rowOffset);
  }

  const colR = new Float64Array(fftSize);
  const colI = new Float64Array(fftSize);
  for (let x = 0; x < fftSize; x += 1) {
    for (let y = 0; y < fftSize; y += 1) {
      const index = y * fftSize + x;
      colR[y] = real64[index];
      colI[y] = imag64[index];
    }
    fft1d(colR, colI);
    for (let y = 0; y < fftSize; y += 1) {
      const index = y * fftSize + x;
      real64[index] = colR[y];
      imag64[index] = colI[y];
    }
  }

  let maxIntensity = 0;
  for (let index = 0; index < real64.length; index += 1) {
    const value = real64[index] ** 2 + imag64[index] ** 2;
    if (value > maxIntensity) maxIntensity = value;
  }

  const real = new Float32Array(real64.length);
  const imag = new Float32Array(imag64.length);
  const normalizer = maxIntensity > 0 ? 1 / Math.sqrt(maxIntensity) : 0;
  const centre = fftSize / 2;
  const cosineX = new Float64Array(fftSize);
  const sineX = new Float64Array(fftSize);
  const cosineY = new Float64Array(fftSize);
  const sineY = new Float64Array(fftSize);
  for (let coordinate = 0; coordinate < fftSize; coordinate += 1) {
    const q = (coordinate - centre) / fftSize;
    const xAngle = 2 * Math.PI * q * centroidX;
    const yAngle = 2 * Math.PI * q * centroidY;
    cosineX[coordinate] = Math.cos(xAngle);
    sineX[coordinate] = Math.sin(xAngle);
    cosineY[coordinate] = Math.cos(yAngle);
    sineY[coordinate] = Math.sin(yAngle);
  }
  for (let y = 0; y < fftSize; y += 1) {
    for (let x = 0; x < fftSize; x += 1) {
      const index = y * fftSize + x;
      // Remove only the global phase caused by translating the aperture. It
      // leaves intensity untouched and makes complex interpolation between
      // FFT samples accurate even when a drawing is far from the centre.
      const cosine = cosineX[x] * cosineY[y] - sineX[x] * sineY[y];
      const sine = sineX[x] * cosineY[y] + cosineX[x] * sineY[y];
      const r = real64[index];
      const i = imag64[index];
      real[index] = (r * cosine - i * sine) * normalizer;
      imag[index] = (r * sine + i * cosine) * normalizer;
    }
  }

  return { real, imag, size: fftSize };
}

export function fft2dIntensity(amplitude, phase, size) {
  const field = fft2dField(amplitude, phase, size, size);
  const intensity = new Float32Array(size * size);
  for (let index = 0; index < intensity.length; index += 1) {
    intensity[index] = field.real[index] ** 2 + field.imag[index] ** 2;
  }
  return intensity;
}

export function sampleComplexIntensity(field, x, y) {
  const { real, imag, size } = field;
  if (x < 0 || y < 0 || x > size - 1 || y > size - 1) return 0;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
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

export function logCompress(intensity, strength = 320) {
  const denominator = Math.log1p(strength);
  const result = new Float32Array(intensity.length);
  for (let i = 0; i < intensity.length; i += 1) {
    result[i] = Math.log1p(strength * Math.max(0, intensity[i])) / denominator;
  }
  return result;
}
