import {
  Building2,
  Presentation,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Who opens Elevate Learning inside a company, and what they open it for.
 *
 * Owner, 9 Oct 2026: this is workforce training for an organisation, not a
 * student portal — so the four roles are a member of staff, the person who
 * writes the course, the manager or HR lead who assigns it, and whoever has
 * to prove to an auditor that it was done. Each line is something that role
 * can do in the product today.
 */

interface Role {
  icon: LucideIcon;
  title: string;
  opensItFor: string;
  does: string[];
}

const ROLES: Role[] = [
  {
    icon: UserRound,
    title: "Member of staff",
    opensItFor: "What they have been asked to finish, and proof that they did.",
    does: [
      "Works through video, article, document and quiz lessons, resuming where they stopped",
      "Sees mandatory courses first, with the date each one is due",
      "Downloads a certificate anyone can verify by its serial",
    ],
  },
  {
    icon: Presentation,
    title: "Course author",
    opensItFor: "The courses their team or department needs.",
    does: [
      "Builds sections, lessons and quizzes in one editor, with media from the company library",
      "Sets a pass mark, attempt limits, a time limit and a question bank per quiz",
      "Reads which questions people get wrong and where they stop watching",
    ],
  },
  {
    icon: Building2,
    title: "HR or line manager",
    opensItFor: "Getting the right training to the right people.",
    does: [
      "Assigns a learning path to a person, a team or the whole company",
      "Adds induction courses to a new hire's onboarding checklist in HRM",
      "Sees who has started, who has stalled and who has finished",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Compliance lead",
    opensItFor: "Evidence, in a form an auditor will accept.",
    does: [
      "Marks training mandatory with a due date, and reads the overdue list",
      "Sets certificates to expire so recurring training comes back round on time",
      "Exports the compliance report and reads the audit log behind it",
    ],
  },
];

export function LmsAudience() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {ROLES.map((role) => (
        <div
          key={role.title}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/10">
              <role.icon
                className="h-6 w-6 text-primary-600"
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
                  className="mt-2 h-1 w-3 shrink-0 rounded-full bg-primary-600"
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
