import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import SalesRequestsBoard from "./SalesRequestsBoard";
import type { SalesRequest, SalesRequestPage } from "@/lib/api/platform-billing-client";

/**
 * Sales requests (26 Sep 2026): source code and dedicated-server asks from
 * the pricing page. The team moves them along and keeps notes; a delete asks
 * first and goes to the recycle bin.
 */

let search = new URLSearchParams();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/sales-requests",
  useSearchParams: () => search,
}));

const list = vi.fn<(q: Record<string, unknown>) => Promise<SalesRequestPage>>();
const update = vi.fn<(id: string, body: Record<string, unknown>) => Promise<SalesRequest>>();
const remove = vi.fn<(id: string) => Promise<unknown>>();

vi.mock("@/lib/api/platform-billing-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-billing-client")>();
  return {
    ...actual,
    platformSalesRequests: {
      list: (q: Record<string, unknown>) => list(q),
      update: (id: string, body: Record<string, unknown>) => update(id, body),
      remove: (id: string) => remove(id),
    },
  };
});

const REQUEST: SalesRequest = {
  id: "sr1",
  type: "source_code",
  name: "Tolu Adebayo",
  email: "tolu@acme.example",
  phone: "+234 801 234 5678",
  organisationName: "Acme Holdings",
  message: "We'd like to host it ourselves.",
  currency: "USD",
  status: "new",
  notes: null,
  createdAt: "2026-09-26T10:00:00Z",
  updatedAt: "2026-09-26T10:00:00Z",
};

function page(rows: SalesRequest[]): SalesRequestPage {
  return { data: rows, meta: { currentPage: 1, lastPage: 1, perPage: 20, total: rows.length } };
}

function renderBoard() {
  return render(
    <ConfirmProvider>
      <SalesRequestsBoard />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  search = new URLSearchParams();
  replace.mockReset();
  list.mockReset().mockResolvedValue(page([REQUEST]));
  update.mockReset().mockImplementation(async (id, body) => ({ ...REQUEST, ...body, id }) as SalesRequest);
  remove.mockReset().mockResolvedValue(undefined);
});

describe("sales requests", () => {
  it("opens a request with contact links, and saves a status change with notes", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: /Tolu Adebayo/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /tolu@acme.example/ })).toHaveAttribute("href", "mailto:tolu@acme.example");
    expect(within(dialog).getByRole("link", { name: /\+234 801 234 5678/ })).toHaveAttribute("href", "tel:+2348012345678");
    expect(within(dialog).getByText("We'd like to host it ourselves.")).toBeInTheDocument();

    const save = within(dialog).getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    await user.click(within(dialog).getByText("Contacted"));
    await user.click(within(dialog).getByLabelText("Team notes"));
    await user.paste("  Called; sending licence draft.  ");
    await user.click(save);

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("sr1", { status: "contacted", notes: "Called; sending licence draft." }),
    );
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Saved.");
  }, 15_000);

  it("asks before deleting, and says the request goes to the recycle bin", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: /Tolu Adebayo/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));

    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Delete Tolu Adebayo's request?");
    expect(confirm).toHaveTextContent(/recycle bin/);
    expect(remove).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole("button", { name: "Delete request" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("sr1"));
    expect(await screen.findByText(/moved to the recycle bin/)).toBeInTheDocument();
  });

  it("keeps the request when the delete is cancelled", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: /Tolu Adebayo/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));

    expect(remove).not.toHaveBeenCalled();
  });

  it("opens on the status the link asked for, and filters by type", async () => {
    search = new URLSearchParams("status=new");
    const user = userEvent.setup();
    renderBoard();

    await waitFor(() => expect(list).toHaveBeenCalledWith({ status: "new", type: undefined, page: 1 }));
    await user.click(screen.getByText("Dedicated server"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ status: "new", type: "dedicated_hosting", page: 1 }));
  });
});
