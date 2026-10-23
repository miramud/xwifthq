import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ login: vi.fn(), isAuthenticated: false, loading: false, user: null }),
  AuthError: class extends Error {},
}));

describe("login page", () => {
  it("carries the typed email to the forgot-password page", () => {
    render(<LoginPage />);

    const link = () => screen.getByRole("link", { name: "Forgot password?" });
    expect(link().getAttribute("href")).toBe("/forgot-password");

    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "ada@example.com" } });
    expect(link().getAttribute("href")).toBe("/forgot-password?email=ada%40example.com");
  });
});
