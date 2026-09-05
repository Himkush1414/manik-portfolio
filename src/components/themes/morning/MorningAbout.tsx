"use client";

import StaggeredGrid from "@/components/ui/staggered-grid";
import { aboutBentoItems, aboutImages } from "@/data/aboutContent";
import { morningDisplayFont } from "./fonts";

// The About page hosts the Staggered Grid on the site's black canvas.
export default function MorningAbout() {
  return (
    <main id="about" className="relative w-full pb-[12vh] pt-[88px]">
      <StaggeredGrid
        images={aboutImages}
        bentoItems={aboutBentoItems}
        centerText="CODE"
        showFooter={false}
        className={`${morningDisplayFont.className} mx-auto max-w-[1200px] px-4`}
      />
    </main>
  );
}
