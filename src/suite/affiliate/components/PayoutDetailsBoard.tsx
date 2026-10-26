"use client";

import { useCallback, useId, useState } from "react";
import { Landmark, Save } from "lucide-react";
import { Button, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { ErrorNote, Skeleton, hintClass, inputClass, labelClass } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice, useLoad } from "@/suite/platform/components/ui";
import { ApiError, myAffiliate, type Affiliate, type MyAffiliate, type PayoutDetails } from "@/lib/api/affiliate-client";
import { explained } from "./ui";

type Field = keyof PayoutDetails;

const FIELDS: { key: Field; snake: string; label: string; hint?: string; missing: string }[] = [
  { key: "bankName", snake: "bank_name", label: "Bank name", missing: "Enter your bank's name." },
  {
    key: "accountNumber",
    snake: "account_number",
    label: "Account number",
    hint: "Enter it in full each time. We only show the last four digits back to you.",
    missing: "Enter your account number.",
  },
  {
    key: "accountName",
    snake: "account_name",
    label: "Account name",
    hint: "As your bank shows it.",
    missing: "Enter the name on the account.",
  },
];

const EMPTY: PayoutDetails = { bankName: "", accountNumber: "", accountName: "" };

/** The first message the API gave for a field, by either spelling of its name. */
function fieldErrorsFrom(errors: Record<string, string[]> | undefined): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  for (const f of FIELDS) {
    const message = errors?.[f.key]?.[0] ?? errors?.[f.snake]?.[0];
    if (message) out[f.key] = message;
  }
  return out;
}

/**
 * Where an affiliate's commission is paid. The saved account number comes
 * back masked, so the form never shows it and asks for it in full on every
 * change; the bank and account name are filled in from what is saved.
 */
export default function PayoutDetailsBoard() {
  const fetcher = useCallback(() => explained(myAffiliate.get()), []);
  const { data, error, loading, reload, setData } = useLoad<MyAffiliate>(fetcher, "Your saved details didn't load.");
  const saved = data?.affiliate.payoutDetails ?? null;

  const onSaved = (affiliate: Affiliate) => setData((d) => (d ? { ...d, affiliate } : d));

  return (
    <>
      <PageHeader title="Payout details" subtitle="The bank account we pay your commission into." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Remounted once, when the saved details arrive, so it starts from them. */}
        <DetailsForm key={data ? "ready" : "loading"} saved={saved} onSaved={onSaved} className="lg:col-span-2" />

        <Panel title="Saved details" icon={Landmark} hue="mint">
          {error && !data ? (
            <LoadError message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Skeleton className="h-24" />
          ) : saved ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500">Bank</dt>
                <dd className="mt-0.5 font-medium text-neutral-900">{saved.bankName}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Account number</dt>
                <dd className="mt-0.5 font-mono font-medium text-neutral-900">{saved.accountNumber}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Account name</dt>
                <dd className="mt-0.5 font-medium text-neutral-900">{saved.accountName}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-neutral-600">None saved yet. Add them so we can pay you.</p>
          )}
        </Panel>

      </div>
    </>
  );
}

function DetailsForm({
  saved,
  onSaved,
  className,
}: {
  saved: PayoutDetails | null;
  onSaved: (a: Affiliate) => void;
  className?: string;
}) {
  const id = useId();
  const [values, setValues] = useState<PayoutDetails>({
    ...EMPTY,
    bankName: saved?.bankName ?? "",
    accountName: saved?.accountName ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: Field, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setFormError(null);

    const body: PayoutDetails = {
      bankName: values.bankName.trim(),
      accountNumber: values.accountNumber.replace(/\s+/g, ""),
      accountName: values.accountName.trim(),
    };
    const missing: Partial<Record<Field, string>> = {};
    for (const f of FIELDS) if (!body[f.key]) missing[f.key] = f.missing;
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }

    setSaving(true);
    try {
      const affiliate = await myAffiliate.updatePayoutDetails(body);
      setValues((v) => ({ ...v, accountNumber: "" }));
      setFieldErrors({});
      setNotice("Payout details saved.");
      onSaved(affiliate);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const mapped = fieldErrorsFrom(err.errors);
        setFieldErrors(mapped);
        if (Object.keys(mapped).length === 0) setFormError(err.message);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Your details weren't saved. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={saved ? "Change details" : "Add details"} className={className}>
      <form onSubmit={submit} noValidate className="space-y-5">
        {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
        {formError && <ErrorNote>{formError}</ErrorNote>}

        {FIELDS.map((f) => {
          const inputId = `${id}-${f.key}`;
          const errorId = `${inputId}-error`;
          const hintId = `${inputId}-hint`;
          const fieldError = fieldErrors[f.key];
          const describedBy = [f.hint ? hintId : null, fieldError ? errorId : null].filter(Boolean).join(" ");
          return (
            <div key={f.key}>
              <label htmlFor={inputId} className={labelClass}>
                {f.label}
              </label>
              <input
                id={inputId}
                name={f.key}
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                autoComplete="off"
                inputMode={f.key === "accountNumber" ? "numeric" : undefined}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={describedBy || undefined}
                className={cx(inputClass, fieldError && "border-error-500 focus:border-error-500 focus:ring-error-500/15")}
              />
              {f.hint && (
                <p id={hintId} className={hintClass}>
                  {f.hint}
                </p>
              )}
              {fieldError && (
                <p id={errorId} className="mt-1.5 text-xs font-medium text-error-700">
                  {fieldError}
                </p>
              )}
            </div>
          );
        })}

        <Button type="submit" variant="primary" icon={Save} disabled={saving}>
          {saving ? "Saving" : "Save payout details"}
        </Button>
      </form>
    </Panel>
  );
}
