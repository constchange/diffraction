import { useCallback, useMemo, useRef, useState } from "react";
import { Aperture } from "@phosphor-icons/react/Aperture";
import { BookmarkSimple } from "@phosphor-icons/react/BookmarkSimple";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Download } from "@phosphor-icons/react/Download";
import { Eye } from "@phosphor-icons/react/Eye";
import { Pause } from "@phosphor-icons/react/Pause";
import { Play } from "@phosphor-icons/react/Play";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { WaveSine } from "@phosphor-icons/react/WaveSine";
import katex from "katex";
import { createAperture, APERTURE_SIZE, apertureStats } from "../core/aperture.js";
import { useDiffraction } from "../hooks/useDiffraction.js";
import { ApertureEditor } from "./ApertureEditor.jsx";
import { DiffractionCanvas } from "./DiffractionCanvas.jsx";
import { FraunhoferApparatus } from "./FraunhoferApparatus.jsx";
import { WavelengthBar, wavelengthToRgb } from "./WavelengthBar.jsx";

function Formula({ children, displayMode = false }) {
  const markup = useMemo(
    () => katex.renderToString(children, { throwOnError: false, displayMode, output: "html" }),
    [children, displayMode],
  );
  return <span className="katex-wrap" dangerouslySetInnerHTML={{ __html: markup }} />;
}

function SliderField({ label, symbol, valueText, min, max, step, value, onChange, disabled, children }) {
  return (
    <div className={`inspector-field ${disabled ? "disabled" : ""}`}>
      <div className="field-heading">
        <span>{label} <i>{symbol}</i></span>
        <strong>{valueText}</strong>
      </div>
      {children}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
      <div className="range-labels"><span>{min}</span><span>{(min + max) / 2}</span><span>{max}</span></div>
    </div>
  );
}

