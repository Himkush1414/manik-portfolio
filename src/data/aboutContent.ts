import type { BentoItem } from "@/components/ui/staggered-grid";
import { createElement } from "react";

// Demo content for the /about Staggered Grid — placeholder, not final.

// Only the length is used (grid tiles are icon cards, not images).
export const aboutImages: string[] = Array.from({ length: 12 }, (_, i) => `tile-${i}`);

function Glyph(path: string) {
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: "h-4 w-4",
      "aria-hidden": true,
    },
    createElement("path", { d: path }),
  );
}

export const aboutBentoItems: BentoItem[] = [
  {
    id: "building",
    title: "Currently building",
    subtitle: "Now",
    description: "Placeholder — a short note on what's in progress.",
    icon: Glyph("M12 3v18M3 12h18"),
  },
  {
    id: "learning",
    title: "Currently learning",
    subtitle: "Study",
    description: "Placeholder — a short note on what's being picked apart.",
    icon: Glyph("M4 6h16M4 12h16M4 18h10"),
  },
  {
    id: "offclock",
    title: "Off the clock",
    subtitle: "Elsewhere",
    description: "Placeholder — a short note on life away from the keyboard.",
    icon: Glyph("M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2"),
  },
];
