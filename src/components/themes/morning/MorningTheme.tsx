"use client";

import GhostFibers from "@/components/effects/GhostFibers";
import { morningBodyFont } from "./fonts";
import MorningAbout from "./MorningAbout";
import MorningContact from "./MorningContact";
import MorningHero from "./MorningHero";
import MorningNav from "./MorningNav";
import MorningProjects from "./MorningProjects";

export type MorningSection = "home" | "projects" | "about" | "contact";

export default function MorningTheme({ section }: { section: MorningSection }) {
  // The Projects page has its own full-bleed identity: solid black, no
  // sunrise gradient, no GhostFibers/Strands — just the nav and the headline.
  if (section === "projects") {
    return (
      <div className={`${morningBodyFont.className} relative min-h-screen overflow-x-hidden bg-black text-white`}>
        <MorningNav />
        <MorningProjects />
      </div>
    );
  }

  return (
    <div className={`${morningBodyFont.className} relative min-h-screen overflow-x-hidden text-[#2E2A45]`}>
      {/* sunrise gradient backdrop */}
      <div className="fixed inset-0 -z-30 bg-gradient-to-b from-[#FFF3D6] via-[#FFCE9C] to-[#8ED1FC]" />

      {/* soft drifting cloud silhouettes */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <div className="absolute -left-20 top-16 h-40 w-96 rounded-full bg-white/40 blur-3xl animate-drift-slow" />
        <div className="absolute right-0 top-40 h-32 w-80 rounded-full bg-white/30 blur-3xl animate-drift-slower" />
        <div className="absolute left-1/3 top-72 h-24 w-72 rounded-full bg-white/25 blur-2xl animate-drift-slow" />
      </div>

      {/* animated fiber texture, blended over the gradient */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 mix-blend-multiply opacity-60">
        <GhostFibers
          lineColor="#FF9F68"
          glowColor="#8ED1FC"
          lightMode
          speed={0.12}
          scale={2.4}
          rotationSpeed={0.08}
          layers={4}
          waveAmplitude={0.02}
          brightness={1.6}
          vignette={0.3}
          grain={0.03}
          blueBoost={1}
        />
      </div>

      <MorningNav />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 sm:px-10">
        {section === "home" && <MorningHero />}
        {section === "about" && <MorningAbout />}
        {section === "contact" && <MorningContact />}
      </main>
    </div>
  );
}
