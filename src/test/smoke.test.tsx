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

  it("renders one unlabelled sign-in screen with username/password and an access code", async () => {
    renderApp("/auth");
    expect(await screen.findByText(/Welcome home/i)).toBeInTheDocument();
    expect(await screen.findByTestId("login-username")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
    expect(screen.getByTestId("access-code-input")).toBeInTheDocument();
  });

  it("never names roles on /auth and offers no signup", async () => {
    renderApp("/auth");
    expect(await screen.findByTestId("signin-card")).toBeInTheDocument();
    expect(screen.queryByText(/I'm a tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/I'm a caretaker/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("landlord-link")).not.toBeInTheDocument();
    expect(screen.queryByText(/sign up/i, { exact: false })).not.toBeInTheDocument();
  });

  it("renders the landlord sign-in at /manager (never labelled Manager)", async () => {
    renderApp("/manager");
    expect((await screen.findAllByText(/Landlord portal/i)).length).toBeGreaterThan(0);
    expect(screen.getByTestId("manager-username")).toBeInTheDocument();
    expect(screen.queryByText(/Manager portal/i)).not.toBeInTheDocument();
  });

  it("shows the 6-digit access code page", async () => {
    renderApp("/tenant/access");
    expect(await screen.findByText(/new tenant/i)).toBeInTheDocument();
    expect(screen.getByTestId("access-code-input")).toBeInTheDocument();
  });
});
