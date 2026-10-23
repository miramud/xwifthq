import { Banknote, Check, IdCard, UserCog, Users, type LucideIcon } from "lucide-react";

/**
 * Who opens HRM, and what they open it for.
 *
 * Four roles rather than four personas: each one is a real set of permissions
 * in the module, and the lines under it are things that role actually does.
 * No photographs; the page draws its people as roles, not as stock faces.
 *
 * Cards alternate between the white glow card and the pale tile, the same
 * rhythm as the stat row. The round white badge carries the HRM hue on its
 * glyph only, and every list uses the purple check circle.
 */

interface Role {
  icon: LucideIcon;
  title: string;
  opensItFor: string;
  does: string[];
}

const ROLES: Role[] = [
  {
    icon: Users,
    title: "HR Manager",
    opensItFor: "The whole employee lifecycle, and the numbers behind it.",
    does: [
      "Runs hiring from requisition and interviews to a signed offer",
      "Owns leave policies, job titles and contract terms",
      "Sees headcount, attrition and absence without asking for an export",
    ],
  },
  {
    icon: UserCog,
    title: "Supervisor",
    opensItFor: "Their own people under My team: approvals, cover and reviews.",
    does: [
      "Approves leave and timesheets for direct reports",
      "Sees who is in, who is on leave and who is still on probation",
      "Sets KPIs, logs progress and completes the appraisal",
    ],
  },
  {
    icon: IdCard,
    title: "Employee",
    opensItFor: "Their own record, without sending a single email.",
    does: [
      "Requests leave against a balance they can already see",
      "Downloads payslips, contracts and personal documents",
      "Raises a grievance privately, without going through their manager",
    ],
  },
  {
    icon: Banknote,
    title: "Payroll Officer",
    opensItFor: "The pay run, the statutory schedules and the ledger posting.",
    does: [
      "Sets up earnings and deductions once, for every run",
      "Runs payroll with overtime and approved adjustments already in",
      "Checks employer cost per run and posts the journal to Finance",
    ],
  },
];

export function HrmAudience() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {ROLES.map((role, index) => (
        <article
          key={role.title}
          className={`flex flex-col p-6 sm:p-7 ${index % 3 === 0 ? "xw-glow-card" : "xw-tile"}`}
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]">
              <role.icon className="h-5 w-5 text-violet-600" aria-hidden="true" />
            </span>
            <h3 className="xw-h3">{role.title}</h3>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-neutral-600">
            {role.opensItFor}
          </p>

          <ul className="mt-5 space-y-3">
            {role.does.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm leading-relaxed text-neutral-700"
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3 text-primary-700" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
