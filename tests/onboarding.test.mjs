import assert from "node:assert/strict";
import test from "node:test";
import { calculateTourPlacement, ONBOARDING_STEPS } from "../src/core/onboarding.js";

test("onboarding covers the seven requested controls", () => {
  assert.equal(ONBOARDING_STEPS.length, 7);
  assert.deepEqual(
    ONBOARDING_STEPS.map((step) => step.id),
    ["draw", "selection", "repeat", "function", "community", "local-save", "export"],
  );
  for (const step of ONBOARDING_STEPS) assert.match(step.selector, /^\[data-tour=/);
});

test("tour panel stays within desktop and mobile viewports", () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 360, height: 740 }]) {
    for (const rect of [
      { left: 4, top: 4, right: 52, bottom: 48, width: 48, height: 44 },
      { left: viewport.width - 74, top: viewport.height - 60, right: viewport.width - 8, bottom: viewport.height - 12, width: 66, height: 48 },
    ]) {
      const placement = calculateTourPlacement(rect, viewport, { width: 340, height: 206 });
      assert.ok(placement.left >= 12);
      assert.ok(placement.top >= 12);
      assert.ok(placement.left + placement.width <= viewport.width - 12);
      assert.ok(placement.top + 206 <= viewport.height - 12);
    }
  }
});
