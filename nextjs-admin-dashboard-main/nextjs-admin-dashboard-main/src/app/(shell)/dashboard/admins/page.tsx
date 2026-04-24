import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { AdminsClient } from "./admins-client";

export const metadata: Metadata = {
  title: "Administrators",
};

export default function AdminsPage() {
  return (
    <>
      <Breadcrumb pageName="Administrators" />
      <AdminsClient />
    </>
  );
}
