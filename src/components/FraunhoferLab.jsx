import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  DEFAULT_APERTURE_WIDTH_MM,
  fraunhoferObservationWidthMm,
} from "../core/coordinates.js";
import {
  createBrandedPatternDataUrl,
  createBrandedPatternDataUrlFromFrame,
  EXPORT_IMAGE_SIZE,
} from "../core/exportPattern.js";
import { FORMULA_PRESETS } from "../core/presets.js";
import { claimCommunityOnboarding } from "../core/communityApi.js";
import { ONBOARDING_STORAGE_KEY } from "../core/onboarding.js";
import { useDiffraction } from "../hooks/useDiffraction.js";
import { ApertureEditor } from "./ApertureEditor.jsx";
import { DiffractionCanvas } from "./DiffractionCanvas.jsx";
import { FraunhoferApparatus } from "./FraunhoferApparatus.jsx";
import { WavelengthBar, wavelengthToRgb } from "./WavelengthBar.jsx";
import { CommunityApertures } from "./CommunityApertures.jsx";
import { OnboardingTour } from "./OnboardingTour.jsx";
import { PlaneCoordinates } from "./PlaneCoordinates.jsx";

const onboardingClaims = new Map();

function claimOnboardingOnce(apiBase) {
  if (!onboardingClaims.has(apiBase)) {
    onboardingClaims.set(apiBase, claimCommunityOnboarding(apiBase));
  }
  return onboardingClaims.get(apiBase);
}

function localCommunityPreviewOpen() {
  return typeof window !== "undefined"
    && ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get("communityPreview") === "1";
}

function localTourPreviewOpen() {
  return typeof window !== "undefined"
    && ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).has("tourStep");
}

function Formula({ children, displayMode = false }) {
  const markup = useMemo(
    () => katex.renderToString(children, { throwOnError: false, displayMode, output: "html" }),
    [children, displayMode],
  );
  return <span className="katex-wrap" dangerouslySetInnerHTML={{ __html: markup }} />;
}

function SliderField({ label, symbol, valueText, min, max, step, value, onChange, disabled, children, showRange = true }) {
  return (
    <div className={`inspector-field ${disabled ? "disabled" : ""}`}>
      <div className="field-heading">
        <span>{label} <i>{symbol}</i></span>
        <strong>{valueText}</strong>
      </div>
      {children}
      {showRange && <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />}
      <div className="range-labels"><span>{min}</span><span>{(min + max) / 2}</span><span>{max}</span></div>
    </div>
  );
}

