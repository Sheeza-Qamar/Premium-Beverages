import { redirect } from "next/navigation";

/** @deprecated Use `/dashboard/settings` — kept for bookmarks. */
export default function LegacySettingsRedirect() {
  redirect("/dashboard/settings");
}
