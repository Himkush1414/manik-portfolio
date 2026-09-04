"use client";

import Strands from "@/components/effects/Strands";
import { Reveal } from "@/components/ui/Reveal";

export default function MorningHero() {
  return (
    <section id="home" className="relative h-[60vh] min-h-[420px] max-h-[640px] w-full">
      <Reveal className="h-full w-full">
        <Strands
          colors={["#FFD98E", "#FF7A59", "#8ED1FC"]}
          count={3}
          speed={0.35}
          amplitude={1.4}
          waviness={0.8}
          thickness={0.4}
          glow={1.1}
          taper={2.5}
          spread={1.6}
          intensity={0.3}
          saturation={1.4}
          opacity={0.8}
          scale={1.6}
          glass={false}
          refraction={1}
          dispersion={1}
          glassSize={1}
          hueShift={0}
        />
      </Reveal>
    </section>
  );
}
