"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_DATA } from "./data";
import { ArrowLeftIcon, ChevronUp } from "./icons";
import { MenuItem } from "./menu-item";
import { useSidebarContext } from "./sidebar-context";

export function Sidebar() {
  const pathname = usePathname();
  const { setIsOpen, isOpen, isMobile, toggleSidebar } = useSidebarContext();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) => (prev.includes(title) ? [] : [title]));

    // Uncomment the following line to enable multiple expanded items
    // setExpandedItems((prev) =>
    //   prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    // );
  };

  useEffect(() => {
    // Keep collapsible open, when it's subpage is active
    NAV_DATA.some((section) => {
      return section.items.some((item) => {
        const subItems = item.items as Array<{ url: string }>;
        if (subItems.length === 0) {
          return false;
        }
        return subItems.some((subItem) => {
          if (subItem.url === pathname) {
            if (!expandedItems.includes(item.title)) {
              toggleExpanded(item.title);
            }

            // Break the loop
            return true;
          }
        });
      });
    });
  }, [pathname]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "max-w-[290px] overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 ease-linear dark:border-gray-800 dark:bg-gray-dark",
          isMobile ? "fixed bottom-0 top-0 z-50" : "sticky top-0 h-screen",
          isOpen ? "w-full" : "w-0",
        )}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="flex h-full flex-col pt-3 pb-6 pl-[25px] pr-[7px] min-[850px]:pt-4 min-[850px]:pb-8">
          <div className="relative pr-4.5">
            <Link
              href="/dashboard"
              onClick={() => isMobile && toggleSidebar()}
              className="inline-block"
            >
              <Logo />
            </Link>

            {isMobile && (
              <button
                onClick={toggleSidebar}
                className="absolute left-3/4 right-4.5 top-1/2 -translate-y-1/2 text-right"
              >
                <span className="sr-only">Close Menu</span>

                <ArrowLeftIcon className="ml-auto size-7" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="custom-scrollbar mt-3 flex-1 overflow-y-auto pr-3 min-[850px]:mt-4">
            {NAV_DATA.map((section) => (
              <div key={section.label} className="mb-6">
                <h2 className="mb-3 text-sm font-medium text-dark-4 dark:text-dark-6">
                  {section.label}
                </h2>

                <nav role="navigation" aria-label={section.label}>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li key={item.title}>
                        {item.items.length ? (
                          (() => {
                            const subItems = item.items as Array<{ title: string; url: string }>;
                            return (
                              <div>
                                <MenuItem
                                  isActive={subItems.some(({ url }) =>
                                    url === "/dashboard"
                                      ? pathname === "/dashboard"
                                      : pathname === url ||
                                      pathname.startsWith(`${url}/`),
                                  )}
                                  onClick={() => toggleExpanded(item.title)}
                                >
                                  <item.icon
                                    className="size-6 shrink-0"
                                    aria-hidden="true"
                                  />

                                  <span>{item.title}</span>

                                  <ChevronUp
                                    className={cn(
                                      "ml-auto rotate-180 transition-transform duration-200",
                                      expandedItems.includes(item.title) &&
                                      "rotate-0",
                                    )}
                                    aria-hidden="true"
                                  />
                                </MenuItem>

                                {expandedItems.includes(item.title) && (
                                  <ul
                                    className="ml-9 mr-0 space-y-1.5 pb-[15px] pr-0 pt-2"
                                    role="menu"
                                  >
                                    {subItems.map((subItem) => (
                                      <li key={subItem.title} role="none">
                                        <MenuItem
                                          as="link"
                                          href={subItem.url}
                                          isActive={
                                            subItem.url === "/dashboard"
                                              ? pathname === "/dashboard"
                                              : pathname === subItem.url ||
                                              pathname.startsWith(
                                                `${subItem.url}/`,
                                              )
                                          }
                                        >
                                          <span>{subItem.title}</span>
                                        </MenuItem>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          (() => {
                            const href = (item as { url: string }).url;

                            return (
                              <MenuItem
                                className="flex items-center gap-3 py-3"
                                as="link"
                                href={href}
                                isActive={
                                  href === "/dashboard"
                                    ? pathname === "/dashboard"
                                    : pathname === href ||
                                    pathname.startsWith(`${href}/`)
                                }
                              >
                                <item.icon
                                  className="size-6 shrink-0"
                                  aria-hidden="true"
                                />

                                <span>{item.title}</span>
                              </MenuItem>
                            );
                          })()
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
