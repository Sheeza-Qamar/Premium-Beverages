import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { PaymentsRecoveryClient } from "./payments-recovery-client";

export const metadata: Metadata = {
  title: "Payments & Recovery",
};

export default function PaymentsRecoveryPage() {
  return (
    <>
      <Breadcrumb pageName="Payments & Recovery" />
      <PaymentsRecoveryClient />
    </>
  );
}
