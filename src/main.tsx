import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyTheme, getSavedAccent, getSavedMode } from "./lib/theme";
import "./index.css";

// Apply the saved theme before first paint to avoid a flash
applyTheme(getSavedAccent(), getSavedMode());

// ---- Lock browser zoom (kiosk behaviour) ----
// Pinch / multi-touch (Android)
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
// Gesture events (older iOS Safari)
(["gesturestart", "gesturechange", "gestureend"] as const).forEach((ev) =>
  document.addEventListener(ev, (e) => e.preventDefault())
);
// Double-tap zoom
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false }
);
// Ctrl/CMD + wheel zoom & keyboard zoom (desktop)
document.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener(
  "keydown",
  (e) => {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0", "Digit0", "Equal", "Minus"].includes(e.key)) {
      e.preventDefault();
    }
  },
  { passive: false }
);

createRoot(document.getElementById("root")!).render(<App />);