import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

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
