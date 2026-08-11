import {
  errorResponse,
  jsonResponse,
  ownerHashFor,
  requireSameOrigin,
  supabaseRequest,
} from "../../_shared/community.js";

export async function onRequestPost({ request, env }) {
  try {
    requireSameOrigin(request);
    const ownerHash = await ownerHashFor(request, env);
    const { data } = await supabaseRequest(
      env,
      "community_onboarding_visits?on_conflict=owner_hash&select=owner_hash",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify({ owner_hash: ownerHash }),
      },
    );
    return jsonResponse({ show: Array.isArray(data) && data.length > 0 });
  } catch (error) {
    return errorResponse(error);
  }
}
