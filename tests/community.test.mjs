import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiError,
  getClientIp,
  moderateTextFields,
  ownerHashFor,
  parseUploadRequest,
  validateApertureData,
} from "../edge-functions/_shared/community.js";
import { encodeAperture } from "../src/core/apertureStorage.js";
import { onRequestPost } from "../edge-functions/api/community-apertures/index.js";

function sampleEncodedAperture(size = 256) {
  const amplitude = new Float32Array(size * size);
  const phase = new Float32Array(size * size);
  amplitude[32 * size + 48] = 1;
  amplitude[180 * size + 210] = 0.5;
  phase[32 * size + 48] = 1.2;
  return encodeAperture({ amplitude, phase }, size);
}

test("community upload validation derives preview and stable content hash", async () => {
  const encoded = sampleEncodedAperture();
  const first = await validateApertureData(encoded);
  const second = await validateApertureData(encoded);
  assert.equal(first.aperture.size, 256);
  assert.equal(atob(first.preview).length, 48 * 48);
  assert.match(first.patternHash, /^[0-9a-f]{64}$/);
  assert.equal(first.patternHash, second.patternHash);
});

test("community upload validation rejects malformed complex aperture buffers", async () => {
  const encoded = sampleEncodedAperture();
  encoded.phase = encoded.phase.slice(4);
  await assert.rejects(
    validateApertureData(encoded),
    (error) => error instanceof ApiError && error.code === "INVALID_APERTURE",
  );
});

test("local moderation normalizes punctuation and rejects matching metadata", () => {
  assert.throws(
    () => moderateTextFields(
      { nickname: "清爽少年", patternName: "博-彩光栅" },
      [{ term: "博彩", category: "gambling" }],
    ),
    (error) => error instanceof ApiError
      && error.code === "CONTENT_REJECTED"
      && error.details.field === "patternName",
  );
});

test("upload metadata accepts exactly three slots and bounded labels", async () => {
  const request = new Request("https://example.test/api/community-apertures", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slot: 3,
      nickname: "  小光  ",
      patternName: "双孔实验",
      aperture: sampleEncodedAperture(),
    }),
  });
  const parsed = await parseUploadRequest(request);
  assert.equal(parsed.slot, 3);
  assert.equal(parsed.nickname, "小光");
});

test("owner identity is a salted digest and never exposes the client IP", async () => {
  const originalFetch = globalThis.fetch;
  let sentBody = "";
  globalThis.fetch = async (_url, options) => {
    sentBody = options.body;
    return Response.json("a".repeat(64));
  };
  const request = {
    url: "https://example.test/api/community-apertures",
    headers: new Headers(),
    eo: { clientIp: "203.0.113.42" },
  };
  assert.equal(getClientIp(request), "203.0.113.42");
  try {
    const ownerHash = await ownerHashFor(request, {
      SUPABASE_URL: "https://sample.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_test_value",
    });
    assert.match(ownerHash, /^[0-9a-f]{64}$/);
    assert.equal(ownerHash.includes("203.0.113.42"), false);
    assert.equal(JSON.parse(sentBody).client_ip, "203.0.113.42");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("community upload route moderates and inserts through a server-only Supabase key", async (context) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("rpc/community_owner_hash")) return Response.json("b".repeat(64));
    if (String(url).includes("community_blocked_terms")) {
      return Response.json([{ term: "赌博", category: "gambling" }]);
    }
    if (String(url).includes("community_blocked_pattern_hashes")) return Response.json([]);
    if (String(url).includes("owner_hash=eq.")) return Response.json([]);
    if (options.method === "POST") {
      const record = JSON.parse(options.body);
      return Response.json([{
        id: "79811b15-1dc6-4fc4-8a58-148b301865af",
        slot: record.slot,
        nickname: record.nickname,
        pattern_name: record.pattern_name,
        preview_data: record.preview_data,
        created_at: "2026-08-10T08:00:00.000Z",
        updated_at: "2026-08-10T08:00:00.000Z",
      }], { status: 201 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const request = new Request("https://example.test/api/community-apertures", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({
      slot: 2,
      nickname: "小光",
      patternName: "双圆孔",
      aperture: sampleEncodedAperture(),
    }),
  });
  Object.defineProperty(request, "eo", { value: { clientIp: "203.0.113.9" } });
  const response = await onRequestPost({
    request,
    env: {
      SUPABASE_URL: "https://sample.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_test_value",
    },
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.equal(payload.item.patternName, "双圆孔");
  assert.equal(calls.at(-1).options.headers.apikey, "sb_secret_test_value");
  assert.equal("authorization" in calls.at(-1).options.headers, false);
  assert.equal(calls.some((call) => call.url.includes("203.0.113.9")), false);
});

test("community upload route discards metadata rejected by moderation", async (context) => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) return Response.json("c".repeat(64));
    return Response.json([{ term: "赌博", category: "gambling" }]);
  };
  const request = new Request("https://example.test/api/community-apertures", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({
      slot: 1,
      nickname: "赌博昵称",
      patternName: "普通图样",
      aperture: sampleEncodedAperture(),
    }),
  });
  Object.defineProperty(request, "eo", { value: { clientIp: "203.0.113.10" } });
  const response = await onRequestPost({
    request,
    env: {
      SUPABASE_URL: "https://sample.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_test_value",
    },
  });
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.error.code, "CONTENT_REJECTED");
  assert.equal(payload.error.message, "内容不符合上传要求，无法上传");
  assert.equal("details" in payload.error, false, "public response must not disclose filtering rules");
  assert.equal(requestCount, 2, "rejected metadata must not reach aperture insert queries");
});
