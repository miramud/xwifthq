"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ReceiptText, Send, ShieldAlert, Stamp } from "lucide-react";
import { Button, ButtonLink, Chip, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { MemoStatusChip } from "@/suite/finance/components/requests/ui";
import { amount as money, amountInput, parseAmount } from "@/suite/finance/lib/format";
import { isFundsRefusal, opsError, type MemoRef, type OpsOptions } from "@/lib/api/operations-travel-client";
import type { Meta } from "./labels";

/* Pieces the trip, event and client-payment screens share. */

/** A status word with its icon on its own wash. */
export function MetaChip({ meta }: { meta: Meta }) {
  return (
    <Chip hue={meta.hue} icon={meta.icon}>
      {meta.label}
    </Chip>
  );
}

/**
 * An amount box in naira that hands its parent kobo. It keeps what was typed
 * while focused, and tidies it to two decimals on blur.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  placeholder = "0.00",
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  /** Kobo; null for empty. */
  value: number | null;
  onChange: (kobo: number | null) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? amountInput(value);
  return (
    <input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      className={cx(inputClass, "text-right tabular-nums", className)}
      value={shown}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.trim() === "" ? null : parseAmount(e.target.value));
      }}
      onBlur={() => setText(null)}
    />
  );
}

export type Funding = "project" | "costCentre";

/** Charge to a project or a cost centre: every trip and event is one or the other. */
export function ChargeTo({
  idPrefix,
  options,
  funding,
  projectId,
  costCentreId,
  onFunding,
  onProject,
  onCostCentre,
  error,
}: {
  idPrefix: string;
  options: OpsOptions | null;
  funding: Funding;
  projectId: string;
  costCentreId: string;
  onFunding: (f: Funding) => void;
  onProject: (id: string) => void;
  onCostCentre: (id: string) => void;
  error?: string;
}) {
  const projects: SelectOption[] = (options?.projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined }));
  const centres: SelectOption[] = (options?.costCentres ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.code }));
  const loading = options === null;
  return (
    <div className="space-y-3">
      <Segmented
        label="Charge to"
        value={funding}
        onChange={onFunding}
        options={[
          { key: "project", label: "Project" },
          { key: "costCentre", label: "Cost centre" },
        ]}
      />
      {funding === "project" ? (
        <Field id={`${idPrefix}-project`} label="Project">
          <SearchableSelect
            id={`${idPrefix}-project`}
            value={projectId}
            onChange={onProject}
            options={projects}
            placeholder={loading ? "Loading projects…" : "Choose the project"}
            searchPlaceholder="Search projects"
            noOptionsText={loading ? "Loading projects…" : "No open projects in this organisation."}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${idPrefix}-charge-err` : undefined}
          />
        </Field>
      ) : (
        <Field id={`${idPrefix}-cc`} label="Cost centre">
          <SearchableSelect
            id={`${idPrefix}-cc`}
            value={costCentreId}
            onChange={onCostCentre}
            options={centres}
            placeholder={loading ? "Loading cost centres…" : "Choose the cost centre"}
            searchPlaceholder="Search cost centres"
            noOptionsText={loading ? "Loading cost centres…" : "No cost centres yet. Finance sets them up."}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${idPrefix}-charge-err` : undefined}
          />
        </Field>
      )}
      <FieldError id={`${idPrefix}-charge-err`} message={error} />
    </div>
  );
}

/**
 * The send button for a draft. When the project's funds check refuses, it
 * says why and offers the MD's way through: send it anyway, with a reason
 * (the API decides who may).
 */
export function SubmitForApproval({
  label,
  hint,
  blocked,
  onSubmit,
}: {
  label: string;
  hint?: React.ReactNode;
  /** Why it cannot be sent yet; disables the button and says so. */
  blocked?: string | null;
  onSubmit: (overrideReason: string | null) => Promise<void>;
}) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funds, setFunds] = useState(false);
  const [reason, setReason] = useState("");

  const send = async () => {
    if (funds && !reason.trim()) {
      setError("Give the reason for going beyond the project's funds, or ask Finance for a release first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(funds ? reason.trim() : null);
    } catch (e) {
      if (isFundsRefusal(e)) setFunds(true);
      setError(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {hint && <p className="text-sm text-neutral-600">{hint}</p>}
      {blocked && (
        <p className="flex items-start gap-2 rounded-xl bg-sun-50 px-3 py-2.5 text-sm text-sun-700 ring-1 ring-sun-500/30">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          {blocked}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {funds && (
        <div>
          <label htmlFor={`${uid}-override`} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Reason for going beyond the funds
          </label>
          <textarea
            id={`${uid}-override`}
            rows={2}
            className={textareaClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this should go ahead before more funds are released"
            aria-describedby={`${uid}-override-hint`}
          />
          <p id={`${uid}-override-hint`} className="mt-1.5 text-xs text-neutral-500">
            Only the MD or a delegate can send beyond the funds. Anyone else: ask Finance for a release, then send it.
          </p>
        </div>
      )}
      <Button variant="primary" icon={Send} disabled={busy || Boolean(blocked)} onClick={() => void send()} className="w-full sm:w-auto">
        {busy ? "Sending…" : funds ? `${label} with this reason` : label}
      </Button>
    </div>
  );
}

/** The advance Finance pays for a trip or an event line, where it is, and what has been paid. */
export function AdvanceMemoCard({ memo, memoId, financeHref = true }: { memo: MemoRef | null; memoId: string | null; financeHref?: boolean }) {
  if (!memo) {
    return (
      <p className="text-sm text-neutral-500">
        {memoId ? "The advance is with Finance." : "The advance is raised in Finance when the trip is approved, and goes straight to the FCU."}
      </p>
    );
  }
  const pct = memo.amount > 0 ? Math.min(100, Math.round((memo.paid / memo.amount) * 100)) : 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <ReceiptText size={16} className="text-coral-600" aria-hidden />
          {memo.reference ?? "Advance memo"}
        </p>
        <MemoStatusChip status={memo.status} />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3 text-xs text-neutral-500">
          <span>
            Paid <span className="ml-1 text-sm font-bold tabular-nums text-neutral-900">{money(memo.paid)}</span>
          </span>
          <span className="tabular-nums">
            of <Money value={memo.amount} className="font-semibold text-neutral-700" />
          </span>
        </div>
        <div
          className="ws-hatch mt-2 h-2.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Advance paid"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct}% paid`}
        >
          <span className="block h-full rounded-full bg-mint-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {financeHref && memoId && (
        <Link href={`/suite/finance/requests/${memoId}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-700 underline-offset-2 hover:underline">
          Open it in Finance
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** "Open the approval" when the document has one. */
export function ApprovalLink({ approvalId }: { approvalId: string | null }) {
  if (!approvalId) return null;
  return (
    <ButtonLink href={`/suite/approvals/${approvalId}`} icon={Stamp}>
      Open the approval
    </ButtonLink>
  );
}

/** A label and a value, for the facts panels. */
export function FactRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

/** Options from an API's `{ key: label }` map. */
export const optionsFrom = (map: Record<string, string> | undefined): SelectOption[] => Object.entries(map ?? {}).map(([value, label]) => ({ value, label }));
