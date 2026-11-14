import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiError,
  communityRequest,
  getClientIp,
  moderateTextFields,
  parseUploadRequest,
  validateApertureData,
} from "../edge-functions/_shared/community.js";
import { encodeAperture, encodeScreenDefinition } from "../src/core/apertureStorage.js";
import { onRequestPost as onUploadPost } from "../edge-functions/api/community-apertures/index.js";
import { onRequestPost as onOnboardingPost } from "../edge-functions/api/community-apertures/onboarding.js";

const TEST_ENV = {
  CLOUDBASE_ENV: "example-cloudbase-123",
  CLOUDBASE_PUBLISHABLE_KEY_1: "public-part-one",
  CLOUDBASE_PUBLISHABLE_KEY_2: "public-part-two",
  DIFFRACTION_SERVER_TOKEN: "server-only-test-token",
};

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

test("community validation stores function text and derives its preview from the rendered raster", async () => {
  const formula = String.raw`\operatorname{circ}\left(\frac{\sqrt{x^2+y^2}}{0.3}\right)`;
  const encodedFormula = encodeScreenDefinition({ mode: "function", formula }, 256);
  const validated = await validateApertureData(encodedFormula, sampleEncodedAperture());
  assert.deepEqual(validated.aperture, {
    format: "fraunhofer-formula-v1",
    size: 256,
    formula,
  });
  assert.equal(atob(validated.preview).length, 48 * 48);
  assert.match(validated.patternHash, /^[0-9a-f]{64}$/);
});

test("community function validation requires a rendered preview raster", async () => {
  const encodedFormula = encodeScreenDefinition({ mode: "function", formula: "x+y" }, 256);
  await assert.rejects(
    validateApertureData(encodedFormula),
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

test("upload metadata accepts the tenth slot and bounded labels", async () => {
  const request = new Request("https://example.test/api/community-apertures", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slot: 10,
      nickname: "  小光  ",
      patternName: "双孔实验",
      aperture: sampleEncodedAperture(),
    }),
  });
  const parsed = await parseUploadRequest(request);
  assert.equal(parsed.slot, 10);
  assert.equal(parsed.nickname, "小光");
});

test("upload metadata rejects an unavailable slot without advertising capacity", async () => {
  const request = new Request("https://example.test/api/community-apertures", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slot: 11,
      nickname: "小光",
      patternName: "双孔实验",
      aperture: sampleEncodedAperture(),
    }),
  });
  await assert.rejects(
    parseUploadRequest(request),
    (error) => error instanceof ApiError
      && error.code === "INVALID_SLOT"
      && !error.message.includes("10"),
  );
});

test("CloudBase RPC receives the EdgeOne IP only in its server-side body", async () => {
  const originalFetch = globalThis.fetch;
  let sentUrl = "";
  let sentBody = "";
  globalThis.fetch = async (url, options) => {
    sentUrl = String(url);
    sentBody = options.body;
    assert.equal(options.headers.authorization, "Bearer public-part-onepublic-part-two");
    return Response.json({ items: [] });
  };
  const request = {
    url: "https://example.test/api/community-apertures",
    headers: new Headers(),
    eo: { clientIp: "203.0.113.42" },
  };
  assert.equal(getClientIp(request), "203.0.113.42");
  try {
    assert.deepEqual(await communityRequest(TEST_ENV, "mine", {}, request), { items: [] });
    assert.match(sentUrl, /\/v1\/rdb\/rest\/rpc\/diffraction_community_call$/);
    assert.equal(sentUrl.includes("203.0.113.42"), false);
    assert.deepEqual(JSON.parse(sentBody), {
      p_action: "mine",
      p_server_token: "server-only-test-token",
      p_client_ip: "203.0.113.42",
      p_payload: {},
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("community upload route reviews and writes through the scoped CloudBase RPC", async (context) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const body = JSON.parse(options.body);
    if (body.p_action === "review") {
      return Response.json({ terms: [{ term: "赌博", category: "gambling" }], blocked: false });
    }
    if (body.p_action === "upload") {
      const record = body.p_payload;
      return Response.json({ item: {
        id: "79811b15-1dc6-4fc4-8a58-148b301865af",
        slot: record.slot,
        nickname: record.nickname,
        patternName: record.patternName,
        preview: record.preview,
        created_at: "2026-08-10T08:00:00.000Z",
        updated_at: "2026-08-10T08:00:00.000Z",
      }, overwritten: false });
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
  const response = await onUploadPost({
    request,
    env: TEST_ENV,
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.equal(payload.item.patternName, "双圆孔");
  assert.equal(calls.at(-1).options.headers.authorization, "Bearer public-part-onepublic-part-two");
  assert.equal(JSON.parse(calls.at(-1).options.body).p_server_token, TEST_ENV.DIFFRACTION_SERVER_TOKEN);
  assert.equal(JSON.parse(calls.at(-1).options.body).p_client_ip, "203.0.113.9");
  assert.equal(calls.some((call) => call.url.includes("203.0.113.9")), false);
});

test("community upload route discards metadata rejected by moderation", async (context) => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => {
    requestCount += 1;
    return Response.json({ terms: [{ term: "赌博", category: "gambling" }], blocked: false });
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
  const response = await onUploadPost({
    request,
    env: TEST_ENV,
  });
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.error.code, "CONTENT_REJECTED");
  assert.equal(payload.error.message, "内容不符合上传要求，无法上传");
  assert.equal("details" in payload.error, false, "public response must not disclose filtering rules");
  assert.equal(requestCount, 1, "rejected metadata must not reach aperture insert queries");
});

test("onboarding claim shows only for the first visit and stores no raw IP", async (context) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  context.after(() => { globalThis.fetch = originalFetch; });
  let inserted = false;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (JSON.parse(options.body).p_action === "onboarding") {
      const show = !inserted;
      inserted = true;
      return Response.json({ show });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  async function claim() {
    const request = new Request("https://example.test/api/community-apertures/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body: "{}",
    });
    Object.defineProperty(request, "eo", { value: { clientIp: "203.0.113.77" } });
    const response = await onOnboardingPost({
      request,
      env: TEST_ENV,
    });
    return response.json();
  }

  assert.deepEqual(await claim(), { show: true });
  assert.deepEqual(await claim(), { show: false });
  const onboardingCalls = requests.filter((item) => JSON.parse(item.options.body).p_action === "onboarding");
  assert.equal(onboardingCalls.length, 2);
  assert.equal(onboardingCalls.some((item) => item.url.includes("203.0.113.77")), false);
  assert.equal(onboardingCalls.every((item) => JSON.parse(item.options.body).p_client_ip === "203.0.113.77"), true);
});
