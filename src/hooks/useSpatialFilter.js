import { useCallback, useEffect, useRef, useState } from "react";

const UPDATE_INTERVAL_MS = 110;

export function useSpatialFilter(initialObject, initialFilter, size, initialOutsideTransmission = 1, initialWavelengthNm = 532) {
  const workerRef = useRef(null);
  const latestRef = useRef({
    object: initialObject,
    filter: initialFilter,
    outsideTransmission: initialOutsideTransmission,
    wavelengthNm: initialWavelengthNm,
    revision: 1,
  });
  const sentRevisionRef = useRef(0);
  const inFlightRef = useRef(false);
  const frameRef = useRef(null);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState({ state: "computing", elapsed: 0, message: "" });

  const submit = useCallback((object, filter, outsideTransmission = 1, wavelengthNm = 532) => {
    latestRef.current = {
      object,
      filter,
      outsideTransmission,
      wavelengthNm,
      revision: latestRef.current.revision + 1,
    };
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/spatial-filter.worker.js", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    function dispatch() {
      const latest = latestRef.current;
      if (inFlightRef.current || sentRevisionRef.current >= latest.revision) return;
      inFlightRef.current = true;
      sentRevisionRef.current = latest.revision;
      if (!frameRef.current) setStatus({ state: "computing", elapsed: 0, message: "" });
      const objectAmplitude = new Float32Array(latest.object.amplitude);
      const objectPhase = new Float32Array(latest.object.phase);
      const filterAmplitude = new Float32Array(latest.filter.amplitude);
      const filterPhase = new Float32Array(latest.filter.phase);
      worker.postMessage({
        revision: latest.revision,
        size,
        objectAmplitude,
        objectPhase,
        filterAmplitude,
        filterPhase,
        outsideTransmission: latest.outsideTransmission,
        wavelengthNm: latest.wavelengthNm,
      }, [objectAmplitude.buffer, objectPhase.buffer, filterAmplitude.buffer, filterPhase.buffer]);
    }

    worker.onmessage = (event) => {
      const payload = event.data;
      inFlightRef.current = false;
      if (payload.type === "error") {
        setStatus({ state: "error", elapsed: 0, message: payload.message });
        return;
      }
      if (payload.revision < latestRef.current.revision) {
        payload.spectrum?.close?.();
        payload.image?.close?.();
        dispatch();
        return;
      }
      const next = {
        spectrum: payload.spectrum ?? null,
        image: payload.image ?? null,
        spectrumPixels: payload.spectrumPixels ?? null,
        imagePixels: payload.imagePixels ?? null,
        size: payload.size,
        revision: payload.revision,
      };
      const previous = frameRef.current;
      frameRef.current = next;
      setFrame(next);
      previous?.spectrum?.close?.();
      previous?.image?.close?.();
      setStatus({ state: "ready", elapsed: payload.elapsed, message: "" });
      dispatch();
    };
    worker.onerror = () => {
      inFlightRef.current = false;
      setStatus({ state: "error", elapsed: 0, message: "空间滤波线程异常，请刷新页面重试" });
    };

    dispatch();
    const interval = window.setInterval(dispatch, UPDATE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      workerRef.current = null;
      worker.terminate();
      frameRef.current?.spectrum?.close?.();
      frameRef.current?.image?.close?.();
    };
  }, [size]);

  return { frame, status, submit };
}
