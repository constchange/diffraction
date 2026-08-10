const APERTURE_SIZE = 256;
const AMPLITUDE_BYTES = APERTURE_SIZE * APERTURE_SIZE;
const PHASE_BYTES = AMPLITUDE_BYTES * 2;
const MAX_BODY_BYTES = 420_000;
const PREVIEW_SIZE = 48;

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

export function getSupabaseConfig(env) {
  const url = String(env?.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = String(env?.SUPABASE_SECRET_KEY ?? env?.SUPABASE_KEY ?? "").trim();
  if (!/^https:\/\/[^/]+/.test(url) || !key) {
    throw new ApiError(503, "DATABASE_NOT_CONFIGURED", "公共空间尚未配置数据库");
  }
  return { url, key };
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

export async function ownerHashFor(request, env) {
  const ip = getClientIp(request);
  const { data } = await supabaseRequest(env, "rpc/community_owner_hash", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_ip: ip }),
  });
  if (typeof data !== "string" || !/^[0-9a-f]{64}$/.test(data)) {
    throw new ApiError(503, "OWNER_IDENTITY_FAILED", "数据库无法生成稳定的网络地址标识");
  }
  return data;
}

function supabaseHeaders(config, extra = {}) {
  const headers = {
    apikey: config.key,
    accept: "application/json",
    ...extra,
  };
  if (!config.key.startsWith("sb_secret_")) {
    headers.authorization = `Bearer ${config.key}`;
  }
  return headers;
}

export async function supabaseRequest(env, resourceAndQuery, options = {}) {
  const config = getSupabaseConfig(env);
  const response = await fetch(`${config.url}/rest/v1/${resourceAndQuery}`, {
    ...options,
    headers: supabaseHeaders(config, options.headers),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new ApiError(
      response.status >= 500 ? 503 : response.status,
      "DATABASE_REQUEST_FAILED",
      "数据库请求失败，请确认 SQL 与环境变量已经配置",
      typeof data === "object" && data ? { code: data.code } : undefined,
    );
  }
  return { data, headers: response.headers, status: response.status };
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

export async function validateApertureData(value) {
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
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
    throw new ApiError(400, "INVALID_SLOT", "档位只能是 1、2 或 3");
  }
  return {
    slot,
    nickname: cleanLabel(body.nickname, "昵称", 20),
    patternName: cleanLabel(body.patternName, "衍射屏名称", 32),
    apertureData: body.aperture,
  };
}

export async function getModerationTerms(env) {
  const { data } = await supabaseRequest(
    env,
    "community_blocked_terms?select=term,category&enabled=eq.true&limit=1000",
  );
  const dynamicTerms = Array.isArray(data)
    ? data.filter((item) => typeof item?.term === "string" && typeof item?.category === "string")
      .map((item) => [item.term, item.category])
    : [];
  const unique = new Map();
  for (const [term, category] of [...BUILTIN_BLOCKED_TERMS, ...dynamicTerms]) {
    const normalized = normalizeModerationText(term);
    if (normalized) unique.set(`${category}:${normalized}`, { term: normalized, category });
  }
  return [...unique.values()];
}

export function moderateTextFields({ nickname, patternName }, terms) {
  for (const [field, value] of [["nickname", nickname], ["patternName", patternName]]) {
    const normalized = normalizeModerationText(value);
    const match = terms.find((item) => normalized.includes(item.term));
    if (match) {
      const label = field === "nickname" ? "昵称" : "衍射屏名称";
      throw new ApiError(422, "CONTENT_REJECTED", `${label}触发${CATEGORY_LABELS[match.category] ?? "敏感内容"}规则，上传数据已丢弃`, {
        field,
        category: match.category,
      });
    }
  }
}

export async function assertPatternAllowed(env, patternHash) {
  const { data } = await supabaseRequest(
    env,
    `community_blocked_pattern_hashes?select=category&pattern_hash=eq.${patternHash}&limit=1`,
  );
  if (Array.isArray(data) && data.length > 0) {
    const category = data[0].category;
    throw new ApiError(422, "CONTENT_REJECTED", `衍射屏图样触发${CATEGORY_LABELS[category] ?? "敏感内容"}规则，上传数据已丢弃`, {
      field: "aperture",
      category,
    });
  }
}

export function mapCommunityMetadata(row) {
  return {
    id: row.id,
    slot: row.slot,
    nickname: row.nickname,
    patternName: row.pattern_name,
    preview: row.preview_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCommunityDetail(row) {
  return {
    ...mapCommunityMetadata(row),
    aperture: row.aperture_data,
  };
}
