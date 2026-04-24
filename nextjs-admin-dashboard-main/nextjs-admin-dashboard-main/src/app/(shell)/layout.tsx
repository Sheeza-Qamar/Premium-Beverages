import { Header } from "@/components/Layouts/header";
import { Sidebar } from "@/components/Layouts/sidebar";
import type { PropsWithChildren } from "react";

export default function ShellLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="w-full bg-gray-2/70 dark:bg-[#07131b]">
        <Header />

        <main className="isolate mx-auto w-full max-w-screen-2xl overflow-hidden p-3.5 md:p-5 2xl:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
