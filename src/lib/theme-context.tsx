"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { flushSync } from "react-dom";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => { },
  isDark: true,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Read persisted theme on mount
  useEffect(() => {
    const stored = localStorage.getItem("ChessLearn-theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(stored);
    }
    setMounted(true);
  }, []);

  // Apply theme class + persist whenever theme changes after mount
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    localStorage.setItem("ChessLearn-theme", theme);
  }, [theme, mounted]);

  const toggleTheme = useCallback(() => {
    const btn = document.querySelector("[data-theme-toggle]") as HTMLElement | null;
    const x = btn ? btn.getBoundingClientRect().left + btn.offsetWidth / 2 : window.innerWidth / 2;
    const y = btn ? btn.getBoundingClientRect().top + btn.offsetHeight / 2 : 0;
    const nextTheme = theme === "dark" ? "light" : "dark";

    // Check if View Transitions API is available
    if ("startViewTransition" in document) {
      const transition = document.startViewTransition(() => {
        // flushSync forces React to update DOM synchronously inside the transition
        flushSync(() => {
          setTheme(nextTheme);
        });
        // Also immediately apply the class so CSS variables change NOW
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(nextTheme);
        localStorage.setItem("ChessLearn-theme", nextTheme);
      });

      transition.ready.then(() => {
        const maxRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 500,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });
    } else {
      // Fallback: simple toggle
      setTheme(nextTheme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
