"use client";

import { Reveal } from "@/components/ui/Reveal";
import { profile } from "@/data/content";
import { morningBodyFont, morningHeadingFont } from "./fonts";

export default function MorningHero() {
  return (
    <section id="home" className="flex min-h-[70vh] flex-col justify-center gap-6 pt-24">
      <Reveal>
        <p className={`${morningBodyFont.className} text-sm font-semibold uppercase tracking-[0.2em] text-[#FF7A59]`}>
          Good morning
        </p>
      </Reveal>
      <Reveal delay={100}>
        <h1 className={`${morningHeadingFont.className} text-4xl font-semibold leading-tight text-[#2E2A45] sm:text-6xl`}>
          {profile.fullName}
        </h1>
      </Reveal>
      <Reveal delay={200}>
        <p className={`${morningBodyFont.className} max-w-xl text-lg text-[#2E2A45]/75 sm:text-xl`}>
          {profile.tagline}
        </p>
      </Reveal>
      <Reveal delay={300}>
        <div className="flex flex-wrap gap-4 pt-2">
          <a
            href="#projects"
            className="rounded-full bg-[#2E2A45] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-105"
          >
            View my work
          </a>
          <a
            href="#contact"
            className="rounded-full border border-[#2E2A45]/20 bg-white/40 px-6 py-3 text-sm font-semibold text-[#2E2A45] backdrop-blur transition-transform hover:scale-105"
          >
            Get in touch
          </a>
        </div>
      </Reveal>
    </section>
  );
}
