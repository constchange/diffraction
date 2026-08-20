function formatValue(value) {
  const absolute = Math.abs(value);
  if (absolute >= 10) return value.toFixed(0);
  if (absolute >= 1) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function PlaneCoordinates({ unit, extent, scaleBar, className = "" }) {
  const safeExtent = Math.max(0, Number(extent) || 0);
  const safeScale = Math.max(0, Number(scaleBar) || 0);
  const scaleWidth = safeExtent > 0 ? Math.min(46, (safeScale / (safeExtent * 2)) * 100) : 0;
  return (
    <div className={`plane-coordinates ${className}`} aria-hidden="true">
      <span className="plane-axis-unit plane-axis-x">x / {unit}</span>
      <span className="plane-axis-unit plane-axis-y">y / {unit}</span>
      <div className="plane-coordinate-ticks">
        <span>−{formatValue(safeExtent)}</span><span>0</span><span>+{formatValue(safeExtent)}</span>
      </div>
      {safeScale > 0 && (
        <div className="plane-scale-bar" style={{ width: `${scaleWidth}%` }}>
          <i /><span>{formatValue(safeScale)} {unit}</span>
        </div>
      )}
    </div>
  );
}
