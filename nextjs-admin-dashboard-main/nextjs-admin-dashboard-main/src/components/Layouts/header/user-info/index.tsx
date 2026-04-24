"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon, SettingsIcon, UserIcon } from "./icons";

function AvatarPlaceholder() {
  return (
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
      aria-hidden
    >
      <UserIcon className="size-5" />
    </span>
  );
}

export function UserInfo() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [USER, setUser] = useState({
    name: "Guest User",
    email: "guest@example.com",
  });

  useEffect(() => {
    const loadSessionUser = async () => {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        user: { name: string; email: string };
      };
      setUser((prev) => ({ ...prev, ...payload.user }));
    };
    void loadSessionUser();
    const onProfileUpdated = () => void loadSessionUser();
    window.addEventListener("erp-profile-updated", onProfileUpdated);
    return () => window.removeEventListener("erp-profile-updated", onProfileUpdated);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/sign-in");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
      setIsOpen(false);
    }
  };

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">My Account</span>

        <figure className="flex items-center gap-3">
          <AvatarPlaceholder />
          <figcaption className="flex items-center gap-1 font-medium text-dark dark:text-dark-6 max-[1024px]:sr-only">
            <span>{USER.name}</span>

            <ChevronUpIcon
              aria-hidden
              className={cn(
                "rotate-180 transition-transform",
                isOpen && "rotate-0",
              )}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-[230px]:min-w-[17.5rem]"
        align="end"
      >
        <h2 className="sr-only">User information</h2>

        <div className="flex items-center gap-2.5 px-5 py-3.5">
          <AvatarPlaceholder />
          <div className="min-w-0 space-y-1 text-base font-medium">
            <div className="mb-2 truncate leading-none text-dark dark:text-white">{USER.name}</div>
            <div className="truncate leading-none text-gray-6">{USER.email}</div>
          </div>
        </div>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6 [&>*]:cursor-pointer">
          <Link
            href="/dashboard/settings"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <SettingsIcon />
            <span className="mr-auto text-base font-medium">Account Settings</span>
          </Link>
        </div>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOutIcon />
            <span className="text-base font-medium">
              {isLoggingOut ? "Logging out..." : "Log out"}
            </span>
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
