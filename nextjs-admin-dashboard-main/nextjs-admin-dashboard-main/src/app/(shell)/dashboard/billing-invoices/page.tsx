import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Orders",
};

/** Billing merged into Orders — old bookmarks still work. */
export default function BillingInvoicesPage() {
  redirect("/dashboard/orders");
}
