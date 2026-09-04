import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manik Rana — Portfolio",
  description: "A time-zone adaptive portfolio that shifts its look with the time of day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
