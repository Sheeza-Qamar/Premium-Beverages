import { LandingPage } from "@/components/landing/landing-page";
import { BRAND } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `${BRAND.name} — Premium beverages & trusted B2B supply`,
  description: `${BRAND.name} delivers quality packaged beverages, dependable wholesale supply, and partnership programs built on transparency, discipline, and service.`,
};

export default function Home() {
  return <LandingPage />;
}
