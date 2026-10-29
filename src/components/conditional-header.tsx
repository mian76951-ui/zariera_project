"use client";

import { usePathname } from "next/navigation";
import { Marquee } from "./marquee";
import { SiteHeader } from "./site-header";

// The auth screens (login / register …) hide the store chrome (marquee, header,
// footer) so they read as clean, immersive full-screen pages with their own back link.
const AUTH_SCREENS = ["/login", "/register", "/register/verify", "/forgot-password", "/reset-password", "/account/verify-email"];

export function useIsAuthScreen(): boolean {
  return AUTH_SCREENS.includes(usePathname());
}

export function ConditionalHeader({ announcements }: { announcements: string[] }) {
  if (useIsAuthScreen()) return null;
  return (
    <>
      <Marquee items={announcements} />
      <SiteHeader />
    </>
  );
}
