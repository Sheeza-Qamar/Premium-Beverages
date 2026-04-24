import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { FirstAdminClient } from "./first-admin-client";

export const metadata: Metadata = {
  title: "Create first admin",
};

export default function FirstAdminPage() {
  return (
    <>
      <Breadcrumb pageName="First administrator" />
      <FirstAdminClient />
    </>
  );
}
