import { renderFieldRgba, SCREEN_SIZE } from "../core/display.js";
import { fft2dField } from "../core/fft.js";

let cachedField = null;
let cachedMeta = null;
let frameSequence = 0;
let workQueue = Promise.resolve();

async function renderCachedFrame(data, fftElapsed = cachedMeta?.fftElapsed ?? 0) {
  if (!cachedField || !cachedMeta) return;
  const renderStartedAt = performance.now();
  const pixels = renderFieldRgba(cachedField, data.renderParams, SCREEN_SIZE, SCREEN_SIZE);
  const renderElapsed = performance.now() - renderStartedAt;
  const common = {
    type: "frame",
    jobId: data.jobId,
    requestId: data.jobId,
    apertureRevision: cachedMeta.apertureRevision,
    quality: cachedMeta.quality,
    fftSize: cachedField.size,
    fftElapsed,
    renderElapsed,
    frameSequence: frameSequence + 1,
    renderRevision: data.renderRevision,
  };
  frameSequence += 1;

  if (typeof createImageBitmap === "function" && typeof ImageData === "function") {
    const bitmap = await createImageBitmap(new ImageData(pixels, SCREEN_SIZE, SCREEN_SIZE));
    self.postMessage({ ...common, bitmap }, [bitmap]);
    return;
  }
  self.postMessage({ ...common, pixels, width: SCREEN_SIZE, height: SCREEN_SIZE }, [pixels.buffer]);
}

async function handleMessage(data) {
  if (data.type === "compute") {
    const startedAt = performance.now();
    cachedField = fft2dField(data.amplitude, data.phase, data.size, data.fftSize);
    const fftElapsed = performance.now() - startedAt;
    cachedMeta = {
      apertureRevision: data.apertureRevision,
      quality: data.quality,
      fftElapsed,
    };
    await renderCachedFrame(data, fftElapsed);
    return;
  }
  if (data.type === "render") await renderCachedFrame(data);
}

self.onmessage = (event) => {
  const data = event.data;
  workQueue = workQueue
    .then(() => handleMessage(data))
    .catch((error) => {
      self.postMessage({
        type: "error",
        jobId: data.jobId,
        requestId: data.jobId,
        message: error instanceof Error ? error.message : "衍射计算失败",
      });
    });
};
