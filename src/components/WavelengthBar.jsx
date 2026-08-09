import { useEffect, useRef } from "react";
import { wavelengthToRgb } from "../core/display.js";

export { wavelengthToRgb };

export function WavelengthBar({ value, disabled = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const image = context.createImageData(canvas.width, canvas.height);
    for (let x = 0; x < canvas.width; x += 1) {
      const wavelength = 380 + (320 * x) / (canvas.width - 1);
      const [red, green, blue] = wavelengthToRgb(wavelength);
      for (let y = 0; y < canvas.height; y += 1) {
        const index = (y * canvas.width + x) * 4;
        image.data[index] = red;
        image.data[index + 1] = green;
        image.data[index + 2] = blue;
        image.data[index + 3] = disabled ? 92 : 230;
      }
    }
    context.putImageData(image, 0, 0);
    const markerX = ((value - 380) / 320) * canvas.width;
    context.beginPath();
    context.arc(markerX, canvas.height / 2, 6, 0, Math.PI * 2);
    context.fillStyle = "#f8fbff";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#2770ff";
    context.stroke();
  }, [value, disabled]);

  return <canvas className="wavelength-bar" ref={canvasRef} width="240" height="16" aria-hidden="true" />;
}
