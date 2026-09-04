"use client";

import Strands from "@/components/effects/Strands";
import { Reveal } from "@/components/ui/Reveal";
import { morningBrushFont } from "./fonts";

export default function MorningHero() {
  return (
    <section id="home" className="relative h-[60vh] min-h-[420px] max-h-[640px] w-full">
      <Reveal className="h-full w-full">
        <Strands
          colors={["#FFD98E", "#FF7A59", "#8ED1FC"]}
          count={3}
          speed={0.35}
          amplitude={1.2}
          waviness={1.1}
          thickness={0.4}
          glow={4}
          taper={2.5}
          spread={1.6}
          intensity={0.3}
          saturation={1.8}
          opacity={0.85}
          scale={2.8}
          glass={false}
          refraction={1}
          dispersion={1}
          glassSize={1}
          hueShift={0}
        />
      </Reveal>

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
        <Reveal delay={150}>
          <h1
            className={`${morningBrushFont.className} text-center text-6xl text-[#1A1A1A] sm:text-8xl md:text-9xl`}
          >
            Manik Rana
          </h1>
        </Reveal>
      </div>
    </section>
  );
}
