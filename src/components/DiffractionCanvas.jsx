import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

function drawGuides(context, width, height) {
  context.save();
  context.strokeStyle = "rgba(133, 164, 226, 0.18)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(width / 2, 14);
  context.lineTo(width / 2, height - 14);
  context.moveTo(14, height / 2);
  context.lineTo(width - 14, height / 2);
  context.stroke();
  context.restore();
}

export const DiffractionCanvas = forwardRef(function DiffractionCanvas(
  { frame, wavelength, whiteLight },
  forwardedRef,
) {
  const canvasRef = useRef(null);
  useImperativeHandle(forwardedRef, () => canvasRef.current, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const animationFrame = requestAnimationFrame(() => {
      if (cancelled) return;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (frame?.bitmap) {
        context.drawImage(frame.bitmap, 0, 0, canvas.width, canvas.height);
      } else if (frame?.pixels) {
        context.putImageData(
          new ImageData(frame.pixels, frame.width, frame.height),
          0,
          0,
        );
      }
      drawGuides(context, canvas.width, canvas.height);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      className="diffraction-canvas"
      width="440"
      height="440"
      role="img"
      aria-label={whiteLight ? "白光夫朗禾费衍射图样" : `${wavelength} 纳米单色光夫朗禾费衍射图样`}
    />
  );
});
