"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentTimeZone, type TimeZone } from "@/lib/time";

interface ThemeContextValue {
  zone: TimeZone | null;
  isManual: boolean;
  setZone: (zone: TimeZone) => void;
  resetToAuto: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const AUTO_REFRESH_INTERVAL_MS = 60_000;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [zone, setZoneState] = useState<TimeZone | null>(null);
  const [isManual, setIsManual] = useState(false);

  useEffect(() => {
    // Local time zone is only knowable client-side; computing it during SSR
    // would use the server's clock and cause a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoneState(getCurrentTimeZone());

    const interval = setInterval(() => {
      setIsManual(currentlyManual => {
        if (!currentlyManual) setZoneState(getCurrentTimeZone());
        return currentlyManual;
      });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const setZone = (next: TimeZone) => {
    setIsManual(true);
    setZoneState(next);
  };

  const resetToAuto = () => {
    setIsManual(false);
    setZoneState(getCurrentTimeZone());
  };

  return (
    <ThemeContext.Provider value={{ zone, isManual, setZone, resetToAuto }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeZone() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeZone must be used within a ThemeProvider");
  return ctx;
}
