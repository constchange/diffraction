import { fresnelPropagate, renderFresnelField } from "../core/fresnel.js";

let workQueue = Promise.resolve();

function sendFrame(data) {
  const startedAt = performance.now();
  const field = fresnelPropagate({
    amplitude: data.amplitude,
    phase: data.phase,
  }, {
    size: data.size,
    fftSize: data.fftSize,
    wavelengthNm: data.wavelengthNm,
    distanceM: data.distanceM,
    planeWidthMm: data.planeWidthMm,
  });
  const pixels = renderFresnelField(field, data.wavelengthNm, data.displayMode);
  self.postMessage({
    type: "frame",
    revision: data.revision,
    elapsed: performance.now() - startedAt,
    size: field.size,
    pixels,
    peakIntensity: field.peakIntensity,
    totalIntensity: field.totalIntensity,
    samplePitchM: field.samplePitchM,
  }, [pixels.buffer]);
}

self.onmessage = (event) => {
  const data = event.data;
  workQueue = workQueue.then(() => sendFrame(data)).catch((error) => {
    self.postMessage({
      type: "error",
      revision: data.revision,
      message: error instanceof Error ? error.message : "菲涅尔衍射计算失败",
    });
  });
};
