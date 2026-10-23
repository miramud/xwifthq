import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ForgotPasswordPage from "./page";

let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/forgot-password",
  useSearchParams: () => search,
}));

const fetchMock = vi.fn();

/** Asking for a reset link never says whether the account exists. */
describe("forgot password", () => {
  beforeEach(() => {
    search = new URLSearchParams();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "If an account exists for that address, we've sent a reset link." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("prefills the email from the sign-in page", () => {
    search = new URLSearchParams("email=ada@example.com");
    render(<ForgotPasswordPage />);

    expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("ada@example.com");
  });

  it("shows the generic confirmation and holds 'Send again' for a minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    });

    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText(/we've sent a reset link/i)).toBeTruthy();
    expect(screen.getByText(/spam/i)).toBeTruthy();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/forgot-password");
    expect(body).toEqual({ email: "ada@example.com" });

    const again = screen.getByRole("button", { name: /send again in 60s/i }) as HTMLButtonElement;
    expect(again.disabled).toBe(true);

    // One tick at a time: each second schedules the next after React re-renders.
    for (let second = 0; second < 61; second++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }

    const ready = screen.getByRole("button", { name: /^send again$/i }) as HTMLButtonElement;
    expect(ready.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(ready);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
