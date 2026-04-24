import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { ExpensesClient } from "./expenses-client";

export const metadata: Metadata = {
  title: "Expense Management",
};

export default function ExpensesPage() {
  return (
    <>
      <Breadcrumb pageName="Expense Management" />
      <ExpensesClient />
    </>
  );
}
