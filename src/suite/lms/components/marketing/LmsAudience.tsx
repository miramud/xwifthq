import {
  Building2,
  Check,
  Presentation,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Who opens XwiftHQ Learning inside a company, and what they open it for.
 *
 * Owner, 9 Oct 2026: this is workforce training for an organisation, not a
 * student portal. So the four roles are a member of staff, the person who
 * writes the course, the manager or HR lead who assigns it, and whoever has
 * to prove to an auditor that it was done. Each line is something that role
 * can do in the product today.
 *
 * The cards alternate between the white glow card and the pale bento tile,
 * each opening with a round white icon badge and closing on a list of purple
 * check circles.
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
    opensItFor: "What they still have to finish, and proof once they have.",
    does: [
      "Works through video, article, document and quiz lessons, and picks up where they left off",
      "Sees mandatory courses first, each with its due date",
      "Downloads a certificate anyone can check by serial number",
    ],
  },
  {
    icon: Presentation,
    title: "Course author",
    opensItFor: "The courses their team or department actually needs.",
    does: [
      "Builds sections, lessons and quizzes in one editor, using media from the company library",
      "Sets a pass mark, attempt limits, a time limit and a question bank for each quiz",
      "Sees which questions people get wrong and where they stop watching",
    ],
  },
  {
    icon: Building2,
    title: "HR or line manager",
    opensItFor: "The right training in front of the right people.",
    does: [
      "Assigns a learning path to one person, a team or the whole company",
      "Adds induction courses to a new hire's onboarding checklist in HRM",
      "Sees who has started, who has stalled and who is done",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Compliance lead",
    opensItFor: "Evidence an auditor will accept without a follow-up email.",
    does: [
      "Makes training mandatory with a due date and tracks the overdue list",
      "Sets certificates to expire, so recurring training comes round again on time",
      "Exports the compliance report and checks the audit log behind it",
    ],
  },
];

export function LmsAudience() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {ROLES.map((role, index) => (
        <article
          key={role.title}
          className={`flex flex-col p-6 sm:p-7 ${
            index % 3 === 0 ? "xw-glow-card" : "xw-tile"
          }`}
        >
          <div className="flex items-center gap-4">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]"
              aria-hidden="true"
            >
              <role.icon className="h-5 w-5 text-primary-600" />
            </span>
            <h3 className="xw-h3">{role.title}</h3>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-neutral-600">
            {role.opensItFor}
          </p>

          <ul className="mt-5 space-y-3">
            {role.does.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3 text-primary-700" />
                </span>
                <span className="text-sm leading-relaxed text-neutral-700">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
