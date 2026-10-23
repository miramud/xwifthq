import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackChecklist, StageForm, StageRoad } from "./PackParts";
import { clientPayment } from "../travel/fixtures";

/** The pack can't be sent with a mandatory document missing; a stage needs a follow-up date unless paid or closed. */

const props = { canAttach: true, canSubmit: true, busyItem: null, itemErrors: {}, onUpload: vi.fn() };

describe("PackChecklist", () => {
  it("marks mandatory items and holds the pack back until they are all attached", () => {
    const r = clientPayment();
    render(<PackChecklist {...props} items={r.items} packStatus="draft" onSubmit={vi.fn()} />);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Mandatory · attached")).toBeInTheDocument();
    expect(screen.getByText("Mandatory")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.getByText("Attach every mandatory document before sending the pack: Invoice.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send the pack for approval" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Download cover-letter.pdf" })).toHaveAttribute("href", "/api/operations/attachments/a1");
  });

  it("sends it once every mandatory document is in, optional ones aside", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const r = clientPayment();
    const items = r.items.map((i) => (i.id === "i2" ? { ...i, attachment: { ...r.items[0].attachment!, id: "a2", name: "invoice.pdf" } } : i));
    render(<PackChecklist {...props} items={items} packStatus="rejected" onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Send the pack again" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("hands a chosen file to the item it belongs to", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(<PackChecklist {...props} onUpload={onUpload} items={clientPayment().items} packStatus="draft" onSubmit={vi.fn()} />);
    const file = new File(["%PDF"], "invoice.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Attach the invoice", { selector: "input" }), file);
    expect(onUpload).toHaveBeenCalledWith("i2", file);
  });

  it("offers no send once the pack is in approval, and no uploads without the permission", () => {
    render(<PackChecklist {...props} canAttach={false} items={clientPayment().items} packStatus="in_approval" onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Send the pack/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Attach the invoice/)).not.toBeInTheDocument();
  });
});

async function pickStage(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox", { name: "Stage" }));
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${name}`) }));
}

describe("StageForm", () => {
  const stages = clientPayment().stages;

  it("won't record an open stage without the next follow-up date", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<StageForm stages={stages} current="submitted" packApproved onSave={onSave} />);
    await pickStage(user, "Acknowledged");
    expect(screen.getByLabelText("Next follow-up")).toBeRequired();
    await user.click(screen.getByRole("button", { name: "Record the stage" }));
    expect(screen.getByText("Set the next follow-up date.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Next follow-up"), "2026-10-09");
    await user.type(screen.getByLabelText("Who you dealt with"), "Mrs Bello");
    await user.click(screen.getByRole("button", { name: "Record the stage" }));
    expect(onSave).toHaveBeenCalledWith({ stage: "acknowledged", contact: "Mrs Bello", notes: null, nextFollowUpOn: "2026-10-09" });
  });

  it("needs no follow-up once paid", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<StageForm stages={stages} current="payment_scheduled" packApproved onSave={onSave} />);
    await pickStage(user, "Paid");
    expect(screen.getByLabelText("Next follow-up")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Record the stage" }));
    expect(onSave).toHaveBeenCalledWith({ stage: "paid", contact: null, notes: null, nextFollowUpOn: null });
  });

  it("keeps Submitted out of reach until the pack is approved", async () => {
    const user = userEvent.setup();
    render(<StageForm stages={stages} current="prepared" packApproved={false} onSave={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: "Stage" }));
    expect(await screen.findByRole("option", { name: /^Submitted/ })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("StageRoad", () => {
  it("ticks the stages reached and marks where it is now", () => {
    const r = clientPayment({ stage: "under_verification" });
    render(<StageRoad stage={r.stage} history={[...r.history, { ...r.history[0], stage: "submitted" }, { ...r.history[0], stage: "acknowledged" }]} />);
    const road = screen.getByRole("list", { name: "Where the request is with the client" });
    expect(within(road).getByText("Under verification").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(road).getByText("Acknowledged").closest("li")).toHaveTextContent("(done)");
    expect(within(road).getByText("Certified").closest("li")).toHaveTextContent("(not yet)");
  });

  it("shows a query as a detour off the road", () => {
    render(<StageRoad stage="queried" history={clientPayment().history} />);
    expect(screen.getByText(/Now: Queried, answer the client and resubmit/)).toBeInTheDocument();
  });
});
