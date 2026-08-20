import { useId } from "react";

function Lens({ x, gradientId, label }) {
  return (
    <g className="compact-bench-lens">
      <path d={`M${x} 18C${x + 17} 34 ${x + 17} 76 ${x} 92C${x - 17} 76 ${x - 17} 34 ${x} 18Z`} fill={`url(#${gradientId})`} />
      <path d={`M${x - 20} 24V15H${x + 20}V24M${x - 20} 86V96H${x + 20}V86`} />
      <line x1={x} y1="92" x2={x} y2="105" />
      <text x={x} y="122">{label}</text>
    </g>
  );
}

function BenchBase() {
  return (
    <>
      <line className="compact-bench-axis" x1="40" y1="56" x2="1040" y2="56" />
      <line className="compact-bench-rail" x1="44" y1="105" x2="1036" y2="105" />
    </>
  );
}

function LaserSource({ glowId }) {
  return (
    <g className="compact-bench-source">
      <rect x="45" y="42" width="66" height="28" rx="6" />
      <rect x="105" y="48" width="14" height="16" rx="2" />
      <circle cx="120" cy="56" r="20" fill={`url(#${glowId})`} />
      <circle className="compact-source-core" cx="120" cy="56" r="3.2" />
      <line x1="78" y1="70" x2="78" y2="98" />
      <path d="M57 105H99L93 98H63Z" />
      <text x="80" y="122">单色光源</text>
    </g>
  );
}

function Screen({ x, label, spotId, filtered = false }) {
  return (
    <g className={filtered ? "compact-bench-screen compact-filter-screen" : "compact-bench-screen"}>
      <path d={`M${x - 8} 21L${x + 10} 27V87L${x - 8} 93Z`} />
      {filtered
        ? <><circle cx={x} cy="56" r="13" /><circle className="compact-filter-hole" cx={x} cy="56" r="5" /></>
        : <><ellipse cx={x} cy="56" rx="17" ry="23" fill={`url(#${spotId})`} /><ellipse className="compact-screen-core" cx={x} cy="56" rx="3.2" ry="7" /></>}
      <line x1={x} y1="92" x2={x} y2="105" />
      <text x={x} y="122">{label}</text>
    </g>
  );
}

function AperturePlate({ x, label = "衍射屏" }) {
  return (
    <g className="compact-bench-aperture">
      <rect x={x - 7} y="20" width="14" height="74" rx="2" />
      <rect className="compact-aperture-hole" x={x - 8} y="48" width="16" height="16" rx="4" />
      <line x1={x} y1="94" x2={x} y2="105" />
      <text x={x} y="122">{label}</text>
    </g>
  );
}

export function CompactOpticalApparatus({
  variant,
  lightColor,
  wavelengthNm,
  distanceM,
  controls = null,
}) {
  const prefix = useId().replace(/:/g, "");
  const lensId = `${prefix}-compact-lens`;
  const glowId = `${prefix}-compact-glow`;
  const spotId = `${prefix}-compact-spot`;
  const arrowId = `${prefix}-compact-arrow`;
  const isSpatial = variant === "spatial";

  return (
    <section className={`compact-apparatus-section compact-apparatus-${variant}`} aria-label={isSpatial ? "4f 空间滤波实验装置" : "菲涅尔衍射实验装置"}>
      <svg
        className="compact-apparatus-diagram"
        viewBox="0 0 1080 128"
        role="img"
        aria-label={isSpatial
          ? "单色光照明物面，经傅里叶透镜、频谱滤波面和成像透镜后在像面成像"
          : "单色光经准直透镜形成平行光，照射衍射屏后自由传播到观察屏"}
        style={{ "--optical-ray-color": lightColor }}
      >
        <defs>
          <linearGradient id={lensId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#234f8f" stopOpacity="0.3" />
            <stop offset="0.48" stopColor="#9beeff" stopOpacity="0.62" />
            <stop offset="1" stopColor="#326ab5" stopOpacity="0.34" />
          </linearGradient>
          <radialGradient id={glowId}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.24" stopColor={lightColor} stopOpacity="0.92" />
            <stop offset="1" stopColor={lightColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={spotId}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.3" stopColor={lightColor} stopOpacity="0.92" />
            <stop offset="1" stopColor={lightColor} stopOpacity="0" />
          </radialGradient>
          <marker id={arrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={lightColor} />
          </marker>
        </defs>

        <BenchBase />
        <LaserSource glowId={glowId} />

        {isSpatial ? (
          <>
            <g className="compact-bench-object">
              <rect x="205" y="24" width="13" height="66" rx="2" />
              <path d="M211.5 42V72M198 57H225" />
              <line x1="211.5" y1="90" x2="211.5" y2="105" />
              <text x="212" y="122">物面</text>
            </g>
            <Lens x={390} gradientId={lensId} label="傅里叶透镜 L₁" />
            <Screen x={552} label="频谱滤波面" spotId={spotId} filtered />
            <Lens x={730} gradientId={lensId} label="成像透镜 L₂" />
            <Screen x={950} label="像面" spotId={spotId} />
            <g className="compact-bench-rays" style={{ markerEnd: `url(#${arrowId})` }}>
              <path d="M121 56L205 38M121 56H205M121 56L205 74" />
              <path d="M218 38L390 28L552 56M218 56H552M218 74L390 84L552 56" />
              <path d="M560 56L730 28L950 40M560 56H950M560 56L730 84L950 72" />
            </g>
          </>
        ) : (
          <>
            <Lens x={290} gradientId={lensId} label="准直透镜" />
            <AperturePlate x={518} />
            <Screen x={950} label="观察屏" spotId={spotId} />
            <g className="compact-bench-rays" style={{ markerEnd: `url(#${arrowId})` }}>
              <path d="M121 56L290 30M121 56H290M121 56L290 82" />
              <path d="M292 30H511M292 56H511M292 82H511" />
              <path d="M525 30L950 38M525 56H950M525 82L950 74" />
            </g>
            <g className="compact-distance-mark">
              <path d="M535 101V109M535 105H933M933 101V109" />
              <text x="734" y="100">z = {distanceM.toFixed(2)} m</text>
            </g>
          </>
        )}
        <text className="compact-wavelength-label" x="1022" y="18">λ = {wavelengthNm} nm</text>
      </svg>
      {controls && <div className="compact-apparatus-controls">{controls}</div>}
    </section>
  );
}
