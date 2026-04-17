import test from "node:test";
import assert from "node:assert/strict";
import speakeasy from "speakeasy";
import { generateTotpSecret, verifyTotp, generateBackupCodes, hashBackupCode } from "./totp.js";

test("generateTotpSecret returns base32-compatible string", () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]+$/);
});

test("backup code hashing is deterministic", () => {
  const [code] = generateBackupCodes(1);
  assert.equal(hashBackupCode(code), hashBackupCode(code));
});

test("verifyTotp rejects malformed token", () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotp({ secret, token: "abc" }), false);
});

test("verifyTotp accepts current speakeasy.totp code with base32 secret", () => {
  const secret = generateTotpSecret();
  const token = speakeasy.totp({
    secret,
    encoding: "base32",
    algorithm: "sha1",
    digits: 6,
    step: 30,
  });
  assert.equal(verifyTotp({ secret, token }), true);
});
