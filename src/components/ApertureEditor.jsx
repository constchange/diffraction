import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
import { ArrowsOutCardinal } from "@phosphor-icons/react/ArrowsOutCardinal";
import { Check } from "@phosphor-icons/react/Check";
import { Circle } from "@phosphor-icons/react/Circle";
import { Eraser } from "@phosphor-icons/react/Eraser";
import { FloppyDisk } from "@phosphor-icons/react/FloppyDisk";
import { FolderOpen } from "@phosphor-icons/react/FolderOpen";
import { Function as FunctionIcon } from "@phosphor-icons/react/Function";
import { GlobeHemisphereWest } from "@phosphor-icons/react/GlobeHemisphereWest";
import { Hexagon } from "@phosphor-icons/react/Hexagon";
import { LineSegment } from "@phosphor-icons/react/LineSegment";
import { Pause } from "@phosphor-icons/react/Pause";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Polygon } from "@phosphor-icons/react/Polygon";
import { Rectangle } from "@phosphor-icons/react/Rectangle";
import { Repeat } from "@phosphor-icons/react/Repeat";
import { Resize } from "@phosphor-icons/react/Resize";
import { Selection } from "@phosphor-icons/react/Selection";
import { Square } from "@phosphor-icons/react/Square";
import { Trash } from "@phosphor-icons/react/Trash";
import { Triangle } from "@phosphor-icons/react/Triangle";
import { X } from "@phosphor-icons/react/X";
import katex from "katex";
import { FORMULA_PRESETS } from "../core/presets.js";
import {
  constrainEllipseToCircle,
  constrainPointToAxis,
  moveApertureSelection,
  paintDrawingOperationInto,
  paintEllipseInto,
  paintPolygonInto,
  paintRectangleInto,
  repeatApertureSelectionInto,
  resizedSelectionBounds,
  scaleApertureSelection,
} from "../core/drawing.js";
import {
  decodeAperture,
  encodeAperture,
  MAX_LOCAL_APERTURES,
  readLocalApertures,
  writeLocalApertures,
} from "../core/apertureStorage.js";

const UNDO_LIMIT = 3;
const CONTINUOUS_TOOLS = new Set(["brush", "eraser"]);
const THROTTLED_PREVIEW_TOOLS = new Set(["line", "rectangle", "ellipse", "polygon", "move", "resize"]);
const PREVIEW_INTERVAL_MS = 90;
const GRID_LINES = Array.from({ length: 16 }, (_, index) => ((index + 1) * 100) / 17);
const RESIZE_HANDLES = ["nw", "ne", "se", "sw"];

const TOOLS = [
  { id: "brush", label: "自由画笔", Icon: PencilSimple },
  { id: "line", label: "直线", Icon: LineSegment },
  { id: "circle", label: "圆", Icon: Circle },
  { id: "ellipse", label: "椭圆", Icon: Circle },
  { id: "square", label: "正方形", Icon: Square },
  { id: "rectangle", label: "长方形", Icon: Rectangle },
  { id: "polygon", label: "多边形", Icon: Polygon },
  { id: "hexagon", label: "六边形", Icon: Hexagon },
  { id: "triangle", label: "三角形", Icon: Triangle },
  { id: "select", label: "矩形选框", Icon: Selection },
  { id: "move", label: "移动选区", Icon: ArrowsOutCardinal },
  { id: "resize", label: "缩放选区", Icon: Resize },
  { id: "eraser", label: "橡皮", Icon: Eraser },
];

