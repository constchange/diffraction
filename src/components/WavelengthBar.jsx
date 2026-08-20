import { useEffect, useRef } from "react";
import { wavelengthToRgb } from "../core/display.js";

export { wavelengthToRgb };

export function WavelengthBar({
  value,
  disabled = false,
  onChange,
  ariaLabel = "光源波长",
}) {
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
    const markerRadius = 7.5;
    const markerX = markerRadius + ((value - 380) / 320) * (canvas.width - markerRadius * 2);
    context.beginPath();
    context.arc(markerX, canvas.height / 2, markerRadius, 0, Math.PI * 2);
    context.fillStyle = "#f8fbff";
    context.fill();
    context.lineWidth = 2.2;
    context.strokeStyle = "rgba(20, 42, 78, 0.9)";
    context.stroke();
  }, [value, disabled]);

  return (
    <div className={`wavelength-spectrum-control ${disabled ? "disabled" : ""}`}>
      <canvas className="wavelength-bar" ref={canvasRef} width="240" height="18" aria-hidden="true" />
      <input
        className="wavelength-spectrum-input"
        type="range"
        min="380"
        max="700"
        step="1"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(Number(event.target.value))}
        aria-label={ariaLabel}
      />
    </div>
  );
}
