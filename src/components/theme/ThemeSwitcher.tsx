"use client";

import type { TimeZone } from "@/lib/time";
import { useThemeZone } from "./ThemeContext";
import { MoonIcon, SunIcon, SunriseIcon, SunsetIcon } from "./icons";

const OPTIONS: { zone: TimeZone; label: string; Icon: typeof SunIcon }[] = [
  { zone: "morning", label: "Morning", Icon: SunriseIcon },
  { zone: "afternoon", label: "Afternoon", Icon: SunIcon },
  { zone: "evening", label: "Evening", Icon: SunsetIcon },
  { zone: "night", label: "Night", Icon: MoonIcon },
];

export function ThemeSwitcher() {
  const { zone, setZone } = useThemeZone();

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex items-center gap-1 rounded-full border border-white/50 bg-white/40 p-1.5 shadow-[0_8px_30px_rgba(46,42,69,0.15)] backdrop-blur-xl"
      role="group"
      aria-label="Preview a time-of-day theme"
    >
      {OPTIONS.map(({ zone: optionZone, label, Icon }) => {
        const active = zone === optionZone;
        return (
          <button
            key={optionZone}
            type="button"
            title={label}
            aria-label={`Preview ${label} theme`}
            aria-pressed={active}
            onClick={() => setZone(optionZone)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              active ? "bg-[#2E2A45] text-white" : "text-[#2E2A45]/70 hover:bg-[#2E2A45]/10"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}
