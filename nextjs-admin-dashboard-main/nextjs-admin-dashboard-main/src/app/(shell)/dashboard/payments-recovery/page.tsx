import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Orders",
};

/** Payments merged into Orders — old bookmarks still work. */
export default function PaymentsRecoveryPage() {
  redirect("/dashboard/orders");
}
