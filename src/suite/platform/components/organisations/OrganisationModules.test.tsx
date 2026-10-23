import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import OrganisationModules from "./OrganisationModules";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { ApiError, type LicenceRow, type OrganisationModule } from "@/lib/api/platform-client";

/**
 * Licensing modules by hand.
 *
 * What carries weight: the owner sees the ladder's verdict (new or upgrade,
 * list, credit, suggestion) before recording, what they type in naira reaches
 * the API in kobo, modules already bought can't be picked again, and a
 * recorded licence shows up in the history without a reload.
 */

const api = vi.hoisted(() => ({
  modules: vi.fn(),
  saveModules: vi.fn(),
  licences: vi.fn(),
  previewLicence: vi.fn(),
  recordLicence: vi.fn(),
}));

vi.mock("@/lib/api/platform-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-client")>();
  return { ...actual, platformOrganisations: { ...actual.platformOrganisations, ...api } };
});

// DataView reads the router to open rows; the test has no app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/organisations/acme",
  useSearchParams: () => new URLSearchParams(),
}));

const MODULES: OrganisationModule[] = [
  { key: "core", label: "Core", entitled: true, source: "default", since: null, until: null, released: true, earlyAccess: false },
  { key: "lms", label: "Learning", entitled: true, source: "licence", since: "2026-09-01", until: null, released: true, earlyAccess: false },
  { key: "hrm", label: "HR", entitled: false, source: "default", since: null, until: null, released: true, earlyAccess: false },
  { key: "projects", label: "Projects", entitled: false, source: "default", since: null, until: null, released: true, earlyAccess: false },
];

function licence(over: Partial<LicenceRow> = {}): LicenceRow {
  return {
    id: "lic-1",
    reference: "LIC-0001",
    status: "paid",
    organisation: { slug: "acme", name: "Acme Institute" },
    channel: "offline",
    gateway: "offline",
    kind: "new",
    modules: ["lms"],
    modulesBefore: 0,
    modulesAdded: 1,
    modulesAfter: 1,
    currency: "NGN",
    amountMinor: 250_000_000,
    listPriceMinor: 250_000_000,
    creditMinor: 0,
    discountMinor: 0,
    paymentMethod: "bank_transfer",
    paymentReference: "GTB-1",
    note: null,
    paidBy: null,
    recordedBy: { name: "Owner", email: "owner@xwifthq.test" },
    paidAt: "2026-09-01T09:00:00Z",
    createdAt: "2026-09-01T09:00:00Z",
    ...over,
  };
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.modules.mockResolvedValue(MODULES);
  api.licences.mockResolvedValue([licence()]);
  api.previewLicence.mockResolvedValue({
    kind: "upgrade",
    modulesBefore: 1,
    modulesAdded: 1,
    modulesAfter: 2,
    listPriceMinor: 450_000_000,
    creditMinor: 250_000_000,
    suggestedMinor: 200_000_000,
    currency: "NGN",
    modules: ["hrm"],
    alreadyLicensed: [],
  });
});

function renderTab() {
  return render(
    <ConfirmProvider>
      <OrganisationModules slug="acme" canManage organisationName="Acme Institute" />
    </ConfirmProvider>,
  );
}

async function openDialog() {
  const user = userEvent.setup();
  renderTab();
  await screen.findByText("LIC-0001");
  await user.click(screen.getAllByRole("button", { name: /record a licence/i })[0]);
  const dialog = await screen.findByRole("dialog", { name: /record a licence/i });
  return { user, dialog };
}

