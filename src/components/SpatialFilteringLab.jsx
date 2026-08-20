import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Aperture } from "@phosphor-icons/react/Aperture";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { Circle } from "@phosphor-icons/react/Circle";
import { Download } from "@phosphor-icons/react/Download";
import { Eraser } from "@phosphor-icons/react/Eraser";
import { Funnel } from "@phosphor-icons/react/Funnel";
import { GridFour } from "@phosphor-icons/react/GridFour";
import { ImageSquare } from "@phosphor-icons/react/ImageSquare";
import { Rectangle } from "@phosphor-icons/react/Rectangle";
import { Scan } from "@phosphor-icons/react/Scan";
import { SlidersHorizontal } from "@phosphor-icons/react/SlidersHorizontal";
import symmetricObjectUrl from "../assets/symmetric-object.jpeg";
import { createBrandedPatternCanvas } from "../core/exportPattern.js";
import {
  niceScaleBar,
  SPATIAL_OBJECT_WIDTH_MM,
  SPATIAL_WAVELENGTH_NM,
  spatialSpectrumWidthPerMm,
} from "../core/coordinates.js";
import { imageDataToAmplitudeField } from "../core/imageField.js";
import {
  createSpatialFilter,
  createSpatialObject,
  SPATIAL_FILTER_SIZE,
} from "../core/spatialFilter.js";
import { useSpatialFilter } from "../hooks/useSpatialFilter.js";
import { ApertureEditor } from "./ApertureEditor.jsx";
import { CompactOpticalApparatus } from "./CompactOpticalApparatus.jsx";
import { PlaneCoordinates } from "./PlaneCoordinates.jsx";
import { SpatialFieldCanvas } from "./SpatialFieldCanvas.jsx";
import { WavelengthBar, wavelengthToRgb } from "./WavelengthBar.jsx";

const OBJECT_PRESETS = [
  { id: "academy", name: "十字标板" },
  { id: "grid", name: "方格光栅" },
  { id: "rings", name: "同心环" },
  { id: "edges", name: "菱形边框" },
  { id: "symmetric-object", name: "某对称体", imageUrl: symmetricObjectUrl },
];

const FILTER_PRESETS = [
  { id: "open", name: "全通", detail: "保留全部频谱", Icon: Aperture },
  { id: "low-pass", name: "低通", detail: "平滑细节", Icon: Circle },
  { id: "high-pass", name: "高通", detail: "提取边缘", Icon: Circle },
  { id: "horizontal", name: "横向频率", detail: "水平狭缝", Icon: Rectangle },
  { id: "vertical", name: "纵向频率", detail: "竖直狭缝", Icon: Rectangle },
  { id: "notch", name: "陷波", detail: "抑制周期噪声", Icon: Scan },
  { id: "abbe", name: "阿贝级次", detail: "逐级恢复结构", Icon: GridFour },
  { id: "phase-contrast", name: "相位衬度", detail: "中心相移 π/2", Icon: SlidersHorizontal },
  { id: "blocked-all", name: "全不通", detail: "阻断全部频谱", Icon: Funnel },
];

function OpticalArrow({ children }) {
  return (
    <div className="spatial-optical-arrow" aria-hidden="true">
      <div><Aperture size={20} weight="duotone" /><ArrowRight size={20} weight="bold" /></div>
      <span>{children}</span>
    </div>
  );
}

