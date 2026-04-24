import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { InventoryClient } from "./inventory-client";

export const metadata: Metadata = {
  title: "Inventory",
};

export default function InventoryPage() {
  return (
    <>
      <Breadcrumb pageName="Inventory" />
      <InventoryClient />
    </>
  );
}
