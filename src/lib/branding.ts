"use client";

import type { CSSProperties } from "react";
import { useAuth, type AuthUser } from "@/lib/auth-store";

/* ------------------------------------------------------------------ */
/*  Institution branding                                               */
/* ------------------------------------------------------------------ */

/**
 * Co-branding, deliberately — not white-labelling.
 *
 * An institution's accent tints a handful of surfaces: the sidebar's active
 * item, its logo tile, the brand chip. It does **not** recolour the primary
 * violet scale, for three reasons:
 *
 *  • that violet is the product's own identity, and the brief treats it as
 *    fixed;
 *  • deriving ten readable shades from one arbitrary hex is unreliable, and a
 *    bad derivation reads as broken rather than branded;
 *  • the API only guarantees contrast for the accent against white. Shades it
 *    never validated could fail the very rule the validation exists to keep.
 *
 * Full white-labelling is a different product decision, and would need a
 * palette per tenant rather than a single colour.
 */

/** XwiftHQ's own purple, when an institution has set nothing. */
export const PLATFORM_ACCENT = "#9638cd";

export interface Branding {
  /** Null for the platform owner and self-serve marketplace customers. */
  organisationName: string | null;
  logoUrl: string | null;
  accent: string;
  /** Black or white — whichever reads on the accent. Computed server-side. */
  accentForeground: string;
  /** True when the institution has actually set something of its own. */
  isBranded: boolean;
}

export function brandingFor(user: AuthUser | null): Branding {
  const accent = user?.organisationAccentColor ?? null;

  return {
    organisationName: user?.organisationName ?? null,
    logoUrl: user?.organisationLogoUrl ?? null,
    accent: accent ?? PLATFORM_ACCENT,
    accentForeground: user?.organisationAccentForeground ?? "#ffffff",
    isBranded: Boolean(user?.organisationName),
  };
}

export function useBranding(): Branding {
  const { user } = useAuth();
  return brandingFor(user);
}

/**
 * CSS custom properties to spread onto a shell wrapper.
 *
 * Scoped to the element rather than set on `:root`, so the branded region is
 * bounded and the rest of the app keeps the platform palette — which matters
 * on shared screens like the public catalog.
 */
export function brandStyle(branding: Branding): CSSProperties {
  return {
    "--brand-accent": branding.accent,
    "--brand-accent-fg": branding.accentForeground,
  } as CSSProperties;
}

/**
 * Initials for the fallback logo tile, from the institution's name.
 * Two characters: more becomes unreadable at tile size.
 */
export function brandInitials(name: string | null): string {
  if (!name) return "XH";

  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "XH"
  );
}
