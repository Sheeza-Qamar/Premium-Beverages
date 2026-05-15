import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { SupportGuidelineClient } from "./support-guideline-client";

export const metadata: Metadata = {
  title: "Support & guideline",
};

export default function SupportGuidelinePage() {
  return (
    <>
      <Breadcrumb pageName="Support & guideline" />
      <SupportGuidelineClient />
    </>
  );
}
