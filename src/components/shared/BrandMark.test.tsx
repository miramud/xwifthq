import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BrandMark from "./BrandMark";
import { brandingFor, brandInitials, PLATFORM_ACCENT } from "@/lib/branding";
import type { AuthUser } from "@/lib/auth-store";

/**
 * Whose product this is, at the top of a console sidebar.
 *
 * The rule worth pinning down: an institution with a name but no logo gets an
 * initials tile, never the platform lockup. Showing XwiftHQ's logo above
 * "Acme Institute" reads as a mistake, not as co-branding.
 */

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    name: "Admin",
    email: "admin@acme.test",
    role: "admin",
    avatar: null,
    emailVerified: true,
    mustChangePassword: false,
    ...overrides,
  };
}

describe("BrandMark", () => {
  it("shows the platform lockup for someone in no organisation", () => {
    render(<BrandMark branding={brandingFor(user())} console="Admin Console" />);

    // The lockup is inline SVG plus a wordmark, so the link's accessible name
    // is what identifies it — there is no image alt to query.
    expect(screen.getByRole("link", { name: "XwiftHQ home" })).toBeInTheDocument();
    expect(screen.getByText("Admin Console")).toBeInTheDocument();
  });

  it("shows the institution's logo and name when it has one", () => {
    const branding = brandingFor(
      user({
        organisationName: "Acme Institute",
        organisationLogoUrl: "https://cdn.example.test/acme.png",
      }),
    );

    render(<BrandMark branding={branding} console="Admin Console" />);

    expect(screen.getByAltText("Acme Institute")).toHaveAttribute(
      "src",
      "https://cdn.example.test/acme.png",
    );
    expect(screen.getByText("Acme Institute")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "XwiftHQ home" })).not.toBeInTheDocument();
  });

  /** The case that would look like a bug if it fell back to the platform logo. */
  it("falls back to initials, not the platform logo, when branded without a logo", () => {
    const branding = brandingFor(user({ organisationName: "Acme Institute" }));

    render(<BrandMark branding={branding} console="Admin Console" />);

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "XwiftHQ home" })).not.toBeInTheDocument();
  });

  /** Co-branding, not white-labelling — the platform is still credited. */
  it("credits the platform underneath an institution's mark", () => {
    const branding = brandingFor(user({ organisationName: "Acme Institute" }));

    render(<BrandMark branding={branding} console="Admin Console" />);

    expect(screen.getByText(/powered by XwiftHQ/i)).toBeInTheDocument();
  });

  it("does not credit the platform to its own people", () => {
    render(<BrandMark branding={brandingFor(user())} console="Admin Console" />);

    expect(screen.queryByText(/powered by/i)).not.toBeInTheDocument();
  });

  /** "Acme Institute" alone does not say which console you are in. */
  it("always names the console", () => {
    const branding = brandingFor(user({ organisationName: "Acme Institute" }));

    render(<BrandMark branding={branding} console="Instructor Studio" />);

    expect(screen.getByText(/Instructor Studio/)).toBeInTheDocument();
  });
});

describe("brandingFor", () => {
  it("falls back to the platform accent when none is set", () => {
    const branding = brandingFor(user({ organisationName: "Acme Institute" }));

    expect(branding.accent).toBe(PLATFORM_ACCENT);
    expect(branding.isBranded).toBe(true);
  });

  it("uses the institution's accent and the server-computed foreground", () => {
    const branding = brandingFor(
      user({
        organisationName: "Acme",
        organisationAccentColor: "#0f766e",
        organisationAccentForeground: "#ffffff",
      }),
    );

    expect(branding.accent).toBe("#0f766e");
    expect(branding.accentForeground).toBe("#ffffff");
  });

  it("treats a signed-out visitor as unbranded", () => {
    const branding = brandingFor(null);

    expect(branding.isBranded).toBe(false);
    expect(branding.accent).toBe(PLATFORM_ACCENT);
  });
});

describe("brandInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(brandInitials("Acme Technical Institute")).toBe("AT");
  });

  it("handles a single word", () => {
    expect(brandInitials("Globex")).toBe("G");
  });

  it("falls back to the platform initials", () => {
    expect(brandInitials(null)).toBe("XH");
    expect(brandInitials("")).toBe("XH");
  });
});
