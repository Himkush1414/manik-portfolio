"use client";

import { Reveal } from "@/components/ui/Reveal";
import { profile } from "@/data/content";
import { morningBodyFont, morningHeadingFont } from "./fonts";

export default function MorningAbout() {
  return (
    <section id="about" className="flex flex-col gap-6">
      <Reveal>
        <h2 className={`${morningHeadingFont.className} text-3xl font-semibold text-[#2E2A45] sm:text-4xl`}>
          About
        </h2>
      </Reveal>
      <Reveal delay={100}>
        <p className={`${morningBodyFont.className} max-w-2xl text-lg leading-relaxed text-[#2E2A45]/75`}>
          {profile.about}
        </p>
      </Reveal>
    </section>
  );
}
