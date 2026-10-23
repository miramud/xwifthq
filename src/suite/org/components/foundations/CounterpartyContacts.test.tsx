import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsPanel, { contactPatch } from "./CounterpartyContacts";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { Counterparty, CounterpartyContact } from "@/lib/api/org-foundations-client";

/** Contact people on a client or vendor: add, edit, make main, remove with a confirm. */

const api = vi.hoisted(() => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
  makePrimaryContact: vi.fn(),
  removeContact: vi.fn(),
}));

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, counterparties: api } };
});

const ngozi: CounterpartyContact = {
  id: "ct-1",
  name: "Ngozi Eze",
  jobTitle: "Accounts officer",
  email: "ngozi@acme.test",
  phone: "+234 803 000 0001",
  purposes: ["accounts", "remittance"],
  isPrimary: true,
  notes: null,
  active: true,
};
const emeka: CounterpartyContact = { ...ngozi, id: "ct-2", name: "Emeka Obi", jobTitle: null, email: null, phone: null, purposes: ["sales"], isPrimary: false };

const CP = {
  id: "cp-1",
  name: "Acme Supplies",
  contacts: [ngozi, emeka],
} as unknown as Counterparty;

const onSaved = vi.fn();

function renderPanel(cp: Counterparty = CP) {
  return render(
    <ConfirmProvider>
      <ContactsPanel cp={cp} onSaved={onSaved} />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  onSaved.mockReset();
});

describe("contact people", () => {
  it("lists them with the main contact marked and links to write or ring", () => {
    renderPanel();
    const row = screen.getByText("Ngozi Eze").closest("li")!;
    expect(within(row).getByText("Main contact")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /ngozi@acme.test/ })).toHaveAttribute("href", "mailto:ngozi@acme.test");
    expect(within(row).getByRole("link", { name: /\+234 803/ })).toHaveAttribute("href", "tel:+2348030000001");
    expect(within(row).getByText("Remittance")).toBeInTheDocument();
    // Only the others can be made main.
    expect(within(row).queryByRole("button", { name: "Make main" })).not.toBeInTheDocument();
  });

  it("says what to do when there are none", () => {
    renderPanel({ ...CP, contacts: [] });
    expect(screen.getByText(/No contacts yet/)).toBeInTheDocument();
  });

  it("makes another contact the main one", async () => {
    const user = userEvent.setup();
    api.makePrimaryContact.mockResolvedValue({ ...CP });
    renderPanel();
    const row = screen.getByText("Emeka Obi").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Make main" }));
    expect(api.makePrimaryContact).toHaveBeenCalledWith("cp-1", "ct-2");
    expect(onSaved).toHaveBeenCalledWith(expect.anything(), "Emeka Obi is now the main contact.");
  });

  it("adds a contact with what they are the contact for", async () => {
    const user = userEvent.setup();
    api.addContact.mockResolvedValue({ ...CP });
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Add contact" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Add contact" }));
    expect(await within(dialog).findByText("Give their name.")).toBeInTheDocument();
    expect(api.addContact).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Name"), "Bola Ade");
    await user.type(within(dialog).getByLabelText(/Email/), "bola@acme.test");
    await user.click(within(dialog).getByRole("button", { name: "Technical" }));
    await user.click(within(dialog).getByRole("button", { name: "Add contact" }));
    expect(api.addContact).toHaveBeenCalledWith("cp-1", expect.objectContaining({ name: "Bola Ade", email: "bola@acme.test", purposes: ["technical"], jobTitle: null }));
    expect(api.addContact.mock.calls[0][1]).not.toHaveProperty("isPrimary");
  });

  it("removes a contact only after confirming", async () => {
    const user = userEvent.setup();
    api.removeContact.mockResolvedValue({ ...CP, contacts: [ngozi] });
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Remove Emeka Obi" }));
    const confirm = await screen.findByRole("alertdialog").catch(() => screen.getByRole("dialog"));
    expect(confirm).toHaveTextContent("recycle bin");
    expect(api.removeContact).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole("button", { name: "Remove contact" }));
    expect(api.removeContact).toHaveBeenCalledWith("cp-1", "ct-2");
  });
});

describe("contactPatch", () => {
  const base = { name: "Ngozi Eze", jobTitle: "Accounts officer", email: "ngozi@acme.test", phone: "+234 803 000 0001", purposes: ["remittance", "accounts"] as CounterpartyContact["purposes"], notes: "", active: true, isPrimary: true };

  it("sends only what changed", () => {
    expect(contactPatch(ngozi, base)).toEqual({});
    expect(contactPatch(ngozi, { ...base, phone: " ", active: false })).toEqual({ phone: null, active: false });
  });

  it("asks for primary only when it is newly wanted", () => {
    expect(contactPatch(emeka, { ...base, name: "Emeka Obi", jobTitle: "", email: "", phone: "", purposes: ["sales"], isPrimary: true })).toEqual({ isPrimary: true });
  });
});
