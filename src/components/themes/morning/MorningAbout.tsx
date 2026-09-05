"use client";

import { morningHeadingFont } from "./fonts";

// Placeholder stub — content to be designed in a later pass.
export default function MorningAbout() {
  return (
    <section id="about" className="flex flex-col items-center gap-3 text-center">
      <h1 className={`${morningHeadingFont.className} text-4xl font-semibold text-[#2E2A45] sm:text-5xl`}>
        About
      </h1>
      <p className={`text-sm font-medium uppercase tracking-[0.2em] text-[#2E2A45]/50`}>
        Coming soon
      </p>
    </section>
  );
}
