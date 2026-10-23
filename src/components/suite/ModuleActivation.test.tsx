import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleActivation } from "./ModuleActivation";

/**
 * The platform owner activates modules. The preview page routes the ask to
 * the right person: an admin raises it with the platform owner, anybody else
 * is told it's their admin's call.
 */

const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));

const preview = [{ key: "hrm", label: "HR", status: "preview" }];

beforeEach(() => {
  auth.user = null;
});

describe("asking for a module", () => {
  it("gives an admin a prefilled request to the platform administrator", () => {
    auth.user = { role: "admin", organisationId: "o1", organisationName: "Meridian", modules: preview };
    render(<ModuleActivation module="hrm" openHref="/suite/hrm" />);

    const link = screen.getByRole("link", { name: "Contact your platform administrator" });
    // Addressed to the platform owner, not back to this organisation's admins (O7).
    expect(link.getAttribute("href")).toBe(`/support?to=platform&subject=${encodeURIComponent("Please activate HR for Meridian")}`);
  });

  it("lets an admin get the module, with it preselected on Plan & billing", () => {
    auth.user = { role: "admin", organisationId: "o1", organisationName: "Meridian", modules: preview };
    render(<ModuleActivation module="hrm" openHref="/suite/hrm" />);

    expect(screen.getByRole("link", { name: "Get HR" })).toHaveAttribute("href", "/suite/org/billing?module=hrm");
  });

  it("tells a user it's their admin's call, with no request button", () => {
    auth.user = { role: "user", organisationId: "o1", organisationName: "Meridian", modules: preview };
    render(<ModuleActivation module="hrm" openHref="/suite/hrm" />);

    expect(screen.getByText(/ask your organisation's admin/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers the way in when the module is already on", () => {
    auth.user = { role: "user", organisationId: "o1", organisationName: "Meridian", modules: [{ key: "hrm", label: "HR", status: "active" }] };
    render(<ModuleActivation module="hrm" openHref="/suite/hrm" />);

    expect(screen.getByRole("link", { name: /Open HR/ })).toHaveAttribute("href", "/suite/hrm");
  });
});
