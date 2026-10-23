import {
  GraduationCap,
  Package,
  SquareKanban,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The HRM hero's drawn mock: one employee record, and the four modules reading
 * off it.
 *
 * The whole argument for putting people in HRM rather than in five places is
 * that the other modules *borrow* the row instead of copying it — so the mock
 * is literally one record with four consumers hanging off it, not a prettier
 * HR dashboard.
 *
 * It sits on the deep teal hero, where `HUE.violet.tile` at 10% is
 * indistinguishable from the ground. So the tiles here are white at low alpha
 * with white glyphs, the same inversion `ProductHero` makes for its own tile.
 */

const READERS: { icon: LucideIcon; module: string; reads: string }[] = [
  { icon: GraduationCap, module: "LMS", reads: "Onboarding pathway · 2 of 6" },
  { icon: Wallet, module: "Finance", reads: "Payroll journal · cost centre OPS" },
  { icon: Package, module: "Admin", reads: "3 assets · 4 access grants" },
  { icon: SquareKanban, module: "Projects", reads: "2 delivery teams" },
];

const FACTS: { label: string; value: string }[] = [
  { label: "Position", value: "Regional Coordinator" },
  { label: "Grade", value: "M3" },
  { label: "Reports to", value: "Head of Operations" },
];

export function HrmHeroMock() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/[0.07] p-7 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold text-white">
            Employee record
          </p>
          <p className="label-mono tnum mt-1 text-white/70">EMP-0147</p>
        </div>
        <span className="label-mono rounded-full bg-white/10 px-3 py-1 text-white/70">
          Illustrative
        </span>
      </div>

      <dl className="mt-6 space-y-2.5 border-b border-white/10 pb-6">
        {FACTS.map((fact) => (
          <div key={fact.label} className="flex items-baseline gap-3 text-sm">
            <dt className="w-28 shrink-0 text-white/70">{fact.label}</dt>
            <dd className="min-w-0 text-white/85">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <p className="label-mono mt-6 text-white/70">Read by</p>

      <ul className="mt-3 space-y-2.5">
        {READERS.map((reader) => (
          <li key={reader.module} className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12">
              <reader.icon className="h-4 w-4 text-white" aria-hidden="true" />
            </span>
            <span className="min-w-0 text-sm text-white/70">
              <span className="font-semibold text-white">{reader.module}</span>
              <span className="text-white/30"> · </span>
              {reader.reads}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm leading-relaxed text-white/70">
        Four modules, one row. Nobody is created twice.
      </p>
    </div>
  );
}
