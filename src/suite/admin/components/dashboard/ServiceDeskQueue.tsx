import { ChevronsUp, ChevronUp, Equal, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Pill, SectionCard } from "@/components/suite/ui";
import { HUE, type Hue } from "@/components/workspace/modules";
import { ADMIN_DATA, type FacilityRequestRow } from "@/lib/suite-data";

/**
 * The internal service desk.
 *
 * Each request leads with a tinted tile whose glyph and hue mark its
 * priority, and the priority word sits beside the status pill, so the rank
 * survives greyscale, colour blindness and a screen reader equally. The tile
 * is decorative because the word is right beside it; announcing both would
 * read the priority twice.
 */

const PRIORITY: Record<FacilityRequestRow["priority"], { icon: LucideIcon; hue: Hue }> = {
  Urgent: { icon: ChevronsUp, hue: "rose" },
  High: { icon: ChevronUp, hue: "coral" },
  Normal: { icon: Equal, hue: "sky" },
  Low: { icon: Minus, hue: "slate" },
};

export function ServiceDeskQueue() {
  const rows = ADMIN_DATA.requests;
  const open = rows.filter((row) => row.status !== "Closed").length;

  return (
    <SectionCard
      title="Service desk"
      subtitle={`${open} open of 17 · the last 7 raised`}
      bodyClassName="px-5 py-2"
    >
      <ul className="divide-y divide-neutral-100">
        {rows.map((row) => {
          const { icon: PriorityIcon, hue } = PRIORITY[row.priority];

          return (
            <li key={row.id} className="flex items-start gap-3 py-3.5">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${HUE[hue].soft}`}
                aria-hidden="true"
              >
                <PriorityIcon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-sm font-semibold text-neutral-900">
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
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${HUE[hue].soft}`}
                  >
                    {row.priority}
                  </span>
                  <Pill tone={row.tone}>{row.status}</Pill>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
