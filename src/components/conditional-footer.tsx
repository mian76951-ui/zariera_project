"use client";

import { SiteFooter } from "./site-footer";
import { useIsAuthScreen } from "./conditional-header";
import type { StoreSettings } from "@/lib/settings-shared";

export function ConditionalFooter({ settings }: { settings: StoreSettings }) {
  if (useIsAuthScreen()) return null;
  return <SiteFooter settings={settings} />;
}
