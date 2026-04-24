import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { BillingInvoicesClient } from "./billing-invoices-client";

export const metadata: Metadata = {
  title: "Billing & Invoices",
};

export default function BillingInvoicesPage() {
  return (
    <>
      <Breadcrumb pageName="Billing & Invoices" />
      <BillingInvoicesClient />
    </>
  );
}
