import {
  communityRequest,
  errorResponse,
  jsonResponse,
  requireSameOrigin,
} from "../../_shared/community.js";

export async function onRequestPost({ request, env }) {
  try {
    requireSameOrigin(request);
    return jsonResponse(await communityRequest(env, "onboarding", {}, request));
  } catch (error) {
    return errorResponse(error);
  }
}
