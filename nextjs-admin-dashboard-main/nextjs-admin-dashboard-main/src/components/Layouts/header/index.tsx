"use client";

import { SearchIcon } from "@/assets/icons";
import { Logo } from "@/components/logo";
import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";

export function Header() {
  const { toggleSidebar, isMobile } = useSidebarContext();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stroke/80 bg-white/95 px-3.5 py-3 backdrop-blur-sm dark:border-stroke-dark dark:bg-gray-dark/95 md:px-5 2xl:px-8">
      <button
        onClick={toggleSidebar}
        className="rounded-md border px-1.5 py-1 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] lg:hidden"
      >
        <MenuIcon />
        <span className="sr-only">Toggle Sidebar</span>
      </button>

      {isMobile && (
        <Link
          href="/dashboard"
          className="ml-2 max-[430px]:hidden min-[375px]:ml-4"
        >
          <Logo compact />
        </Link>
      )}

      <div className="max-xl:hidden">
        <h1 className="mb-0.5 text-xl font-semibold tracking-tight text-dark dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm font-medium text-dark-5 dark:text-dark-6">{BRAND.name}</p>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 min-[375px]:gap-4">
        <div className="relative w-full max-w-[280px]">
          <input
            type="search"
            placeholder="Search"
            className="flex h-10 w-full items-center gap-3 rounded-full border border-stroke/80 bg-gray-2/70 pl-11 pr-4 text-sm outline-none transition-colors focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary"
          />

          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2" />
        </div>

        <ThemeToggleSwitch />

        <div className="shrink-0">
          <UserInfo />
        </div>
      </div>
    </header>
  );
}
