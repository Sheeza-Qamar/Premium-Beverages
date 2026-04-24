import type { Metadata } from "next";
import { ClientCardView } from "./view";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Client Card",
};

export default async function ClientCardPage({ params }: Props) {
  const { token } = await params;
  return <ClientCardView token={token} />;
}
