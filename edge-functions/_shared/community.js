const APERTURE_SIZE = 256;
const AMPLITUDE_BYTES = APERTURE_SIZE * APERTURE_SIZE;
const PHASE_BYTES = AMPLITUDE_BYTES * 2;
const MAX_BODY_BYTES = 420_000;
const PREVIEW_SIZE = 48;
const FORMULA_FORMAT = "fraunhofer-formula-v1";

const BUILTIN_BLOCKED_TERMS = [
  ["色情", "pornography"],
  ["成人视频", "pornography"],
  ["裸聊", "pornography"],
  ["约炮", "pornography"],
  ["porn", "pornography"],
  ["nsfw", "pornography"],
  ["赌博", "gambling"],
  ["博彩", "gambling"],
  ["赌场", "gambling"],
  ["下注", "gambling"],
  ["百家乐", "gambling"],
  ["casino", "gambling"],
  ["毒品", "drugs"],
  ["贩毒", "drugs"],
  ["吸毒", "drugs"],
  ["冰毒", "drugs"],
  ["海洛因", "drugs"],
  ["可卡因", "drugs"],
  ["大麻", "drugs"],
  ["政治敏感", "politics"],
  ["颠覆政权", "politics"],
  ["分裂国家", "politics"],
  ["反政府", "politics"],
];

const CATEGORY_LABELS = {
  pornography: "不适宜内容",
  gambling: "涉赌内容",
  drugs: "涉毒内容",
  politics: "政治敏感内容",
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function errorResponse(error) {
  if (error instanceof ApiError) {
    if (error.code === "CONTENT_REJECTED") {
      return jsonResponse({
        error: {
          code: error.code,
          message: "内容不符合上传要求，无法上传",
        },
      }, error.status);
    }
    return jsonResponse({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    }, error.status);
  }
  return jsonResponse({
    error: {
      code: "INTERNAL_ERROR",
      message: "公共空间暂时不可用，请稍后重试",
    },
  }, 500);
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, "CROSS_ORIGIN_DENIED", "不接受来自其他网站的写入请求");
  }
}

export function getCloudBaseConfig(env) {
  const environment = String(env?.CLOUDBASE_ENV ?? "").trim();
  // EdgeOne limits each environment variable to 1000 characters, while this
  // environment's public JWT is longer. Keep the two parts server-side only.
  const publishableKey = String(env?.CLOUDBASE_PUBLISHABLE_KEY_1 ?? "")
    + String(env?.CLOUDBASE_PUBLISHABLE_KEY_2 ?? "");
  const serverToken = String(env?.DIFFRACTION_SERVER_TOKEN ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{5,80}$/.test(environment) || !publishableKey || !serverToken) {
    throw new ApiError(503, "DATABASE_NOT_CONFIGURED", "公共空间尚未配置数据库");
  }
  return {
    endpoint: `https://${environment}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/diffraction_community_call`,
    publishableKey,
    serverToken,
  };
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function getClientIp(request) {
  const edgeIp = request.eo?.clientIp;
  if (typeof edgeIp === "string" && edgeIp.trim()) return edgeIp.trim();

  const hostname = new URL(request.url).hostname;
  if (isLocalHostname(hostname)) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || "127.0.0.1";
  }
  throw new ApiError(503, "CLIENT_IP_UNAVAILABLE", "部署平台没有提供可信的客户端 IP");
}

async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function communityRequest(env, action, payload = {}, request) {
  const config = getCloudBaseConfig(env);
  const clientIp = request ? getClientIp(request) : null;
  let response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.publishableKey}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_action: action,
        p_server_token: config.serverToken,
        p_client_ip: clientIp,
        p_payload: payload,
      }),
    });
  } catch {
    throw new ApiError(503, "DATABASE_REQUEST_FAILED", "公共空间数据库暂时无法连接");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(503, "DATABASE_REQUEST_FAILED", "公共空间数据库返回格式有误");
  }
  if (!response.ok || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiError(503, "DATABASE_REQUEST_FAILED", "公共空间数据库请求失败");
  }
  return data;
}

function normalizeModerationText(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function cleanLabel(value, field, maximum) {
  if (typeof value !== "string") {
    throw new ApiError(400, "INVALID_METADATA", `${field}不能为空`);
  }
  const cleaned = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned || Array.from(cleaned).length > maximum) {
    throw new ApiError(400, "INVALID_METADATA", `${field}需为 1–${maximum} 个字符`);
  }
  return cleaned;
}

function decodeBase64(value, expectedLength, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new ApiError(400, "INVALID_APERTURE", `${field}不是有效的 Base64 数据`);
  }
  let binary;
  try {
    binary = atob(value);
  } catch {
    throw new ApiError(400, "INVALID_APERTURE", `${field}无法解码`);
  }
  if (binary.length !== expectedLength) {
    throw new ApiError(400, "INVALID_APERTURE", `${field}长度不正确`);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes) {
  let result = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(result);
}

