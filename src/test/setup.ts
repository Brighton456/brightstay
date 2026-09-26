import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// Demo role/session state must not leak between tests
beforeEach(() => {
  localStorage.clear();
});

// jsdom lacks ResizeObserver used by recharts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver ?? (ResizeObserverMock as unknown as typeof ResizeObserver);

if (!("scrollTo" in window)) {
  window.scrollTo = () => {};
}