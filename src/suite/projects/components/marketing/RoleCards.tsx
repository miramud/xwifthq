import { Briefcase, Check, ListTodo, ShieldCheck, Target } from "lucide-react";

/**
 * Four people, four reasons to open the module.
 *
 * Roles rather than personas: a contributor who only ever wants today's list
 * and an executive who only ever wants the portfolio are both badly served by
 * a page that describes one generic "user".
 *
 * The cards alternate a white glow card and a pale tile, the same rhythm as
 * the stats row. The module's sky hue lands on the glyph in the round icon
 * only; the lists use the purple check circle every module page shares.
 */

const ROLES = [
  {
    icon: Target,
    title: "Project manager",
    opens: "To check that the plan, the team and the money still line up.",
    does: [
      "Plans sprints from the story board and closes each one with a snapshot",
      "Spots work about to slip on the schedule and critical path",
      "Tracks expected spend against actual, down to who raised each request",
    ],
  },
  {
    icon: ListTodo,
    title: "Team member",
    opens: "To see what is theirs this sprint and log the hours against it.",
    does: [
      "Works from My work, across every project they are on",
      "Moves tasks across the board and logs time as they go",
      "Gets nudged in Slack, WhatsApp or email, wherever the team already talks",
    ],
  },
  {
    icon: ShieldCheck,
    title: "QA or security analyst",
    opens: "To test what the sprint shipped before a client finds the gaps.",
    does: [
      "Runs test sprints from a case library, with AI-drafted cases for each story",
      "Logs findings with severity, steps to reproduce and a recommendation",
      "Watches each finding become a bug the project manager assigns",
    ],
  },
  {
    icon: Briefcase,
    title: "Director or finance lead",
    opens: "To see every project without chasing anyone for a status report.",
    does: [
      "Reviews every schedule and team on one dashboard, with the funds in Finance",
      "Downloads the performance workbook, finance analysis included",
      "Shares a read-only link with the client instead of a slide deck",
    ],
  },
] as const;

export function RoleCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {ROLES.map((role, i) => {
        const Glyph = role.icon;
        return (
          <article
            key={role.title}
            className={`flex flex-col p-6 sm:p-7 ${i % 3 === 0 ? "xw-glow-card" : "xw-tile"}`}
          >
            <div className="flex items-center gap-3.5">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]"
                aria-hidden="true"
              >
                <Glyph className="h-5 w-5 text-info-600" />
              </span>
              <h3 className="xw-h3">{role.title}</h3>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              {role.opens}
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
        );
      })}
    </div>
  );
}
