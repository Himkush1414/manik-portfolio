import { ThemeProvider } from "@/components/theme/ThemeContext";
import { ThemeRenderer } from "@/components/theme/ThemeRenderer";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

export default function Home() {
  return (
    <ThemeProvider>
      <ThemeRenderer />
      <ThemeSwitcher />
    </ThemeProvider>
  );
}
