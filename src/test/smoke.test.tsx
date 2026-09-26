import { describe, it, expect, beforeAll } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../App";
import { AppSessionProvider } from "../contexts/AppSessionContext";
import { AuthProvider } from "../contexts/AuthContext";
import { default as ThemeProvider } from "../contexts/ThemeContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../components/ui/tooltip";

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList;
  }
  window.localStorage.clear();
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderApp(initialPath = "/") {
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppSessionProvider>
            <AuthProvider>
              <MemoryRouter initialEntries={[initialPath]}>
                <AppRoutes />
              </MemoryRouter>
            </AuthProvider>
          </AppSessionProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("BrightStay smoke", () => {
  it("renders the landing hero", () => {
    renderApp("/");
    expect(screen.getAllByText(/beautiful|residential rental/i).length).toBeGreaterThan(0);
  });

  it("renders the tenant login-only page with the access-code quiz", async () => {
    renderApp("/auth");
    expect(await screen.findByText(/Welcome home/i)).toBeInTheDocument();
    expect(await screen.findByText(/New tenant\? Click here to log in with your access code/i)).toBeInTheDocument();
  });

  it("renders the manager login", async () => {
    renderApp("/manager");
    expect(await screen.findByText(/Staff portal/i)).toBeInTheDocument();
    expect(screen.getByTestId("manager-username")).toBeInTheDocument();
  });

  it("shows the 6-digit access code page", async () => {
    renderApp("/tenant/access");
    expect(await screen.findByText(/new tenant/i)).toBeInTheDocument();
    expect(screen.getByTestId("access-code-input")).toBeInTheDocument();
  });
});
