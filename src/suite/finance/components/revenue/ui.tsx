"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Ban, Clock, Lock } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import type { SelectOption } from "@/components/workspace/SearchableSelect";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { ledger } from "@/lib/api/finance-ledger-client";
import { banking, type BankAccount } from "@/lib/api/finance-banking-client";
import { revenue, type InvoiceStatus, type MilestoneStatus } from "@/lib/api/finance-revenue-client";
import { amount, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { PvNumber } from "../vouchers/ui";
import { INVOICE_STATUS, MILESTONE_STATUS, lateness, rail, share } from "./meta";

/* The pieces every Revenue screen shares. */

export { Money, Fact } from "../vouchers/ui";

export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  const s = INVOICE_STATUS[status] ?? INVOICE_STATUS.draft;
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

export function MilestoneChip({ status }: { status: MilestoneStatus }) {
  const s = MILESTONE_STATUS[status] ?? MILESTONE_STATUS.planned;
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

/** "12 days late", in a hue that deepens with age; nothing when it isn't late. */
export function LateChip({ days }: { days: number }) {
  const l = lateness(days);
  if (!l) return null;
  return (
    <Chip hue={l.hue} icon={Clock}>
      {l.label}
    </Chip>
  );
}

/** What is left is retention only: held back by agreement, so neither late nor due now. */
export function RetentionChip() {
  return (
    <Chip hue="slate" icon={Lock}>
      Retention held
    </Chip>
  );
}

/**
 * A document number the way the register prints it, series quiet and
 * sequence bold (INV/2026/**0003**). A draft has no number yet and says so.
 */
export function DocNo({ value, size = "md", className }: { value: string | null; size?: "md" | "lg" | "xl"; className?: string }) {
  if (!value)
    return <span className={cx("font-semibold italic text-neutral-500", size === "xl" ? "text-[28px] sm:text-[34px]" : size === "lg" ? "text-lg" : "text-[13px]", className)}>Draft, no number yet</span>;
  return <PvNumber value={value} size={size} className={className} />;
}

/** A label over a form control, with the error under it read out when it appears. */
export function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-error-700"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** `2026-10-02T09:14:00+01:00` → `2 Oct 2026, 09:14`. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? day(iso) : `${day(iso)}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * A voided document's banner: who voided it and when, what that did, and
 * the reason they gave in a quieter line under it. Older records may lack
 * the who or the when; the sentence reads without them.
 */
export function VoidedNote({
  at,
  by,
  reason,
  children,
  className,
}: {
  at: string | null | undefined;
  by: string | null | undefined;
  reason: string | null | undefined;
  /** What voiding it did, e.g. "Its journal was reversed." */
  children: React.ReactNode;
  className?: string;
}) {
  const who = [by ? `by ${by}` : null, at ? `on ${stamp(at)}` : null].filter(Boolean).join(" ");
  return (
    <div role="note" className={cx("rounded-2xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-700", className)}>
      <p className="flex items-start gap-2">
        <Ban size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">Voided{who ? ` ${who}` : ""}.</span> {children}
        </span>
      </p>
      {reason && (
        <p className="mt-1.5 pl-6 text-[13px] text-neutral-600">
          <span className="font-medium text-neutral-700">Reason:</span> {reason}
        </p>
      )}
    </div>
  );
}

/* ------------------------------ the rail ------------------------------ */

const RAIL_FILL: Record<"invoiced" | "completed" | "planned", string> = {
  invoiced: "bg-gradient-to-r from-primary-500 to-primary-400",
  completed: "bg-gradient-to-r from-mint-500 to-mint-400",
  planned: "bg-sky-200",
};

/**
 * A contract's value as one rail: invoiced in blue, accepted-and-waiting in
 * mint, planned milestones in a pale wash, and value no milestone covers yet
 * hatched. Past the value, the excess hangs off the end in rose. The legend
 * under it carries every figure, so colour is never the only signal.
 */
export function BillingRail({
  value,
  milestones,
  currency = "NGN",
  compact = false,
  live = false,
}: {
  value: number;
  milestones: { amount: number; status: MilestoneStatus }[];
  currency?: string;
  compact?: boolean;
  /** Announce changes (the editor's rail moves as amounts are typed). */
  live?: boolean;
}) {
  const r = rail(value, milestones);
  const scale = Math.max(value, r.scheduled, 1);
  const c = currency as CurrencyCode;
  return (
    <div className="min-w-0">
      <div className={cx("ws-hatch flex overflow-hidden rounded-full", compact ? "h-2" : "h-3")} aria-hidden>
        {r.segments.map((s) =>
          s.amount > 0 ? <span key={s.key} className={cx("h-full transition-[width] duration-300", RAIL_FILL[s.key])} style={{ width: `${share(Math.min(s.amount, scale), scale)}%` }} /> : null,
        )}
        {r.over > 0 && <span className="h-full bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${share(r.over, scale)}%` }} />}
      </div>
      {!compact && (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          {r.segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={cx("h-2 w-2 rounded-full", RAIL_FILL[s.key])} aria-hidden />
              {s.label} <span className="font-semibold tabular-nums text-neutral-900">{amount(s.amount, c)}</span>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="ws-hatch h-2 w-2 rounded-full ring-1 ring-neutral-200" aria-hidden />
            Not scheduled <span className="font-semibold tabular-nums text-neutral-900">{amount(r.unscheduled, c)}</span>
          </li>
        </ul>
      )}
      {r.over > 0 && (
        <p role={live ? "alert" : undefined} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-rose-700">
          <AlertTriangle size={15} aria-hidden />
          The milestones come to {amount(r.over, c)} more than the contract value. Lower an amount or raise the value.
        </p>
      )}
    </div>
  );
}

/** Invoiced against value, for the register's cards: a simple bar with its two figures. */
export function BilledBar({ invoiced, value, currency = "NGN" }: { invoiced: number; value: number; currency?: string }) {
  const c = currency as CurrencyCode;
  const p = share(invoiced, value);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs text-neutral-500">
        <span>
          Invoiced <span className="ml-1 text-sm font-bold tabular-nums text-neutral-900">{amount(invoiced, c)}</span>
        </span>
        <span className="tabular-nums">
          of <span className="font-semibold text-neutral-700">{amount(value, c)}</span>
        </span>
      </div>
      <div
        className="ws-hatch mt-2 h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Invoiced against the contract value"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p)}
        aria-valuetext={`${Math.round(p)}% invoiced`}
      >
        <span className="block h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/* --------------------------- small screens ---------------------------- */

const NARROW = "(max-width: 639px)";

function subscribeNarrow(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Below the `sm` breakpoint (a phone). False on the server and where `matchMedia` is missing. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(NARROW).matches : false),
    () => false,
  );
}

/**
 * How a Revenue list opens: as a table on a wide screen, as cards on a phone
 * (a table there scrolls sideways inside its card). Each width remembers its
 * own choice, so picking the table on a laptop doesn't open it on a phone.
 */
export function useListView(storageKey: string): { defaultView: "table" | "list"; storageKey: string } {
  const narrow = useNarrow();
  return narrow ? { defaultView: "list", storageKey: `${storageKey}-sm` } : { defaultView: "table", storageKey };
}

/* ------------------------------ pickers ------------------------------- */

export interface ListState<T> {
  status: "loading" | "ready" | "error";
  items: T[];
}

function useLoad<T>(load: () => Promise<T[]>): ListState<T> {
  const [state, setState] = useState<ListState<T>>({ status: "loading", items: [] });
  useEffect(() => {
    let alive = true;
    load().then(
      (items) => alive && setState({ status: "ready", items }),
      () => alive && setState({ status: "error", items: [] }),
    );
    return () => {
      alive = false;
    };
    // Loaded once per screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

/** The organisation's counterparties, clients first. */
export function useClientOptions(): ListState<SelectOption> {
  return useLoad(() =>
    orgFoundations.lookups.counterparties().then((rows) =>
      rows
        .map((c) => ({ value: c.id, label: c.name, hint: c.code ?? undefined, group: c.roles.includes("client") ? "Clients" : "Other organisations" }))
        .sort((a, b) => (a.group === b.group ? a.label.localeCompare(b.label) : a.group === "Clients" ? -1 : 1)),
    ),
  );
}

/** Postable revenue and other-income accounts: the only ones an invoice line may earn. */
export function useRevenueAccounts(): ListState<SelectOption> {
  return useLoad(() =>
    ledger.accounts.list({ postableOnly: true }).then((r) =>
      r.accounts
        .filter((a) => a.isPostable && a.active && (a.type === "revenue" || a.type === "other_income"))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        .map((a) => ({ value: a.id, label: `${a.code} ${a.name}`, hint: a.currency ? `${a.currency} only` : undefined, group: a.type === "revenue" ? "Revenue" : "Other income" })),
    ),
  );
}

export function useProjectOptions(): ListState<SelectOption> {
  return useLoad(() => revenue.projects().then((rows) => rows.map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined }))));
}

export function useBankAccounts(): ListState<BankAccount> {
  return useLoad(() => banking.accounts.list().then((rows) => rows.filter((b) => b.status === "active")));
}

/** What a picker says while its list loads, or when it failed. */
export function pickerText(state: ListState<unknown>, what: string): string {
  if (state.status === "loading") return `Loading ${what}…`;
  if (state.status === "error") return `The ${what} didn't load. Reload the page to try again.`;
  return `No ${what} yet.`;
}
