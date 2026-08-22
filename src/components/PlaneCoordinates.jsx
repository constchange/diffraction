import { useMemo } from "react";
import katex from "katex";
import { coordinateScaleLatex, coordinateUnitLatex } from "../core/coordinates.js";

function formatValue(value) {
  const absolute = Math.abs(value);
  if (absolute >= 10) return value.toFixed(0);
  if (absolute >= 1) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function MathMark({ latex, className = "" }) {
  const markup = useMemo(
    () => katex.renderToString(latex, { throwOnError: false, output: "html" }),
    [latex],
  );
  return <span className={`plane-math-mark ${className}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function PlaneCoordinates({
  unit,
  extent,
  scaleBar,
  xSymbol = "x",
  ySymbol = "y",
  className = "",
}) {
  const safeExtent = Math.max(0, Number(extent) || 0);
  const safeScale = Math.max(0, Number(scaleBar) || 0);
  const scaleWidth = safeExtent > 0 ? Math.min(100, (safeScale / (safeExtent * 2)) * 100) : 0;
  const unitLatex = coordinateUnitLatex(unit);
  const extentLatex = formatValue(safeExtent);
  return (
    <div className={`plane-coordinates ${className}`} aria-hidden="true">
      <MathMark className="plane-axis-unit plane-axis-x" latex={String.raw`${xSymbol}\,/\,${unitLatex}`} />
      <MathMark className="plane-axis-unit plane-axis-y" latex={String.raw`${ySymbol}\,/\,${unitLatex}`} />
      <div className="plane-coordinate-ticks plane-coordinate-ticks-x">
        <MathMark latex={`-${extentLatex}`} /><MathMark latex="0" /><MathMark latex={`+${extentLatex}`} />
      </div>
      <div className="plane-coordinate-ticks plane-coordinate-ticks-y">
        <MathMark latex={`+${extentLatex}`} /><MathMark latex="0" /><MathMark latex={`-${extentLatex}`} />
      </div>
      {safeScale > 0 && (
        <div className="plane-scale-bar" style={{ width: `${scaleWidth}%` }}>
          <i /><MathMark latex={coordinateScaleLatex(safeScale, unit)} />
        </div>
      )}
    </div>
  );
}
