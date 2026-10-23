import {
  Award,
  Banknote,
  BriefcaseBusiness,
  ClipboardCheck,
  DoorOpen,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

/**
 * The employment lifecycle, drawn.
 *
 * The page's whole claim is that HRM owns the person from the offer to the
 * exit, so the lifecycle is the signature figure rather than a bullet list
 * halfway down. Seven stages, in order, each naming what HRM actually records
 * at that point. A stage with nothing behind it would be decoration.
 *
 * The ribbon sits in one pale bento tile. At `lg` the seven stages share a row
 * and a lilac rail runs through their round badges, because there a line means
 * "next". Below that the stages stack as small white cards and the step number
 * carries the order instead: a horizontal rail through a vertical stack says
 * the opposite of what it means, and a seven-wide row at 360px would push the
 * page sideways.
 */

interface Stage {
  icon: LucideIcon;
  title: string;
  detail: string;
}

const STAGES: Stage[] = [
  {
    icon: UserPlus,
    title: "Hire",
    detail: "Requisition, candidates and interviews, all the way to an accepted offer",
  },
  {
    icon: ClipboardCheck,
    title: "Onboard",
    detail: "Checklist, induction courses and probation tracked to confirmation",
  },
  {
    icon: BriefcaseBusiness,
    title: "Work",
    detail: "Rota, attendance, timesheets and leave, all against one balance",
  },
  {
    icon: Award,
    title: "Develop",
    detail: "KPIs, appraisals and finished training, on the same record",
  },
  {
    icon: Banknote,
    title: "Pay",
    detail: "Statutory deductions, employer cost and a journal posted to Finance",
  },
  {
    icon: TrendingUp,
    title: "Progress",
    detail: "Contract renewals and role changes, kept in the person's history",
  },
  {
    icon: DoorOpen,
    title: "Exit",
    detail: "Clearance and final pay, held until assets and advances are settled",
  },
];

export function LifecycleRibbon() {
  return (
    <div className="xw-tile p-4 sm:p-6 lg:px-4 lg:py-8">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7 lg:gap-0">
        {STAGES.map((stage, index) => (
          <li
            key={stage.title}
            className="rounded-2xl bg-white p-5 lg:rounded-none lg:bg-transparent lg:px-2 lg:py-0 lg:text-center"
          >
            {/* The rail with its badge. Below `lg` the badge stands alone. */}
            <div className="flex items-center gap-3 lg:gap-0">
              <span
                className={`hidden h-0.5 flex-1 lg:block ${
                  index === 0 ? "bg-transparent" : "bg-primary-200"
                }`}
                aria-hidden="true"
              />
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 ring-4 ring-white lg:bg-white lg:shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)] lg:ring-primary-50">
                <stage.icon className="h-5 w-5 text-violet-600" aria-hidden="true" />
              </span>
              <span
                className={`hidden h-0.5 flex-1 lg:block ${
                  index === STAGES.length - 1 ? "bg-transparent" : "bg-primary-200"
                }`}
                aria-hidden="true"
              />
              <span className="tnum text-xs font-semibold text-primary-700 lg:hidden">
                Step {index + 1}
              </span>
            </div>

            <p className="tnum mt-4 hidden text-xs font-semibold text-primary-700 lg:block">
              Step {index + 1}
            </p>
            <h3 className="xw-h3 mt-3 text-base lg:mt-1">{stage.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              {stage.detail}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