export function SpatialFilteringLab() {
  const initialObjectRef = useRef(createSpatialObject());
  const initialFilterRef = useRef(createSpatialFilter());
  const [objectField, setObjectField] = useState(initialObjectRef.current);
  const [filterField, setFilterField] = useState(initialFilterRef.current);
  const [objectPreset, setObjectPreset] = useState("academy");
  const [filterPreset, setFilterPreset] = useState("open");
  const [filterRadius, setFilterRadius] = useState(0.2);
  const [slitWidth, setSlitWidth] = useState(0.12);
  const [abbeOrder, setAbbeOrder] = useState(1);
  const [activePanel, setActivePanel] = useState("filter");
  const [showSpectrumBackdrop, setShowSpectrumBackdrop] = useState(true);
  const [outsideTransmission, setOutsideTransmission] = useState(1);
  const [wavelengthNm, setWavelengthNm] = useState(SPATIAL_WAVELENGTH_NM);
  const imageCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const { frame, status, submit } = useSpatialFilter(
    initialObjectRef.current,
    initialFilterRef.current,
    SPATIAL_FILTER_SIZE,
    1,
    SPATIAL_WAVELENGTH_NM,
  );
  const latestObjectRef = useRef(initialObjectRef.current);
  const latestFilterRef = useRef(initialFilterRef.current);
  const latestOutsideTransmissionRef = useRef(1);

  useEffect(() => {
    submit(objectField, filterField, outsideTransmission, wavelengthNm);
  }, [filterField, objectField, outsideTransmission, submit, wavelengthNm]);

  const filterOptions = useMemo(() => ({
    radius: filterRadius,
    slit: slitWidth,
    abbeOrder,
  }), [abbeOrder, filterRadius, slitWidth]);

  const applyObjectPreset = useCallback(async (kind, imageUrl) => {
    if (imageUrl) {
      const next = await loadImageField(imageUrl);
      latestObjectRef.current = next;
      setObjectPreset(kind);
      setObjectField(next);
      return;
    }
    const next = createSpatialObject(SPATIAL_FILTER_SIZE, kind);
    latestObjectRef.current = next;
    setObjectPreset(kind);
    setObjectField(next);
  }, []);

  const applyFilterPreset = useCallback((kind, nextOptions = filterOptions) => {
    const next = createSpatialFilter(SPATIAL_FILTER_SIZE, kind, nextOptions);
    latestFilterRef.current = next;
    latestOutsideTransmissionRef.current = 1;
    setOutsideTransmission(1);
    setFilterPreset(kind);
    setFilterField(next);
  }, [filterOptions]);

  function updateFilterOption(key, value) {
    const next = { ...filterOptions, [key]: value };
    if (key === "radius") setFilterRadius(value);
    if (key === "slit") setSlitWidth(value);
    if (key === "abbeOrder") setAbbeOrder(value);
    applyFilterPreset(filterPreset, next);
  }

  const updateObjectField = useCallback((next) => {
    latestObjectRef.current = next;
    setObjectPreset("custom");
    setObjectField(next);
  }, []);

  const previewObjectField = useCallback((next) => {
    latestObjectRef.current = next;
    submit(next, latestFilterRef.current, latestOutsideTransmissionRef.current, wavelengthNm);
  }, [submit, wavelengthNm]);

  const updateFilterField = useCallback((next) => {
    latestFilterRef.current = next;
    setFilterPreset("custom");
    setFilterField(next);
  }, []);

  const previewFilterField = useCallback((next) => {
    latestFilterRef.current = next;
    submit(latestObjectRef.current, next, latestOutsideTransmissionRef.current, wavelengthNm);
  }, [submit, wavelengthNm]);

  const blockEntireSpectrum = useCallback(() => {
    const next = createSpatialFilter(SPATIAL_FILTER_SIZE, "blocked");
    latestFilterRef.current = next;
    latestOutsideTransmissionRef.current = 0;
    setFilterPreset("blocked-all");
    setOutsideTransmission(0);
    setFilterField(next);
  }, []);

  const objectPresets = (
    <div className="spatial-editor-presets object-preset-row">
      {OBJECT_PRESETS.map((preset) => (
        <button key={preset.id} type="button" className={objectPreset === preset.id ? "active" : ""} onClick={() => applyObjectPreset(preset.id, preset.imageUrl)}>{preset.name}</button>
      ))}
      <button type="button" onClick={() => fileInputRef.current?.click()}>上传图片</button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={loadImage} hidden />
    </div>
  );
  const lightColor = `rgb(${wavelengthToRgb(wavelengthNm).join(",")})`;
  const spectrumWidthPerMm = spatialSpectrumWidthPerMm();

  async function loadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const next = await loadImageField(file);
    setObjectPreset("custom");
    latestObjectRef.current = next;
    setObjectField(next);
    event.target.value = "";
  }

  async function loadImageField(source) {
    const bitmap = await createImageBitmap(source instanceof Blob ? source : await fetch(source).then((response) => response.blob()));
    const buffer = document.createElement("canvas");
    buffer.width = SPATIAL_FILTER_SIZE;
    buffer.height = SPATIAL_FILTER_SIZE;
    const context = buffer.getContext("2d", { alpha: false, willReadFrequently: true });
    context.fillStyle = "#000";
    context.fillRect(0, 0, buffer.width, buffer.height);
    const scale = Math.min(buffer.width / bitmap.width, buffer.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(bitmap, (buffer.width - width) / 2, (buffer.height - height) / 2, width, height);
    bitmap.close?.();
    const image = context.getImageData(0, 0, buffer.width, buffer.height);
    return imageDataToAmplitudeField(image, SPATIAL_FILTER_SIZE);
  }

  function exportImage() {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    const branded = createBrandedPatternCanvas(canvas, "空间滤波仿真 (c)2026, Qi Hui Academy");
    const anchor = document.createElement("a");
    anchor.download = "4f-spatial-filtering-result.png";
    anchor.href = branded.toDataURL("image/png");
    anchor.click();
  }

  return (
    <section className="spatial-filter-lab" aria-label="4f 空间滤波实验">
      <header className="spatial-filter-hero">
        <div>
          <span>FOURIER OPTICS · 4F SYSTEM</span>
          <h1>在频谱面塑造图像</h1>
          <p>观察空间频率如何决定轮廓、细节与方向结构。</p>
        </div>
        <div className={`spatial-status ${status.state}`}><i />{status.state === "ready" ? `实时 · ${status.elapsed.toFixed(0)} ms` : status.state === "error" ? status.message : "计算中"}</div>
      </header>

      <CompactOpticalApparatus
        variant="spatial"
        lightColor={lightColor}
        wavelengthNm={wavelengthNm}
        controls={(
          <div className="compact-wavelength-control">
            <label><span>照明波长 λ</span><output>{wavelengthNm} nm</output></label>
            <WavelengthBar value={wavelengthNm} onChange={setWavelengthNm} ariaLabel="空间滤波照明波长" />
          </div>
        )}
      />

      <nav className="spatial-mobile-switcher" aria-label="空间滤波工作区">
        {[["object", "物面"], ["filter", "频谱面"], ["image", "像面"]].map(([id, label]) => (
          <button key={id} type="button" className={activePanel === id ? "active" : ""} onClick={() => setActivePanel(id)}>{label}</button>
        ))}
      </nav>

      <div className="spatial-stage">
        <article className={`spatial-module spatial-editor-module object-module ${activePanel === "object" ? "mobile-active" : ""}`}>
          <ApertureEditor
            aperture={objectField}
            size={SPATIAL_FILTER_SIZE}
            onChange={updateObjectField}
            onPreview={previewObjectField}
            mode="draw"
            formula=""
            onModeChange={() => {}}
            onFormulaChange={() => {}}
            title="物面"
            subtitle="振幅物体 U₀(x, y)"
            editorId="spatial-object-title"
            index="01"
            showModeTabs={false}
            showCommunity={false}
            showLocalStorage={false}
            clearLabel="清空物面"
            clearTitle="清空物面全部内容"
            supplementalControls={objectPresets}
            coordinateUnit="mm"
            coordinateExtent={SPATIAL_OBJECT_WIDTH_MM / 2}
            scaleBar={niceScaleBar(SPATIAL_OBJECT_WIDTH_MM)}
            canvasAriaLabel="空间滤波物面绘制区域"
          />
        </article>

        <OpticalArrow>傅里叶透镜 L₁</OpticalArrow>

        <article className={`spatial-module spatial-editor-module spectrum-module ${activePanel === "filter" ? "mobile-active" : ""}`}>
          <ApertureEditor
            aperture={filterField}
            size={SPATIAL_FILTER_SIZE}
            onChange={updateFilterField}
            onPreview={previewFilterField}
            mode="draw"
            formula=""
            onModeChange={() => {}}
            onFormulaChange={() => {}}
            title="频谱面"
            subtitle="滤波器 H(fₓ, fᵧ)"
            editorId="spatial-filter-title"
            index="02"
            showModeTabs={false}
            allowedTools={["brush", "circle", "eraser"]}
            showRepeat={false}
            showCommunity={false}
            showLocalStorage={false}
            showClearAction={false}
            showPhase
            coordinateUnit="mm⁻¹"
            coordinateExtent={spectrumWidthPerMm / 2}
            scaleBar={niceScaleBar(spectrumWidthPerMm)}
            canvasClassName={showSpectrumBackdrop ? "aperture-filter-mask" : ""}
            canvasUnderlay={showSpectrumBackdrop
              ? <SpatialFieldCanvas bitmap={frame?.spectrum} pixels={frame?.spectrumPixels} sourceSize={frame?.size} label="物面的空间频谱" />
              : null}
            canvasAriaLabel="频谱面滤波函数绘制区域"
            utilityControls={(
              <button type="button" className={showSpectrumBackdrop ? "active" : ""} onClick={() => setShowSpectrumBackdrop((visible) => !visible)}>
                <ImageSquare size={14} /> {showSpectrumBackdrop ? "隐藏频谱" : "显示频谱"}
              </button>
            )}
          />
          <section className="spectrum-filter-panel" aria-label="频谱滤波器">
            <div className="spatial-inspector-title"><Funnel size={19} weight="duotone" /><div><strong>频谱滤波器</strong><span>选择预设后仍可在频谱面继续绘制</span></div></div>
            <div className="filter-preset-grid">
              {FILTER_PRESETS.map(({ id, name, detail, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={filterPreset === id ? "active" : ""}
                  onClick={() => id === "blocked-all" ? blockEntireSpectrum() : applyFilterPreset(id)}
                >
                  <Icon size={16} weight="duotone" /><span><strong>{name}</strong><small>{detail}</small></span>
                </button>
              ))}
            </div>
            <div className="spectrum-filter-options">
              {["low-pass", "high-pass", "phase-contrast"].includes(filterPreset) && (
                <label className="spatial-parameter"><span>截止半径</span><input type="range" min="0.04" max="0.65" step="0.01" value={filterRadius} onChange={(event) => updateFilterOption("radius", Number(event.target.value))} /><output>{filterRadius.toFixed(2)} fₙ</output></label>
              )}
              {["horizontal", "vertical"].includes(filterPreset) && (
                <label className="spatial-parameter"><span>狭缝宽度</span><input type="range" min="0.02" max="0.5" step="0.01" value={slitWidth} onChange={(event) => updateFilterOption("slit", Number(event.target.value))} /><output>{slitWidth.toFixed(2)} fₙ</output></label>
              )}
              {filterPreset === "abbe" && (
                <div className="abbe-order-control"><span>开放衍射级次</span><div>{[0, 1, 2].map((order) => <button key={order} type="button" className={abbeOrder === order ? "active" : ""} onClick={() => updateFilterOption("abbeOrder", order)}>{order === 0 ? "零级" : `至 ±${order} 级`}</button>)}</div></div>
              )}
            </div>
            <div className="spatial-theory-note"><Scan size={17} /><p><strong>读图提示</strong><span>频谱中心对应缓慢变化的轮廓；离中心越远，代表越精细的空间结构。</span></p></div>
          </section>
        </article>

        <OpticalArrow>成像透镜 L₂</OpticalArrow>

        <article className={`spatial-module image-module ${activePanel === "image" ? "mobile-active" : ""}`}>
          <header><span>03</span><div><h2>像面</h2><p>|F⁻¹{'{'}H·F(U₀){'}'}|²</p></div></header>
          <div className="spatial-canvas-shell image-shell">
            <SpatialFieldCanvas ref={imageCanvasRef} bitmap={frame?.image} pixels={frame?.imagePixels} sourceSize={frame?.size} label="空间滤波后的像面强度" />
            <PlaneCoordinates unit="mm" extent={SPATIAL_OBJECT_WIDTH_MM / 2} scaleBar={niceScaleBar(SPATIAL_OBJECT_WIDTH_MM)} />
          </div>
          <footer className="spatial-module-controls image-controls">
            <div><ImageSquare size={17} /><span>像面强度</span><strong>{filterPreset === "blocked-all" ? "全部不通" : FILTER_PRESETS.find((item) => item.id === filterPreset)?.name ?? "自由滤波"}</strong></div>
            <button type="button" onClick={exportImage}><Download size={15} /> 导出像面</button>
          </footer>
        </article>
      </div>

    </section>
  );
}
