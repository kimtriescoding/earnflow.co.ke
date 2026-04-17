export function formatCurrency(value, currency = "KES") {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(Number(value || 0));
}
