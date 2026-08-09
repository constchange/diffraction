import { compile, complex } from "mathjs";

const COMMANDS = ["sin", "cos", "tan", "exp", "abs", "atan2", "min", "max"];

function readBraceGroup(source, openingIndex) {
  if (source[openingIndex] !== "{") return null;
  let depth = 0;
  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) {
      return {
        content: source.slice(openingIndex + 1, index),
        end: index + 1,
      };
    }
  }
  throw new Error("LaTeX 花括号没有闭合");
}

function replaceFractions(source) {
  let result = source;
  let marker = result.indexOf("\\frac");
  while (marker !== -1) {
    let cursor = marker + 5;
    while (/\s/.test(result[cursor] ?? "")) cursor += 1;
    const numerator = readBraceGroup(result, cursor);
    if (!numerator) throw new Error("\\frac 后需要两个花括号参数");
    cursor = numerator.end;
    while (/\s/.test(result[cursor] ?? "")) cursor += 1;
    const denominator = readBraceGroup(result, cursor);
    if (!denominator) throw new Error("\\frac 后需要两个花括号参数");
    const replacement = `((${replaceFractions(numerator.content)})/(${replaceFractions(denominator.content)}))`;
    result = result.slice(0, marker) + replacement + result.slice(denominator.end);
    marker = result.indexOf("\\frac");
  }
  return result;
}

function replaceSqrt(source) {
  let result = source;
  let marker = result.indexOf("\\sqrt");
  while (marker !== -1) {
    let cursor = marker + 5;
    while (/\s/.test(result[cursor] ?? "")) cursor += 1;
    const group = readBraceGroup(result, cursor);
    if (!group) throw new Error("\\sqrt 后需要花括号参数");
    const replacement = `sqrt(${replaceSqrt(group.content)})`;
    result = result.slice(0, marker) + replacement + result.slice(group.end);
    marker = result.indexOf("\\sqrt");
  }
  return result;
}

function replaceExponential(source) {
  let result = source;
  let marker = result.indexOf("e^{");
  while (marker !== -1) {
    const group = readBraceGroup(result, marker + 2);
    if (!group) break;
    result = result.slice(0, marker) + `exp(${group.content})` + result.slice(group.end);
    marker = result.indexOf("e^{");
  }
  return result;
}

export function latexToExpression(latex) {
  if (typeof latex !== "string" || latex.trim().length === 0) {
    throw new Error("请输入屏函数");
  }
  if (latex.length > 1200) throw new Error("屏函数过长，请精简表达式");

  let expression = latex
    .trim()
    .replace(/^\s*(?:T|t)\s*\([^)]*\)\s*=\s*/, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\operatorname\s*\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\s*\{([^}]+)\}/g, "$1")
    .replace(/\\text\s*\{[^}]*\}/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\pi/g, " pi ")
    .replace(/−/g, "-");

  expression = replaceFractions(expression);
  expression = replaceSqrt(expression);
  expression = replaceExponential(expression);
  for (const command of COMMANDS) {
    expression = expression.replace(new RegExp(`\\\\${command}\\b`, "g"), command);
  }

  expression = expression
    .replace(/[{}]/g, (value) => (value === "{" ? "(" : ")"))
    .replace(/\]\s*\[/g, ")*(")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\)\s*(?=(?:rect|circ|tri|sin|cos|tan|exp|abs|sqrt|atan2)\s*\()/g, ")*")
    .replace(/\s+/g, " ")
    .trim();

  if (/[^0-9a-zA-Z_+\-*/^().,\s]/.test(expression)) {
    throw new Error("公式中含有暂不支持的 LaTeX 符号");
  }
  return expression;
}

const helpers = {
  i: complex(0, 1),
  rect: (value) => (Math.abs(Number(value)) <= 0.5 ? 1 : 0),
  circ: (value) => (Math.abs(Number(value)) <= 1 ? 1 : 0),
  tri: (value) => Math.max(0, 1 - Math.abs(Number(value))),
  step: (value) => (Number(value) >= 0 ? 1 : 0),
};

function complexParts(value) {
  if (typeof value === "number") return { re: value, im: 0 };
  if (value && typeof value.re === "number" && typeof value.im === "number") {
    return { re: value.re, im: value.im };
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return { re: numeric, im: 0 };
  throw new Error("屏函数必须返回实数或复数");
}

export function evaluateScreenFunction(latex, size = 256) {
  const expression = latexToExpression(latex);
  let compiled;
  try {
    compiled = compile(expression);
  } catch (error) {
    throw new Error(`无法解析公式：${error instanceof Error ? error.message : "格式错误"}`);
  }

  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  const scope = { ...helpers, x: 0, y: 0 };

  for (let row = 0; row < size; row += 1) {
    scope.y = (2 * (row + 0.5)) / size - 1;
    for (let column = 0; column < size; column += 1) {
      scope.x = (2 * (column + 0.5)) / size - 1;
      let value;
      try {
        value = compiled.evaluate(scope);
      } catch (error) {
        throw new Error(`计算屏函数失败：${error instanceof Error ? error.message : "未知错误"}`);
      }
      const { re, im } = complexParts(value);
      const modulus = Math.hypot(re, im);
      const index = row * size + column;
      amplitude[index] = Math.max(0, Math.min(1, modulus));
      phase[index] = modulus > 1e-12 ? Math.atan2(im, re) : 0;
    }
  }

  return { amplitude, phase, expression };
}
