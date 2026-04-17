import test from "node:test";
import assert from "node:assert/strict";
import { computeAcademicOrderPricing, computeChatOrderPricing, computeVideoOrderPricing } from "./pricing.js";

test("computeVideoOrderPricing enforces min target views", () => {
  const pricing = computeVideoOrderPricing({ targetViews: 10, pricePerView: 0.5, minimumViews: 200 });
  assert.equal(pricing.targetViews, 200);
  assert.equal(pricing.totalAmount, 100);
});

test("computeChatOrderPricing includes setup fee", () => {
  const pricing = computeChatOrderPricing({ requestedMinutes: 20, pricePerMinute: 2, setupFee: 50 });
  assert.equal(pricing.subtotalAmount, 40);
  assert.equal(pricing.totalAmount, 90);
});

test("computeAcademicOrderPricing applies urgent multiplier", () => {
  const pricing = computeAcademicOrderPricing({
    wordCount: 750,
    basePrice: 300,
    pricePer100Words: 100,
    urgent: true,
    urgentMultiplier: 2,
  });
  assert.equal(pricing.subtotalAmount, 1100);
  assert.equal(pricing.totalAmount, 2200);
});
