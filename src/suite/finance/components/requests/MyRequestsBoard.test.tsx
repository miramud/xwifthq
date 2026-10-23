import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyRequestsBoard from "./MyRequestsBoard";
import { memoSummary } from "./fixtures";

/** My requests: what's next on each, the ones waiting on me, and an invitation when there are none. */

const list = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return { ...actual, spend: { ...actual.spend, me: { ...actual.spend.me, list } } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/requests",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  window.localStorage.clear();
  list.mockReset();
});

describe("MyRequestsBoard", () => {
  it("says what happens next on each request, and filters to the ones waiting on me", async () => {
    const user = userEvent.setup();
    list.mockResolvedValue([
      memoSummary({ id: "a", title: "Swiftlink: September fibre lease", status: "fcu_queried" }),
      memoSummary({ id: "b", title: "Travel advance: Abuja", type: "advance", status: "awaiting_retirement", paidAmount: 200_000_00 }),
      memoSummary({ id: "c", title: "Projector lamps", status: "paid", paidAmount: 90_000_00 }),
      memoSummary({ id: "d", title: "Printer toner", status: "draft", reference: null }),
    ]);
    render(<MyRequestsBoard />);

    expect(await screen.findByText("Answer the FCU's query")).toBeInTheDocument();
    expect(screen.getByText("Retire your advance")).toBeInTheDocument();
    // A draft opens in the editor; a sent request on its own page.
    expect(screen.getByRole("link", { name: /Printer toner/ })).toHaveAttribute("href", "/suite/finance/requests/new?id=d");
    expect(screen.getByRole("link", { name: /Projector lamps/ })).toHaveAttribute("href", "/suite/finance/requests/c");

    await user.click(screen.getByRole("tab", { name: /Waiting on you/ }));
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/suite/finance/requests/"));
    const titles = links.map((a) => a.textContent ?? "");
    expect(titles.some((t) => t.includes("Projector lamps"))).toBe(false);
    expect(titles.some((t) => t.includes("Swiftlink"))).toBe(true);
    expect(within(screen.getByRole("tab", { name: /Waiting on you/ })).getByText("3")).toBeInTheDocument();
  });

  it("invites the first request when there are none", async () => {
    list.mockResolvedValue([]);
    render(<MyRequestsBoard />);
    expect(await screen.findByText("Ask Finance for a payment or an advance")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Raise your first request" })).toHaveAttribute("href", "/suite/finance/requests/new");
  });

  it("offers to try again when the list fails", async () => {
    list.mockRejectedValue(new Error("Network down"));
    render(<MyRequestsBoard />);
    expect(await screen.findByText(/Your requests didn't load/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
