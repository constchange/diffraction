function apiError(message, code = "REQUEST_FAILED", status = 0) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function requestJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        accept: "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw apiError("无法连接公共空间，请检查网络后重试", "NETWORK_ERROR");
  }

  const contentType = response.headers.get("content-type") ?? "";
  let payload = null;
  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    throw apiError(
      payload?.error?.message ?? "公共空间请求失败，请稍后重试",
      payload?.error?.code ?? "REQUEST_FAILED",
      response.status,
    );
  }
  if (!payload) throw apiError("公共空间返回了无法识别的数据", "INVALID_RESPONSE", response.status);
  return payload;
}

function normalizedBase(baseUrl) {
  return String(baseUrl || "/api/community-apertures").replace(/\/+$/, "");
}

export function listCommunityApertures(baseUrl, page = 1, pageSize = 18, signal) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson(`${normalizedBase(baseUrl)}?${query}`, { signal });
}

export function listOwnedCommunityApertures(baseUrl, signal) {
  return requestJson(`${normalizedBase(baseUrl)}?scope=mine`, { signal });
}

export function uploadCommunityAperture(baseUrl, submission) {
  return requestJson(normalizedBase(baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submission),
  });
}

export function getCommunityAperture(baseUrl, id) {
  return requestJson(`${normalizedBase(baseUrl)}/${encodeURIComponent(id)}`);
}

export function deleteCommunityAperture(baseUrl, id) {
  return requestJson(`${normalizedBase(baseUrl)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