export function FraunhoferLab({
  compact = false,
  communityApiBase = "/api/community-apertures",
  embeddedInWorkspace = false,
  workspaceActive = true,
}) {
  const initialApertureRef = useRef(null);
  if (!initialApertureRef.current) initialApertureRef.current = createAperture(APERTURE_SIZE);
  const initialAperture = initialApertureRef.current;
  const [currentAperture, setCurrentAperture] = useState(initialAperture);
  const [wavelength, setWavelength] = useState(532);
  const [focalLength, setFocalLength] = useState(1.2);
  const [whiteLight, setWhiteLight] = useState(false);
  const [autoRun, setAutoRun] = useState(true);
  const [zoom, setZoom] = useState(1.45);
  const [editorMode, setEditorMode] = useState("draw");
  const [screenFormula, setScreenFormula] = useState(FORMULA_PRESETS.find((preset) => preset.id === "double-slit").latex);
  const [displayMode, setDisplayMode] = useState("enhanced");
  const [toast, setToast] = useState("");
  const [communityOpen, setCommunityOpen] = useState(localCommunityPreviewOpen);
  const [exportingPattern, setExportingPattern] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(localTourPreviewOpen);
  const outputCanvasRef = useRef(null);
  const toastTimerRef = useRef(null);
  const renderParams = useMemo(() => ({
    wavelength,
    focalLength,
    whiteLight,
    zoom,
    displayMode,
  }), [wavelength, focalLength, whiteLight, zoom, displayMode]);
  const { frame, status, submitAperture, requestExportFrame } = useDiffraction(
    initialAperture,
    APERTURE_SIZE,
    autoRun,
    renderParams,
  );
  const [stats, setStats] = useState(() => apertureStats(initialAperture.amplitude));
  const wavelengthColor = wavelengthToRgb(wavelength);

  useEffect(() => {
    let cancelled = false;
    let locallySeen = false;
    try {
      locallySeen = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
    } catch {
      locallySeen = false;
    }

    if (locallySeen && !localTourPreviewOpen()) return undefined;

    if (localTourPreviewOpen()) return undefined;

    claimOnboardingOnce(communityApiBase)
      .then((result) => {
        if (cancelled) return;
        try {
          window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
        } catch {
          // The server-side IP claim remains the cross-browser fallback.
        }
        if (result.show) setOnboardingOpen(true);
      })
      .catch(() => {
        if (cancelled) return;
        try {
          window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
        } catch {
          // The guide can still be completed without browser storage.
        }
        setOnboardingOpen(true);
      });
    return () => { cancelled = true; };
  }, [communityApiBase]);

  const closeOnboarding = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // The server-side IP claim still prevents the guide from repeating.
    }
    setOnboardingOpen(false);
  }, []);

  const commitAperture = useCallback((next) => {
    setCurrentAperture(next);
    setStats(apertureStats(next.amplitude));
    submitAperture(next, { quality: "live" });
  }, [submitAperture]);

  const announce = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  const pauseForFunctionEdit = useCallback(() => {
    if (!autoRun) return;
    setAutoRun(false);
    announce("实时渲染已暂停，可安心编辑屏函数");
  }, [announce, autoRun]);

  async function savePattern() {
    const canvas = outputCanvasRef.current;
    if (!canvas || exportingPattern) return;
    setExportingPattern(true);
    const anchor = document.createElement("a");
    anchor.download = `fraunhofer-${whiteLight ? "white" : `${wavelength}nm`}-${focalLength.toFixed(2)}m.png`;
    let exportFrame = null;
    try {
      announce("正在生成 1024×1024 高清光屏图样…");
      exportFrame = await requestExportFrame(EXPORT_IMAGE_SIZE, EXPORT_IMAGE_SIZE);
      anchor.href = createBrandedPatternDataUrlFromFrame(exportFrame, canvas.ownerDocument);
      anchor.click();
      announce("1024×1024 高清光屏图样已保存");
    } catch {
      anchor.href = createBrandedPatternDataUrl(canvas);
      anchor.click();
      announce("高清计算暂不可用，已保存 1024×1024 放大图样");
    } finally {
      exportFrame?.bitmap?.close?.();
      setExportingPattern(false);
    }
  }

  const loadCommunityAperture = useCallback((savedScreen, item) => {
    if (savedScreen.mode === "function") {
      setScreenFormula(savedScreen.formula);
      setEditorMode("function");
    } else {
      const next = savedScreen.aperture;
      setEditorMode("draw");
      setCurrentAperture(next);
      setStats(apertureStats(next.amplitude));
      submitAperture(next, { quality: "final" });
    }
    announce(`已载入“${item.patternName}”`);
  }, [announce, submitAperture]);

  const loadCommonPreset = useCallback((preset) => {
    setAutoRun(true);
    setScreenFormula(preset.latex);
    setEditorMode("function");
    announce(`已从常用库载入“${preset.name}”`);
  }, [announce]);

  const lightColor = `rgb(${wavelengthColor.join(",")})`;
  const apparatusLightColor = whiteLight ? "#fff8dc" : lightColor;
  const observationWidthMm = fraunhoferObservationWidthMm(zoom);

  return (
    <div className={`fraunhofer-lab-root ${compact ? "compact" : ""}`}>
      {!embeddedInWorkspace && <header className="lab-topbar">
        <div className="academy-title">
          <strong>启慧研习院</strong>
          <span aria-hidden="true">·</span>
          <span>夫朗禾费衍射仿真</span>
        </div>
      </header>}

      <main className={`lab-main ${embeddedInWorkspace ? "workspace-embedded-lab" : ""}`}>
        <FraunhoferApparatus lightColor={apparatusLightColor} />

        <div className="experiment-layout">
          <section className="experiment-deck" aria-label="衍射仿真实验台">
            <div className="optical-stage">
              <ApertureEditor
                aperture={currentAperture}
                size={APERTURE_SIZE}
                onChange={commitAperture}
                onPreview={submitAperture}
                mode={editorMode}
                formula={screenFormula}
                onModeChange={setEditorMode}
                onFormulaChange={setScreenFormula}
                onFunctionEditStart={pauseForFunctionEdit}
                onOpenCommunity={() => setCommunityOpen(true)}
                onLoadCommonPreset={loadCommonPreset}
                isRenderingPaused={!autoRun}
                coordinateUnit="mm"
                coordinateExtent={DEFAULT_APERTURE_WIDTH_MM / 2}
                scaleBar={1}
                scaleBarUnit="mm"
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
                  <div className="coordinate-plane-frame observation-coordinate-frame">
                    <DiffractionCanvas
                      ref={outputCanvasRef}
                      frame={frame}
                      wavelength={wavelength}
                      whiteLight={whiteLight}
                    />
                    <PlaneCoordinates
                      unit="mm"
                      extent={observationWidthMm / 2}
                      scaleBar={1}
                      xSymbol="u"
                      ySymbol="v"
                    />
                  </div>
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

            <SliderField label="波长" symbol="λ" valueText={whiteLight ? "380–700 nm" : `${wavelength} nm`} min={380} max={700} step={1} value={wavelength} onChange={setWavelength} disabled={whiteLight} showRange={false}>
              <WavelengthBar value={wavelength} disabled={whiteLight} onChange={setWavelength} />
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
            <button type="button" className="secondary-action" onClick={savePattern} disabled={exportingPattern} data-tour="export"><Download size={18} /> {exportingPattern ? "正在生成高清图样…" : "保存 1024×1024 光屏图样"}</button>

            <div className="inspector-note"><CheckCircle size={15} weight="fill" /><span>绘制与参数变化会自动传播到光屏</span></div>
          </aside>
        </div>
      </main>

      {toast && <div className="toast-message" role="status"><BookmarkSimple size={18} weight="fill" />{toast}</div>}
      <CommunityApertures
        open={communityOpen}
        aperture={currentAperture}
        mode={editorMode}
        formula={screenFormula}
        size={APERTURE_SIZE}
        apiBase={communityApiBase}
        onLoad={loadCommunityAperture}
        onClose={() => setCommunityOpen(false)}
      />
      <OnboardingTour open={onboardingOpen && !communityOpen && workspaceActive} onClose={closeOnboarding} />
    </div>
  );
}
