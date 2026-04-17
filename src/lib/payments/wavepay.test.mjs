import test from "node:test";
import assert from "node:assert/strict";
import { createAuthorizationKey } from "./wavepay.js";

test("createAuthorizationKey creates base64 payload", () => {
  const key = createAuthorizationKey({
    publicKey: "pub",
    privateKey: "priv",
    amount: 100,
    walletId: "wallet",
    identifier: "abc",
    timestamp: 1700000000000,
  });
  const decoded = JSON.parse(Buffer.from(key, "base64").toString("utf8"));
  assert.equal(decoded.publicKey, "pub");
  assert.equal(decoded.privateKey, "priv");
  assert.equal(decoded.amount, 100);
  assert.equal(decoded.walletId, "wallet");
  assert.equal(decoded.identifier, "abc");
  assert.equal(decoded.timestamp, 1700000000000);
});
