export const EXPORT_WATERMARK = "启慧研习院-夫朗禾费衍射仿真";
export const EXPORT_IMAGE_SIZE = 1024;

function roundedRectanglePath(context, x, y, width, height, radius) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

export function drawExportWatermark(context, width, height, label = EXPORT_WATERMARK) {
  const scale = Math.max(0.75, Math.min(width, height) / 440);
  const fontSize = Math.max(11, Math.round(12 * scale));
  const horizontalPadding = Math.round(10 * scale);
  const badgeHeight = Math.round(27 * scale);
  const margin = Math.round(12 * scale);
  const markerWidth = Math.max(2, Math.round(3 * scale));

  context.save();
  context.font = `600 ${fontSize}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "middle";

  const textWidth = context.measureText(label).width;
  const badgeWidth = Math.ceil(textWidth + horizontalPadding * 2 + markerWidth + 7 * scale);
  const x = Math.max(margin, width - badgeWidth - margin);
  const y = Math.max(margin, height - badgeHeight - margin);

  context.shadowColor = "rgba(83, 105, 255, 0.34)";
  context.shadowBlur = 10 * scale;
  context.fillStyle = "rgba(5, 12, 34, 0.84)";
  roundedRectanglePath(context, x, y, badgeWidth, badgeHeight, 6 * scale);
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = "rgba(120, 145, 255, 0.72)";
  context.lineWidth = Math.max(1, scale);
  context.stroke();

  context.fillStyle = "#7fdcff";
  context.fillRect(
    x + horizontalPadding,
    y + Math.round(7 * scale),
    markerWidth,
    badgeHeight - Math.round(14 * scale),
  );

  context.shadowColor = "rgba(127, 220, 255, 0.45)";
  context.shadowBlur = 4 * scale;
  context.fillStyle = "#f4f7ff";
  context.fillText(
    label,
    x + horizontalPadding + markerWidth + 7 * scale,
    y + badgeHeight / 2,
  );
  context.restore();

  return { x, y, width: badgeWidth, height: badgeHeight };
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
