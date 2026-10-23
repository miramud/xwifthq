"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";

/**
 * Renders its children only for somebody who belongs to an institution.
 *
 * HR and Projects work inside one institution. The platform owner belongs to
 * none, and every screen in those consoles answered them with a 403 from
 * `EnsureInOrganisation` — so the page they saw was a column of "Could not
 * load" boxes, each true and none of them explaining anything. One sentence in
 * place of the page says why, and where to go instead.
 *
 * Presentation only. The API refuses regardless.
 */
export default function NeedsOrganisation({
  area,
  children,
}: {
  area: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  // Not signed in yet, or still loading: let the page's own guard decide.
  if (!user || user.organisationId) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6 text-center">
      <Building2 aria-hidden className="mx-auto mb-3 text-neutral-500" size={28} />
      <h2 className="text-base font-semibold text-neutral-900">
        {area} is run inside an institution
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        This account administers the platform and does not belong to an institution, so there
        is no {area} for it to open. Sign in as an institution&apos;s administrator to work in it.
      </p>
      <Link
        href="/suite/org/organisations"
        className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700"
      >
        View institutions
      </Link>
    </div>
  );
}
