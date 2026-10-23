import { Code, Palette, type LucideIcon } from "lucide-react";
import { SPINE_FACILITIES } from "@/lib/products";

/**
 * What arrives with any module, at any tier, as a grid of pale bento tiles.
 *
 * The six shared services are read from `SPINE_FACILITIES` rather than retyped,
 * so this grid cannot drift from the platform page's version of the same list.
 * The notes live here because the registry carries labels only. Two entries
 * that are not shared services but are in every plan (branding and the API)
 * are appended locally.
 */

const NOTES: Record<string, string> = {
  Identity: "Each person is added once and logs in once, whichever modules they use.",
  "Org tree": "Set up your departments and branches once. Every module follows the same structure.",
  Permissions: "One role model across the whole suite, enforced on the server rather than hidden in the screens.",
  "Audit log": "Every change in every module lands in one trail, recorded the same way.",
  Notifications: "In-app, email and WhatsApp alerts, with one set of preferences wherever the event started.",
  Reporting: "Reports that cross modules, because every module reads the same data.",
};

const EXTRAS: { icon: LucideIcon; label: string; note: string }[] = [
  {
    icon: Palette,
    label: "Your own branding",
    note: "Your colours and logo, with contrast checked on the server so a brand colour never produces unreadable text.",
  },
  {
    icon: Code,
    label: "REST API",
    note: "The same API the screens use, scoped to your organisation, on every plan.",
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
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ITEMS.map((item) => {
        const Glyph = item.icon;
        return (
          <li key={item.label} className="xw-tile flex flex-col p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_1px_2px_rgb(16_18_31/0.06)]">
              <Glyph className="h-5 w-5 text-primary-600" aria-hidden="true" />
            </span>
            <h3 className="xw-h3 mt-5">{item.label}</h3>
            {item.note && <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
