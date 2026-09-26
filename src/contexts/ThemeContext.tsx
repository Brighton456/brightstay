import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyAccent,
  applyMode,
  getSavedAccent,
  getSavedMode,
  supportsMode,
  type Accent,
  type Mode,
} from "@/lib/theme";

type ThemeCtx = {
  accent: Accent;
  mode: Mode;
  setAccent: (a: Accent) => void;
  setMode: (m: Mode) => void;
  supportsMode: boolean;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState<Accent>(() => getSavedAccent());
  const [mode, setMode] = useState<Mode>(() => getSavedMode());

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  return (
    <ThemeContext.Provider
      value={{ accent, mode, setAccent, setMode, supportsMode: supportsMode(accent) }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}