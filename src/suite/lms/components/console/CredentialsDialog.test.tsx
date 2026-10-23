import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CredentialsDialog from "./CredentialsDialog";
import type { OneTimeCredential } from "@/lib/api/saas-client";

/**
 * This dialog guards the only data in the product that closing a window
 * destroys: generated passwords are hashed on the way into the database and
 * shown exactly once.
 *
 * Its obstructiveness is the feature, and obstructive UI is exactly what a
 * future refactor "tidies up". These tests exist so that tidying fails loudly.
 */

const CREDENTIALS: OneTimeCredential[] = [
  { name: "Ada Lovelace", email: "ada@acme.test", temporaryPassword: "AdaPass123456789" },
  { name: "Grace Hopper", email: "grace@acme.test", temporaryPassword: "GracePass12345678" },
];

let clipboardText = "";
let downloadedName: string | null = null;

beforeEach(() => {
  clipboardText = "";
  downloadedName = null;

  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(async (text: string) => {
        clipboardText = text;
      }),
    },
  });

  // jsdom implements neither of these.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:fake");
  globalThis.URL.revokeObjectURL = vi.fn();

  // Intercept the synthetic anchor click the download uses.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloadedName = this.download;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CredentialsDialog — the acknowledge gate", () => {
  it("keeps Done disabled until the admin confirms they saved the passwords", async () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));

    expect(done).toBeEnabled();
  });

  it("does not close while the passwords are unacknowledged", async () => {
    const onClose = vi.fn();
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).not.toHaveBeenCalled();
    // ...and says why, rather than doing nothing and looking broken.
    expect(screen.getByRole("alert")).toHaveTextContent(/gone for good/i);
  });

  /** Escape is the reflex that would cost an admin a whole re-import. */
  it("routes Escape through the same confirmation", async () => {
    const onClose = vi.fn();
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={onClose} />);

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("closes on Escape once acknowledged", async () => {
    const onClose = vi.fn();
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={onClose} />);

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  /**
   * Downloading is the strongest possible acknowledgement — the admin now has
   * the file — so it satisfies the gate on its own.
   */
  it("treats downloading the CSV as acknowledgement", async () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /download csv/i }));

    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
  });
});

describe("CredentialsDialog — getting the passwords out", () => {
  it("copies every credential as CSV, header included", async () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /copy all/i }));

    expect(clipboardText).toContain("name,email,temporary_password");
    expect(clipboardText).toContain("ada@acme.test");
    expect(clipboardText).toContain("AdaPass123456789");
    expect(clipboardText).toContain("GracePass12345678");
  });

  it("downloads a dated csv file", async () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /download csv/i }));

    expect(downloadedName).toMatch(/^xwifthq-credentials-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("copies a single password from its row", async () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Copy password for grace@acme.test" }),
    );

    expect(clipboardText).toBe("GracePass12345678");
  });

  it("shows every credential in the table", () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    const table = screen.getByRole("table");

    for (const credential of CREDENTIALS) {
      expect(within(table).getByText(credential.email)).toBeInTheDocument();
      expect(within(table).getByText(credential.temporaryPassword)).toBeInTheDocument();
    }
  });
});

describe("CredentialsDialog — telling the truth about what this is", () => {
  /**
   * The warning is the reason the admin behaves differently here than on any
   * other screen. If it is ever softened, this fails.
   */
  it("states that the passwords cannot be retrieved", () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    const warning = screen.getByText(/cannot be retrieved/i);

    expect(warning).toBeInTheDocument();
    expect(warning.textContent).toMatch(/once/i);
  });

  it("is a modal dialog labelled by its heading", () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Learners created");
  });

  it("counts the accounts it created", () => {
    render(<CredentialsDialog credentials={CREDENTIALS} onClose={vi.fn()} />);

    expect(screen.getByText(/2 accounts ready to hand out/i)).toBeInTheDocument();
  });

  it("uses the singular for one account", () => {
    render(<CredentialsDialog credentials={[CREDENTIALS[0]]} onClose={vi.fn()} />);

    expect(screen.getByText(/1 account ready to hand out/i)).toBeInTheDocument();
  });
});
