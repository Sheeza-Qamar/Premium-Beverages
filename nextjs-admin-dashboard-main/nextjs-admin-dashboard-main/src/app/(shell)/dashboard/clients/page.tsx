import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { ClientsClient } from "./clients-client";

export const metadata: Metadata = {
  title: "Clients",
};

export default function ClientsPage() {
  return (
    <>
      <Breadcrumb pageName="Clients" />
      <ClientsClient />
    </>
  );
}
