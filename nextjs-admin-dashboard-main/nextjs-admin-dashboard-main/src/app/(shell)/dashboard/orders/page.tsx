import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { OrdersClient } from "./orders-client";

export const metadata: Metadata = {
  title: "Orders",
};

export default function OrdersPage() {
  return (
    <>
      <Breadcrumb pageName="Orders" />
      <OrdersClient />
    </>
  );
}
