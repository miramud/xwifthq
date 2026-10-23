import { ChevronsUp, ChevronUp, Equal, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Pill, SectionCard } from "@/components/suite/ui";
import { ADMIN_DATA, type FacilityRequestRow } from "@/lib/suite-data";

/**
 * The internal service desk.
 *
 * Priority gets a glyph and a word rather than a colour, which keeps the page
 * inside Admin's ink and means the rank survives greyscale, colour-blindness
 * and a screen reader equally. The glyph is decorative because the word is
 * right beside it; announcing both would read the priority twice.
 */

const PRIORITY: Record<FacilityRequestRow["priority"], { icon: LucideIcon; weight: string }> = {
  Urgent: { icon: ChevronsUp, weight: "font-semibold text-neutral-900" },
  High: { icon: ChevronUp, weight: "font-medium text-neutral-800" },
  Normal: { icon: Equal, weight: "text-neutral-600" },
  Low: { icon: Minus, weight: "text-neutral-500" },
};

export function ServiceDeskQueue() {
  const rows = ADMIN_DATA.requests;
  const open = rows.filter((row) => row.status !== "Closed").length;

  return (
    <SectionCard
      title="Service desk"
      subtitle={`${open} open of 17 · last 7 raised`}
      bodyClassName="px-5 py-2"
    >
      <ul className="divide-y divide-neutral-100">
        {rows.map((row) => {
          const { icon: PriorityIcon, weight } = PRIORITY[row.priority];

          return (
            <li key={row.id} className="py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm font-medium text-neutral-900">
                  {row.type}
                </p>
                <span className="shrink-0 font-mono text-[11px] text-neutral-500 tnum">
                  {row.ref}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                {row.raisedBy} · {row.location}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs ${weight}`}>
                  <PriorityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {row.priority}
                </span>
                <span className="text-neutral-300" aria-hidden="true">
                  ·
                </span>
                <Pill tone={row.tone}>{row.status}</Pill>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
