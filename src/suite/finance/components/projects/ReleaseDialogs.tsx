"use client";

import { useId, useState } from "react";
import { Button, Segmented, cx } from "@/components/workspace/kit";
import { inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { fieldMessages, plainError, spend, type FundReleaseRecord, type ProjectFundsDetail } from "@/lib/api/finance-payments-client";
import { accounting, amount, parseAmount } from "@/suite/finance/lib/format";
import { SCOPE_LABEL } from "./meta";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Asking the MD to release money to a project: an amount, what it may be
 * spent on, and any conditions. It is requested and sent for approval in
 * one go; the approval links back to this project.
 */
export function ReleaseDialog({ project, onClose, onDone }: { project: ProjectFundsDetail; onClose: () => void; onDone: (message: string) => void }) {
  const uid = useId();
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"non_labour" | "all">("non_labour");
  const [conditions, setConditions] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const unreleased = Math.max(0, project.bac - project.released);
  const pending = project.releases.filter((r) => r.status === "requested");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseAmount(value);
    if (a === null || a <= 0) {
      setErrors({ amount: "Enter the amount to release, like 50,000,000.00." });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const r = await spend.funds.requestRelease(project.id, { amount: a, scope, conditions: conditions.trim() || null });
      onDone(r.status === "approved" ? `Release ${r.tranche} of ${amount(a)} approved and available to spend.` : `Release ${r.tranche} of ${amount(a)} sent to the MD for approval.`);
    } catch (err) {
      const f = fieldMessages(err);
      setErrors(Object.keys(f).length ? { ...f, general: f.duties ?? f.project ?? "" } : { general: plainError(err, "The release wasn't requested.") });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title="Request a fund release"
      subtitle={`${project.name}: ${amount(project.released)} released of a ${amount(project.bac)} budget.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Sending…" : "Request release"}
          </Button>
        </div>
      }
    >
      {errors.general && <p role="alert" className="rounded-xl bg-error-500/5 px-4 py-3 text-sm text-error-700">{errors.general}</p>}
      <div>
        <label htmlFor={`${uid}-amount`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Amount (₦)
        </label>
        <input
          id={`${uid}-amount`}
          inputMode="decimal"
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const v = parseAmount(value);
            if (v !== null) setValue(v ? accounting(v) : "");
          }}
          aria-invalid={Boolean(errors.amount) || undefined}
          aria-describedby={`${uid}-amount-hint`}
          className={cx(inputClass, "text-right text-base font-semibold tabular-nums")}
        />
        {errors.amount ? (
          <FieldError message={errors.amount} />
        ) : (
          <p id={`${uid}-amount-hint`} className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            Budget not yet released: {amount(unreleased)}.
            {unreleased > 0 && (
              <button type="button" onClick={() => setValue(accounting(unreleased))} className="min-h-8 cursor-pointer font-semibold text-primary-700 underline-offset-2 hover:underline">
                Use all of it
              </button>
            )}
          </p>
        )}
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-neutral-700">What it may be spent on</span>
        <Segmented
          label="What the release may be spent on"
          value={scope}
          onChange={setScope}
          options={[
            { key: "non_labour", label: SCOPE_LABEL.non_labour },
            { key: "all", label: "All, labour included" },
          ]}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Payroll is controlled in HRM; most releases cover non-labour spend only.</p>
      </div>
      <div>
        <label htmlFor={`${uid}-cond`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Conditions <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <RichTextEditor
          id={`${uid}-cond`}
          value={conditions}
          onChange={setConditions}
          placeholder="e.g. Hardware only after the client signs off the design"
        />
      </div>
      {pending.length > 0 && (
        <p className="text-xs text-neutral-500">
          {pending.length === 1 ? "One release is" : `${pending.length} releases are`} already waiting for approval: {pending.map((r) => `tranche ${r.tranche}, ${amount(r.amount)}`).join("; ")}.
        </p>
      )}
    </DialogFrame>
  );
}

/** Taking back the unspent part of an approved release, with a reason. */
export function RevokeDialog({ release, onClose, onDone }: { release: FundReleaseRecord; onClose: () => void; onDone: (message: string) => void }) {
  const uid = useId();
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const left = release.amount - release.revoked;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseAmount(value);
    const errs: Record<string, string> = {};
    if (a === null || a <= 0) errs.amount = "Enter the amount to take back.";
    else if (a > left) errs.amount = `At most ${amount(left)} of this release is left to revoke.`;
    if (!reason.trim()) errs.reason = "Say why the funds are taken back.";
    setErrors(errs);
    if (Object.keys(errs).length || a === null) return;
    setBusy(true);
    try {
      await spend.funds.revokeRelease(release.id, a, reason.trim());
      onDone(`${amount(a)} of release ${release.tranche} revoked.`);
    } catch (err) {
      const f = fieldMessages(err);
      setErrors(Object.keys(f).length ? f : { general: plainError(err, "The release wasn't revoked.") });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`Revoke from release ${release.tranche}?`}
      subtitle={`${amount(release.amount)} released${release.revoked ? `, ${amount(release.revoked)} already revoked` : ""}. Only the unspent, uncommitted part can be taken back.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep the release</Button>
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? "Revoking…" : "Revoke funds"}
          </Button>
        </div>
      }
    >
      {errors.general && <p role="alert" className="rounded-xl bg-error-500/5 px-4 py-3 text-sm text-error-700">{errors.general}</p>}
      <div>
        <label htmlFor={`${uid}-amount`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Amount to take back (₦)
        </label>
        <input
          id={`${uid}-amount`}
          inputMode="decimal"
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={Boolean(errors.amount) || undefined}
          className={cx(inputClass, "text-right tabular-nums")}
        />
        <FieldError message={errors.amount} />
      </div>
      <div>
        <label htmlFor={`${uid}-why`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Why
        </label>
        <textarea id={`${uid}-why`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(errors.reason) || undefined} className={textareaClass} />
        <FieldError message={errors.reason} />
      </div>
    </DialogFrame>
  );
}
