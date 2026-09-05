"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Staggered Grid — a reveal-on-scroll effect: the centre word rises into place
 * character by character (from the middle out), then a 7-column icon grid
 * staggers up column by column (also middle out), with a small "bento" cluster
 * of expandable cards in the centre.
 *
 * Ported from the VengeanceUI registry item. Adapted for this project: the
 * `imagesloaded` / `react-icons` deps are dropped, the GSAP + ScrollTrigger
 * choreography is replaced with an IntersectionObserver + CSS-transition
 * stagger, and the zinc/neutral light palette is swapped for the site's black
 * + glass tones.
 */

export interface BentoItem {
  id: number | string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
}

export interface StaggeredGridProps {
  /** Only the length matters — grid tiles are icon cards, not photos. */
  images: string[];
  bentoItems: BentoItem[];
  centerText?: string;
  className?: string;
  showFooter?: boolean;
  credits?: {
    madeBy: { text: string; href: string };
    moreDemos: { text: string; href: string };
  };
}

function LayersGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

function BracketsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M8 4H6a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

function NodesGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8 7.5 16 16.5M8.3 6H15.7M18 8.5v7" />
    </svg>
  );
}

const GRID_CARDS = [
  { Icon: LayersGlyph, label: "Interfaces" },
  { Icon: BracketsGlyph, label: "Systems" },
  { Icon: NodesGlyph, label: "Tooling" },
];

const COLUMNS = 7;
const MIDDLE_COLUMN = Math.floor(COLUMNS / 2);
const TOTAL_TILES = 21;
const BENTO_INDEX = 16;

function useInView<T extends Element>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, inView };
}

export function StaggeredGrid({
  images,
  bentoItems,
  centerText = "CODE",
  className,
  showFooter = false,
  credits,
}: StaggeredGridProps) {
  const { ref: textRef, inView: textIn } = useInView<HTMLDivElement>("0px 0px -5% 0px");
  const { ref: gridRef, inView: gridIn } = useInView<HTMLDivElement>();
  const [activeBento, setActiveBento] = useState(0);

  const chars = Array.from(centerText);
  const charCenter = (chars.length - 1) / 2;

  const tiles: (string | "BENTO_GROUP")[] = Array.from(
    { length: TOTAL_TILES },
    (_, i) => images[i % images.length] ?? "",
  );
  tiles[BENTO_INDEX] = "BENTO_GROUP";

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <section className="relative mt-[14vh] flex w-full justify-center">
        <div
          ref={textRef}
          aria-label={centerText}
          className="flex text-[clamp(3rem,14vw,10rem)] font-extrabold uppercase leading-[0.85] tracking-tight text-white"
        >
          {chars.map((char, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "inline-block transition-[transform,opacity] duration-700 ease-out",
                textIn ? "translate-y-0 opacity-100" : "translate-y-[0.6em] opacity-0",
              )}
              style={{ transitionDelay: `${Math.abs(i - charCenter) * 55}ms` }}
            >
              {char === " " ? " " : char}
            </span>
          ))}
        </div>
      </section>

      <section className="relative my-[16vh] w-full overflow-x-auto">
        <div
          ref={gridRef}
          className="relative mx-auto grid aspect-[1.7] h-auto w-full min-w-[820px] max-w-none grid-cols-7 grid-rows-3 gap-3 p-2"
        >
          {tiles.map((item, i) => {
            const col = i % COLUMNS;
            const delay = 120 + Math.abs(col - MIDDLE_COLUMN) * 110;

            if (item === "BENTO_GROUP") {
              if (!bentoItems || bentoItems.length === 0) return null;
              return (
                <div
                  key="bento-group"
                  className={cn(
                    "relative z-20 col-span-3 row-span-1 flex h-full w-full items-center justify-center gap-2 transition-[transform,opacity] duration-700 ease-out",
                    gridIn ? "translate-y-0 scale-100 opacity-100" : "translate-y-10 scale-95 opacity-0",
                  )}
                  style={{ transitionDelay: `${120 + Math.abs(2 - MIDDLE_COLUMN) * 110}ms` }}
                >
                  {bentoItems.map((bentoItem, index) => {
                    const isActive = activeBento === index;
                    return (
                      <div
                        key={bentoItem.id}
                        className={cn(
                          "group relative h-full cursor-pointer overflow-hidden rounded-2xl border transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]",
                          isActive
                            ? "border-white/25 bg-white/[0.06]"
                            : "border-white/10 bg-white/[0.02]",
                        )}
                        style={{ width: isActive ? "62%" : "19%" }}
                        onMouseEnter={() => setActiveBento(index)}
                        onFocus={() => setActiveBento(index)}
                        onClick={() => setActiveBento(index)}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isActive}
                      >
                        <div
                          className={cn(
                            "absolute inset-0 flex flex-col justify-end p-5 transition-all duration-500",
                            isActive
                              ? "translate-y-0 opacity-100"
                              : "pointer-events-none translate-y-3 opacity-0",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold leading-tight tracking-tight text-white">
                              {bentoItem.title}
                            </h3>
                            <span className="text-white/80">{bentoItem.icon}</span>
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-white/45">
                            {bentoItem.description}
                          </p>
                        </div>

                        <div
                          className={cn(
                            "absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all duration-500",
                            isActive ? "pointer-events-none scale-90 opacity-0" : "scale-100 opacity-100",
                          )}
                        >
                          <span className="text-white/45 transition-colors group-hover:text-white/80">
                            {bentoItem.icon}
                          </span>
                          <span className="text-center text-[9px] font-medium uppercase leading-tight tracking-wider text-white/40">
                            {bentoItem.subtitle}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            if (i === 17 || i === 18) return null;

            const { Icon, label } = GRID_CARDS[i % GRID_CARDS.length];
            return (
              <figure
                key={`tile-${i}`}
                className={cn(
                  "group relative z-10 m-0 cursor-pointer transition-[transform,opacity] duration-700 ease-out",
                  gridIn ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0",
                )}
                style={{ transitionDelay: `${delay}ms` }}
              >
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] transition-all duration-500 ease-out group-hover:border-white/25 group-hover:bg-white/[0.07]">
                  <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/30 via-black/60 to-black opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative z-10 flex flex-col items-center justify-center gap-3">
                    <Icon className="h-8 w-8 text-white/40 transition-all duration-300 group-hover:scale-110 group-hover:text-white" />
                    <div className="translate-y-2 text-center opacity-0 transition-all delay-75 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-white/70">
                        A focus on
                      </span>
                      <span className="block text-sm font-semibold tracking-tight text-white">
                        {label}
                      </span>
                    </div>
                  </div>
                </div>
              </figure>
            );
          })}
        </div>
      </section>

      {showFooter && credits && (
        <footer className="relative z-50 flex w-full items-center justify-between p-8 text-xs font-medium uppercase tracking-wider text-white/70">
          <a href={credits.madeBy.href} className="transition-opacity hover:opacity-60">
            {credits.madeBy.text}
          </a>
          <a href={credits.moreDemos.href} className="transition-opacity hover:opacity-60">
            {credits.moreDemos.text}
          </a>
        </footer>
      )}
    </div>
  );
}

export default StaggeredGrid;
