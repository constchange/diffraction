import { renderSpatialField, spatialFilterField } from "../core/spatialFilter.js";
import { renderFieldRgba, wavelengthToRgb } from "../core/display.js";

let workQueue = Promise.resolve();

async function sendFrame(data) {
  const startedAt = performance.now();
  const objectField = { amplitude: data.objectAmplitude, phase: data.objectPhase };
  const filterField = { amplitude: data.filterAmplitude, phase: data.filterPhase };
  const result = spatialFilterField(
    objectField,
    filterField,
    data.size,
    undefined,
    data.outsideTransmission,
  );
  const lightColor = wavelengthToRgb(data.wavelengthNm ?? 532);
  const spectrumPixels = renderFieldRgba(result.spectrum, {
    wavelength: data.wavelengthNm ?? 532,
    focalLength: 1.2,
    zoom: 1.45,
    displayMode: "enhanced",
    monochromeColor: lightColor,
  }, data.size, data.size);
  const imagePixels = renderSpatialField(result.image, "image", lightColor);
  const elapsed = performance.now() - startedAt;
  const common = { type: "frame", revision: data.revision, elapsed, size: data.size };

  // Transferred RGBA buffers are more reliable than constructing two
  // ImageBitmaps in a worker on Linux Firefox, and remain small at 256².
  self.postMessage({ ...common, spectrumPixels, imagePixels }, [spectrumPixels.buffer, imagePixels.buffer]);
}

self.onmessage = (event) => {
  const data = event.data;
  workQueue = workQueue.then(() => sendFrame(data)).catch((error) => {
    self.postMessage({
      type: "error",
      revision: data.revision,
      message: error instanceof Error ? error.message : "空间滤波计算失败",
    });
  });
};
