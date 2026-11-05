import { HistoryIcon, LayoutGridIcon, SlidersHorizontalIcon, UploadCloudIcon } from "lucide-react";

/** The one navigation definition used by Navbar and MobileNav (order per UI_BLUEPRINT §2). */
export const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutGridIcon },
  { href: "/runs", label: "Runs", icon: HistoryIcon },
  { href: "/import", label: "Import", icon: UploadCloudIcon },
  { href: "/settings", label: "Settings", icon: SlidersHorizontalIcon },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];

/** "/" is active only on the exact path; other links are active on their path and sub-paths. */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
