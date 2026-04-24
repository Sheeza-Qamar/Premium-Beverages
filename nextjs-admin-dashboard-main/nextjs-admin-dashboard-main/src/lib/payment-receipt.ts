export function toIsoDateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

export function buildPaymentReceiptNumber(paymentId: number, paymentDate: string | Date): string {
  const datePart = toIsoDateOnly(paymentDate).replaceAll("-", "");
  return `PR-${datePart}-${String(paymentId).padStart(6, "0")}`;
}
