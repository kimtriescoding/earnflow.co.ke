function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function computeVideoOrderPricing({ targetViews, pricePerView, minimumViews = 1 }) {
  const normalizedViews = Math.max(Math.floor(toNumber(targetViews, minimumViews)), Math.floor(toNumber(minimumViews, 1)));
  const unitPrice = Math.max(toNumber(pricePerView, 0), 0);
  const subtotal = Number((normalizedViews * unitPrice).toFixed(2));
  return {
    targetViews: normalizedViews,
    unitPrice,
    subtotalAmount: subtotal,
    totalAmount: subtotal,
  };
}

export function computeChatOrderPricing({ requestedMinutes, pricePerMinute, setupFee = 0 }) {
  const minutes = Math.max(Math.floor(toNumber(requestedMinutes, 10)), 1);
  const minutePrice = Math.max(toNumber(pricePerMinute, 0), 0);
  const fee = Math.max(toNumber(setupFee, 0), 0);
  const subtotal = Number((minutes * minutePrice).toFixed(2));
  const total = Number((subtotal + fee).toFixed(2));
  return {
    requestedMinutes: minutes,
    unitPrice: minutePrice,
    subtotalAmount: subtotal,
    setupFee: fee,
    totalAmount: total,
  };
}

export function computeAcademicOrderPricing({
  wordCount,
  basePrice,
  pricePer100Words,
  urgent = false,
  urgentMultiplier = 1.5,
}) {
  const words = Math.max(Math.floor(toNumber(wordCount, 500)), 100);
  const base = Math.max(toNumber(basePrice, 0), 0);
  const per100 = Math.max(toNumber(pricePer100Words, 0), 0);
  const units = Math.ceil(words / 100);
  const subtotal = Number((base + units * per100).toFixed(2));
  const multiplier = urgent ? Math.max(toNumber(urgentMultiplier, 1.5), 1) : 1;
  const total = Number((subtotal * multiplier).toFixed(2));
  return {
    wordCount: words,
    unitPrice: per100,
    subtotalAmount: subtotal,
    totalAmount: total,
    urgent,
    urgentMultiplier: multiplier,
  };
}
