"use client";

import AfternoonTheme from "@/components/themes/afternoon/AfternoonTheme";
import EveningTheme from "@/components/themes/evening/EveningTheme";
import MorningTheme from "@/components/themes/morning/MorningTheme";
import NightTheme from "@/components/themes/night/NightTheme";
import { useThemeZone } from "./ThemeContext";
import { LoadingScreen } from "./LoadingScreen";

export function ThemeRenderer() {
  const { zone } = useThemeZone();

  switch (zone) {
    case "morning":
      return <MorningTheme />;
    case "afternoon":
      return <AfternoonTheme />;
    case "evening":
      return <EveningTheme />;
    case "night":
      return <NightTheme />;
    default:
      return <LoadingScreen />;
  }
}
