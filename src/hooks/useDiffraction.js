import { useCallback, useEffect, useRef, useState } from "react";

const UPDATE_INTERVAL_MS = 100;
const REFINE_IDLE_MS = 700;
export const LIVE_FFT_SIZE = 512;
export const FINAL_FFT_SIZE = 1024;

export function useDiffraction(initialAperture, size, autoRun, renderParams) {
  const workerRef = useRef(null);
  const workerGenerationRef = useRef(0);
  const autoRunRef = useRef(autoRun);
  const dispatchRef = useRef(null);
  const jobSequenceRef = useRef(0);
  const inFlightRef = useRef(null);
  const latestRevisionRef = useRef(initialAperture ? 1 : 0);
  const latestApertureRef = useRef(
    initialAperture ? { aperture: initialAperture, size, revision: 1 } : null,
  );
  const liveCompletedRevisionRef = useRef(0);
  const refinedRevisionRef = useRef(0);
  const refineDueAtRef = useRef(
    (typeof performance === "undefined" ? 0 : performance.now()) + REFINE_IDLE_MS,
  );
  const paramsRef = useRef(renderParams);
  const observedParamsRef = useRef(renderParams);
  const paramsRevisionRef = useRef(1);
  const renderedParamsRevisionRef = useRef(0);
  const lastPresentedApertureRevisionRef = useRef(0);
  const frameRef = useRef(null);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState({
    state: initialAperture ? "computing" : "idle",
    elapsed: 0,
    renderElapsed: 0,
    quality: "live",
    message: "",
  });

  // Submission is ref-only: drawing never waits for React or a worker copy.
  // Every edit gets a live 512² pass; one 1024² pass is allowed only after
  // the aperture has remained unchanged for REFINE_IDLE_MS.
  const submitAperture = useCallback((aperture, options = {}) => {
    if (!aperture) return;
    const revision = latestRevisionRef.current + 1;
    latestRevisionRef.current = revision;
    latestApertureRef.current = {
      aperture,
      size: options.size ?? size,
      revision,
    };
    refineDueAtRef.current = performance.now() + REFINE_IDLE_MS;
  }, [size]);

  useEffect(() => {
    if (renderParams !== observedParamsRef.current) {
      paramsRevisionRef.current += 1;
      observedParamsRef.current = renderParams;
    }
    paramsRef.current = renderParams;
  }, [renderParams]);

  useEffect(() => {
    const generation = workerGenerationRef.current + 1;
    workerGenerationRef.current = generation;
    const worker = new Worker(new URL("../workers/diffraction.worker.js", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    inFlightRef.current = null;
    liveCompletedRevisionRef.current = 0;
    refinedRevisionRef.current = 0;
    renderedParamsRevisionRef.current = 0;

    function postCompute(latest, quality) {
      const jobId = jobSequenceRef.current + 1;
      jobSequenceRef.current = jobId;
      const amplitude = new Float32Array(latest.aperture.amplitude);
      const phase = new Float32Array(latest.aperture.phase);
      const renderRevision = paramsRevisionRef.current;
      inFlightRef.current = {
        jobId,
        kind: quality,
        apertureRevision: latest.revision,
        renderRevision,
      };
      if (!frameRef.current) {
        setStatus((current) => current.state === "computing"
          ? current
          : { ...current, state: "computing", message: "" });
      }
      worker.postMessage(
        {
          type: "compute",
          jobId,
          requestId: jobId,
          apertureRevision: latest.revision,
          quality,
          fftSize: quality === "final" ? FINAL_FFT_SIZE : LIVE_FFT_SIZE,
          size: latest.size,
          amplitude,
          phase,
          renderParams: paramsRef.current,
          renderRevision,
        },
        [amplitude.buffer, phase.buffer],
      );
    }

    function postRender() {
      const jobId = jobSequenceRef.current + 1;
      jobSequenceRef.current = jobId;
      const renderRevision = paramsRevisionRef.current;
      inFlightRef.current = { jobId, kind: "render", renderRevision };
      worker.postMessage({
        type: "render",
        jobId,
        requestId: jobId,
        renderParams: paramsRef.current,
        renderRevision,
      });
    }

    function dispatchLatest() {
      const latest = latestApertureRef.current;
      if (!latest || !autoRunRef.current || inFlightRef.current !== null) return;

      if (liveCompletedRevisionRef.current < latest.revision) {
        postCompute(latest, "live");
        return;
      }
      if (
        lastPresentedApertureRevisionRef.current < liveCompletedRevisionRef.current ||
        renderedParamsRevisionRef.current < paramsRevisionRef.current
      ) {
        postRender();
        return;
      }
      if (
        refinedRevisionRef.current < latest.revision &&
        performance.now() >= refineDueAtRef.current
      ) {
        postCompute(latest, "final");
      }
    }
    dispatchRef.current = dispatchLatest;

    worker.onmessage = (event) => {
      const payload = event.data;
      if (workerRef.current !== worker || workerGenerationRef.current !== generation) {
        payload.bitmap?.close?.();
        return;
      }
      const activeJob = inFlightRef.current;
      if (!activeJob || payload.jobId !== activeJob.jobId) {
        payload.bitmap?.close?.();
        return;
      }
      inFlightRef.current = null;

      if (payload.type === "frame") {
        if (activeJob.kind === "live") {
          liveCompletedRevisionRef.current = Math.max(
            liveCompletedRevisionRef.current,
            activeJob.apertureRevision,
          );
        } else if (activeJob.kind === "final") {
          refinedRevisionRef.current = Math.max(
            refinedRevisionRef.current,
            activeJob.apertureRevision,
          );
        }
        renderedParamsRevisionRef.current = Math.max(
          renderedParamsRevisionRef.current,
          payload.renderRevision ?? activeJob.renderRevision ?? 0,
        );

        const shouldPresent =
          payload.apertureRevision >= lastPresentedApertureRevisionRef.current &&
          (autoRunRef.current || !frameRef.current);
        if (shouldPresent) {
          lastPresentedApertureRevisionRef.current = payload.apertureRevision;
          const nextFrame = {
            bitmap: payload.bitmap ?? null,
            pixels: payload.pixels ?? null,
            width: payload.width,
            height: payload.height,
            sequence: payload.frameSequence,
          };
          const previous = frameRef.current;
          frameRef.current = nextFrame;
          setFrame(nextFrame);
          previous?.bitmap?.close?.();
          setStatus({
            state: "ready",
            elapsed: payload.fftElapsed,
            renderElapsed: payload.renderElapsed,
            quality: payload.quality,
            message: "",
          });
        } else {
          payload.bitmap?.close?.();
        }
      } else {
        if (activeJob.kind === "live") {
          liveCompletedRevisionRef.current = Math.max(
            liveCompletedRevisionRef.current,
            activeJob.apertureRevision,
          );
        } else if (activeJob.kind === "final") {
          refinedRevisionRef.current = Math.max(
            refinedRevisionRef.current,
            activeJob.apertureRevision,
          );
        }
        setStatus({
          state: "error",
          elapsed: 0,
          renderElapsed: 0,
          quality: "live",
          message: payload.message,
        });
      }
    };

    worker.onerror = () => {
      if (workerRef.current !== worker) return;
      inFlightRef.current = null;
      setStatus({
        state: "error",
        elapsed: 0,
        renderElapsed: 0,
        quality: "live",
        message: "衍射计算线程异常，请刷新页面重试",
      });
    };

    dispatchLatest();
    const interval = window.setInterval(dispatchLatest, UPDATE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      if (dispatchRef.current === dispatchLatest) dispatchRef.current = null;
      if (workerRef.current === worker) workerRef.current = null;
      inFlightRef.current = null;
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    autoRunRef.current = autoRun;
    if (autoRun) dispatchRef.current?.();
  }, [autoRun]);

  return { frame, status, submitAperture };
}