export function FraunhoferLab({ compact = false }) {
  const initialApertureRef = useRef(null);
  if (!initialApertureRef.current) initialApertureRef.current = createAperture(APERTURE_SIZE);
  const initialAperture = initialApertureRef.current;
  const [wavelength, setWavelength] = useState(532);
  const [focalLength, setFocalLength] = useState(1.2);
  const [whiteLight, setWhiteLight] = useState(false);
  const [autoRun, setAutoRun] = useState(true);
  const [zoom, setZoom] = useState(1.45);
  const [editorMode, setEditorMode] = useState("draw");
  const [displayMode, setDisplayMode] = useState("enhanced");
  const [toast, setToast] = useState("");
  const outputCanvasRef = useRef(null);
  const toastTimerRef = useRef(null);
  const renderParams = useMemo(() => ({
    wavelength,
    focalLength,
    whiteLight,
    zoom,
    displayMode,
  }), [wavelength, focalLength, whiteLight, zoom, displayMode]);
  const { frame, status, submitAperture } = useDiffraction(
    initialAperture,
    APERTURE_SIZE,
    autoRun,
    renderParams,
  );
  const [stats, setStats] = useState(() => apertureStats(initialAperture.amplitude));
  const wavelengthColor = wavelengthToRgb(wavelength);

  const commitAperture = useCallback((next) => {
    setStats(apertureStats(next.amplitude));
    submitAperture(next, { quality: "live" });
  }, [submitAperture]);

  function announce(message) {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2200);
  }

  function savePattern() {
    const canvas = outputCanvasRef.current;
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.download = `fraunhofer-${whiteLight ? "white" : `${wavelength}nm`}-${focalLength.toFixed(2)}m.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
    announce("光屏图样已保存");
  }

  const lightColor = `rgb(${wavelengthColor.join(",")})`;

  return (
    <div className={`fraunhofer-lab-root ${compact ? "compact" : ""}`}>
      <header className="lab-topbar">
        <div className="academy-title">
          <strong>启慧研习院</strong>
          <span aria-hidden="true">·</span>
          <span>夫朗禾费衍射仿真</span>
        </div>
      </header>

      <main className="lab-main">
        <FraunhoferApparatus />

        <div className="experiment-layout">
          <section className="experiment-deck" aria-label="衍射仿真实验台">
            <div className="optical-stage">
              <ApertureEditor
                aperture={initialAperture}
                size={APERTURE_SIZE}
                onChange={commitAperture}
                onPreview={submitAperture}
                onModeChange={setEditorMode}
              />

              <div className="optical-bridge" aria-label={`薄透镜焦距 ${focalLength.toFixed(2)} 米`}>
                <Sparkle size={20} weight="fill" style={{ color: whiteLight ? "#f7fbff" : lightColor }} />
                <Aperture size={34} weight="duotone" />
                <small>薄透镜</small>
                <strong>f = {focalLength.toFixed(2)} m</strong>
              </div>

              <section className="observation-module" aria-labelledby="observation-title">
                <header className="module-header">
                  <div>
                    <span className="module-index">02</span>
                    <div><h2 id="observation-title">光屏</h2><p>远场强度 I(u, v)</p></div>
                  </div>
                  <span className={`live-badge ${autoRun ? status.state : "paused"}`}><i /> {!autoRun ? "已暂停" : status.state === "computing" ? "计算中" : "实时"}</span>
                </header>
                <div className="observation-canvas-shell">
                  <DiffractionCanvas
                    ref={outputCanvasRef}
                    frame={frame}
                    wavelength={wavelength}
                    whiteLight={whiteLight}
                  />
                </div>
                <footer className="screen-caption">
                  <div className="display-scale-control" aria-label="光强显示标度">
                    <Eye size={16} />
                    <button type="button" className={displayMode === "linear" ? "active" : ""} onClick={() => setDisplayMode("linear")}>线性</button>
                    <button type="button" className={displayMode === "enhanced" ? "active" : ""} onClick={() => setDisplayMode("enhanced")}>增强</button>
                  </div>
                  <strong>{whiteLight ? "白光叠加" : `${wavelength} nm`}</strong>
                </footer>
              </section>
            </div>

            <footer className="experiment-footer">
              <button type="button" className="play-control" onClick={() => setAutoRun((value) => !value)} aria-label={autoRun ? "暂停实时计算" : "继续实时计算"}>
                {autoRun ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
              </button>
              <div className="calculation-state">
                <strong>{autoRun ? "实时传播" : "图样已冻结"}</strong>
                <span>{status.state === "ready" ? `${status.quality === "final" ? "1024² 精细" : "512² 实时"} FFT · ${status.elapsed.toFixed(0)} ms` : status.state === "error" ? status.message : "等待光场更新"}</span>
              </div>
              <progress className="timeline-line" max="100" value={autoRun ? "72" : "72"}>72%</progress>
              <label className="zoom-control">
                <span>观察缩放</span>
                <input type="range" min="0.55" max="2.4" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                <output>{zoom.toFixed(2)}×</output>
              </label>
            </footer>
          </section>

          <aside className="inspector-panel" aria-label="实验参数">
            <div className="inspector-heading">
              <div><WaveSine size={22} weight="duotone" /><span>实验参数</span></div>
              <span className="sample-chip">256² 屏 · 512/1024² FFT</span>
            </div>

            <section className="light-mode-section">
              <div className="field-heading"><span>光源模式</span><strong>{whiteLight ? "白光" : "单色光"}</strong></div>
              <div className="segmented-control">
                <button type="button" className={!whiteLight ? "active" : ""} onClick={() => setWhiteLight(false)}>单色光</button>
                <button type="button" className={whiteLight ? "active" : ""} onClick={() => setWhiteLight(true)}>白光</button>
              </div>
            </section>

            <SliderField label="波长" symbol="λ" valueText={whiteLight ? "380–700 nm" : `${wavelength} nm`} min={380} max={700} step={1} value={wavelength} onChange={setWavelength} disabled={whiteLight}>
              <WavelengthBar value={wavelength} disabled={whiteLight} />
            </SliderField>

            <SliderField label="透镜焦距" symbol="f" valueText={`${focalLength.toFixed(2)} m`} min={0.2} max={2} step={0.02} value={focalLength} onChange={setFocalLength} />

            <section className="field-summary">
              <div><span>屏函数编辑</span><strong>{editorMode === "draw" ? "自由绘制" : "LaTeX 复函数"}</strong></div>
              <div><span>有效透光面积</span><strong>{(stats.activeRatio * 100).toFixed(1)}%</strong></div>
              <div><span>平均振幅透过率</span><strong>{stats.meanTransmission.toFixed(3)}</strong></div>
            </section>

            <section className="equation-panel">
              <span>夫朗禾费远场</span>
              <Formula displayMode>{String.raw`I(u,v)\propto\left|\mathcal{F}\{T(x,y)\}\right|^2`}</Formula>
              <p>图样尺度 <Formula>{String.raw`\propto \lambda f`}</Formula></p>
            </section>

            <button type="button" className="primary-action" onClick={() => setAutoRun((value) => !value)}>
              {autoRun ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
              {autoRun ? "暂停实时计算" : "继续实时计算"}
            </button>
            <button type="button" className="secondary-action" onClick={savePattern}><Download size={18} /> 保存光屏图样</button>

            <div className="inspector-note"><CheckCircle size={15} weight="fill" /><span>绘制与参数变化会自动传播到光屏</span></div>
          </aside>
        </div>
      </main>

      {toast && <div className="toast-message" role="status"><BookmarkSimple size={18} weight="fill" />{toast}</div>}
    </div>
  );
}
