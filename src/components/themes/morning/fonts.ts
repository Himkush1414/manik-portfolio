import { Archivo, Inter, Permanent_Marker, Quicksand } from "next/font/google";

export const morningHeadingFont = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const morningBodyFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Closest legitimate Google Fonts match for the requested "Suster Selly"
// brush-marker style: thick, textured, hand-painted strokes.
export const morningBrushFont = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Heavy grotesque display face for oversized, full-bleed headlines
// (e.g. the "NIGHTMARE" wordmark on the Projects page).
export const morningDisplayFont = Archivo({
  subsets: ["latin"],
  weight: ["800", "900"],
  display: "swap",
});
