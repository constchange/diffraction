import { useCallback, useEffect, useRef, useState } from "react";
import { FRESNEL_FFT_SIZE } from "../core/fresnel.js";

const UPDATE_INTERVAL_MS = 110;

export function useFresnelDiffraction(initialAperture, size, initialParameters) {
  const latestRef = useRef({
    aperture: initialAperture,
    parameters: initialParameters,
    revision: 1,
  });
  const sentRevisionRef = useRef(0);
  const inFlightRef = useRef(false);
  const hasFrameRef = useRef(false);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState({ state: "computing", elapsed: 0, message: "" });

  const submit = useCallback((aperture, parameters) => {
    latestRef.current = {
      aperture,
      parameters,
      revision: latestRef.current.revision + 1,
    };
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/fresnel.worker.js", import.meta.url), {
      type: "module",
    });

    function dispatch() {
      const latest = latestRef.current;
      if (inFlightRef.current || sentRevisionRef.current >= latest.revision) return;
      inFlightRef.current = true;
      sentRevisionRef.current = latest.revision;
      if (!hasFrameRef.current) setStatus({ state: "computing", elapsed: 0, message: "" });
      const amplitude = new Float32Array(latest.aperture.amplitude);
      const phase = new Float32Array(latest.aperture.phase);
      worker.postMessage({
        revision: latest.revision,
        size,
        fftSize: FRESNEL_FFT_SIZE,
        amplitude,
        phase,
        ...latest.parameters,
      }, [amplitude.buffer, phase.buffer]);
    }

    worker.onmessage = (event) => {
      const payload = event.data;
      inFlightRef.current = false;
      if (payload.type === "error") {
        setStatus({ state: "error", elapsed: 0, message: payload.message });
        dispatch();
        return;
      }
      if (payload.revision < latestRef.current.revision) {
        dispatch();
        return;
      }
      setFrame({
        pixels: payload.pixels,
        size: payload.size,
        peakIntensity: payload.peakIntensity,
        totalIntensity: payload.totalIntensity,
        samplePitchM: payload.samplePitchM,
        revision: payload.revision,
      });
      hasFrameRef.current = true;
      setStatus({ state: "ready", elapsed: payload.elapsed, message: "" });
      dispatch();
    };
    worker.onerror = () => {
      inFlightRef.current = false;
      setStatus({ state: "error", elapsed: 0, message: "菲涅尔计算线程异常，请刷新页面重试" });
    };

    dispatch();
    const interval = window.setInterval(dispatch, UPDATE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      worker.terminate();
    };
  }, [size]);

  return { frame, status, submit };
}
