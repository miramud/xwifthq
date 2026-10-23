"use client";

import { AlertTriangle, Check, CheckCircle2, Wallet } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import type { VoucherStatus } from "@/lib/api/finance-payments-client";
import { amount } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { PIPELINE, VOUCHER_STATUS, pipeline } from "./meta";

/* The pieces every voucher and payment screen shares. */

export function VoucherStatusChip({ status }: { status: VoucherStatus }) {
  const s = VOUCHER_STATUS[status] ?? VOUCHER_STATUS.draft;
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

/**
 * The voucher number as the register prints it. Gap-free numbering is the
 * control (a missing number is a missing voucher), so the number is set in
 * the mono face with its series in a quieter weight: PV/2026/10/**0003**.
 */
export function PvNumber({ value, size = "md", className }: { value: string; size?: "md" | "lg" | "xl"; className?: string }) {
  const cut = value.lastIndexOf("/");
  const series = cut > 0 ? value.slice(0, cut + 1) : "";
  const seq = cut > 0 ? value.slice(cut + 1) : value;
  return (
    <span
      className={cx(
        "whitespace-nowrap font-mono tabular-nums tracking-tight",
        size === "xl" ? "text-[28px] leading-none sm:text-[34px]" : size === "lg" ? "text-lg" : "text-[13px]",
        className,
      )}
    >
      <span className="text-neutral-500">{series}</span>
      <span className="font-semibold text-neutral-900">{seq}</span>
    </span>
  );
}

/** Money with tabular figures; a negative also carries its minus sign. */
export function Money({ value, currency = "NGN", className }: { value: number | null | undefined; currency?: string; className?: string }) {
  return <span className={cx("whitespace-nowrap tabular-nums", (value ?? 0) < 0 && "text-error-700", className)}>{amount(value, currency as CurrencyCode)}</span>;
}

/**
 * Drafted → FCU checked → authorised → scheduled → paid → confirmed, as a
 * row of stations. Done stations carry a tick, the current one a ring and
 * the words "Now"; the list is an ordered list, so it reads in order.
 */
export function VoucherPipeline({ status }: { status: VoucherStatus }) {
  const steps = pipeline(status);
  if (!steps) return null;
  const queried = status === "fcu_queried";
  return (
    <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label="Where this voucher is">
      {PIPELINE.map((label, i) => {
        const st = steps[i];
        return (
          <li key={label} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cx("absolute right-1/2 top-[15px] hidden h-0.5 w-full sm:block", st === "todo" ? "ws-hatch" : "bg-primary-500")}
                style={{ marginRight: 16 }}
              />
            )}
            <span
              className={cx(
                "relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                st === "done" && "bg-primary-600 text-white",
                st === "current" && (queried ? "bg-sun-50 text-sun-700 ring-2 ring-sun-500" : "bg-white text-primary-700 ring-2 ring-primary-500"),
                st === "todo" && "bg-neutral-100 text-neutral-500",
              )}
            >
              {st === "done" ? <Check size={15} aria-hidden /> : i + 1}
            </span>
            <span className={cx("mt-2 text-xs font-semibold", st === "todo" ? "text-neutral-500" : "text-neutral-900")}>{label}</span>
            <span className="sr-only">{st === "done" ? ", done" : st === "current" ? ", in progress" : ", to come"}</span>
            {st === "current" && (
              <span aria-hidden className={cx("mt-0.5 text-[11px] font-semibold", queried ? "text-sun-700" : "text-primary-700")}>
                {queried ? "Queried" : "Now"}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The voucher against what is left on its memo. The track is the memo's
 * room; this voucher fills it from the left and the rest is hatched. Over
 * the room, the excess hangs off the end in rose and the line under it says
 * by how much. Words carry the state; the colour only agrees.
 */
export function MemoMeter({ room, draw, currency = "NGN" }: { room: number; draw: number; currency?: string }) {
  const over = draw - room;
  const exceeds = over > 0;
  const scale = Math.max(room, draw, 1);
  const fill = (Math.min(draw, room) / scale) * 100;
  const excess = exceeds ? (over / scale) * 100 : 0;
  const c = currency as CurrencyCode;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-4 text-xs text-neutral-500">
        <span>
          This voucher <span className="ml-1 text-sm font-bold tabular-nums text-neutral-900">{amount(draw, c)}</span>
        </span>
        <span className="text-right">
          <span className="mr-1 text-sm font-bold tabular-nums text-neutral-900">{amount(room, c)}</span> left on the memo
        </span>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        <div className="ws-hatch flex h-full overflow-hidden rounded-l-full" style={{ width: `${100 - excess}%` }}>
          <span className={cx("h-full transition-[width] duration-300", exceeds ? "bg-sun-500" : "bg-primary-500")} style={{ width: `${(fill / (100 - excess || 1)) * 100}%` }} />
        </div>
        {exceeds && <span className="h-full rounded-r-full bg-rose-500" style={{ width: `${excess}%` }} />}
      </div>
      <p role="status" aria-live="polite" className={cx("mt-2 flex items-center gap-1.5 text-sm font-semibold", exceeds ? "text-rose-700" : draw === 0 ? "text-neutral-500" : "text-mint-700")}>
        {exceeds ? <AlertTriangle size={15} aria-hidden /> : draw === 0 ? <Wallet size={15} aria-hidden /> : <CheckCircle2 size={15} aria-hidden />}
        {exceeds
          ? `Exceeds the memo balance by ${amount(over, c)}. Lower the lines, or amend the memo (it goes back for approval).`
          : draw === 0
            ? "Enter the amounts"
            : `Within the memo balance: ${amount(room - draw, c)} left after this voucher`}
      </p>
    </div>
  );
}

/** A label over a figure, for the totals strip and the facts of a memo. */
export function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-neutral-900">{children}</dd>
    </div>
  );
}
