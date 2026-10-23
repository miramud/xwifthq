import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyAssetRequestDetail from "./MyAssetRequestDetail";
import { assetRequest, movement } from "@/suite/operations/components/assets/fixtures";
import { ApiError, type MyAssetRequestDetail as Detail } from "@/lib/api/operations-assets-client";

/** One of my asset requests: the approval, the gate pass and the handover notes, each printable. */

const api = vi.hoisted(() => ({ show: vi.fn(), cancel: vi.fn() }));

vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return { ...actual, myAssets: { ...actual.myAssets, show: api.show, cancel: api.cancel } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-ada", role: "user", name: "Ada Obi", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/my/assets/requests/r1", useSearchParams: () => new URLSearchParams() }));

function detail(over: Partial<Detail> = {}): Detail {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pool, book, ...base } = assetRequest();
  return { ...base, handovers: [], ...over };
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  document.body.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("MyAssetRequestDetail", () => {
  it("shows a take-out with its gate pass, the approval and the handover note, each printable", async () => {
    api.show.mockResolvedValue(
      detail({
        kind: "take_out",
        kindLabel: "Temporary take-out",
        status: "fulfilled",
        asset: { id: "a1", tagNo: "MPT/LAP/0001", name: "Dell Latitude 5440", status: "in_transit" },
        returnBy: "2026-10-09",
        toLocation: "Workshop, Abuja",
        gatePass: {
          id: "g1",
          number: "MPT/GP/2026/0001",
          holder: "Ada Obi",
          purpose: "Client demo",
          destination: "Workshop, Abuja",
          outAt: "2026-10-05T09:00:00+01:00",
          dueBackOn: "2099-10-09",
          returnedAt: null,
          overdue: false,
          assets: [{ id: "a1", tagNo: "MPT/LAP/0001", name: "Dell Latitude 5440" }],
          status: "out",
          pdfPath: "/operations/me/gate-passes/g1/pdf",
        },
        handovers: [{ ...movement(), pdfPath: "/operations/me/handovers/m1/pdf" }],
      }),
    );
    render(<MyAssetRequestDetail id="r1" />);

    expect(await screen.findByRole("heading", { name: "Temporary take-out: MPT/LAP/0001 Dell Latitude 5440" })).toBeInTheDocument();
    expect(api.show).toHaveBeenCalledWith("r1");
    expect(screen.getByRole("link", { name: /See the approval/ })).toHaveAttribute("href", "/suite/approvals/ap1");
    expect(screen.getByRole("link", { name: "Print: MPT/GP/2026/0001" })).toHaveAttribute("href", "/api/operations/me/gate-passes/g1/pdf");
    expect(screen.getByRole("link", { name: "Handover note: MPT/HO/2026/0007" })).toHaveAttribute("href", "/api/operations/me/handovers/m1/pdf");
    expect(screen.getByText(/waiting for your signature/)).toBeInTheDocument();
    // Fulfilled: nothing left to cancel.
    expect(screen.queryByRole("button", { name: "Cancel request" })).not.toBeInTheDocument();
  });

  it("cancels an approved request after asking", async () => {
    const user = userEvent.setup();
    api.show.mockResolvedValue(detail());
    api.cancel.mockResolvedValue(detail({ status: "cancelled" }));
    render(<MyAssetRequestDetail id="r1" />);

    await user.click(await screen.findByRole("button", { name: "Cancel request" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel the request" }));
    expect(api.cancel).toHaveBeenCalledWith("r1");
    expect(await screen.findByText("MPT/AR/2026/0003 is cancelled.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });

  it("says plainly when the request is not there", async () => {
    api.show.mockRejectedValue(new ApiError("Not found.", 404));
    render(<MyAssetRequestDetail id="nope" />);
    expect(await screen.findByText(/The request didn.t load/)).toBeInTheDocument();
  });
});
