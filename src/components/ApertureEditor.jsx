import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
import { Circle } from "@phosphor-icons/react/Circle";
import { Eraser } from "@phosphor-icons/react/Eraser";
import { FloppyDisk } from "@phosphor-icons/react/FloppyDisk";
import { FolderOpen } from "@phosphor-icons/react/FolderOpen";
import { Function as FunctionIcon } from "@phosphor-icons/react/Function";
import { Hexagon } from "@phosphor-icons/react/Hexagon";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Rectangle } from "@phosphor-icons/react/Rectangle";
import { Square } from "@phosphor-icons/react/Square";
import { Trash } from "@phosphor-icons/react/Trash";
import { Triangle } from "@phosphor-icons/react/Triangle";
import katex from "katex";
import { FORMULA_PRESETS } from "../core/presets.js";
import { paintSegmentInto, paintStampInto } from "../core/drawing.js";
import {
  decodeAperture,
  encodeAperture,
  MAX_LOCAL_APERTURES,
  readLocalApertures,
  writeLocalApertures,
} from "../core/apertureStorage.js";

const UNDO_LIMIT = 3;

const TOOLS = [
  { id: "brush", label: "画笔", Icon: PencilSimple },
  { id: "circle", label: "圆", Icon: Circle },
  { id: "square", label: "正方形", Icon: Square },
  { id: "rectangle", label: "长方形", Icon: Rectangle },
  { id: "hexagon", label: "六边形", Icon: Hexagon },
  { id: "triangle", label: "三角形", Icon: Triangle },
  { id: "eraser", label: "橡皮", Icon: Eraser },
];

