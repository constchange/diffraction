import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export const SpatialFieldCanvas = forwardRef(function SpatialFieldCanvas({
  bitmap,
  pixels,
  sourceSize,
  label,
  className = "",
}, forwardedRef) {
  const canvasRef = useRef(null);
  useImperativeHandle(forwardedRef, () => canvasRef.current, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (bitmap) context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    else if (pixels && sourceSize) {
      const buffer = document.createElement("canvas");
      buffer.width = sourceSize;
      buffer.height = sourceSize;
      buffer.getContext("2d", { alpha: false }).putImageData(
        new ImageData(pixels, sourceSize, sourceSize),
        0,
        0,
      );
      context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    }
  }, [bitmap, pixels, sourceSize]);

  return <canvas ref={canvasRef} className={`spatial-field-canvas ${className}`} width="480" height="480" role="img" aria-label={label} />;
});
