export type Accent = "crimson" | "gold" | "forest";
export type Mode = "light" | "dark";

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "crimson", label: "Crimson", swatch: "linear-gradient(135deg, #e8444f, #8f1420)" },
  { value: "gold", label: "Golden", swatch: "linear-gradient(135deg, #f2b03d, #b9791a)" },
  { value: "forest", label: "Forest", swatch: "linear-gradient(135deg, #3fae6a, #14532d)" },
];

export const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "light", label: "White", hint: "Bright, airy light mode" },
  { value: "dark", label: "Black", hint: "Dense, low-glare dark mode" },
];

const ACCENT_KEY = "brightstay_accent";
const MODE_KEY = "brightstay_mode";

export function getSavedAccent(): Accent {
  const v = localStorage.getItem(ACCENT_KEY);
  return v === "crimson" || v === "gold" || v === "forest" ? v : "crimson";
}

export function getSavedMode(): Mode {
  return localStorage.getItem(MODE_KEY) === "light" ? "light" : "dark";
}

export function applyTheme(accent: Accent, mode: Mode) {
  const root = document.documentElement;
  root.dataset.accent = accent;
  root.dataset.mode = mode;
  root.style.colorScheme = mode;
  localStorage.setItem(ACCENT_KEY, accent);
  localStorage.setItem(MODE_KEY, mode);
}

export function applyAccent(a: Accent) {
  applyTheme(a, getSavedMode());
}

export function applyMode(m: Mode) {
  applyTheme(getSavedAccent(), m);
}

/**
 * Light/dark appearance unlocks once the landlord brand color is one of the
 * supported accents (Crimson, Golden, Forest). Kept as an explicit gate so a
 * future neutral/unbranded accent could hide the toggle.
 */
export function supportsMode(accent: Accent): boolean {
  return accent === "crimson" || accent === "gold" || accent === "forest";
}