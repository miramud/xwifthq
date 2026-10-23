import { Banknote, Calculator, Landmark, ShieldCheck, type LucideIcon } from "lucide-react";

/**
 * Who opens Elevate Finance, and what they open it for.
 *
 * Four roles rather than four personas: a role has tasks, and the tasks are
 * what the module is judged on. The icon tile carries the gold tint with an
 * `accent-600` glyph — the value calibrated for a glyph on white — and nothing
 * on these cards is gold text.
 */

interface Role {
  icon: LucideIcon;
  title: string;
  opensItFor: string;
  tasks: string[];
}

const ROLES: readonly Role[] = [
  {
    icon: Landmark,
    title: "Managing Director",
    opensItFor: "Every project's money on one screen, and the decisions only they can make.",
    tasks: [
      "Reads the portfolio by RAG status and earned value — CPI, SPI and EAC",
      "Releases project funds in tranches, and overrides an insufficient-funds stop with a reason",
      "Approves high-value spend with a second factor from an authenticator app",
    ],
  },
  {
    icon: Calculator,
    title: "Financial Controller",
    opensItFor: "The books, the close, and the report the board reads.",
    tasks: [
      "Posts and reviews journals, then soft-closes and locks the period",
      "Sets company budgets to BLOCK or WARN and watches budget against actual",
      "Prints the company finance report as a verifiable PDF, or exports it to Excel",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Finance Control Unit",
    opensItFor: "The queue of memos waiting for a checkpoint.",
    tasks: [
      "Clears memos item by item against the checklist before a voucher exists",
      "Raises payment vouchers with withholding tax worked out",
      "Confirms each payment against the bank statement line and closes retirements",
    ],
  },
  {
    icon: Banknote,
    title: "Treasury",
    opensItFor: "What is due to be paid, and from which account.",
    tasks: [
      "Builds payment schedules for a second approver and generates the bank file",
      "Imports bank statements and reconciles each account with a printable report",
      "Reads the cash position and the forecast for the weeks ahead",
    ],
  },
];

export function FinanceRoles() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {ROLES.map((role) => {
        const Glyph = role.icon;
        return (
          <div
            key={role.title}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-500/15">
                <Glyph
                  className="h-6 w-6 text-accent-600"
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

            <ul className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
              {role.tasks.map((task) => (
                <li
                  key={task}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-700"
                >
                  <span
                    className="mt-2 h-1 w-3 shrink-0 rounded-full bg-accent-500"
                    aria-hidden="true"
                  />
                  {task}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
