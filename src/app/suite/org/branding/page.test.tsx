import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BrandingPage from "./page";

/**
 * The branding screen.
 *
 * Its job is to stop an institution shipping an interface its own people
 * cannot read. The contrast check runs as the admin types, using the same WCAG
 * maths the API enforces on save, so the refusal is never a surprise at the
 * end of the form.
 */

let currentUser: Record<string, unknown> | null = {
  role: "admin",
  name: "Admin",
  organisationId: "org-1",
};

const refresh = vi.fn();

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false, refresh }),
  AuthError: class extends Error {},
}));

// The logo uploader talks to Cloudinary; irrelevant here and replaced with a
// stub so the form's own behaviour is what is under test.
vi.mock("@/suite/lms/components/instructor/ThumbnailUploader", () => ({
  default: () => <div data-testid="logo-uploader" />,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "admin", name: "Admin", organisationId: "org-1" };

  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        name: "Acme Institute",
        description: "",
        whatsappNumber: null,
        logoUrl: null,
        accentColor: "#0c4f54",
      },
    }),
  });

  vi.stubGlobal("fetch", fetchMock);
});

describe("BrandingPage — access", () => {
  it("tells the platform owner branding belongs to an organisation", () => {
    currentUser = { role: "super_admin", name: "Owner", organisationId: null };

    render(<BrandingPage />);

    expect(screen.getByText(/branding belongs to an organisation/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("BrandingPage — WhatsApp number", () => {
  /**
   * The number is the institution's opt-in to the channel — there is no
   * separate switch, so the field has to say what leaving it empty means.
   */
  it("explains that an empty number simply sends nothing", async () => {
    render(<BrandingPage />);

    expect(await screen.findByLabelText(/whatsapp number/i)).toHaveValue("");
    expect(screen.getByText(/leave it empty and nothing is sent/i)).toBeInTheDocument();
  });

  it("sends the number the institution typed", async () => {
    const user = userEvent.setup();
    render(<BrandingPage />);

    await user.type(await screen.findByLabelText(/whatsapp number/i), "+234 803 555 0101");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patch).toBeDefined();
      expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
        whatsappNumber: "+234 803 555 0101",
      });
    });
  });

  /** Clearing it is a decision, not an unfinished form. */
  it("sends null when the number is cleared", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          name: "Acme Institute",
          description: "",
          whatsappNumber: "+2348035550101",
          logoUrl: null,
          accentColor: "#0c4f54",
        },
      }),
    });

    const user = userEvent.setup();
    render(<BrandingPage />);

    await user.clear(await screen.findByLabelText(/whatsapp number/i));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ whatsappNumber: null });
    });
  });
});

describe("BrandingPage — contrast guard", () => {
  /**
   * The reason the screen exists. A pale accent would make white button text
   * invisible for everybody in the institution.
   */
  it("blocks saving and explains when the accent is too pale", async () => {
    render(<BrandingPage />);

    const hex = await screen.findByLabelText(/or type a hex/i);

    await userEvent.clear(hex);
    await userEvent.type(hex, "#ffff00");

    expect(await screen.findByText(/below the 4.5:1 minimum/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save branding/i })).toBeDisabled();
  });

  it("confirms a legible accent and allows saving", async () => {
    render(<BrandingPage />);

    const hex = await screen.findByLabelText(/or type a hex/i);

    await userEvent.clear(hex);
    await userEvent.type(hex, "#0f766e");

    expect(await screen.findByText(/that reads clearly/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save branding/i })).toBeEnabled();
  });

  /** The figure itself, not just a verdict — an admin tuning a shade needs it. */
  it("shows the measured ratio", async () => {
    render(<BrandingPage />);

    await screen.findByLabelText(/or type a hex/i);

    // Black on white is the maximum, 21:1.
    const hex = screen.getByLabelText(/or type a hex/i);
    await userEvent.clear(hex);
    await userEvent.type(hex, "#000000");

    expect(await screen.findByText(/21.0:1/)).toBeInTheDocument();
  });

  it("resets to the platform accent on request", async () => {
    render(<BrandingPage />);

    const hex = await screen.findByLabelText(/or type a hex/i);
    await userEvent.clear(hex);
    await userEvent.type(hex, "#0f766e");

    await userEvent.click(screen.getByRole("button", { name: /reset to default/i }));

    expect(screen.getByLabelText(/or type a hex/i)).toHaveValue("#0c4f54");
  });
});

describe("BrandingPage — saving", () => {
  it("sends the branding and re-reads the session so the sidebar updates", async () => {
    render(<BrandingPage />);

    await screen.findByLabelText(/institution name/i);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });

    await userEvent.click(screen.getByRole("button", { name: /save branding/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/organisation",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    // Branding rides on the session, so it has to be re-read or the sidebar
    // keeps showing the old mark until a reload.
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText(/your console has been updated/i)).toBeInTheDocument();
  });

  it("surfaces the API's own reason when it refuses", async () => {
    render(<BrandingPage />);

    await screen.findByLabelText(/institution name/i);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        message: "The given data was invalid.",
        errors: { accentColor: ["That colour is too pale to carry white text."] },
      }),
    });

    await userEvent.click(screen.getByRole("button", { name: /save branding/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too pale/i);
  });

  it("will not save without a name", async () => {
    render(<BrandingPage />);

    const name = await screen.findByLabelText(/institution name/i);
    await userEvent.clear(name);

    expect(screen.getByRole("button", { name: /save branding/i })).toBeDisabled();
  });
});

describe("BrandingPage — preview", () => {
  /** An accent cannot be judged from a hex code, only from what it colours. */
  it("previews the sidebar with the institution's name", async () => {
    render(<BrandingPage />);

    expect(await screen.findByText(/how your sidebar will look/i)).toBeInTheDocument();

    const name = screen.getByLabelText(/institution name/i);
    await userEvent.clear(name);
    await userEvent.type(name, "Globex Academy");

    // Shown in the preview as well as the field.
    expect(screen.getAllByText("Globex Academy").length).toBeGreaterThan(0);
  });

  it("falls back to a placeholder name in the preview", async () => {
    render(<BrandingPage />);

    const name = await screen.findByLabelText(/institution name/i);
    await userEvent.clear(name);

    expect(screen.getByText("Your institution")).toBeInTheDocument();
  });
});
