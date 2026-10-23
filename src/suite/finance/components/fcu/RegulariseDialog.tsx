"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Info, Landmark } from "lucide-react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { Field } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, PersonSelect } from "@/suite/org/components/foundations/shared";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { spend, spendError, spendFieldErrors, type MemoFull, type SpendOptions, type UnauthorisedPayment } from "@/lib/api/finance-spend-client";
import { day } from "@/suite/finance/lib/format";
import { Money } from "@/suite/finance/components/banking/ui";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Regularise a bank debit nobody authorised (Finance PRD §11.9): raise the
 * retrospective memo for it, marked post-facto and tied to the statement
 * line. The person regularising is its requester; the MD approves it, and
 * the voucher made from it is confirmed against this same debit - nothing
 * is paid twice. What it cannot know (who was paid, which budget) is asked
 * here, filled in from the statement line where the classifier knew.
 */

type Funding = "project" | "costCentre";
type PayeeKind = "vendor" | "staff";

export interface RegulariseResult {
  memo: MemoFull;
  submitError: string | null;
}

export default function RegulariseDialog({
  line,
  onDone,
  onClose,
}: {
  line: UnauthorisedPayment;
  onDone: (result: RegulariseResult) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [options, setOptions] = useState<SpendOptions | null>(null);
  const [vendors, setVendors] = useState<SelectOption[] | null>(null);
  const [costCentres, setCostCentres] = useState<SelectOption[] | null>(null);

  const [explanation, setExplanation] = useState("");
  const [funding, setFunding] = useState<Funding>(line.costCentreId && !line.projectId ? "costCentre" : "project");
  const [projectId, setProjectId] = useState(line.projectId ?? "");
  const [costCentreId, setCostCentreId] = useState(line.costCentreId ?? "");
  const [costCategory, setCostCategory] = useState("");
  const [payeeKind, setPayeeKind] = useState<PayeeKind>(line.personId && !line.counterpartyId ? "staff" : "vendor");
  const [vendorId, setVendorId] = useState(line.counterpartyId ?? "");
  const [staffId, setStaffId] = useState(line.personId ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    spend.me.options().then(
      (o) => alive && setOptions(o),
      () => alive && setOptions({ types: {}, categories: {}, checklists: { payment: [], advance: [], retirement: [] }, projects: [], accounts: [], bankAccounts: [] }),
    );
    orgFoundations.lookups
      .counterparties({ role: "vendor" })
      .then((rows) => alive && setVendors(rows.map((c) => ({ value: c.id, label: c.name, hint: c.code ?? undefined }))))
      .catch(() => alive && setVendors([]));
    orgFoundations.lookups
      .costCentres()
      .then((rows) => alive && setCostCentres(rows.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))))
      .catch(() => alive && setCostCentres([]));
    return () => {
      alive = false;
    };
  }, []);

  const projectOptions = useMemo<SelectOption[]>(() => (options?.projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })), [options]);
  const categoryOptions = useMemo<SelectOption[]>(() => Object.entries(options?.categories ?? {}).map(([value, label]) => ({ value, label })), [options]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!explanation.trim()) local.explanation = "Say why it was paid without authority.";
    if (payeeKind === "vendor" ? !vendorId : !staffId) local.payee = "Say who was paid.";
    if (funding === "project" ? !projectId : !costCentreId) local.funding = "Choose the project or cost centre it is charged to.";
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    setError(null);
    try {
      const result = await spend.fcu.regularise(line.lineId, {
        explanation: explanation.trim(),
        projectId: funding === "project" ? projectId : null,
        costCentreId: funding === "costCentre" ? costCentreId : null,
        costCategory: costCategory || null,
        payeeCounterpartyId: payeeKind === "vendor" ? vendorId : null,
        payeeUserId: payeeKind === "staff" ? staffId : null,
      });
      onDone(result);
    } catch (err) {
      const fields = spendFieldErrors(err);
      setErrors({
        explanation: fields.explanation,
        payee: fields.payee ?? fields.payeeCounterpartyId ?? fields.payeeUserId,
        funding: fields.project ?? fields.projectId ?? fields.costCentreId,
      });
      setError(spendError(err));
      setBusy(false);
    }
  };

  const principal = line.principal ?? line.amount;

  return (
    <DialogFrame
      as="form"
      size="lg"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title="Regularise this payment"
      subtitle="Raise the memo that should have come first. It is marked post-facto and goes to the MD; its voucher is matched to this debit, so nothing is paid twice."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep as it is</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Raising…" : "Raise post-facto memo"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* The debit itself, as the statement shows it. */}
        <figure className="rounded-xl border border-dashed border-rose-200 bg-rose-50/60 px-4 py-3" aria-label="The bank debit">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">Debit, no voucher</span>
            <Money value={line.amount} className="text-lg font-bold text-neutral-900" />
          </div>
          <p className="mt-1 break-words font-mono text-[13px] leading-snug text-neutral-700">{line.narration ?? "No narration"}</p>
          <figcaption className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-600">
            <span>{day(line.date)}</span>
            {line.bankAccount && (
              <span className="inline-flex items-center gap-1">
                <Landmark size={12} aria-hidden /> {line.bankAccount}
              </span>
            )}
            {principal !== line.amount && (
              <span>
                <Money value={principal} /> to the payee, the rest a transfer fee
              </span>
            )}
          </figcaption>
        </figure>

        <Field id={`${uid}-why`} label="Why it was paid without authority" hint="Required">
          <RichTextEditor
            id={`${uid}-why`}
            autoFocus
            value={explanation}
            onChange={setExplanation}
            placeholder="e.g. The supplier would not release the goods without payment; the Bursar paid from the bank portal."
            invalid={Boolean(errors.explanation)}
          />
          <FieldError message={errors.explanation} />
        </Field>

        <fieldset className="space-y-3">
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">Who was paid</legend>
          <Segmented
            label="Payee"
            value={payeeKind}
            onChange={(v) => setPayeeKind(v)}
            options={[
              { key: "vendor", label: "Vendor" },
              { key: "staff", label: "Member of staff" },
            ]}
          />
          {payeeKind === "vendor" ? (
            <SearchableSelect
              id={`${uid}-vendor`}
              aria-label="Vendor"
              value={vendorId}
              onChange={setVendorId}
              options={vendors ?? []}
              clearable
              placeholder={vendors === null ? "Loading vendors…" : "Choose from the vendor register"}
              searchPlaceholder="Search vendors"
              noOptionsText={vendors === null ? "Loading vendors…" : "No vendors in the register yet."}
              aria-invalid={errors.payee ? true : undefined}
            />
          ) : (
            <PersonSelect id={`${uid}-staff`} value={staffId} onChange={setStaffId} clearable placeholder="Choose a colleague" invalid={Boolean(errors.payee)} />
          )}
          {(line.counterparty || line.person) && (
            <p className="text-xs text-neutral-500">The statement review matched this debit to {line.counterparty ?? line.person}.</p>
          )}
          <FieldError message={errors.payee} />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">Which budget it is charged to</legend>
          <Segmented
            label="Charge to"
            value={funding}
            onChange={(v) => setFunding(v)}
            options={[
              { key: "project", label: "Project" },
              { key: "costCentre", label: "Cost centre" },
            ]}
          />
          {funding === "project" ? (
            <SearchableSelect
              id={`${uid}-project`}
              aria-label="Project"
              value={projectId}
              onChange={setProjectId}
              options={projectOptions}
              clearable
              placeholder={options === null ? "Loading projects…" : "Choose the project"}
              searchPlaceholder="Search projects"
              noOptionsText={options === null ? "Loading projects…" : "No projects in this organisation."}
              aria-invalid={errors.funding ? true : undefined}
            />
          ) : (
            <SearchableSelect
              id={`${uid}-cc`}
              aria-label="Cost centre"
              value={costCentreId}
              onChange={setCostCentreId}
              options={costCentres ?? []}
              clearable
              placeholder={costCentres === null ? "Loading cost centres…" : "Choose the cost centre"}
              searchPlaceholder="Search cost centres"
              noOptionsText={costCentres === null ? "Loading cost centres…" : "No cost centres yet."}
              aria-invalid={errors.funding ? true : undefined}
            />
          )}
          <FieldError message={errors.funding} />
          <Field id={`${uid}-category`} label="Cost category" hint="Optional">
            <SearchableSelect
              id={`${uid}-category`}
              value={costCategory}
              onChange={setCostCategory}
              options={categoryOptions}
              clearable
              placeholder="Choose what kind of cost it is"
              searchPlaceholder="Search categories"
            />
          </Field>
        </fieldset>

        <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-[13px] leading-snug text-sky-800">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
          You become its requester: attach the documents it needs and answer the FCU&apos;s questions. You can&apos;t approve, vet, prepare or authorise it.
        </p>

        {error && (
          <p role="alert" className="text-sm text-error-700">
            {error}
          </p>
        )}
      </div>
    </DialogFrame>
  );
}
