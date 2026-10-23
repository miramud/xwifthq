import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ResetPasswordPage from "./page";

let search = new URLSearchParams();
const replace = vi.fn();
const login = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/reset-password",
  useSearchParams: () => search,
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ login }),
  AuthError: class extends Error {},
}));

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function fill(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
}

describe("reset password", () => {
  beforeEach(() => {
    search = new URLSearchParams("token=abc123&email=ada%40example.com");
    replace.mockReset();
    login.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves the new password, signs in with it, and lands an org user on My employment", async () => {
    respond(200, { message: "Your password has been reset." });
    login.mockResolvedValue({
      role: "user",
      organisationId: "org",
      mustChangePassword: false,
      modules: [{ key: "hrm", label: "HRM", status: "active" }],
    });
    render(<ResetPasswordPage />);

    fill("new-password-1", "new-password-1");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save password and sign in/i }));
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/reset-password");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      email: "ada@example.com",
      token: "abc123",
      password: "new-password-1",
      password_confirmation: "new-password-1",
    });
    expect(login).toHaveBeenCalledWith("ada@example.com", "new-password-1");
    expect(replace).toHaveBeenCalledWith("/suite/hrm/me");
  });

  it("refuses mismatched passwords without calling the API", async () => {
    render(<ResetPasswordPage />);

    fill("new-password-1", "new-password-2");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save password and sign in/i }));
    });

    expect(screen.getByText("The two passwords do not match.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns an expired link into a one-click request for a new one, keeping the email", async () => {
    respond(422, { message: "Invalid.", errors: { token: ["This password reset token is invalid."] } });
    render(<ResetPasswordPage />);

    fill("new-password-1", "new-password-1");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save password and sign in/i }));
    });

    expect(await screen.findByText("This link is invalid or has expired")).toBeTruthy();
    const link = screen.getByRole("link", { name: /request a new link/i });
    expect(link.getAttribute("href")).toBe("/forgot-password?email=ada%40example.com");
    expect(login).not.toHaveBeenCalled();
  });

  it("explains a link that arrived without its token", () => {
    search = new URLSearchParams("email=ada%40example.com");
    render(<ResetPasswordPage />);

    expect(screen.getByText("This link is incomplete")).toBeTruthy();
  });
});
