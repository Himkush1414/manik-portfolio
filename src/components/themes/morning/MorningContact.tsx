"use client";

import { Reveal } from "@/components/ui/Reveal";
import { profile } from "@/data/content";
import { morningBodyFont, morningHeadingFont } from "./fonts";

export default function MorningContact() {
  return (
    <section id="contact" className="flex flex-col gap-6">
      <Reveal>
        <h2 className={`${morningHeadingFont.className} text-3xl font-semibold text-[#2E2A45] sm:text-4xl`}>
          Let&apos;s talk
        </h2>
      </Reveal>
      <Reveal delay={100}>
        <p className={`${morningBodyFont.className} max-w-xl text-lg text-[#2E2A45]/75`}>
          Have a project in mind or just want to say hello? My inbox is open.
        </p>
      </Reveal>
      <Reveal delay={200}>
        <a
          href={`mailto:${profile.email}`}
          className="w-fit rounded-full bg-[#FF7A59] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 hover:bg-[#FF6A45]"
        >
          {profile.email}
        </a>
      </Reveal>
    </section>
  );
}
