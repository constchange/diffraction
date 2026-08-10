import {
  ApiError,
  errorResponse,
  jsonResponse,
  mapCommunityDetail,
  ownerHashFor,
  requireSameOrigin,
  supabaseRequest,
} from "../../_shared/community.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatedId(params) {
  const id = String(params?.id ?? "");
  if (!UUID_PATTERN.test(id)) throw new ApiError(400, "INVALID_ID", "公共衍射屏编号无效");
  return id;
}

export async function onRequestGet({ params, env }) {
  try {
    const id = validatedId(params);
    const { data } = await supabaseRequest(
      env,
      `community_apertures?select=id,slot,nickname,pattern_name,preview_data,created_at,updated_at,aperture_data&id=eq.${id}&limit=1`,
    );
    if (!Array.isArray(data) || data.length === 0) {
      throw new ApiError(404, "NOT_FOUND", "这个公共衍射屏不存在或已经被删除");
    }
    return jsonResponse({ item: mapCommunityDetail(data[0]) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestDelete({ request, params, env }) {
  try {
    requireSameOrigin(request);
    const id = validatedId(params);
    const ownerHash = await ownerHashFor(request, env);
    const { data } = await supabaseRequest(
      env,
      `community_apertures?id=eq.${id}&owner_hash=eq.${ownerHash}&select=id`,
      {
        method: "DELETE",
        headers: { prefer: "return=representation" },
      },
    );
    if (!Array.isArray(data) || data.length === 0) {
      throw new ApiError(404, "NOT_FOUND", "未找到属于当前网络地址的这个档位");
    }
    return jsonResponse({ deleted: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}
