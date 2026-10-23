"use client";

import Link from "next/link";
import { XwiftLockup } from "@/components/shared/BrandLogo";
import { brandInitials, type Branding } from "@/lib/branding";

/**
 * Whose product this is, at the top of a console sidebar.
 *
 * An institution's members see their institution. Everybody else — the
 * platform owner, self-serve customers — sees XwiftHQ. The subtitle names
 * the console either way, because "Acme Institute" alone does not tell you
 * whether you are in the admin console or the instructor studio.
 *
 * The fallback when an institution has a name but no logo is an initials tile
 * in their accent, not the platform lockup: showing somebody else's logo above
 * their own name reads as a mistake.
 */
export default function BrandMark({
  branding,
  console: consoleName,
  href = "/",
  onNavigate,
}: {
  branding: Branding;
  console: string;
  href?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="px-5 py-5">
      <Link
        href={href}
        onClick={onNavigate}
        className="inline-flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/40"
        aria-label={`${branding.organisationName ?? "XwiftHQ"} home`}
      >
        {branding.logoUrl ? (
          // Institution logos are arbitrary user-supplied URLs, which
          // next/image cannot optimise without every host being allowlisted.
          // Fixed height with `w-auto` keeps any aspect ratio from shifting the
          // sidebar as it loads.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.organisationName ?? "Logo"}
            className="h-8 w-auto max-w-[9rem] rounded bg-white/95 object-contain p-1"
          />
        ) : branding.isBranded ? (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
            style={{ background: "var(--brand-accent)", color: "var(--brand-accent-fg)" }}
          >
            {brandInitials(branding.organisationName)}
          </span>
        ) : (
          // The sidebar is dark, so the mark is reversed rather than dropped on
          // a white tile — a white plaque behind a logo is a workaround for a
          // raster asset, and this one is not raster.
          <XwiftLockup variant="reversed" markClassName="h-8 w-8" wordClassName="text-lg" />
        )}

        {branding.isBranded && (
          <span className="min-w-0 truncate font-heading text-sm font-semibold text-white">
            {branding.organisationName}
          </span>
        )}
      </Link>

      <p className="mt-2 text-[11px] tracking-wide text-neutral-400">
        {consoleName}
        {branding.isBranded && <span className="text-neutral-500"> · powered by XwiftHQ</span>}
      </p>
    </div>
  );
}
