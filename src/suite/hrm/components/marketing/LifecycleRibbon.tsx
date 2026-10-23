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
 * This page's whole claim is that HRM owns the person from the offer to the
 * exit, so the lifecycle is the page's signature figure rather than a bullet
 * list halfway down. Seven stages, in order, each naming what HRM actually
 * records at that point — a stage with nothing behind it would be decoration.
 *
 * The rail that joins the stages only draws at `lg`, where seven cells sit in
 * a row and a line means "next". Below that the cells stack and the mono index
 * carries the order instead: a horizontal rail through a vertical stack says
 * the opposite of what it means, and a seven-wide row at 320px would push the
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
    detail: "Requisition, candidates, interviews, then an offer and acceptance",
  },
  {
    icon: ClipboardCheck,
    title: "Onboard",
    detail: "Checklist, induction courses, and probation tracked to confirmation",
  },
  {
    icon: BriefcaseBusiness,
    title: "Work",
    detail: "Rota, attendance, timesheets and leave against one balance",
  },
  {
    icon: Award,
    title: "Develop",
    detail: "KPIs, appraisals and the training finished, on the same record",
  },
  {
    icon: Banknote,
    title: "Pay",
    detail: "Statutory deductions, employer cost and the journal posted to Finance",
  },
  {
    icon: TrendingUp,
    title: "Progress",
    detail: "Contract renewals and changes of role, kept on the person's history",
  },
  {
    icon: DoorOpen,
    title: "Exit",
    detail: "Clearance and final pay, held until assets and advances are back",
  },
];

export function LifecycleRibbon() {
  return (
    <ol className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-7 lg:gap-x-0">
      {STAGES.map((stage, index) => (
        <li key={stage.title} className="lg:px-1.5">
          {/* The rail. Decorative: the list itself already carries the order. */}
          <div className="hidden items-center lg:flex" aria-hidden="true">
            <span
              className={`h-px flex-1 ${
                index === 0 ? "bg-transparent" : "bg-violet-500/25"
              }`}
            />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-violet-500 bg-white" />
            <span
              className={`h-px flex-1 ${
                index === STAGES.length - 1
                  ? "bg-transparent"
                  : "bg-violet-500/25"
              }`}
            />
          </div>

          <div className="flex items-center gap-3 lg:mt-5 lg:block">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <stage.icon
                className="h-5 w-5 text-violet-600"
                aria-hidden="true"
              />
            </span>
            <p className="label-mono text-neutral-500 lg:mt-4">
              <span className="tnum">
                {String(index + 1).padStart(2, "0")}
              </span>
            </p>
          </div>

          <h3 className="mt-2 font-heading text-base font-semibold text-neutral-900">
            {stage.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
            {stage.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}
