import { evaluateScreenFunction } from "../core/formula.js";

self.onmessage = (event) => {
  const { latex, size, requestId } = event.data;
  try {
    const startedAt = performance.now();
    const result = evaluateScreenFunction(latex, size);
    self.postMessage(
      {
        type: "formula-result",
        requestId,
        amplitude: result.amplitude,
        phase: result.phase,
        expression: result.expression,
        elapsed: performance.now() - startedAt,
      },
      [result.amplitude.buffer, result.phase.buffer],
    );
  } catch (error) {
    self.postMessage({
      type: "formula-error",
      requestId,
      message: error instanceof Error ? error.message : "屏函数解析失败",
    });
  }
};