describe("OrganisationModules — licences", () => {
  it("lists the licence history with what was paid against the list price", async () => {
    renderTab();
    expect(await screen.findByText("LIC-0001")).toBeInTheDocument();
    expect(screen.getByText("At list price")).toBeInTheDocument();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("shows the ladder's verdict, converts naira to kobo, records and refreshes the history", async () => {
    const { user, dialog } = await openDialog();

    // Already bought: shown, but not pickable again.
    expect(within(dialog).getByRole("checkbox", { name: /learning/i })).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox", { name: /^hr/i }));

    await waitFor(() => expect(api.previewLicence).toHaveBeenCalledWith("acme", { modules: ["hrm"], currency: "NGN" }));
    expect(await within(dialog).findByText("Upgrade")).toBeInTheDocument();
    expect(within(dialog).getByText("1 → 2")).toBeInTheDocument();
    expect(within(dialog).getByText("₦4,500,000")).toBeInTheDocument();
    expect(within(dialog).getByText("− ₦2,500,000")).toBeInTheDocument();

    const amount = within(dialog).getByLabelText(/amount paid/i);
    // Prefilled with the suggestion, in major units.
    expect(amount).toHaveValue("2000000");

    await user.clear(amount);
    await user.type(amount, "1,800,000.50");
    expect(within(dialog).getByText(/₦199,999.50 below list/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/payment reference/i), "GTB-778812");

    const recorded = licence({
      id: "lic-2",
      reference: "LIC-0002",
      kind: "upgrade",
      modules: ["hrm"],
      modulesBefore: 1,
      modulesAfter: 2,
      amountMinor: 180_000_050,
      listPriceMinor: 450_000_000,
      creditMinor: 250_000_000,
      discountMinor: 19_999_950,
      paymentReference: "GTB-778812",
    });
    api.recordLicence.mockResolvedValue(recorded);
    api.licences.mockResolvedValue([recorded, licence()]);

    await user.click(within(dialog).getByRole("button", { name: /record licence/i }));

    await waitFor(() =>
      expect(api.recordLicence).toHaveBeenCalledWith("acme", {
        modules: ["hrm"],
        currency: "NGN",
        amountMinor: 180_000_050,
        method: "bank_transfer",
        reference: "GTB-778812",
        paidOn: today(),
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.licences).toHaveBeenCalledTimes(2);
    expect(api.modules).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("LIC-0002")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/LIC-0002 recorded: HR is on for good/);
  });

  it("re-prices in dollars when the currency changes", async () => {
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("checkbox", { name: /projects/i }));
    await waitFor(() => expect(api.previewLicence).toHaveBeenCalledTimes(1));
    await user.click(within(dialog).getByRole("radio", { name: /dollars/i }));
    await waitFor(() =>
      expect(api.previewLicence).toHaveBeenLastCalledWith("acme", { modules: ["projects"], currency: "USD" }),
    );
  });

  it("shows the server's field errors beside the fields", async () => {
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("checkbox", { name: /^hr/i }));
    await within(dialog).findByText("Upgrade");
    await user.type(within(dialog).getByLabelText(/payment reference/i), "GTB-1");

    api.recordLicence.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        amountMinor: ["Enter what was paid, or choose Complimentary if nothing was."],
      }),
    );
    await user.click(within(dialog).getByRole("button", { name: /record licence/i }));

    expect(await within(dialog).findByText("Enter what was paid, or choose Complimentary if nothing was.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/amount paid/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("asks for a note when the licence is complimentary, and sends zero", async () => {
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("checkbox", { name: /^hr/i }));
    await within(dialog).findByText("Upgrade");
    await chooseOption(user, within(dialog).getByLabelText(/payment method/i), "Complimentary");
    await user.click(within(dialog).getByRole("button", { name: /record licence/i }));

    expect(await within(dialog).findByText("Say why, for the audit trail.")).toBeInTheDocument();
    expect(api.recordLicence).not.toHaveBeenCalled();

    api.recordLicence.mockResolvedValue(licence({ id: "lic-3", reference: "LIC-0003", modules: ["hrm"], amountMinor: 0 }));
    await user.type(within(dialog).getByLabelText(/^note/i), "Pilot partner");
    await user.click(within(dialog).getByRole("button", { name: /record licence/i }));

    await waitFor(() =>
      expect(api.recordLicence).toHaveBeenCalledWith(
        "acme",
        expect.objectContaining({ amountMinor: 0, method: "complimentary", note: "Pilot partner" }),
      ),
    );
  });
});

describe("OrganisationModules — early access", () => {
  // Finance is licensed but unreleased deployment-wide; Inventory is unreleased and off.
  const WITH_UNRELEASED: OrganisationModule[] = [
    ...MODULES,
    { key: "finance", label: "Finance", entitled: true, source: "licence", since: "2026-10-01", until: null, released: false, earlyAccess: false },
    { key: "inventory", label: "Inventory", entitled: false, source: "default", since: null, until: null, released: false, earlyAccess: false },
  ];

  beforeEach(() => {
    api.modules.mockResolvedValue(WITH_UNRELEASED);
  });

  it("offers the switch only on unreleased modules, and only once they are on", async () => {
    renderTab();
    const finance = await screen.findByRole("switch", { name: "Finance early access" });
    expect(finance).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Inventory early access" })).toBeDisabled();
    for (const name of ["Learning", "HR", "Projects", "Core"]) {
      expect(screen.queryByRole("switch", { name: `${name} early access` })).not.toBeInTheDocument();
    }
    expect(screen.getAllByText("Preview until released")).toHaveLength(2);
  });

  it("marks the change unsaved, sends earlyAccess in the save and shows the chip after", async () => {
    const user = userEvent.setup();
    renderTab();
    const finance = await screen.findByRole("switch", { name: "Finance early access" });
    await user.click(finance);

    expect(finance).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1 unsaved change.")).toBeInTheDocument();
    expect(screen.getByText("Will open early")).toBeInTheDocument();

    api.saveModules.mockResolvedValue(
      WITH_UNRELEASED.map((m) => (m.key === "finance" ? { ...m, earlyAccess: true } : m)),
    );
    await user.click(screen.getByRole("button", { name: /save modules/i }));

    await waitFor(() => expect(api.saveModules).toHaveBeenCalledTimes(1));
    const [, sent] = api.saveModules.mock.calls[0];
    expect(sent).toContainEqual({ key: "finance", enabled: true, until: null, earlyAccess: true });
    expect(sent).toContainEqual({ key: "inventory", enabled: false, until: null, earlyAccess: false });
    // Released modules don't carry the flag.
    expect(sent.find((c: { key: string }) => c.key === "hrm")).not.toHaveProperty("earlyAccess");

    expect(await screen.findByText("Early access", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("No unsaved changes.")).toBeInTheDocument();
    expect(screen.getAllByText("Preview until released")).toHaveLength(1);
  });

  it("switching the module off clears early access", async () => {
    const user = userEvent.setup();
    api.modules.mockResolvedValue(
      WITH_UNRELEASED.map((m) => (m.key === "finance" ? { ...m, earlyAccess: true } : m)),
    );
    renderTab();
    const early = await screen.findByRole("switch", { name: "Finance early access" });
    expect(early).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("switch", { name: "Finance licensed" }));
    expect(early).toHaveAttribute("aria-checked", "false");
    expect(early).toBeDisabled();
  });
});
