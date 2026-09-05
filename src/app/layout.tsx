import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/ThemeContext";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manik Rana — Portfolio",
  description: "A time-zone adaptive portfolio that shifts its look with the time of day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <ThemeProvider>
          {children}
          <ThemeSwitcher />
        </ThemeProvider>
      </body>
    </html>
  );
}
