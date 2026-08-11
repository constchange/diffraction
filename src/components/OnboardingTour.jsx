import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { X } from "@phosphor-icons/react/X";
import { calculateTourPlacement, ONBOARDING_STEPS } from "../core/onboarding.js";

const SPECTRUM = ["#5ff8ff", "#5790ff", "#8b69ff", "#e06cff", "#ffd26d"];

function localPreviewStep() {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return 0;
  const requested = Number(new URLSearchParams(window.location.search).get("tourStep"));
  return Number.isInteger(requested) && requested >= 0 && requested < ONBOARDING_STEPS.length
    ? requested
    : 0;
}

function rectSnapshot(rect) {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function bringTargetIntoView(target) {
  let parent = target.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 2) {
      const targetRect = target.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      parent.scrollTop += targetRect.top - parentRect.top
        - (parent.clientHeight - targetRect.height) / 2;
    }
    parent = parent.parentElement;
  }

  const rect = target.getBoundingClientRect();
  if (rect.top < 12 || rect.bottom > window.innerHeight - 12) {
    const targetTop = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
  }
}

function LightFairy({ targetRect }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !targetRect) return undefined;
    const context = canvas.getContext("2d");
    const cssWidth = Math.max(112, targetRect.width + 90);
    const cssHeight = Math.max(100, targetRect.height + 82);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let start = performance.now();

    function draw(now) {
      const elapsed = reduceMotion ? 680 : now - start;
      const angle = elapsed * 0.00225 - Math.PI * 0.62;
      const centerX = cssWidth / 2;
      const centerY = cssHeight / 2;
      const radiusX = Math.max(25, targetRect.width / 2 + 19);
      const radiusY = Math.max(22, targetRect.height / 2 + 16);
      context.clearRect(0, 0, cssWidth, cssHeight);
      context.save();
      context.globalCompositeOperation = "lighter";

      for (let trail = 22; trail >= 1; trail -= 1) {
        const trailAngle = angle - trail * 0.075;
        const fade = (1 - trail / 24) * 0.38;
        SPECTRUM.forEach((color, colorIndex) => {
          const dispersion = (colorIndex - 2) * 1.25;
          const x = centerX + Math.cos(trailAngle) * radiusX
            + Math.cos(trailAngle + Math.PI / 2) * dispersion;
          const y = centerY + Math.sin(trailAngle) * radiusY
            + Math.sin(trailAngle + Math.PI / 2) * dispersion;
          context.beginPath();
          context.fillStyle = color;
          context.globalAlpha = fade * (0.45 + colorIndex * 0.06);
          context.shadowColor = color;
          context.shadowBlur = 9;
          context.arc(x, y, 1.1 + fade * 3.2, 0, Math.PI * 2);
          context.fill();
        });
      }

      const coreX = centerX + Math.cos(angle) * radiusX;
      const coreY = centerY + Math.sin(angle) * radiusY;
      const halo = context.createRadialGradient(coreX, coreY, 0, coreX, coreY, 17);
      halo.addColorStop(0, "rgba(255,255,255,1)");
      halo.addColorStop(0.18, "rgba(232,250,255,.98)");
      halo.addColorStop(0.46, "rgba(121,218,255,.4)");
      halo.addColorStop(1, "rgba(80,150,255,0)");
      context.globalAlpha = 1;
      context.shadowColor = "#dffaff";
      context.shadowBlur = 16;
      context.fillStyle = halo;
      context.beginPath();
      context.arc(coreX, coreY, 17, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff";
      context.beginPath();
      context.arc(coreX, coreY, 3.1, 0, Math.PI * 2);
      context.fill();
      context.restore();

      if (!reduceMotion) animationFrame = requestAnimationFrame(draw);
    }

    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, [targetRect]);

  if (!targetRect) return null;
  const width = Math.max(112, targetRect.width + 90);
  const height = Math.max(100, targetRect.height + 82);
  return (
    <canvas
      ref={canvasRef}
      className="tour-light-fairy"
      style={{
        left: targetRect.left + targetRect.width / 2 - width / 2,
        top: targetRect.top + targetRect.height / 2 - height / 2,
      }}
      aria-hidden="true"
    />
  );
}

export function OnboardingTour({ open, onClose }) {
  const [stepIndex, setStepIndex] = useState(localPreviewStep);
  const [targetRect, setTargetRect] = useState(null);
  const [placement, setPlacement] = useState(null);
  const cardRef = useRef(null);
  const frameRef = useRef(0);
  const step = ONBOARDING_STEPS[stepIndex];

  const measure = useCallback(() => {
    if (!open) return;
    const target = document.querySelector(step.selector);
    if (!target) {
      setTargetRect(null);
      return;
    }
    const rect = rectSnapshot(target.getBoundingClientRect());
    setTargetRect(rect);
    const card = cardRef.current;
    setPlacement(calculateTourPlacement(rect, {
      width: window.innerWidth,
      height: window.innerHeight,
    }, {
      width: 340,
      height: card?.offsetHeight || 206,
    }));
  }, [open, step]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const target = document.querySelector(step.selector);
    if (target) bringTargetIntoView(target);
    measure();
    const settleTimer = window.setTimeout(measure, 360);
    return () => window.clearTimeout(settleTimer);
  }, [measure, open, step]);

  useEffect(() => {
    if (!open) return undefined;
    function scheduleMeasure() {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(measure);
    }
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [measure, open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        if (stepIndex === ONBOARDING_STEPS.length - 1) onClose();
        else setStepIndex((value) => value + 1);
      }
      if (event.key === "ArrowLeft") setStepIndex((value) => Math.max(0, value - 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, stepIndex]);

  useLayoutEffect(() => {
    if (open && targetRect) measure();
  }, [measure, open, step.description, targetRect?.width]);

  if (!open) return null;

  function finishOrAdvance() {
    if (stepIndex === ONBOARDING_STEPS.length - 1) onClose();
    else setStepIndex((value) => value + 1);
  }

  return createPortal((
    <div className="onboarding-tour" role="presentation">
      {targetRect && (
        <div
          className="tour-spotlight"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
          aria-hidden="true"
        />
      )}
      <LightFairy targetRect={targetRect} />
      <section
        ref={cardRef}
        className="tour-card"
        data-side={placement?.side ?? "below"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
        style={placement ? {
          left: placement.left,
          top: placement.top,
          width: placement.width,
        } : undefined}
      >
        <button type="button" className="tour-skip" onClick={onClose} aria-label="跳过新用户引导"><X size={15} /> 跳过</button>
        <span className="tour-eyebrow">{step.eyebrow}</span>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-description">{step.description}</p>
        <footer>
          <div className="tour-progress" aria-label={`第 ${stepIndex + 1} 步，共 ${ONBOARDING_STEPS.length} 步`}>
            {ONBOARDING_STEPS.map((item, index) => (
              <i key={item.id} className={index === stepIndex ? "active" : ""} />
            ))}
          </div>
          <div className="tour-actions">
            {stepIndex > 0 && <button type="button" className="tour-previous" onClick={() => setStepIndex((value) => value - 1)}>上一步</button>}
            <button type="button" className="tour-next" onClick={finishOrAdvance}>
              {stepIndex === ONBOARDING_STEPS.length - 1 ? "开始探索" : "下一步"}
              <ArrowRight size={15} weight="bold" />
            </button>
          </div>
        </footer>
      </section>
    </div>
  ), document.body);
}
