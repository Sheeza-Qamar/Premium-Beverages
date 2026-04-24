"use client";

import { SidebarProvider } from "@/components/Layouts/sidebar/sidebar-context";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="premium-beverages-theme"
      disableTransitionOnChange
    >
      <SidebarProvider>{children}</SidebarProvider>
    </ThemeProvider>
  );
}