export const ApertureEditor = memo(function ApertureEditor({
  aperture,
  size,
  onChange,
  onPreview,
  onModeChange,
  onFunctionEditStart,
  onOpenCommunity,
  isRenderingPaused = false,
}) {
  const canvasRef = useRef(null);
  const apertureRef = useRef(aperture);
  const strokeApertureRef = useRef(null);
  const apertureRasterRef = useRef(null);
  const lastRenderedAmplitudeRef = useRef(null);
  const drawingRef = useRef(false);
  const previousPointRef = useRef(null);
  const pendingPointRef = useRef(null);
  const drawingBaseRef = useRef(null);
  const activeOperationsRef = useRef([]);
  const editableShapeRef = useRef(null);
  const selectionRef = useRef(null);
  const selectionOriginRef = useRef(null);
  const moveOffsetRef = useRef({ x: 0, y: 0 });
  const resizeHandleRef = useRef(null);
  const polygonVerticesRef = useRef([]);
  const polygonCursorRef = useRef(null);
  const drawingFrameRef = useRef(null);
  const lastPreviewFrameRef = useRef(-Infinity);
  const mutationRevisionRef = useRef(0);
  const publishedRevisionRef = useRef(-1);
  const historyRef = useRef([]);
  const formulaWorkerRef = useRef(null);
  const formulaRequestRef = useRef(0);
  const [mode, setMode] = useState("draw");
  const [tool, setTool] = useState("brush");
  const [brushSize, setBrushSize] = useState(34);
  const [rectangleWidth, setRectangleWidth] = useState(48);
  const [rectangleHeight, setRectangleHeight] = useState(28);
  const [rectangleEditable, setRectangleEditable] = useState(false);
  const [selection, setSelection] = useState(null);
  const [polygonVertices, setPolygonVertices] = useState([]);
  const [polygonFilled, setPolygonFilled] = useState(true);
  const [toolMessage, setToolMessage] = useState("拖曳画笔或选择一个形状开始绘制");
  const [transmission, setTransmission] = useState(1);
  const [repeatCount, setRepeatCount] = useState(2);
  const [repeatSpacing, setRepeatSpacing] = useState(12);
  const [repeatDirection, setRepeatDirection] = useState("horizontal");
  const [repeatMessage, setRepeatMessage] = useState("请先用矩形选框选择一个单元");
  const [repeatPanelOpen, setRepeatPanelOpen] = useState(false);
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
        resetEditableShape();
        clearSelection();
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

  useEffect(() => {
    if (mode !== "draw" || tool !== "polygon") return undefined;
    function handleKeyDown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        finishPolygon();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelPolygon();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, tool, polygonVertices.length, polygonFilled, brushSize, transmission]);

  useEffect(() => {
    if (tool !== "polygon" || polygonVertices.length === 0) return;
    previewPolygon(polygonCursorRef.current);
  }, [polygonFilled, brushSize, transmission]);

  useEffect(() => {
    if (mode !== "draw") return undefined;
    function handleUndoShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof HTMLElement
        && (target.isContentEditable || new Set(["INPUT", "TEXTAREA", "SELECT"]).has(target.tagName))) return;
      if (drawingRef.current
        || (historyRef.current.length === 0 && polygonVerticesRef.current.length === 0)) return;
      event.preventDefault();
      undo();
    }
    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, [mode, onChange]);

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

  function resetEditableShape() {
    editableShapeRef.current = null;
    setRectangleEditable(false);
  }

  function cloneAperture(source) {
    return {
      amplitude: new Float32Array(source.amplitude),
      phase: new Float32Array(source.phase),
    };
  }

  function updateSelection(next) {
    selectionRef.current = next;
    setSelection(next);
    setRepeatMessage(next
      ? `当前选区 ${Math.round(next.right - next.left)} × ${Math.round(next.bottom - next.top)} px`
      : "请先用矩形选框选择一个单元");
  }

  function clearSelection() {
    selectionOriginRef.current = null;
    resizeHandleRef.current = null;
    updateSelection(null);
  }

  function marqueeBounds(from, to, roundToPixels = false) {
    const left = Math.max(0, Math.min(size, Math.min(from.x, to.x)));
    const right = Math.max(0, Math.min(size, Math.max(from.x, to.x)));
    const top = Math.max(0, Math.min(size, Math.min(from.y, to.y)));
    const bottom = Math.max(0, Math.min(size, Math.max(from.y, to.y)));
    if (!roundToPixels) return { left, right, top, bottom };
    const normalized = {
      left: Math.floor(left),
      right: Math.ceil(right),
      top: Math.floor(top),
      bottom: Math.ceil(bottom),
    };
    return normalized.right > normalized.left && normalized.bottom > normalized.top
      ? normalized
      : null;
  }

  function pointInsideSelection(point, activeSelection = selectionRef.current) {
    return Boolean(activeSelection
      && point.x >= activeSelection.left
      && point.x < activeSelection.right
      && point.y >= activeSelection.top
      && point.y < activeSelection.bottom);
  }

  function resizeHandleAtPoint(point, activeSelection = selectionRef.current) {
    if (!activeSelection) return null;
    const tolerance = Math.max(5, 9 * point.scale);
    const positions = {
      nw: { x: activeSelection.left, y: activeSelection.top },
      ne: { x: activeSelection.right, y: activeSelection.top },
      se: { x: activeSelection.right, y: activeSelection.bottom },
      sw: { x: activeSelection.left, y: activeSelection.bottom },
    };
    return RESIZE_HANDLES.find((handle) => {
      const target = positions[handle];
      return Math.hypot(point.x - target.x, point.y - target.y) <= tolerance;
    }) ?? null;
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
      const operation = {
        kind: "stamp",
        x: point.x,
        y: point.y,
        radius: Math.max(1, (brushSize * point.scale) / 2),
        tool,
        transmission,
      };
      activeOperationsRef.current.push(operation);
      paintDrawingOperationInto({
        amplitude: next.amplitude,
        phase: next.phase,
        size,
        operation,
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
    const operation = {
      kind: "segment",
      from,
      to,
      radius: Math.max(1, (brushSize * to.scale) / 2),
      tool,
      transmission,
    };
    activeOperationsRef.current.push(operation);
    paintDrawingOperationInto({
      amplitude: next.amplitude,
      phase: next.phase,
      size,
      operation,
    });
    apertureRef.current = next;
    mutationRevisionRef.current += 1;
    renderAmplitude(next.amplitude);
    previewWorkingAperture();
  }

  function previewRectangle(to) {
    const base = drawingBaseRef.current;
    const from = previousPointRef.current;
    if (!base || !from) return;
    const working = cloneAperture(base);
    paintRectangleInto({
      amplitude: working.amplitude,
      phase: working.phase,
      size,
      from,
      to,
      transmission,
    });
    strokeApertureRef.current = working;
    apertureRef.current = working;
    mutationRevisionRef.current += 1;
    renderAmplitude(working.amplitude);
    previewWorkingAperture();
  }

  function previewEllipse(to) {
    const base = drawingBaseRef.current;
    const from = previousPointRef.current;
    if (!base || !from) return null;
    const endpoint = to.shiftKey ? constrainEllipseToCircle(from, to, size) : to;
    const working = cloneAperture(base);
    paintEllipseInto({
      amplitude: working.amplitude,
      phase: working.phase,
      size,
      from,
      to: endpoint,
      transmission,
    });
    strokeApertureRef.current = working;
    apertureRef.current = working;
    mutationRevisionRef.current += 1;
    renderAmplitude(working.amplitude);
    previewWorkingAperture();
    return endpoint;
  }

  function lineOperation(from, to) {
    return {
      kind: "segment",
      from,
      to,
      radius: Math.max(0.5, (brushSize * to.scale) / 2),
      tool: "brush",
      transmission,
    };
  }

  function previewLine(to) {
    const base = drawingBaseRef.current;
    const from = previousPointRef.current;
    if (!base || !from) return;
    const endpoint = to.shiftKey ? constrainPointToAxis(from, to) : to;
    const working = cloneAperture(base);
    paintDrawingOperationInto({
      amplitude: working.amplitude,
      phase: working.phase,
      size,
      operation: lineOperation(from, endpoint),
    });
    strokeApertureRef.current = working;
    apertureRef.current = working;
    mutationRevisionRef.current += 1;
    renderAmplitude(working.amplitude);
    previewWorkingAperture();
    return endpoint;
  }

  function polygonOperation(vertices = polygonVerticesRef.current) {
    const scale = vertices[0]?.scale ?? 1;
    return {
      kind: "polygon",
      vertices: vertices.map(({ x, y }) => ({ x, y })),
      filled: polygonFilled,
      lineWidth: Math.max(1, brushSize * scale),
      transmission,
    };
  }

  function previewPolygon(cursor = polygonCursorRef.current) {
    const base = drawingBaseRef.current;
    const fixedVertices = polygonVerticesRef.current;
    if (!base || fixedVertices.length === 0) return;
    polygonCursorRef.current = cursor;
    const vertices = cursor ? [...fixedVertices, cursor] : fixedVertices;
    const working = cloneAperture(base);
    if (vertices.length >= 3) {
      paintPolygonInto({
        amplitude: working.amplitude,
        phase: working.phase,
        size,
        ...polygonOperation(vertices),
      });
    } else if (vertices.length === 2) {
      paintDrawingOperationInto({
        amplitude: working.amplitude,
        phase: working.phase,
        size,
        operation: lineOperation(vertices[0], vertices[1]),
      });
    }
    strokeApertureRef.current = working;
    apertureRef.current = working;
    mutationRevisionRef.current += 1;
    renderAmplitude(working.amplitude);
    previewWorkingAperture();
  }

  function addPolygonVertex(event) {
    const point = canvasPoint(event);
    if (event.detail > 1 && polygonVerticesRef.current.length >= 3) {
      finishPolygon();
      return;
    }
    if (polygonVerticesRef.current.length === 0) {
      saveHistory();
      resetEditableShape();
      clearSelection();
      drawingBaseRef.current = apertureRef.current;
      mutationRevisionRef.current = 0;
      publishedRevisionRef.current = -1;
      lastPreviewFrameRef.current = -Infinity;
    }
    const vertices = [...polygonVerticesRef.current, point];
    polygonVerticesRef.current = vertices;
    polygonCursorRef.current = null;
    setPolygonVertices(vertices);
    setToolMessage(`${vertices.length} 个顶点 · 双击、按 Enter 或点击“完成多边形”闭合`);
    previewPolygon(null);
  }

  function finishPolygon() {
    const vertices = polygonVerticesRef.current;
    const base = drawingBaseRef.current;
    if (!base || vertices.length < 3) {
      setToolMessage("至少需要 3 个顶点才能完成多边形");
      return;
    }
    const operation = polygonOperation(vertices);
    const next = cloneAperture(base);
    paintDrawingOperationInto({
      amplitude: next.amplitude,
      phase: next.phase,
      size,
      operation,
    });
    apertureRef.current = next;
    strokeApertureRef.current = null;
    renderAmplitude(next.amplitude);
    onChange(next, { quality: "final" });
    polygonVerticesRef.current = [];
    polygonCursorRef.current = null;
    drawingBaseRef.current = null;
    setPolygonVertices([]);
    setToolMessage("多边形已完成；继续点击可绘制下一个");
  }

  function cancelPolygon(publish = true) {
    if (polygonVerticesRef.current.length === 0) return false;
    const base = drawingBaseRef.current;
    if (base) {
      apertureRef.current = base;
      strokeApertureRef.current = null;
      renderAmplitude(base.amplitude);
      if (publish) onChange(base, { quality: "final" });
      historyRef.current.pop();
      setUndoCount(historyRef.current.length);
    }
    polygonVerticesRef.current = [];
    polygonCursorRef.current = null;
    drawingBaseRef.current = null;
    setPolygonVertices([]);
    setToolMessage("已取消未完成的多边形");
    return true;
  }

  function chooseTool(nextTool) {
    if (tool === "polygon" && nextTool !== "polygon") cancelPolygon();
    if (nextTool !== tool) resetEditableShape();
    if (!new Set(["select", "move", "resize"]).has(nextTool)) clearSelection();
    setTool(nextTool);
    const messages = {
      select: "在衍射屏上拖曳一个矩形选区",
      move: selectionRef.current ? "在选区内按住并拖曳以移动内容" : "请先用矩形选框建立选区",
      resize: selectionRef.current ? "拖动选区四角缩放；按住 Shift 保持宽高比" : "请先用矩形选框建立选区",
      line: "按住并拖曳；同时按住 Shift 可画水平或竖直线",
      ellipse: "按住并拖曳画椭圆；同时按住 Shift 可画正圆",
      polygon: "逐点点击添加顶点；双击或按 Enter 完成",
    };
    setToolMessage(messages[nextTool] ?? "点击或拖曳，在衍射屏上绘制透光区域");
  }

  function changeEditorMode(nextMode) {
    if (nextMode !== "draw") {
      cancelPolygon();
      clearSelection();
    }
    setMode(nextMode);
  }

  function previewSelectionMove(to) {
    const base = drawingBaseRef.current;
    const original = selectionOriginRef.current;
    const from = previousPointRef.current;
    if (!base || !original || !from) return;
    const offsetX = Math.max(
      -original.left,
      Math.min(size - original.right, Math.round(to.x - from.x)),
    );
    const offsetY = Math.max(
      -original.top,
      Math.min(size - original.bottom, Math.round(to.y - from.y)),
    );
    moveOffsetRef.current = { x: offsetX, y: offsetY };
    const working = moveApertureSelection({
      amplitude: base.amplitude,
      phase: base.phase,
      size,
      bounds: original,
      offsetX,
      offsetY,
    });
    strokeApertureRef.current = working;
    apertureRef.current = working;
    updateSelection({
      left: original.left + offsetX,
      right: original.right + offsetX,
      top: original.top + offsetY,
      bottom: original.bottom + offsetY,
    });
    mutationRevisionRef.current += 1;
    renderAmplitude(working.amplitude);
    previewWorkingAperture();
  }

  function previewSelectionScale(to) {
    const base = drawingBaseRef.current;
    const original = selectionOriginRef.current;
    const handle = resizeHandleRef.current;
    if (!base || !original || !handle) return null;
    const targetBounds = resizedSelectionBounds(original, handle, to, size, Boolean(to.shiftKey));
    const working = scaleApertureSelection({
      amplitude: base.amplitude,
      phase: base.phase,
      size,
      bounds: original,
      targetBounds,
    });
    strokeApertureRef.current = working;
    apertureRef.current = working;
    updateSelection(targetBounds);
    mutationRevisionRef.current += 1;
    renderAmplitude(working.amplitude);
    previewWorkingAperture();
    return targetBounds;
  }

  function updateEditableShape(dimension, value) {
    const editable = editableShapeRef.current;
    if (!editable) return;
    const nextWidth = dimension === "width" ? value : rectangleWidth;
    const nextHeight = dimension === "height" ? value : rectangleHeight;
    if (dimension === "width") setRectangleWidth(value);
    else setRectangleHeight(value);

    const operation = {
      kind: editable.kind ?? "rectangle",
      from: {
        x: editable.centre.x - nextWidth / 2,
        y: editable.centre.y - nextHeight / 2,
      },
      to: {
        x: editable.centre.x + nextWidth / 2,
        y: editable.centre.y + nextHeight / 2,
      },
      transmission: editable.transmission,
    };
    const next = cloneAperture(editable.base);
    paintDrawingOperationInto({
      amplitude: next.amplitude,
      phase: next.phase,
      size,
      operation,
    });
    apertureRef.current = next;
    renderAmplitude(next.amplitude);
    onPreview?.(next, { quality: "live" });
  }

  function finalizeShapeAdjustment() {
    if (!editableShapeRef.current) return;
    onChange(apertureRef.current, { quality: "final" });
  }

  function repeatSelection() {
    const activeSelection = selectionRef.current;
    if (!activeSelection) {
      setRepeatMessage("请先用矩形选框选择一个单元");
      return;
    }
    saveHistory();
    const next = cloneAperture(apertureRef.current);
    repeatApertureSelectionInto({
      amplitude: next.amplitude,
      phase: next.phase,
      size,
      bounds: activeSelection,
      count: repeatCount,
      spacing: repeatSpacing,
      direction: repeatDirection,
    });
    apertureRef.current = next;
    editableShapeRef.current = null;
    setRectangleEditable(false);
    renderAmplitude(next.amplitude);
    onChange(next, { quality: "final" });
    setRepeatMessage(
      `已沿${repeatDirection === "horizontal" ? "横向" : "纵向"}生成 ${repeatCount} 个副本`,
    );
  }

  function flushPendingPoint(timestamp) {
    if (
      THROTTLED_PREVIEW_TOOLS.has(tool)
      && timestamp - lastPreviewFrameRef.current < PREVIEW_INTERVAL_MS
    ) {
      drawingFrameRef.current = requestAnimationFrame(flushPendingPoint);
      return;
    }
    drawingFrameRef.current = null;
    lastPreviewFrameRef.current = timestamp;
    const next = pendingPointRef.current;
    pendingPointRef.current = null;
    if (!next) return;
    if (tool === "polygon" && polygonVerticesRef.current.length > 0) {
      previewPolygon(next);
      return;
    }
    if (!drawingRef.current) return;
    if (tool === "select") {
      updateSelection(marqueeBounds(previousPointRef.current, next));
    } else if (tool === "move") {
      previewSelectionMove(next);
    } else if (tool === "resize") {
      previewSelectionScale(next);
    } else if (tool === "rectangle") {
      previewRectangle(next);
    } else if (tool === "ellipse") {
      previewEllipse(next);
    } else if (tool === "line") {
      previewLine(next);
    } else {
      const previous = previousPointRef.current ?? next;
      drawSegment(previous, next);
      previousPointRef.current = next;
    }
  }

  function handlePointerDown(event) {
    if (mode !== "draw" || event.button !== 0) return;
    if (tool === "polygon") {
      addPolygonVertex(event);
      return;
    }
    const rawPoint = canvasPoint(event);
    if (tool === "move" && !pointInsideSelection(rawPoint)) {
      setToolMessage(selectionRef.current ? "请在选区内部按下并拖曳" : "请先用矩形选框建立选区");
      return;
    }
    const resizeHandle = tool === "resize" ? resizeHandleAtPoint(rawPoint) : null;
    if (tool === "resize" && !resizeHandle) {
      setToolMessage(selectionRef.current ? "请拖动选区四角的控制点" : "请先用矩形选框建立选区");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    previousPointRef.current = rawPoint;
    pendingPointRef.current = null;
    mutationRevisionRef.current = 0;
    publishedRevisionRef.current = -1;
    lastPreviewFrameRef.current = -Infinity;

    if (tool === "select") {
      selectionOriginRef.current = selectionRef.current;
      updateSelection(marqueeBounds(rawPoint, rawPoint));
      return;
    }

    saveHistory();
    const current = apertureRef.current;
    resetEditableShape();
    drawingBaseRef.current = current;
    activeOperationsRef.current = [];
    if (tool === "move") {
      selectionOriginRef.current = selectionRef.current;
      moveOffsetRef.current = { x: 0, y: 0 };
      strokeApertureRef.current = current;
      return;
    }
    if (tool === "resize") {
      selectionOriginRef.current = selectionRef.current;
      resizeHandleRef.current = resizeHandle;
      strokeApertureRef.current = current;
      return;
    }

    clearSelection();
    const workingAperture = cloneAperture(current);
    strokeApertureRef.current = workingAperture;
    apertureRef.current = workingAperture;
    const point = CONTINUOUS_TOOLS.has(tool) || ["rectangle", "ellipse", "line"].includes(tool)
      ? rawPoint
      : { ...rawPoint, x: Math.floor(rawPoint.x) + 0.5, y: Math.floor(rawPoint.y) + 0.5 };
    previousPointRef.current = point;
    if (!["rectangle", "ellipse", "line"].includes(tool)) commitPoints([point]);
  }

  function handlePointerMove(event) {
    if (mode !== "draw") return;
    const polygonActive = tool === "polygon" && polygonVerticesRef.current.length > 0;
    const dragTool = CONTINUOUS_TOOLS.has(tool)
      || ["rectangle", "ellipse", "line", "select", "move", "resize"].includes(tool);
    if (!polygonActive && (!drawingRef.current || !dragTool)) return;
    pendingPointRef.current = { ...canvasPoint(event), shiftKey: event.shiftKey };
    if (drawingFrameRef.current === null) {
      drawingFrameRef.current = requestAnimationFrame(flushPendingPoint);
    }
  }

  function handlePointerUp(event) {
    if (!drawingRef.current) return;
    if (drawingFrameRef.current !== null) {
      cancelAnimationFrame(drawingFrameRef.current);
      drawingFrameRef.current = null;
    }
    const nextPoint = { ...canvasPoint(event), shiftKey: event.shiftKey };

    if (tool === "select") {
      const nextSelection = marqueeBounds(previousPointRef.current, nextPoint, true);
      updateSelection(nextSelection);
      setToolMessage(nextSelection
        ? `已选择 ${nextSelection.right - nextSelection.left} × ${nextSelection.bottom - nextSelection.top} px；可移动、缩放或重复`
        : "选区过小，请重新拖曳");
      finishPointerInteraction(event);
      return;
    }

    if (tool === "move") {
      previewSelectionMove(nextPoint);
      const { x, y } = moveOffsetRef.current;
      const working = strokeApertureRef.current;
      if (working && (x !== 0 || y !== 0)) {
        apertureRef.current = working;
        onChange(working, { quality: "final" });
        setToolMessage(`选区已移动：Δx = ${x}px，Δy = ${y}px`);
      } else {
        const base = drawingBaseRef.current;
        apertureRef.current = base;
        strokeApertureRef.current = null;
        renderAmplitude(base.amplitude);
        updateSelection(selectionOriginRef.current);
        historyRef.current.pop();
        setUndoCount(historyRef.current.length);
        setToolMessage("选区位置未改变");
      }
      finishPointerInteraction(event);
      return;
    }

    if (tool === "resize") {
      const targetBounds = previewSelectionScale(nextPoint);
      const original = selectionOriginRef.current;
      const working = strokeApertureRef.current;
      const changed = targetBounds && original && (
        targetBounds.left !== original.left
        || targetBounds.right !== original.right
        || targetBounds.top !== original.top
        || targetBounds.bottom !== original.bottom
      );
      if (working && changed) {
        apertureRef.current = working;
        onChange(working, { quality: "final" });
        const width = targetBounds.right - targetBounds.left;
        const height = targetBounds.bottom - targetBounds.top;
        setToolMessage(`选区已缩放为 ${width} × ${height}px${nextPoint.shiftKey ? " · 已保持宽高比" : ""}`);
      } else {
        const base = drawingBaseRef.current;
        apertureRef.current = base;
        strokeApertureRef.current = null;
        renderAmplitude(base.amplitude);
        updateSelection(original);
        historyRef.current.pop();
        setUndoCount(historyRef.current.length);
        setToolMessage("选区尺寸未改变");
      }
      finishPointerInteraction(event);
      return;
    }

    if (drawingRef.current && mode === "draw" && CONTINUOUS_TOOLS.has(tool)) {
      const previous = previousPointRef.current ?? nextPoint;
      if (Math.hypot(nextPoint.x - previous.x, nextPoint.y - previous.y) > 0.1) {
        drawSegment(previous, nextPoint);
      }
    }
    if (drawingRef.current && mode === "draw" && tool === "rectangle") {
      const from = previousPointRef.current;
      const to = nextPoint;
      const width = Math.abs(to.x - from.x);
      const height = Math.abs(to.y - from.y);
      if (width >= 1 && height >= 1) {
        previewRectangle(to);
        const operation = { kind: "rectangle", from, to, transmission };
        activeOperationsRef.current = [operation];
        const roundedWidth = Math.max(1, Math.round(width));
        const roundedHeight = Math.max(1, Math.round(height));
        setRectangleWidth(roundedWidth);
        setRectangleHeight(roundedHeight);
        setRectangleEditable(true);
        editableShapeRef.current = {
          kind: "rectangle",
          base: drawingBaseRef.current,
          centre: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
          transmission,
        };
      } else {
        apertureRef.current = drawingBaseRef.current;
        strokeApertureRef.current = null;
        renderAmplitude(drawingBaseRef.current.amplitude);
        historyRef.current.pop();
        setUndoCount(historyRef.current.length);
      }
    }
    if (drawingRef.current && mode === "draw" && tool === "ellipse") {
      const from = previousPointRef.current;
      const endpoint = nextPoint.shiftKey
        ? constrainEllipseToCircle(from, nextPoint, size)
        : nextPoint;
      const width = Math.abs(endpoint.x - from.x);
      const height = Math.abs(endpoint.y - from.y);
      if (width >= 1 && height >= 1) {
        previewEllipse(endpoint);
        activeOperationsRef.current = [{ kind: "ellipse", from, to: endpoint, transmission }];
        const roundedWidth = Math.max(1, Math.round(width));
        const roundedHeight = Math.max(1, Math.round(height));
        setRectangleWidth(roundedWidth);
        setRectangleHeight(roundedHeight);
        setRectangleEditable(true);
        editableShapeRef.current = {
          kind: "ellipse",
          base: drawingBaseRef.current,
          centre: { x: (from.x + endpoint.x) / 2, y: (from.y + endpoint.y) / 2 },
          transmission,
        };
        setToolMessage(nextPoint.shiftKey
          ? `正圆已完成 · ${roundedWidth}px`
          : `椭圆已完成 · ${roundedWidth} × ${roundedHeight}px`);
      } else {
        apertureRef.current = drawingBaseRef.current;
        strokeApertureRef.current = null;
        renderAmplitude(drawingBaseRef.current.amplitude);
        historyRef.current.pop();
        setUndoCount(historyRef.current.length);
      }
    }
    if (drawingRef.current && mode === "draw" && tool === "line") {
      const from = previousPointRef.current;
      const endpoint = nextPoint.shiftKey ? constrainPointToAxis(from, nextPoint) : nextPoint;
      const distance = Math.hypot(endpoint.x - from.x, endpoint.y - from.y);
      if (distance >= 0.5) {
        previewLine(endpoint);
        activeOperationsRef.current = [lineOperation(from, endpoint)];
        setToolMessage(`直线已完成 · 线宽 ${brushSize}px${nextPoint.shiftKey ? " · 正交约束" : ""}`);
      } else {
        apertureRef.current = drawingBaseRef.current;
        strokeApertureRef.current = null;
        renderAmplitude(drawingBaseRef.current.amplitude);
        historyRef.current.pop();
        setUndoCount(historyRef.current.length);
      }
    }
    const working = strokeApertureRef.current;
    const finalSnapshot = working && activeOperationsRef.current.length
      ? cloneAperture(working)
      : null;
    pendingPointRef.current = null;
    drawingRef.current = false;
    strokeApertureRef.current = null;
    if (finalSnapshot) {
      apertureRef.current = finalSnapshot;
      onChange(finalSnapshot, { quality: "final" });
    }
    finishPointerInteraction(event);
  }

  function finishPointerInteraction(event) {
    pendingPointRef.current = null;
    previousPointRef.current = null;
    drawingBaseRef.current = null;
    activeOperationsRef.current = [];
    resizeHandleRef.current = null;
    drawingRef.current = false;
    strokeApertureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerCancel(event) {
    if (drawingFrameRef.current !== null) {
      cancelAnimationFrame(drawingFrameRef.current);
      drawingFrameRef.current = null;
    }
    if (tool === "select") {
      updateSelection(selectionOriginRef.current);
    }
    const base = drawingBaseRef.current;
    if (base && tool !== "select") {
      apertureRef.current = base;
      renderAmplitude(base.amplitude);
      onChange(base);
      historyRef.current.pop();
      setUndoCount(historyRef.current.length);
    }
    if (["move", "resize"].includes(tool)) updateSelection(selectionOriginRef.current);
    pendingPointRef.current = null;
    previousPointRef.current = null;
    drawingBaseRef.current = null;
    activeOperationsRef.current = [];
    resizeHandleRef.current = null;
    drawingRef.current = false;
    strokeApertureRef.current = null;
    if (tool !== "select") resetEditableShape();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearAperture() {
    cancelPolygon(false);
    saveHistory();
    resetEditableShape();
    clearSelection();
    const next = { amplitude: new Float32Array(size * size), phase: new Float32Array(size * size) };
    strokeApertureRef.current = null;
    apertureRef.current = next;
    renderAmplitude(next.amplitude);
    onChange(next);
  }

  function undo() {
    if (cancelPolygon()) return;
    const previous = historyRef.current.pop();
    if (previous) {
      resetEditableShape();
      clearSelection();
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
      cancelPolygon(false);
      saveHistory();
      resetEditableShape();
      clearSelection();
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
          <button type="button" role="tab" aria-selected={mode === "draw"} className={mode === "draw" ? "active" : ""} onClick={() => changeEditorMode("draw")}>
            <PencilSimple size={16} weight="duotone" /> 绘制
          </button>
          <button type="button" role="tab" aria-selected={mode === "function"} className={mode === "function" ? "active" : ""} onClick={() => changeEditorMode("function")}>
            <FunctionIcon size={16} weight="bold" /> 屏函数
          </button>
        </div>
      </header>

      <div className="aperture-workspace">
        {mode === "draw" && (
          <div className="drawing-toolbar" aria-label="绘制工具">
            {TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`${tool === id ? "active" : ""} ${id === "select" ? "selection-tool" : ""}`}
                onClick={() => chooseTool(id)}
                aria-label={label}
                title={label}
              >
                <Icon className={id === "ellipse" ? "ellipse-tool-icon" : undefined} size={19} weight={tool === id ? "fill" : "regular"} />
              </button>
            ))}
            <button
              type="button"
              className={`toolbar-repeat-button ${repeatPanelOpen ? "active" : ""}`}
              onClick={() => setRepeatPanelOpen((openPanel) => !openPanel)}
              title="周期性重复当前选区"
              aria-label="周期性重复当前选区"
              aria-expanded={repeatPanelOpen}
            >
              <Repeat size={17} /><span>重复单元</span>
            </button>
          </div>
        )}
        <div className="aperture-canvas-shell">
          <canvas
            ref={canvasRef}
            className={`aperture-canvas tool-${tool}`}
            width={size}
            height={size}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onDoubleClick={() => {
              if (tool === "polygon" && polygonVerticesRef.current.length >= 3) finishPolygon();
            }}
            aria-label="衍射屏透光率绘制区域，黑色不透光，白色完全透光"
          />
          <svg className="aperture-grid" viewBox="0 0 100 100" aria-hidden="true">
            <g>
              {GRID_LINES.map((position) => (
                <line key={`vertical-${position}`} x1={position} y1="0" x2={position} y2="100" />
              ))}
              {GRID_LINES.map((position) => (
                <line key={`horizontal-${position}`} x1="0" y1={position} x2="100" y2={position} />
              ))}
            </g>
          </svg>
          {selection && (
            <div
              className={`selection-marquee ${tool === "resize" ? "resizable" : ""}`}
              style={{
                left: `${(selection.left / size) * 100}%`,
                top: `${(selection.top / size) * 100}%`,
                width: `${((selection.right - selection.left) / size) * 100}%`,
                height: `${((selection.bottom - selection.top) / size) * 100}%`,
              }}
              aria-hidden="true"
            >
              <span className="selection-size">{Math.round(selection.right - selection.left)} × {Math.round(selection.bottom - selection.top)}</span>
              {tool === "resize" && RESIZE_HANDLES.map((handle) => (
                <i key={handle} className={`selection-resize-handle handle-${handle}`} />
              ))}
            </div>
          )}
          {tool === "polygon" && polygonVertices.length > 0 && (
            <svg className="polygon-guides" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
              {polygonVertices.map((point, index) => (
                <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="2.4" />
              ))}
            </svg>
          )}
          <span className="axis-label axis-x">x</span>
          <span className="axis-label axis-y">y</span>
          <div className="canvas-scale">−1.0 <span>0</span> +1.0</div>
        </div>
      </div>

      {mode === "draw" ? (
        <div className={`draw-controls ${["rectangle", "ellipse"].includes(tool) ? "rectangle-controls" : ""} ${tool === "polygon" ? "polygon-controls" : ""} ${["select", "move", "resize"].includes(tool) ? "selection-controls" : ""} ${repeatPanelOpen ? "repeat-panel-visible" : ""}`}>
          {repeatPanelOpen && (
            <div className="repeat-panel repeat-panel-docked">
              <header>
                <div className="repeat-panel-title"><strong>周期重复</strong><span>当前选区</span></div>
                <button
                  type="button"
                  className="repeat-panel-close"
                  onClick={() => setRepeatPanelOpen(false)}
                  title="关闭重复单元面板"
                  aria-label="关闭重复单元面板"
                >
                  <X size={14} />
                </button>
              </header>
              <div className="repeat-direction" role="group" aria-label="重复方向">
                <button type="button" className={repeatDirection === "horizontal" ? "active" : ""} onClick={() => setRepeatDirection("horizontal")}>横向 →</button>
                <button type="button" className={repeatDirection === "vertical" ? "active" : ""} onClick={() => setRepeatDirection("vertical")}>纵向 ↓</button>
              </div>
              <label>
                <span>副本数量</span><output>{repeatCount}</output>
                <input type="range" min="1" max="12" value={repeatCount} onChange={(event) => setRepeatCount(Number(event.target.value))} />
              </label>
              <label>
                <span>单元间距</span><output>{repeatSpacing}px</output>
                <input type="range" min="0" max="96" value={repeatSpacing} onChange={(event) => setRepeatSpacing(Number(event.target.value))} />
              </label>
              <button type="button" className="repeat-apply" onClick={repeatSelection} disabled={!selection}>
                <Repeat size={15} /> 生成副本
              </button>
              <p aria-live="polite">{repeatMessage}</p>
            </div>
          )}
          {["rectangle", "ellipse"].includes(tool) ? (
            <>
              <label className={!rectangleEditable ? "disabled" : ""}>
                <span>{tool === "ellipse" ? "椭圆宽度" : "矩形宽度"}</span>
                <input
                  type="range"
                  min="2"
                  max={size}
                  value={rectangleWidth}
                  disabled={!rectangleEditable}
                  onChange={(event) => updateEditableShape("width", Number(event.target.value))}
                  onPointerUp={finalizeShapeAdjustment}
                  onKeyUp={finalizeShapeAdjustment}
                  onBlur={finalizeShapeAdjustment}
                />
                <output>{rectangleWidth}px</output>
              </label>
              <label className={!rectangleEditable ? "disabled" : ""}>
                <span>{tool === "ellipse" ? "椭圆高度" : "矩形高度"}</span>
                <input
                  type="range"
                  min="2"
                  max={size}
                  value={rectangleHeight}
                  disabled={!rectangleEditable}
                  onChange={(event) => updateEditableShape("height", Number(event.target.value))}
                  onPointerUp={finalizeShapeAdjustment}
                  onKeyUp={finalizeShapeAdjustment}
                  onBlur={finalizeShapeAdjustment}
                />
                <output>{rectangleHeight}px</output>
              </label>
            </>
          ) : !["select", "move", "resize"].includes(tool) ? (
            <label>
              <span>{tool === "line" ? "直线粗细" : tool === "polygon" ? "边线粗细" : "工具尺寸"}</span>
              <input type="range" min={tool === "line" || tool === "polygon" ? "2" : "8"} max="120" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
              <output>{brushSize}px</output>
            </label>
          ) : null}
          {tool === "polygon" && (
            <div className="polygon-style-control">
              <span>多边形样式</span>
              <div role="group" aria-label="多边形样式">
                <button type="button" className={polygonFilled ? "active" : ""} onClick={() => setPolygonFilled(true)}>实心</button>
                <button type="button" className={!polygonFilled ? "active" : ""} onClick={() => setPolygonFilled(false)}>空心</button>
              </div>
            </div>
          )}
          {!["select", "move", "resize", "eraser"].includes(tool) && (
            <label>
              <span>透光率 |T|</span>
              <input type="range" min="0" max="1" step="0.05" value={transmission} onChange={(event) => setTransmission(Number(event.target.value))} />
              <output>{transmission.toFixed(2)}</output>
            </label>
          )}
          {tool === "polygon" && (
            <div className="polygon-finish-actions">
              <button type="button" onClick={finishPolygon} disabled={polygonVertices.length < 3}><Check size={14} /> 完成多边形</button>
              <button type="button" onClick={() => cancelPolygon()} disabled={polygonVertices.length === 0}><X size={14} /> 取消</button>
            </div>
          )}
          {["select", "move", "resize"].includes(tool) && selection && (
            <button type="button" className="clear-selection-action" onClick={clearSelection}><X size={14} /> 取消选区</button>
          )}
          <p className="tool-status" aria-live="polite">{toolMessage}</p>
          <div className="canvas-actions utility-actions">
            <button type="button" className="undo-action" onClick={undo} disabled={undoCount === 0} title={`撤销 Ctrl+Z（剩余 ${undoCount}/3 步）`}>
              <ArrowCounterClockwise size={17} /><span>撤销</span><small>{undoCount}/3</small>
            </button>
            <button type="button" onClick={clearAperture} title="清空衍射屏全部内容"><Trash size={17} /><span>清空画布</span></button>
            <button type="button" onClick={onOpenCommunity} title="浏览或上传公共衍射屏"><GlobeHemisphereWest size={17} /><span>公共空间</span></button>
            <details className="local-save-menu">
              <summary title="保存或载入衍射屏" aria-label="保存或载入衍射屏"><FloppyDisk size={17} /><span>保存 / 载入</span></summary>
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
        <div className="formula-editor" onPointerDownCapture={onFunctionEditStart}>
          <div className={`function-pause-notice ${isRenderingPaused ? "paused" : ""}`} role="status">
            <Pause size={13} weight="fill" />
            {isRenderingPaused ? "实时渲染已暂停；编辑完成后请手动继续" : "点击编辑区将自动暂停实时渲染"}
          </div>
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
