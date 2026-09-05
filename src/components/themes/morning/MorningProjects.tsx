"use client";

import { useEffect, useRef } from "react";
import { morningDisplayFont } from "./fonts";
import MorningProjectShowcase from "./MorningProjectShowcase";
import MorningProjectsSystem from "./MorningProjectsSystem";

const HEADLINE = "NIGHTMARE";

export default function MorningProjects() {
  const headlineRef = useRef<HTMLHeadingElement>(null);

  // Scroll-linked drift: after the letters land, "NIGHTMARE" translates
  // upward faster than the page scrolls and fades out as the Ciridae
  // section below takes over. Values are written to CSS custom properties
  // so scrolling never triggers a React re-render.
  useEffect(() => {
    const el = headlineRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      el.style.setProperty("--nm-shift", `${(-y * 0.4).toFixed(1)}px`);
      el.style.setProperty("--nm-fade", Math.max(0, 1 - y / 600).toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black px-2">
        <h1
          ref={headlineRef}
          aria-label={HEADLINE}
          className={`${morningDisplayFont.className} nm-headline w-full select-none text-center font-black uppercase leading-none tracking-[-0.04em] text-[#F5F3EC] text-[15vw]`}
        >
          {HEADLINE.split("").map((char, i) => (
            <span
              key={i}
              aria-hidden
              className="nm-char"
              style={{ animationDelay: `${80 + i * 65}ms` }}
            >
              {char}
            </span>
          ))}
        </h1>
      </section>

      <MorningProjectsSystem />
      <MorningProjectShowcase />
    </>
  );
}
