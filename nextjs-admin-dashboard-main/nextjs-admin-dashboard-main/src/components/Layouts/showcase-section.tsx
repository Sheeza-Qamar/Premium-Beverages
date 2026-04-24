import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PropsType = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function ShowcaseSection({ title, children, className }: PropsType) {
  return (
    <div className="rounded-xl border border-stroke/80 bg-white shadow-sm dark:border-dark-3 dark:bg-gray-dark">
      <h2 className="border-b border-stroke/80 px-4 py-3 text-sm font-semibold tracking-tight text-dark dark:border-dark-3 dark:text-white sm:px-5 xl:px-6">
        {title}
      </h2>

      <div className={cn("p-4 sm:p-5 xl:p-6", className)}>{children}</div>
    </div>
  );
}
