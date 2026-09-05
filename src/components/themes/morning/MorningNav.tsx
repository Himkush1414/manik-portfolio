"use client";

import Link from "next/link";
import { navLinks, profile } from "@/data/content";
import { morningHeadingFont } from "./fonts";

export default function MorningNav() {
  return (
    <nav className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-2xl items-center justify-between gap-4 rounded-full border border-white/50 bg-white/35 px-5 py-2.5 shadow-[0_8px_30px_rgba(255,159,104,0.15)] backdrop-blur-xl">
        <Link href="/" className={`${morningHeadingFont.className} text-base font-semibold text-[#2E2A45]`}>
          {profile.name}
        </Link>
        <ul className="hidden items-center gap-6 sm:flex">
          {navLinks.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm font-medium text-[#2E2A45]/75 transition-colors hover:text-[#FF7A59]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/contact"
          className="rounded-full bg-[#FF7A59] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 hover:bg-[#FF6A45]"
        >
          Say hi
        </Link>
      </div>
    </nav>
  );
}
