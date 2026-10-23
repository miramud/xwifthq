import { Code, Palette, type LucideIcon } from "lucide-react";
import { SPINE_FACILITIES } from "@/lib/products";

/**
 * What arrives with any module, at any tier.
 *
 * The six shared services are read from `SPINE_FACILITIES` rather than retyped,
 * so this grid cannot drift from the platform page's version of the same list.
 * The notes live here because the registry carries labels only — two entries
 * that are not shared services but are in every plan (branding and the API) are
 * appended locally and marked as such.
 */

const NOTES: Record<string, string> = {
  Identity:
    "A person is created once and signs in once, whichever modules they use.",
  "Org tree":
    "Elevate Admin defines the organisation; every other module inherits it.",
  Permissions:
    "One role model across the suite, enforced in the API rather than in the UI.",
  "Audit log":
    "Every mutation in every module lands in the same trail, with the same shape.",
  Notifications:
    "In-app, email and WhatsApp — one set of preferences, wherever the event came from.",
  Reporting:
    "Cross-module reports, because five modules are reading one dataset.",
};

const EXTRAS: { icon: LucideIcon; label: string; note: string }[] = [
  {
    icon: Palette,
    label: "Per-organisation branding",
    note: "Your colours and mark, with foreground contrast checked server-side so a brand accent cannot ship a WCAG failure.",
  },
  {
    icon: Code,
    label: "REST API",
    note: "The same API the interface uses, scoped to your organisation, on every plan.",
  },
];

const ITEMS = [
  ...SPINE_FACILITIES.map((facility) => ({
    icon: facility.icon,
    label: facility.label,
    note: NOTES[facility.label] ?? "",
  })),
  ...EXTRAS,
];

export function SpineIncludes() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {ITEMS.map((item) => {
        const Glyph = item.icon;
        return (
          <li
            key={item.label}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10">
              <Glyph className="h-5 w-5 text-primary-600" aria-hidden="true" />
            </span>
            <p className="mt-4 font-heading text-sm font-semibold text-neutral-900">
              {item.label}
            </p>
            {item.note && (
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {item.note}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
