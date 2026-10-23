import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NumberingBoard from "./NumberingBoard";
import { ApiError, type NumberSeries } from "@/lib/api/org-foundations-client";

/** Reference numbering: tokens go in at the cursor and the next number is previewed as you type. */

const api = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), preview: vi.fn() }));

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, numbering: api } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/numbering",
  useSearchParams: () => new URLSearchParams(),
}));

const SERIES: NumberSeries = {
  id: "s-1",
  code: "invoice",
  name: "Invoices",
  format: "INV-{NNNN}",
  reset: "yearly",
  startAt: 1,
  active: true,
  preview: "INV-0043",
  issued: 42,
  voided: 1,
};

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  api.list.mockResolvedValue([SERIES]);
  api.preview.mockImplementation(async (format: string) => ({ preview: format.replace("{ORG}", "MPT").replace("{YYYY}", "2026").replace("{NNNN}", "0043"), reset: "yearly" }));
});

async function openEditor() {
  const user = userEvent.setup();
  render(<NumberingBoard />);
  const table = await screen.findByRole("table");
  expect(within(table).getByText("INV-0043")).toBeInTheDocument();
  expect(within(table).getByText("(1 voided)")).toBeInTheDocument();
  await user.click(within(table).getByRole("button", { name: "Edit Invoices" }));
  const form = await screen.findByRole("form", { name: "Edit Invoices" });
  return { user, form, input: within(form).getByLabelText("Format") as HTMLInputElement };
}

describe("NumberingBoard", () => {
  it("inserts a token at the cursor and previews the next number from the server", async () => {
    const { user, form, input } = await openEditor();

    // Cursor after "INV-": the token lands there, not at the end.
    input.focus();
    input.setSelectionRange(4, 4);
    await user.click(within(form).getByRole("button", { name: /Insert \{ORG\}/ }));
    expect(input.value).toBe("INV-{ORG}{NNNN}");

    input.setSelectionRange(9, 9);
    await user.click(within(form).getByRole("button", { name: /Insert \{YYYY\}/ }));
    expect(input.value).toBe("INV-{ORG}{YYYY}{NNNN}");

    await waitFor(() => expect(api.preview).toHaveBeenLastCalledWith("INV-{ORG}{YYYY}{NNNN}"));
    expect(await within(form).findByText("INV-MPT20260043")).toBeInTheDocument();
    // Debounced: two quick edits, one request for the settled format.
    expect(api.preview).toHaveBeenCalledTimes(1);
  });

  it("says what's wrong without asking the server when there is no running number", async () => {
    const { user, form, input } = await openEditor();
    await user.clear(input);
    await user.type(input, "INV-");
    expect(await within(form).findByText("Add a running number, like {NNNN}.")).toBeInTheDocument();
    expect(api.preview).not.toHaveBeenCalled();
    expect(within(form).getByRole("button", { name: "Save series" })).toBeEnabled();
    await user.click(within(form).getByRole("button", { name: "Save series" }));
    expect(api.update).not.toHaveBeenCalled();
  });

  it("shows the server's word on an unknown token", async () => {
    const { user, form, input } = await openEditor();
    api.preview.mockRejectedValue(new ApiError("Unknown token {FOO}.", 422, { format: ["Unknown token {FOO}."] }));
    await user.click(within(form).getByRole("button", { name: /Insert \{MM\}/ }));
    expect(input.value).toBe("INV-{NNNN}{MM}");
    await user.type(input, "{{FOO}");
    expect(await within(form).findByText("Unknown token {FOO}.")).toBeInTheDocument();
  });

  it("saves the format, reset and start, and says changes apply from the next number", async () => {
    const { user, form, input } = await openEditor();
    expect(within(form).getByText(/The 42 already issued keep their numbers/)).toBeInTheDocument();
    api.update.mockResolvedValue({ id: "s-1", code: "invoice", format: "INV-{YYYY}-{NNNN}", reset: "yearly", preview: "INV-2026-0043" });

    input.setSelectionRange(4, 4);
    await user.click(within(form).getByRole("button", { name: /Insert \{YYYY\}/ }));
    await user.type(input, "-", { initialSelectionStart: 10, initialSelectionEnd: 10 });
    await waitFor(() => expect(api.preview).toHaveBeenLastCalledWith("INV-{YYYY}-{NNNN}"));
    await within(form).findByText("INV-2026-0043");

    await user.click(within(form).getByRole("button", { name: "Save series" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("s-1", { name: "Invoices", format: "INV-{YYYY}-{NNNN}", reset: "yearly", startAt: 1 }));
    expect(await screen.findByText("Invoices saved. The next number is INV-2026-0043.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });
});
