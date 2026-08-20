import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { Download } from "@phosphor-icons/react/Download";
import { Eye } from "@phosphor-icons/react/Eye";
import { Ruler } from "@phosphor-icons/react/Ruler";
import { WaveSine } from "@phosphor-icons/react/WaveSine";
import { apertureStats } from "../core/aperture.js";
import { niceScaleBar } from "../core/coordinates.js";
import { createBrandedPatternCanvas } from "../core/exportPattern.js";
import {
  createFresnelAperture,
  FRESNEL_SIZE,
  referenceFresnelNumber,
} from "../core/fresnel.js";
import { useFresnelDiffraction } from "../hooks/useFresnelDiffraction.js";
import { ApertureEditor } from "./ApertureEditor.jsx";
import { CompactOpticalApparatus } from "./CompactOpticalApparatus.jsx";
import { PlaneCoordinates } from "./PlaneCoordinates.jsx";
import { SpatialFieldCanvas } from "./SpatialFieldCanvas.jsx";
import { WavelengthBar, wavelengthToRgb } from "./WavelengthBar.jsx";

const APERTURE_PRESETS = [
  { id: "circle", name: "圆孔", detail: "观察菲涅尔环带" },
  { id: "square", name: "方孔", detail: "比较直角边界传播" },
  { id: "single-slit", name: "单缝", detail: "观察近场条纹演化" },
  { id: "double-hole", name: "双圆孔", detail: "叠加近场干涉" },
  { id: "rings", name: "同心环", detail: "环带复振幅结构" },
];

function PropagationBridge({ distanceM }) {
  return (
    <div className="fresnel-propagation" aria-hidden="true">
      <div className="fresnel-wavefront"><i /><i /><i /></div>
      <div className="fresnel-propagation-line"><span /><ArrowRight size={22} weight="bold" /></div>
      <strong>自由空间传播</strong>
      <small>z = {distanceM.toFixed(2)} m</small>
    </div>
  );
}

