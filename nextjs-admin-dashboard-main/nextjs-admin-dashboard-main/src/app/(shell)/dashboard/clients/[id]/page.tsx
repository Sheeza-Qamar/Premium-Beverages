import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { ClientDetailClient } from "./client-detail-client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Client #${id}` };
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <Breadcrumb pageName="Client details" />
      <ClientDetailClient clientId={id} />
    </>
  );
}
