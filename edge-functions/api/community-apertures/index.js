import {
  ApiError,
  assertPatternAllowed,
  errorResponse,
  getModerationTerms,
  jsonResponse,
  mapCommunityMetadata,
  moderateTextFields,
  ownerHashFor,
  parseUploadRequest,
  requireSameOrigin,
  supabaseRequest,
  validateApertureData,
} from "../../_shared/community.js";

const METADATA_COLUMNS = "id,slot,nickname,pattern_name,preview_data,created_at,updated_at";

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function contentRangeTotal(headers) {
  const match = headers.get("content-range")?.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") === "mine" ? "mine" : "public";
    if (scope === "mine") {
      const ownerHash = await ownerHashFor(request, env);
      const { data } = await supabaseRequest(
        env,
        `community_apertures?select=${METADATA_COLUMNS}&owner_hash=eq.${ownerHash}&order=slot.asc`,
      );
      return jsonResponse({ items: (data ?? []).map(mapCommunityMetadata), slotLimit: 3 });
    }

    const page = parsePositiveInteger(url.searchParams.get("page"), 1, 100_000);
    const pageSize = parsePositiveInteger(url.searchParams.get("pageSize"), 18, 48);
    const offset = (page - 1) * pageSize;
    const { data, headers } = await supabaseRequest(
      env,
      `community_apertures?select=${METADATA_COLUMNS}&order=pattern_name.asc,id.asc&limit=${pageSize}&offset=${offset}`,
      { headers: { prefer: "count=exact" } },
    );
    const items = (data ?? []).map(mapCommunityMetadata);
    return jsonResponse({
      items,
      page,
      pageSize,
      total: contentRangeTotal(headers) ?? offset + items.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    requireSameOrigin(request);
    const upload = await parseUploadRequest(request);
    const ownerHash = await ownerHashFor(request, env);
    const terms = await getModerationTerms(env);
    moderateTextFields(upload, terms);
    const validated = await validateApertureData(upload.apertureData, upload.previewApertureData);
    moderateTextFields({ formula: validated.formula }, terms);
    await assertPatternAllowed(env, validated.patternHash);

    const existingQuery = `community_apertures?select=id&owner_hash=eq.${ownerHash}&slot=eq.${upload.slot}&limit=1`;
    const { data: existingRows } = await supabaseRequest(env, existingQuery);
    const record = {
      owner_hash: ownerHash,
      slot: upload.slot,
      nickname: upload.nickname,
      pattern_name: upload.patternName,
      aperture_data: validated.aperture,
      preview_data: validated.preview,
      pattern_hash: validated.patternHash,
      moderation: {
        method: "local-rules",
        status: "approved",
        checked_at: new Date().toISOString(),
      },
    };

    let result;
    let status;
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      const id = existingRows[0].id;
      result = await supabaseRequest(
        env,
        `community_apertures?id=eq.${id}&owner_hash=eq.${ownerHash}&select=${METADATA_COLUMNS}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            prefer: "return=representation",
          },
          body: JSON.stringify(record),
        },
      );
      status = 200;
    } else {
      result = await supabaseRequest(
        env,
        `community_apertures?select=${METADATA_COLUMNS}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            prefer: "return=representation",
          },
          body: JSON.stringify(record),
        },
      );
      status = 201;
    }

    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) throw new ApiError(503, "DATABASE_REQUEST_FAILED", "数据库没有返回上传结果");
    return jsonResponse({ item: mapCommunityMetadata(row), overwritten: status === 200 }, status);
  } catch (error) {
    return errorResponse(error);
  }
}