export function FresnelDiffractionLab() {
  const initialApertureRef = useRef(createFresnelAperture());
  const [aperture, setAperture] = useState(initialApertureRef.current);
  const [activePreset, setActivePreset] = useState("circle");
  const [wavelengthNm, setWavelengthNm] = useState(532);
  const [distanceM, setDistanceM] = useState(0.8);
  const [planeWidthMm, setPlaneWidthMm] = useState(8);
  const [displayMode, setDisplayMode] = useState("enhanced");
  const [activePanel, setActivePanel] = useState("aperture");
  const outputCanvasRef = useRef(null);
  const parameters = useMemo(() => ({
    wavelengthNm,
    distanceM,
    planeWidthMm,
    displayMode,
  }), [displayMode, distanceM, planeWidthMm, wavelengthNm]);
  const { frame, status, submit } = useFresnelDiffraction(
    initialApertureRef.current,
    FRESNEL_SIZE,
    parameters,
  );

  useEffect(() => {
    submit(aperture, parameters);
  }, [aperture, parameters, submit]);

  const updateAperture = useCallback((next) => {
    setActivePreset("custom");
    setAperture(next);
  }, []);

  const previewAperture = useCallback((next) => {
    submit(next, parameters);
  }, [parameters, submit]);

  function loadPreset(kind) {
    const next = createFresnelAperture(FRESNEL_SIZE, kind);
    setActivePreset(kind);
    setAperture(next);
  }

  function exportImage() {
    if (!outputCanvasRef.current) return;
    const branded = createBrandedPatternCanvas(
      outputCanvasRef.current,
      "菲涅尔衍射仿真 (c)2026, Qi Hui Academy",
    );
    const anchor = document.createElement("a");
    anchor.download = "fresnel-diffraction-result.png";
    anchor.href = branded.toDataURL("image/png");
    anchor.click();
  }

  const stats = apertureStats(aperture.amplitude);
  const fresnelNumber = referenceFresnelNumber(planeWidthMm, wavelengthNm, distanceM);
  const samplePitchUm = (planeWidthMm * 1000) / FRESNEL_SIZE;
  const lightColor = `rgb(${wavelengthToRgb(wavelengthNm).join(",")})`;
  const presets = (
    <div className="fresnel-inline-presets" aria-label="菲涅尔衍射屏预设">
      {APERTURE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={activePreset === preset.id ? "active" : ""}
          onClick={() => loadPreset(preset.id)}
          title={preset.detail}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );

  return (
    <section className="fresnel-lab" aria-label="菲涅尔衍射实验">
      <header className="fresnel-hero">
        <div>
          <span>NEAR-FIELD OPTICS · FRESNEL PROPAGATION</span>
          <h1>看见光在空间中逐步展开</h1>
          <p>绘制衍射屏，拖动传播距离，观察近场结构如何连续演化为衍射图样。</p>
        </div>
        <div className={`fresnel-status ${status.state}`}>
          <i />
          {status.state === "ready" ? `实时 · ${status.elapsed.toFixed(0)} ms` : status.state === "error" ? status.message : "计算中"}
        </div>
      </header>

      <CompactOpticalApparatus
        variant="fresnel"
        lightColor={lightColor}
        wavelengthNm={wavelengthNm}
        distanceM={distanceM}
      />

      <nav className="fresnel-mobile-switcher" aria-label="菲涅尔实验工作区">
        <button type="button" className={activePanel === "aperture" ? "active" : ""} onClick={() => setActivePanel("aperture")}>衍射屏</button>
        <button type="button" className={activePanel === "output" ? "active" : ""} onClick={() => setActivePanel("output")}>观察屏</button>
      </nav>

      <div className="fresnel-stage">
        <article className={`fresnel-aperture-card spatial-editor-module ${activePanel === "aperture" ? "mobile-active" : ""}`}>
          <ApertureEditor
            aperture={aperture}
            size={FRESNEL_SIZE}
            onChange={updateAperture}
            onPreview={previewAperture}
            mode="draw"
            formula=""
            onModeChange={() => {}}
            onFormulaChange={() => {}}
            title="衍射屏"
            subtitle="入射平面复振幅 U₀(x, y)"
            editorId="fresnel-aperture-title"
            index="01"
            showModeTabs={false}
            showRepeat={false}
            showCommunity={false}
            showLocalStorage={false}
            clearLabel="清空衍射屏"
            clearTitle="清空菲涅尔衍射屏"
            supplementalControls={presets}
            coordinateUnit="mm"
            coordinateExtent={planeWidthMm / 2}
            scaleBar={niceScaleBar(planeWidthMm)}
            canvasAriaLabel="菲涅尔衍射屏透光率绘制区域"
          />
        </article>

        <PropagationBridge distanceM={distanceM} />

        <article className={`fresnel-output-card ${activePanel === "output" ? "mobile-active" : ""}`}>
          <header>
            <span>02</span>
            <div><h2>观察屏</h2><p>传播后强度 I(x, y; z)</p></div>
            <strong><Eye size={14} /> {displayMode === "enhanced" ? "增强显示" : "线性强度"}</strong>
          </header>
          <div className="fresnel-output-shell">
            <SpatialFieldCanvas
              ref={outputCanvasRef}
              pixels={frame?.pixels}
              sourceSize={frame?.size}
              label="菲涅尔衍射观察屏光强"
            />
            <PlaneCoordinates
              unit="mm"
              extent={planeWidthMm / 2}
              scaleBar={niceScaleBar(planeWidthMm)}
            />
          </div>
          <footer>
            <div><WaveSine size={17} /><span>菲涅尔传播</span><strong>{distanceM.toFixed(2)} m</strong></div>
            <button type="button" onClick={exportImage}><Download size={15} /> 导出图像</button>
          </footer>
        </article>
      </div>

      <aside className="fresnel-inspector">
        <div className="fresnel-inspector-title">
          <WaveSine size={22} weight="duotone" />
          <div><strong>传播参数</strong><span>菲涅尔传递函数法 · 512² FFT</span></div>
        </div>

        <section className="fresnel-parameter-block">
          <label><span>波长 λ</span><output>{wavelengthNm} nm</output></label>
          <WavelengthBar value={wavelengthNm} onChange={setWavelengthNm} />
        </section>

        <section className="fresnel-parameter-block">
          <label><span>传播距离 z</span><output>{distanceM.toFixed(2)} m</output></label>
          <input aria-label="传播距离" type="range" min="0.05" max="2" step="0.01" value={distanceM} onChange={(event) => setDistanceM(Number(event.target.value))} />
          <div className="fresnel-range-scale"><span>0.05</span><span>1.00</span><span>2.00 m</span></div>
        </section>

        <section className="fresnel-parameter-block">
          <label><span>衍射屏物理宽度</span><output>{planeWidthMm.toFixed(1)} mm</output></label>
          <input aria-label="衍射屏物理宽度" type="range" min="2" max="16" step="0.1" value={planeWidthMm} onChange={(event) => setPlaneWidthMm(Number(event.target.value))} />
          <div className="fresnel-range-scale"><span>2</span><span>8</span><span>16 mm</span></div>
        </section>

        <section className="fresnel-display-mode">
          <span>显示映射</span>
          <div>
            <button type="button" className={displayMode === "linear" ? "active" : ""} onClick={() => setDisplayMode("linear")}>线性</button>
            <button type="button" className={displayMode === "enhanced" ? "active" : ""} onClick={() => setDisplayMode("enhanced")}>增强</button>
          </div>
        </section>

        <dl className="fresnel-readout">
          <div><dt>参考菲涅尔数</dt><dd>{Number.isFinite(fresnelNumber) ? fresnelNumber.toFixed(1) : "∞"}</dd></div>
          <div><dt>采样间隔</dt><dd>{samplePitchUm.toFixed(1)} μm</dd></div>
          <div><dt>有效透光面积</dt><dd>{(stats.activeRatio * 100).toFixed(1)}%</dd></div>
        </dl>

        <div className="fresnel-theory-note">
          <Ruler size={18} />
          <p><strong>实验提示</strong><span>减小传播距离可观察孔径轮廓附近的近场振荡；增大距离后，图样会逐渐接近夫朗禾费远场分布。</span></p>
        </div>
      </aside>
    </section>
  );
}
