import {
  ApiError,
  assertPatternAllowed,
  communityRequest,
  errorResponse,
  getClientIp,
  getModerationTerms,
  jsonResponse,
  moderateTextFields,
  parseUploadRequest,
  requireSameOrigin,
  validateApertureData,
} from "../../_shared/community.js";

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") === "mine" ? "mine" : "public";
    if (scope === "mine") {
      return jsonResponse(await communityRequest(env, "mine", {}, request));
    }

    const page = parsePositiveInteger(url.searchParams.get("page"), 1, 100_000);
    const pageSize = parsePositiveInteger(url.searchParams.get("pageSize"), 18, 48);
    return jsonResponse(await communityRequest(env, "list", { page, pageSize }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    requireSameOrigin(request);
    const upload = await parseUploadRequest(request);
    getClientIp(request);
    const validated = await validateApertureData(upload.apertureData, upload.previewApertureData);
    const review = await communityRequest(env, "review", { patternHash: validated.patternHash });
    const terms = getModerationTerms(review);
    moderateTextFields({ ...upload, formula: validated.formula }, terms);
    assertPatternAllowed(review);
    const record = {
      slot: upload.slot,
      nickname: upload.nickname,
      patternName: upload.patternName,
      aperture: validated.aperture,
      preview: validated.preview,
      patternHash: validated.patternHash,
    };
    const result = await communityRequest(env, "upload", record, request);
    if (!result?.item) throw new ApiError(503, "DATABASE_REQUEST_FAILED", "数据库没有返回上传结果");
    return jsonResponse(result, result.overwritten ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
