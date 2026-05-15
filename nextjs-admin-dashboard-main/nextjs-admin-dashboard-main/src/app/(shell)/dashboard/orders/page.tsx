import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { OrdersClient } from "./orders-client";

export const metadata: Metadata = {
  title: "Orders & payments",
};

export default function OrdersPage() {
  return (
    <>
      <Breadcrumb pageName="Orders & payments" />
      <OrdersClient />
    </>
  );
}
