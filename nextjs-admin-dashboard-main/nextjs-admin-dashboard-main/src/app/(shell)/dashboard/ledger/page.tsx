import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { LedgerClient } from "./ledger-client";

export const metadata: Metadata = {
  title: "Ledger",
};

export default function LedgerPage() {
  return (
    <>
      <Breadcrumb pageName="Ledger" />
      <LedgerClient />
    </>
  );
}
