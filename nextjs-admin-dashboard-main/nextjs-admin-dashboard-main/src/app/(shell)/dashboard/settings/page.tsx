import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { PersonalInfoForm } from "./_components/personal-info";

export const metadata: Metadata = {
  title: "Settings",
  description: "Premium Beverages ERP — account profile",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Breadcrumb pageName="Settings" />

      <PersonalInfoForm />
    </div>
  );
}
