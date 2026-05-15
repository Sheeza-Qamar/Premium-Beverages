/**
 * When an order is fully paid and production has caught up to ordered qty,
 * show "completed" even if the DB row is still "pending" (manual status lag).
 */
export type OrderLikeForStatusDisplay = {
  status: string;
  outstandingAmount: number;
  orderedQty: number;
  producedQty: number;
};

export function getDisplayOrderStatus(
  o: OrderLikeForStatusDisplay,
): "pending" | "completed" | "cancelled" {
  if (o.status === "cancelled") return "cancelled";
  const paidUp = o.outstandingAmount <= 0.0001;
  const producedEnough =
    o.orderedQty <= 0 ? true : o.producedQty + 1e-6 >= o.orderedQty;
  if (paidUp && producedEnough) return "completed";
  if (o.status === "completed") return "completed";
  return "pending";
}
