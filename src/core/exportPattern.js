export const EXPORT_WATERMARK = "夫朗禾费衍射仿真 (c)2026, Qi Hui Academy";
export const EXPORT_IMAGE_SIZE = 1024;

export function drawExportWatermark(context, width, height, label = EXPORT_WATERMARK) {
  const scale = Math.max(0.75, Math.min(width, height) / 440);
  const fontSize = Math.max(11, Math.round(12 * scale));
  const margin = Math.round(12 * scale);
  const lineHeight = Math.ceil(fontSize * 1.28);

  context.save();
  context.font = `italic 600 ${fontSize}px "Times New Roman", "Noto Serif SC", "Songti SC", Georgia, serif`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";

  const textWidth = context.measureText(label).width;
  const x = Math.max(margin, width - textWidth - margin);
  const baseline = height - margin;

  context.shadowColor = "rgba(0, 0, 0, 0.96)";
  context.shadowBlur = 5 * scale;
  context.shadowOffsetX = Math.max(1, Math.round(scale));
  context.shadowOffsetY = Math.max(1, Math.round(1.5 * scale));
  context.fillStyle = "#f4ead2";
  context.fillText(label, x, baseline);
  context.restore();

  return { x, y: baseline - lineHeight, width: Math.ceil(textWidth), height: lineHeight };
}

function createExportCanvas(documentRef) {
  if (!documentRef?.createElement) throw new TypeError("A document is required to export the pattern");
  const exportCanvas = documentRef.createElement("canvas");
  exportCanvas.width = EXPORT_IMAGE_SIZE;
  exportCanvas.height = EXPORT_IMAGE_SIZE;
  return exportCanvas;
}

function prepareExportContext(exportCanvas) {
  const context = exportCanvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Unable to create the export canvas");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

export function createBrandedPatternCanvas(sourceCanvas) {
  if (!sourceCanvas) throw new TypeError("A source canvas is required");
  const documentRef = sourceCanvas.ownerDocument ?? globalThis.document;
  const exportCanvas = createExportCanvas(documentRef);
  const context = prepareExportContext(exportCanvas);

  context.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
  drawExportWatermark(context, exportCanvas.width, exportCanvas.height);
  return exportCanvas;
}

export function createBrandedPatternCanvasFromFrame(frame, documentRef = globalThis.document) {
  if (!frame || (!frame.bitmap && !frame.pixels)) {
    throw new TypeError("A rendered diffraction frame is required");
  }
  const exportCanvas = createExportCanvas(documentRef);
  const context = prepareExportContext(exportCanvas);

  if (frame.bitmap) {
    context.drawImage(frame.bitmap, 0, 0, exportCanvas.width, exportCanvas.height);
  } else {
    const sourceCanvas = documentRef.createElement("canvas");
    sourceCanvas.width = frame.width;
    sourceCanvas.height = frame.height;
    const sourceContext = sourceCanvas.getContext("2d", { alpha: false });
    if (!sourceContext) throw new Error("Unable to prepare the rendered diffraction frame");
    sourceContext.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
    context.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
  }

  drawExportWatermark(context, exportCanvas.width, exportCanvas.height);
  return exportCanvas;
}

export function createBrandedPatternDataUrl(sourceCanvas) {
  return createBrandedPatternCanvas(sourceCanvas).toDataURL("image/png");
}

export function createBrandedPatternDataUrlFromFrame(frame, documentRef) {
  return createBrandedPatternCanvasFromFrame(frame, documentRef).toDataURL("image/png");
}