function makePreview(amplitude) {
  const preview = new Uint8Array(PREVIEW_SIZE * PREVIEW_SIZE);
  for (let previewY = 0; previewY < PREVIEW_SIZE; previewY += 1) {
    const startY = Math.floor((previewY * APERTURE_SIZE) / PREVIEW_SIZE);
    const endY = Math.floor(((previewY + 1) * APERTURE_SIZE) / PREVIEW_SIZE);
    for (let previewX = 0; previewX < PREVIEW_SIZE; previewX += 1) {
      const startX = Math.floor((previewX * APERTURE_SIZE) / PREVIEW_SIZE);
      const endX = Math.floor(((previewX + 1) * APERTURE_SIZE) / PREVIEW_SIZE);
      let sum = 0;
      let count = 0;
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          sum += amplitude[y * APERTURE_SIZE + x];
          count += 1;
        }
      }
      preview[previewY * PREVIEW_SIZE + previewX] = Math.round(sum / Math.max(1, count));
    }
  }
  return bytesToBase64(preview);
}

async function validateRasterAperture(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_APERTURE", "衍射屏数据缺失");
  }
  if (value.format !== "fraunhofer-aperture-v1" || value.size !== APERTURE_SIZE) {
    throw new ApiError(400, "INVALID_APERTURE", "衍射屏格式或采样尺寸不兼容");
  }
  const amplitude = decodeBase64(value.amplitude, AMPLITUDE_BYTES, "振幅数据");
  const phase = decodeBase64(value.phase, PHASE_BYTES, "相位数据");
  const combined = new Uint8Array(amplitude.length + phase.length);
  combined.set(amplitude);
  combined.set(phase, amplitude.length);
  return {
    aperture: {
      format: "fraunhofer-aperture-v1",
      size: APERTURE_SIZE,
      amplitude: value.amplitude,
      phase: value.phase,
    },
    preview: makePreview(amplitude),
    patternHash: await sha256Hex(combined),
  };
}

export async function validateApertureData(value, previewValue) {
  if (value?.format !== FORMULA_FORMAT) return validateRasterAperture(value);
  const formula = typeof value.formula === "string" ? value.formula.trim() : "";
  if (value.size !== APERTURE_SIZE || !formula || formula.length > 1200
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(formula)) {
    throw new ApiError(400, "INVALID_APERTURE", "屏函数格式或采样尺寸不兼容");
  }
  const previewSource = await validateRasterAperture(previewValue);
  return {
    aperture: {
      format: FORMULA_FORMAT,
      size: APERTURE_SIZE,
      formula,
    },
    preview: previewSource.preview,
    patternHash: previewSource.patternHash,
    formula,
  };
}

export async function parseUploadRequest(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "衍射屏上传数据过大");
  }
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "上传内容不是有效的 JSON");
  }
  const slot = Number(body?.slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
    throw new ApiError(400, "INVALID_SLOT", "上传档位无效");
  }
  return {
    slot,
    nickname: cleanLabel(body.nickname, "昵称", 20),
    patternName: cleanLabel(body.patternName, "衍射屏名称", 32),
    apertureData: body.aperture,
    previewApertureData: body.previewAperture,
  };
}

export function getModerationTerms(review) {
  const dynamicTerms = Array.isArray(review?.terms)
    ? review.terms.filter((item) => typeof item?.term === "string" && typeof item?.category === "string")
      .map((item) => [item.term, item.category])
    : [];
  const unique = new Map();
  for (const [term, category] of [...BUILTIN_BLOCKED_TERMS, ...dynamicTerms]) {
    const normalized = normalizeModerationText(term);
    if (normalized) unique.set(`${category}:${normalized}`, { term: normalized, category });
  }
  return [...unique.values()];
}

export function moderateTextFields({ nickname, patternName, formula }, terms) {
  for (const [field, value] of [["nickname", nickname], ["patternName", patternName], ["formula", formula]]) {
    if (typeof value !== "string") continue;
    const normalized = normalizeModerationText(value);
    const match = terms.find((item) => normalized.includes(item.term));
    if (match) {
      const label = field === "nickname" ? "昵称" : field === "patternName" ? "衍射屏名称" : "屏函数";
      throw new ApiError(422, "CONTENT_REJECTED", `${label}触发${CATEGORY_LABELS[match.category] ?? "敏感内容"}规则，上传数据已丢弃`, {
        field,
        category: match.category,
      });
    }
  }
}

export function assertPatternAllowed(review) {
  if (review?.blocked === true) {
    const category = review.category;
    throw new ApiError(422, "CONTENT_REJECTED", `衍射屏图样触发${CATEGORY_LABELS[category] ?? "敏感内容"}规则，上传数据已丢弃`, {
      field: "aperture",
      category,
    });
  }
}
