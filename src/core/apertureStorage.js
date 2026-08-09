export const APERTURE_STORAGE_KEY = "fraunhofer-aperture-saves-v1";
export const MAX_LOCAL_APERTURES = 5;

const FORMAT = "fraunhofer-aperture-v1";
const CHUNK_SIZE = 0x8000;

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function encodeAperture(aperture, size) {
  const length = size * size;
  if (aperture.amplitude.length !== length || aperture.phase.length !== length) {
    throw new RangeError("衍射屏尺寸与采样数据不一致");
  }

  const amplitude = new Uint8Array(length);
  const phaseBytes = new Uint8Array(length * 2);
  const phaseView = new DataView(phaseBytes.buffer);
  for (let index = 0; index < length; index += 1) {
    amplitude[index] = Math.round(255 * Math.max(0, Math.min(1, aperture.amplitude[index])));
    const wrappedPhase = Math.atan2(Math.sin(aperture.phase[index]), Math.cos(aperture.phase[index]));
    phaseView.setInt16(index * 2, Math.round((wrappedPhase / Math.PI) * 32767), true);
  }

  return {
    format: FORMAT,
    size,
    amplitude: bytesToBase64(amplitude),
    phase: bytesToBase64(phaseBytes),
  };
}

export function decodeAperture(encoded, expectedSize) {
  if (!encoded || encoded.format !== FORMAT || encoded.size !== expectedSize) {
    throw new TypeError("本地存档格式或采样尺寸不兼容");
  }
  const length = expectedSize * expectedSize;
  const amplitudeBytes = base64ToBytes(encoded.amplitude);
  const phaseBytes = base64ToBytes(encoded.phase);
  if (amplitudeBytes.length !== length || phaseBytes.length !== length * 2) {
    throw new RangeError("本地存档数据不完整");
  }

  const amplitude = new Float32Array(length);
  const phase = new Float32Array(length);
  const phaseView = new DataView(phaseBytes.buffer, phaseBytes.byteOffset, phaseBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    amplitude[index] = amplitudeBytes[index] / 255;
    phase[index] = (phaseView.getInt16(index * 2, true) / 32767) * Math.PI;
  }
  return { amplitude, phase };
}

export function readLocalApertures(storage, expectedSize) {
  try {
    const parsed = JSON.parse(storage.getItem(APERTURE_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string" && item.data?.size === expectedSize)
      .slice(0, MAX_LOCAL_APERTURES);
  } catch {
    return [];
  }
}

export function writeLocalApertures(storage, items) {
  if (items.length > MAX_LOCAL_APERTURES) throw new RangeError("本地最多保存 5 个衍射屏");
  storage.setItem(APERTURE_STORAGE_KEY, JSON.stringify(items));
}
