import { Banknote, Calculator, Landmark, ShieldCheck, Check, type LucideIcon } from "lucide-react";

/**
 * Who opens XwiftHQ Finance, and what they open it for.
 *
 * Four roles rather than four personas: a role has tasks, and the tasks are
 * what the module is judged on. Cards alternate between the white glow card
 * and the pale tile, the same rhythm as the stats row. The glyph sits on a
 * round white disc in the module's gold (`accent-600`, calibrated for a glyph
 * on white); the task list uses the purple check circles every list shares.
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
    opensItFor: "Every project's money on one screen, plus the calls only they can make.",
    tasks: [
      "Reads the portfolio by RAG status and earned value: CPI, SPI and EAC",
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
      "Sets company budgets to BLOCK or WARN, and tracks budget against actual",
      "Prints the company finance report as a verifiable PDF, or exports it to Excel",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Finance Control Unit",
    opensItFor: "The queue of memos waiting at a checkpoint.",
    tasks: [
      "Clears each memo item by item against the checklist before any voucher exists",
      "Raises payment vouchers with withholding tax already worked out",
      "Confirms each payment against its bank statement line and closes retirements",
    ],
  },
  {
    icon: Banknote,
    title: "Treasury",
    opensItFor: "What is due, and which account pays it.",
    tasks: [
      "Builds payment schedules for a second approver, then generates the bank file",
      "Imports bank statements and reconciles every account with a printable report",
      "Checks the cash position and the forecast for the weeks ahead",
    ],
  },
];

export function FinanceRoles() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {ROLES.map((role, index) => {
        const Glyph = role.icon;
        return (
          <div
            key={role.title}
            className={`p-6 sm:p-7 ${index === 0 || index === 3 ? "xw-glow-card" : "xw-tile"}`}
          >
            <div className="flex items-center gap-4">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]"
                aria-hidden="true"
              >
                <Glyph className="h-5 w-5 text-accent-600" />
              </span>
              <h3 className="xw-h3">{role.title}</h3>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              {role.opensItFor}
            </p>

            <ul className="mt-5 space-y-3">
              {role.tasks.map((task) => (
                <li
                  key={task}
                  className="flex items-start gap-3 text-sm leading-relaxed text-neutral-700"
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3 text-primary-700" />
                  </span>
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
