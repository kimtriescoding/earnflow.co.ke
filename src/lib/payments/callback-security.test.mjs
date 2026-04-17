import test from "node:test";
import assert from "node:assert/strict";
import { validateActivationPayment, validateClientOrderPayment } from "./callback-security.js";

test("validateActivationPayment passes on exact amount and references", () => {
  const result = validateActivationPayment(
    { amount: 1000, paymentKey: "pk-1", reference: "ACT-1" },
    { amount: 1000, paymentKey: "pk-1", reference: "ACT-1" },
    1000
  );
  assert.equal(result.ok, true);
});

test("validateActivationPayment fails on underpayment", () => {
  const result = validateActivationPayment(
    { amount: 1000, paymentKey: "pk-1", reference: "ACT-1" },
    { amount: 2, paymentKey: "pk-1", reference: "ACT-1" },
    1000
  );
  assert.equal(result.ok, false);
  assert.equal(result.amountMatches, false);
});

test("validateActivationPayment fails when callback omits paymentKey", () => {
  const result = validateActivationPayment(
    { amount: 500, paymentKey: "pk-x", reference: "ACT-9" },
    { amount: 500, reference: "ACT-9" },
    500
  );
  assert.equal(result.ok, false);
  assert.equal(result.paymentKeyMatches, false);
});

test("validateActivationPayment fails when stored paymentKey missing", () => {
  const result = validateActivationPayment(
    { amount: 500, reference: "ACT-9" },
    { amount: 500, paymentKey: "pk-x", reference: "ACT-9" },
    500
  );
  assert.equal(result.ok, false);
});

test("validateClientOrderPayment passes when amount and keys match", () => {
  const result = validateClientOrderPayment(
    { totalAmount: 250, paymentKey: "pk-o", paymentReference: "ORD-1" },
    { amount: 250, paymentKey: "pk-o", reference: "ORD-1" }
  );
  assert.equal(result.ok, true);
});

test("validateClientOrderPayment fails on amount mismatch", () => {
  const result = validateClientOrderPayment(
    { totalAmount: 250, paymentKey: "pk-o", paymentReference: "ORD-1" },
    { amount: 100, paymentKey: "pk-o", reference: "ORD-1" }
  );
  assert.equal(result.ok, false);
});
