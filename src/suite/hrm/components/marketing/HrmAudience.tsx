import { Banknote, IdCard, UserCog, Users, type LucideIcon } from "lucide-react";

/**
 * Who opens HRM, and what they open it for.
 *
 * Four roles rather than four personas: each one is a real set of permissions
 * in the module, and the lines under it are things that role actually does.
 * No photographs — the page draws its people as roles, not as stock faces.
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
    opensItFor: "The whole employment lifecycle, and the numbers behind it.",
    does: [
      "Runs recruitment from requisition through interviews to an accepted offer",
      "Maintains leave policies, job titles and contract terms",
      "Reads headcount, attrition and absence without asking for an export",
    ],
  },
  {
    icon: UserCog,
    title: "Supervisor",
    opensItFor: "Their own team, under My team — approvals, cover and reviews.",
    does: [
      "Approves leave and timesheets for the people who report to them",
      "Sees who is in, who is on leave and who is still on probation",
      "Sets KPIs, records progress and completes the appraisal",
    ],
  },
  {
    icon: IdCard,
    title: "Employee",
    opensItFor: "Their own record, without emailing anyone for it.",
    does: [
      "Requests leave against a balance they can see",
      "Downloads payslips, contracts and their own documents",
      "Raises a grievance privately, without going through their manager",
    ],
  },
  {
    icon: Banknote,
    title: "Payroll Officer",
    opensItFor: "The run, the statutory schedules and the ledger posting.",
    does: [
      "Maintains earnings and deduction elements once, for every run",
      "Runs payroll with overtime and approved adjustments already in it",
      "Reads employer cost per run and posts the journal to Finance",
    ],
  },
];

export function HrmAudience() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {ROLES.map((role) => (
        <div
          key={role.title}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <role.icon
                className="h-6 w-6 text-violet-600"
                aria-hidden="true"
              />
            </span>
            <h3 className="font-heading text-lg font-semibold text-neutral-900">
              {role.title}
            </h3>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-neutral-600">
            {role.opensItFor}
          </p>

          <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
            {role.does.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-500"
              >
                <span
                  className="mt-2 h-1 w-3 shrink-0 rounded-full bg-violet-500"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
