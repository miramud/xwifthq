import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GatePassBoard } from "./GatePasses";
import type { GatePass } from "@/lib/api/operations-assets-client";

/** The gate-pass board: each pass shows on screen and prints as a verifiable PDF. */

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), checkIn: vi.fn() }));

vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return { ...actual, gatePasses: { ...actual.gatePasses, list: api.list, get: api.get, checkIn: api.checkIn } };
});

const pass: GatePass = {
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
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.list.mockResolvedValue([pass]);
  api.get.mockResolvedValue({ ...pass, qr: "data:image/png;base64,AAAA" });
});

describe("GatePassBoard", () => {
  it("prints a pass as its PDF, from the row and from the pass itself", async () => {
    const user = userEvent.setup();
    render(<GatePassBoard canCheckIn={false} />);
    expect(await screen.findByRole("link", { name: "Print: MPT/GP/2026/0001" })).toHaveAttribute("href", "/api/operations/gate-passes/g1/pdf");

    await user.click(screen.getByRole("button", { name: "Show pass MPT/GP/2026/0001" }));
    const dialog = await screen.findByRole("dialog", { name: "Gate pass" });
    expect(within(dialog).getByRole("link", { name: "Print PDF" })).toHaveAttribute("href", "/api/operations/gate-passes/g1/pdf");
    expect(api.get).toHaveBeenCalledWith("g1");
  });
});
