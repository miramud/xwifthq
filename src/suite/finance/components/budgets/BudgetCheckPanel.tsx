"use client";

import { ShieldAlert, ShieldX } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import type { CurrencyCode } from "@/lib/money";
import { accounting, amount } from "@/suite/finance/lib/format";
import type { BudgetCheck } from "@/lib/api/finance-budgets-client";
import { CONTROL_MODE } from "./meta";

/**
 * What the company budget check said about a voucher: for each line over its
 * account's budget for the year, the budget, what is already spent, this
 * voucher and how far over it takes it. A WARN travels with the voucher for
 * the FCU and the approvers; a BLOCK stops it being sent.
 */
export function BudgetCheckPanel({
  check,
  context = "stored",
  currency = "NGN",
  className,
}: {
  check: BudgetCheck;
  /** `stored`: what the check said when the voucher was sent. `live`: what it would say now. `blocked`: the refusal just given. */
  context?: "stored" | "live" | "blocked";
  currency?: string;
  className?: string;
}) {
  if (!check || check.result === "ok" || !Array.isArray(check.lines) || check.lines.length === 0) return null;
  const block = context === "blocked" || check.result === "block";
  const Icon = block ? ShieldX : ShieldAlert;
  const title =
    context === "blocked"
      ? "Not sent: this voucher would take an account over its budget"
      : context === "live"
        ? block
          ? "This voucher will be refused: an account would go over its budget"
          : "This voucher will be flagged over budget"
        : "Sent over budget";
  const says =
    context === "blocked"
      ? "The account is under a block control. Revise the year's budget, or recode the line to an account with room, then send it again."
      : context === "live"
        ? block
          ? "Sending is refused while a blocked account is over. Revise the budget or recode the line."
          : "It can still be sent; the FCU and the approvers will see this."
        : "The budget check flagged these lines when the voucher was sent. The FCU and the approvers see it here.";

  return (
    <section
      aria-label="Budget check"
      role={context === "blocked" ? "alert" : undefined}
      className={cx("rounded-[1.125rem] border p-4 sm:p-5", block ? "border-rose-500/25 bg-rose-50" : "border-sun-500/30 bg-sun-50", className)}
    >
      <div className="flex items-start gap-3">
        <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white", block ? "text-rose-700" : "text-sun-700")}>
          <Icon size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className={cx("text-[15px] font-semibold", block ? "text-rose-700" : "text-sun-700")}>{title}</h2>
          <p className={cx("mt-0.5 text-sm", block ? "text-rose-700" : "text-sun-700")}>{says}</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <caption className="sr-only">Lines over budget</caption>
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th scope="col" className="py-2.5 pl-4 pr-2">Account</th>
              <th scope="col" className="px-2 py-2.5 text-right">Budget for the year</th>
              <th scope="col" className="px-2 py-2.5 text-right">Spent so far</th>
              <th scope="col" className="px-2 py-2.5 text-right">This voucher</th>
              <th scope="col" className="px-2 py-2.5 text-right">Over by</th>
              <th scope="col" className="py-2.5 pl-2 pr-4">Control</th>
            </tr>
          </thead>
          <tbody>
            {check.lines.map((l, i) => {
              const m = CONTROL_MODE[l.mode] ?? CONTROL_MODE.warn;
              const used = l.budget > 0 ? Math.min(100, ((l.actual + l.request) / l.budget) * 100) : 100;
              return (
                <tr key={`${l.accountId ?? l.account}-${i}`} className="border-b border-neutral-100 last:border-0 align-top">
                  <td className="py-3 pl-4 pr-2">
                    <span className="font-medium text-neutral-900">{l.account}</span>
                    <span aria-hidden className="mt-1.5 block h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full ws-hatch">
                      <span className={cx("block h-full rounded-full", block ? "bg-rose-500" : "bg-sun-400")} style={{ width: `${used}%` }} />
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{accounting(l.budget)}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-neutral-600">{accounting(l.actual)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{accounting(l.request)}</td>
                  <td className={cx("px-2 py-3 text-right font-semibold tabular-nums", l.mode === "block" ? "text-rose-700" : "text-sun-700")}>{amount(l.over, currency as CurrencyCode)}</td>
                  <td className="py-3 pl-2 pr-4">
                    <Chip hue={m.hue} icon={m.icon}>
                      {m.label}
                    </Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A refusal's message parsed back into the panel's shape, when only the text came back. */
export function BudgetRefusal({ message, className }: { message: string; className?: string }) {
  const text = message.replace(/^BUDGET_EXCEEDED:\s*/, "");
  return (
    <section role="alert" aria-label="Budget check" className={cx("flex items-start gap-3 rounded-[1.125rem] border border-rose-500/25 bg-rose-50 p-4 sm:p-5", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-700">
        <ShieldX size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-rose-700">Not sent: over budget</h2>
        <p className="mt-0.5 text-sm text-rose-700">{text}</p>
      </div>
    </section>
  );
}
