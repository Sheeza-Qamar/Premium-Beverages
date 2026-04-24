import "@/css/satoshi.css";
import "@/css/style.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import { BRAND } from "@/lib/brand";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    template: `%s | ${BRAND.name}`,
    default: BRAND.name,
  },
  description: `${BRAND.name} — inventory, production, and sales.`,
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <NextTopLoader color={BRAND.primaryHex} showSpinner={false} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
