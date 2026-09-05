"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

// Site-wide chrome (footer watermark + theme switcher). Individual project
// pages (/projects/[slug]) are a fully custom full-screen layout, so they get
// none of it.
export function SiteChrome() {
  const pathname = usePathname() ?? "";
  const isProjectDetail = /^\/projects\/[^/]+$/.test(pathname);
  if (isProjectDetail) return null;

  return (
    <>
      <SiteFooter />
      <ThemeSwitcher />
    </>
  );
}

export default SiteChrome;
