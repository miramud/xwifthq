import { Briefcase, ListTodo, ShieldCheck, Target } from "lucide-react";

/**
 * Four people, four reasons to open the module.
 *
 * Roles rather than personas: a contributor who only ever wants today's list
 * and an executive who only ever wants the portfolio are both badly served by
 * a page that describes one generic "user".
 */

const ROLES = [
  {
    icon: Target,
    title: "Project manager",
    opens: "To see whether the plan, the team and the money still agree.",
    does: [
      "Plans sprints from the story board and closes them with a snapshot",
      "Watches the schedule and critical path for work about to slip",
      "Reads expected expense against actual, down to who raised each request",
    ],
  },
  {
    icon: ListTodo,
    title: "Team member",
    opens: "To find out what is theirs this sprint, and log the hours against it.",
    does: [
      "Works from My work across every project they belong to",
      "Moves tasks on the board and logs time against them",
      "Gets notified in Slack, WhatsApp or email, wherever the team already talks",
    ],
  },
  {
    icon: ShieldCheck,
    title: "QA or security analyst",
    opens: "To test what the sprint delivered before a client does.",
    does: [
      "Runs test sprints from a case library, with AI-drafted cases per story",
      "Logs findings with severity, steps to reproduce and a recommendation",
      "Sees each finding become a bug the project manager assigns",
    ],
  },
  {
    icon: Briefcase,
    title: "Director or finance lead",
    opens: "To see every project without asking anyone for a status report.",
    does: [
      "Reviews every project's schedule and team on one dashboard, and its funds in Finance",
      "Downloads the performance workbook with its finance analysis",
      "Shares a read-only link with the client instead of a slide deck",
    ],
  },
] as const;

export function RoleCards() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {ROLES.map((role) => {
        const Glyph = role.icon;
        return (
          <div
            key={role.title}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-500/10">
                <Glyph className="h-5 w-5 text-info-600" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-lg font-semibold text-neutral-900">
                {role.title}
              </h3>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              {role.opens}
            </p>

            <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
              {role.does.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    className="mt-2 h-1 w-3 shrink-0 rounded-full bg-info-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed text-neutral-500">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