export const ApertureEditor = memo(function ApertureEditor({ aperture, size, onChange, onPreview, onModeChange }) {
  const canvasRef = useRef(null);
  const apertureRef = useRef(aperture);
  const strokeApertureRef = useRef(null);
  const apertureRasterRef = useRef(null);
  const lastRenderedAmplitudeRef = useRef(null);
  const drawingRef = useRef(false);
  const previousPointRef = useRef(null);
  const pendingPointRef = useRef(null);
  const drawingFrameRef = useRef(null);
  const mutationRevisionRef = useRef(0);
  const publishedRevisionRef = useRef(-1);
  const historyRef = useRef([]);
  const formulaWorkerRef = useRef(null);
  const formulaRequestRef = useRef(0);
  const [mode, setMode] = useState("draw");
  const [tool, setTool] = useState("brush");
  const [brushSize, setBrushSize] = useState(34);
  const [transmission, setTransmission] = useState(1);
  const [formula, setFormula] = useState(FORMULA_PRESETS[1].latex);
  const [formulaState, setFormulaState] = useState({ state: "ready", message: "可实时解析复振幅" });
  const [undoCount, setUndoCount] = useState(0);
  const [savedApertures, setSavedApertures] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      return readLocalApertures(window.localStorage, size);
    } catch {
      return [];
    }
  });
  const [selectedSaveId, setSelectedSaveId] = useState("");
  const [storageMessage, setStorageMessage] = useState("可保存当前屏函数");

  useEffect(() => {
    if (!drawingRef.current) apertureRef.current = aperture;
  }, [aperture]);

  useEffect(
    () => () => {
      if (drawingFrameRef.current !== null) cancelAnimationFrame(drawingFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/formula.worker.js", import.meta.url), {
      type: "module",
    });
    formulaWorkerRef.current = worker;
    worker.onmessage = (event) => {
      const payload = event.data;
      if (payload.requestId !== formulaRequestRef.current) return;
      if (payload.type === "formula-result") {
        saveHistory();
        const next = { amplitude: payload.amplitude, phase: payload.phase };
        apertureRef.current = next;
        renderAmplitude(next.amplitude);
        onChange(next);
        setFormulaState({
          state: "ready",
          message: `已更新 · ${payload.elapsed.toFixed(0)} ms`,
        });
      } else {
        setFormulaState({ state: "error", message: payload.message });
      }
    };
    return () => worker.terminate();
  }, [onChange]);

  useEffect(() => {
    if (mode !== "function" || !formulaWorkerRef.current) return;
    setFormulaState({ state: "computing", message: "正在解析…" });
    const timer = window.setTimeout(() => {
      const requestId = formulaRequestRef.current + 1;
      formulaRequestRef.current = requestId;
      formulaWorkerRef.current.postMessage({ latex: formula, size, requestId });
    }, 460);
    return () => window.clearTimeout(timer);
  }, [formula, mode, size]);

  function renderAmplitude(amplitude) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!apertureRasterRef.current || apertureRasterRef.current.size !== size) {
      apertureRasterRef.current = {
        size,
        image: context.createImageData(size, size),
      };
    }
    const { image } = apertureRasterRef.current;
    for (let index = 0; index < amplitude.length; index += 1) {
      const gray = Math.round(255 * Math.max(0, Math.min(1, amplitude[index])));
      const offset = index * 4;
      image.data[offset] = gray;
      image.data[offset + 1] = gray;
      image.data[offset + 2] = gray;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    lastRenderedAmplitudeRef.current = amplitude;
  }

  useEffect(() => {
    if (lastRenderedAmplitudeRef.current === aperture.amplitude) return;
    renderAmplitude(aperture.amplitude);
  }, [aperture, size]);

  const formulaPreview = useMemo(
    () =>
      katex.renderToString(`T(x,y)=${formula}`, {
        throwOnError: false,
        displayMode: false,
        output: "html",
      }),
    [formula],
  );

  function canvasPoint(event) {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * size,
      y: ((event.clientY - bounds.top) / bounds.height) * size,
      scale: size / bounds.width,
    };
  }

  function saveHistory() {
    historyRef.current.push(apertureRef.current);
    historyRef.current = historyRef.current.slice(-UNDO_LIMIT);
    setUndoCount(historyRef.current.length);
  }

  function previewWorkingAperture() {
    const working = strokeApertureRef.current;
    if (!working || publishedRevisionRef.current === mutationRevisionRef.current) return;
    publishedRevisionRef.current = mutationRevisionRef.current;
    onPreview?.(working, { quality: "live" });
  }

  function commitPoints(points) {
    if (!points.length) return;
    const next = strokeApertureRef.current;
    if (!next) return;
    for (const point of points) {
      paintStampInto({
        amplitude: next.amplitude,
        phase: next.phase,
        size,
        x: point.x,
        y: point.y,
        radius: Math.max(1, (brushSize * point.scale) / 2),
        tool,
        transmission,
      });
    }
    apertureRef.current = next;
    mutationRevisionRef.current += 1;
    renderAmplitude(next.amplitude);
    previewWorkingAperture();
  }

  function drawSegment(from, to) {
    const next = strokeApertureRef.current;
    if (!next) return;
    paintSegmentInto({
      amplitude: next.amplitude,
      phase: next.phase,
      size,
      from,
      to,
      radius: Math.max(1, (brushSize * to.scale) / 2),
      tool,
      transmission,
    });
    apertureRef.current = next;
    mutationRevisionRef.current += 1;
    renderAmplitude(next.amplitude);
    previewWorkingAperture();
  }

  function flushPendingPoint() {
    drawingFrameRef.current = null;
    const next = pendingPointRef.current;
    pendingPointRef.current = null;
    if (!next || !drawingRef.current) return;
    const previous = previousPointRef.current ?? next;
    drawSegment(previous, next);
    previousPointRef.current = next;
  }

  function handlePointerDown(event) {
    if (mode !== "draw") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    saveHistory();
    const current = apertureRef.current;
    const workingAperture = {
      amplitude: new Float32Array(current.amplitude),
      phase: new Float32Array(current.phase),
    };
    strokeApertureRef.current = workingAperture;
    apertureRef.current = workingAperture;
    mutationRevisionRef.current = 0;
    publishedRevisionRef.current = -1;
    drawingRef.current = true;
    const rawPoint = canvasPoint(event);
    const point = ["brush", "eraser"].includes(tool)
      ? rawPoint
      : { ...rawPoint, x: Math.floor(rawPoint.x) + 0.5, y: Math.floor(rawPoint.y) + 0.5 };
    previousPointRef.current = point;
    commitPoints([point]);
  }

  function handlePointerMove(event) {
    if (!drawingRef.current || mode !== "draw" || !["brush", "eraser"].includes(tool)) return;
    pendingPointRef.current = canvasPoint(event);
    if (drawingFrameRef.current === null) {
      drawingFrameRef.current = requestAnimationFrame(flushPendingPoint);
    }
  }

  function handlePointerUp(event) {
    if (drawingFrameRef.current !== null) {
      cancelAnimationFrame(drawingFrameRef.current);
      drawingFrameRef.current = null;
    }
    if (drawingRef.current && mode === "draw" && ["brush", "eraser"].includes(tool)) {
      const next = pendingPointRef.current ?? canvasPoint(event);
      const previous = previousPointRef.current ?? next;
      if (Math.hypot(next.x - previous.x, next.y - previous.y) > 0.1) drawSegment(previous, next);
    }
    const working = strokeApertureRef.current;
    const finalSnapshot = working
      ? {
          amplitude: new Float32Array(working.amplitude),
          phase: new Float32Array(working.phase),
        }
      : null;
    pendingPointRef.current = null;
    drawingRef.current = false;
    strokeApertureRef.current = null;
    if (finalSnapshot) {
      apertureRef.current = finalSnapshot;
      onChange(finalSnapshot, { quality: "final" });
    }
    previousPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearAperture() {
    saveHistory();
    const next = { amplitude: new Float32Array(size * size), phase: new Float32Array(size * size) };
    strokeApertureRef.current = null;
    apertureRef.current = next;
    renderAmplitude(next.amplitude);
    onChange(next);
  }

  function undo() {
    const previous = historyRef.current.pop();
    if (previous) {
      strokeApertureRef.current = null;
      apertureRef.current = previous;
      renderAmplitude(previous.amplitude);
      onChange(previous);
    }
    setUndoCount(historyRef.current.length);
  }

  function saveApertureLocally() {
    if (savedApertures.length >= MAX_LOCAL_APERTURES) {
      setStorageMessage("已达到 5 个上限，请先删除一个存档");
      return;
    }
    try {
      const usedNumbers = new Set(savedApertures.map((item) => Number(item.slot)).filter(Number.isFinite));
      let slot = 1;
      while (usedNumbers.has(slot)) slot += 1;
      const savedAt = Date.now();
      const item = {
        id: `${savedAt.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        slot,
        name: `衍射屏 ${slot}`,
        savedAt,
        data: encodeAperture(apertureRef.current, size),
      };
      const next = [...savedApertures, item];
      writeLocalApertures(window.localStorage, next);
      setSavedApertures(next);
      setSelectedSaveId(item.id);
      setStorageMessage(`已保存“${item.name}”`);
    } catch {
      setStorageMessage("保存失败：浏览器本地空间不可用");
    }
  }

  function loadSelectedAperture() {
    const item = savedApertures.find((candidate) => candidate.id === selectedSaveId);
    if (!item) return;
    try {
      const next = decodeAperture(item.data, size);
      saveHistory();
      strokeApertureRef.current = null;
      apertureRef.current = next;
      renderAmplitude(next.amplitude);
      onChange(next);
      setStorageMessage(`已载入“${item.name}”`);
    } catch {
      setStorageMessage("载入失败：存档数据已损坏");
    }
  }

  function deleteSelectedAperture() {
    const item = savedApertures.find((candidate) => candidate.id === selectedSaveId);
    if (!item) return;
    try {
      const next = savedApertures.filter((candidate) => candidate.id !== selectedSaveId);
      writeLocalApertures(window.localStorage, next);
      setSavedApertures(next);
      setSelectedSaveId("");
      setStorageMessage(`已删除“${item.name}”`);
    } catch {
      setStorageMessage("删除失败：浏览器本地空间不可用");
    }
  }

  return (
    <section className="aperture-module" aria-labelledby="aperture-title">
      <header className="module-header">
        <div>
          <span className="module-index">01</span>
          <div>
            <h2 id="aperture-title">衍射屏</h2>
            <p>复振幅屏函数 T(x, y)</p>
          </div>
        </div>
        <div className="editor-mode" role="tablist" aria-label="衍射屏编辑方式">
          <button type="button" role="tab" aria-selected={mode === "draw"} className={mode === "draw" ? "active" : ""} onClick={() => setMode("draw")}>
            <PencilSimple size={16} weight="duotone" /> 绘制
          </button>
          <button type="button" role="tab" aria-selected={mode === "function"} className={mode === "function" ? "active" : ""} onClick={() => setMode("function")}>
            <FunctionIcon size={16} weight="bold" /> 屏函数
          </button>
        </div>
      </header>

      <div className="aperture-workspace">
        {mode === "draw" && (
          <div className="drawing-toolbar" aria-label="绘制工具">
            {TOOLS.map(({ id, label, Icon }) => (
              <button key={id} type="button" className={tool === id ? "active" : ""} onClick={() => setTool(id)} aria-label={label} title={label}>
                <Icon size={19} weight={tool === id ? "fill" : "regular"} />
              </button>
            ))}
          </div>
        )}
        <div className="aperture-canvas-shell">
          <canvas
            ref={canvasRef}
            className="aperture-canvas"
            width={size}
            height={size}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="衍射屏透光率绘制区域，黑色不透光，白色完全透光"
          />
          <span className="axis-label axis-x">x</span>
          <span className="axis-label axis-y">y</span>
          <div className="canvas-scale">−1.0 <span>0</span> +1.0</div>
        </div>
      </div>

      {mode === "draw" ? (
        <div className="draw-controls">
          <label>
            <span>工具尺寸</span>
            <input type="range" min="8" max="120" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            <output>{brushSize}px</output>
          </label>
          <label>
            <span>透光率 |T|</span>
            <input type="range" min="0" max="1" step="0.05" value={transmission} onChange={(event) => setTransmission(Number(event.target.value))} />
            <output>{transmission.toFixed(2)}</output>
          </label>
          <div className="canvas-actions">
            <button type="button" className="undo-action" onClick={undo} disabled={undoCount === 0} title={`撤销（剩余 ${undoCount}/3 步）`}>
              <ArrowCounterClockwise size={18} /><small>{undoCount}</small>
            </button>
            <button type="button" onClick={clearAperture} title="清空"><Trash size={18} /></button>
            <details className="local-save-menu">
              <summary title="本地衍射屏存档" aria-label="本地衍射屏存档"><FloppyDisk size={18} /></summary>
              <div className="local-save-panel">
                <header><strong>本地衍射屏</strong><span>{savedApertures.length}/{MAX_LOCAL_APERTURES}</span></header>
                <select value={selectedSaveId} onChange={(event) => setSelectedSaveId(event.target.value)} aria-label="选择本地衍射屏存档">
                  <option value="">选择一个存档</option>
                  {savedApertures.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {new Date(item.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </option>
                  ))}
                </select>
                <div>
                  <button type="button" onClick={saveApertureLocally} disabled={savedApertures.length >= MAX_LOCAL_APERTURES}>
                    <FloppyDisk size={15} /> 保存当前
                  </button>
                  <button type="button" onClick={loadSelectedAperture} disabled={!selectedSaveId}>
                    <FolderOpen size={15} /> 载入
                  </button>
                  <button type="button" onClick={deleteSelectedAperture} disabled={!selectedSaveId}>
                    <Trash size={15} /> 删除
                  </button>
                </div>
                <p aria-live="polite">{storageMessage}</p>
              </div>
            </details>
          </div>
        </div>
      ) : (
        <div className="formula-editor">
          <div className="preset-row" aria-label="屏函数预设">
            {FORMULA_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => setFormula(preset.latex)}>{preset.name}</button>
            ))}
          </div>
          <textarea value={formula} onChange={(event) => setFormula(event.target.value)} spellCheck="false" aria-label="LaTeX 复数屏函数" />
          <div className="formula-preview" dangerouslySetInnerHTML={{ __html: formulaPreview }} />
          <p className={`formula-status ${formulaState.state}`}>{formulaState.message}</p>
        </div>
      )}
    </section>
  );
});
