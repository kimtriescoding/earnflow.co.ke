import test from "node:test";
import assert from "node:assert/strict";
import { buildCommissionPlan } from "./commission-plan.js";

test("buildCommissionPlan uses fixed level amounts", () => {
  const plan = buildCommissionPlan({
    hierarchy: { uplineL1UserId: "u1", uplineL2UserId: "u2", uplineL3UserId: "u3" },
    rules: {
      level1: { enabled: true, amount: 100 },
      level2: { enabled: false, amount: 50 },
      level3: { enabled: true, amount: 25 },
    },
  });

  assert.equal(plan.length, 2);
  assert.deepEqual(plan[0], { level: 1, beneficiaryUserId: "u1", amount: 100 });
  assert.deepEqual(plan[1], { level: 3, beneficiaryUserId: "u3", amount: 25 });
});
