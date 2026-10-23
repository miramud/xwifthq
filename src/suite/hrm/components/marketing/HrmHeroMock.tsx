import {
  GraduationCap,
  Package,
  SquareKanban,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The HRM drawn mock: one employee record, and the four modules reading off it.
 *
 * The case for keeping people in HRM rather than in five places is that the
 * other modules borrow the record instead of copying it. So the mock is one
 * record with four readers hanging off it, not a prettier HR dashboard.
 *
 * It is a white frame on a soft purple glow (`.xw-frame`), so it reads on the
 * white and lilac grounds it sits on. Each reader gets a round lilac badge;
 * the module's own hue only marks the record's status dot.
 */

const READERS: { icon: LucideIcon; module: string; reads: string }[] = [
  { icon: GraduationCap, module: "LMS", reads: "Onboarding path, 2 of 6 done" },
  { icon: Wallet, module: "Finance", reads: "Payroll journal, cost centre OPS" },
  { icon: Package, module: "Admin", reads: "3 assets and 4 access grants" },
  { icon: SquareKanban, module: "Projects", reads: "On 2 delivery teams" },
];

const FACTS: { label: string; value: string }[] = [
  { label: "Position", value: "Regional Coordinator" },
  { label: "Grade", value: "M3" },
  { label: "Reports to", value: "Head of Operations" },
];

export function HrmHeroMock() {
  return (
    <div className="xw-frame mx-auto max-w-md p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-semibold text-white"
            aria-hidden="true"
          >
            AO
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-bold tracking-[-0.01em] text-neutral-900">
              Employee record
            </p>
            <p className="tnum mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" />
              EMP-0147, active
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
          Illustrative
        </span>
      </div>

      <dl className="mt-5 space-y-2 rounded-2xl bg-neutral-50 p-4">
        {FACTS.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="shrink-0 text-neutral-500">{fact.label}</dt>
            <dd className="min-w-0 text-right font-medium text-neutral-900">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-xs font-semibold text-neutral-900">Read by</p>

      <ul className="mt-3 space-y-2">
        {READERS.map((reader) => (
          <li
            key={reader.module}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50">
              <reader.icon className="h-4 w-4 text-primary-600" aria-hidden="true" />
            </span>
            <span className="min-w-0 text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">{reader.module}</span>
              <span className="text-neutral-300"> · </span>
              {reader.reads}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-sm leading-relaxed text-neutral-600">
        Four modules, one record. Nobody is ever entered twice.
      </p>
    </div>
  );
}
