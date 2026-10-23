"use client";

import { useId, useState } from "react";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ErrorNote, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, fieldErrors } from "@/suite/org/components/foundations/shared";
import {
  banking,
  errorText,
  type BankAccount,
  type BankAccountType,
  type BankAccountUpdate,
  type BankPurpose,
  type StatementTemplate,
} from "@/lib/api/finance-banking-client";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { ACCOUNT_TYPES, PURPOSES, TEMPLATES } from "./labels";

/**
 * Change a bank account's details. The bank, number, currency and ledger
 * account are fixed once statements are checked against them, so they are
 * not here. For CSV and Excel exports the column headings can be named, for
 * banks whose export uses headings the reader doesn't know.
 */

/** The roles the statement reader looks for (`TabularStatementParser::ALIASES`). */
export const COLUMN_ROLES: { key: string; label: string; example: string }[] = [
  { key: "txn", label: "Transaction date", example: "Trans Date" },
  { key: "value", label: "Value date", example: "Value Date" },
  { key: "narration", label: "Narration", example: "Remarks" },
  { key: "cheque", label: "Reference or cheque number", example: "Ref" },
  { key: "withdrawal", label: "Money out", example: "Debit" },
  { key: "deposit", label: "Money in", example: "Credit" },
  { key: "amount", label: "Single amount column", example: "Amount" },
  { key: "balance", label: "Balance", example: "Balance" },
];

const opts = <K extends string>(m: Record<K, string>): SelectOption[] => (Object.keys(m) as K[]).map((k) => ({ value: k, label: m[k] }));

function mappingFrom(raw: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of COLUMN_ROLES) {
    const v = raw?.[r.key];
    if (typeof v === "string") out[r.key] = v;
  }
  return out;
}

export default function EditBankAccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: BankAccount;
  onClose: () => void;
  onSaved: (account: BankAccount) => void;
}) {
  const uid = useId();
  const [name, setName] = useState(account.name);
  const [bankName, setBankName] = useState(account.bankName ?? "");
  const [accountType, setAccountType] = useState<BankAccountType>(account.accountType);
  const [purpose, setPurpose] = useState<BankPurpose>(account.purpose);
  const [template, setTemplate] = useState<StatementTemplate>(account.statementTemplate);
  const [mapping, setMapping] = useState<Record<string, string>>(() => mappingFrom(account.columnMapping));
  const [address, setAddress] = useState(account.addressOnRecord ?? "");
  const [threshold, setThreshold] = useState(account.lowBalanceThreshold === null ? "" : amountInput(account.lowBalanceThreshold));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lbl = "mb-1.5 block text-sm font-medium text-neutral-700";
  const tabular = template === "csv" || template === "xlsx";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim() === "") found.name = "Give the account a name people will recognise.";
    if (account.bankCode === "other" && bankName.trim() === "") found.bankName = "Name the bank.";
    const limit = threshold.trim() === "" ? null : parseAmount(threshold);
    if (threshold.trim() !== "" && limit === null) found.lowBalanceThreshold = "Type an amount like 5,000,000.00.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    const cleaned = Object.fromEntries(Object.entries(mapping).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ""));
    const input: BankAccountUpdate = {
      name: name.trim(),
      accountType,
      purpose,
      statementTemplate: template,
      columnMapping: tabular && Object.keys(cleaned).length > 0 ? cleaned : null,
      addressOnRecord: address.trim() || null,
      lowBalanceThreshold: limit,
    };
    if (account.bankCode === "other") input.bankName = bankName.trim();

    setBusy(true);
    try {
      onSaved(await banking.accounts.update(account.id, input));
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title="Edit account"
      subtitle={`${account.number} · ${account.currency}. The bank, number, currency and ledger account can't change.`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-name`} className={lbl}>
            Account name
          </label>
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={errors.name ? true : undefined} className={inputClass} />
          <FieldError message={errors.name} />
        </div>
        {account.bankCode === "other" && (
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-bankname`} className={lbl}>
              Bank name
            </label>
            <input id={`${uid}-bankname`} value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={120} aria-invalid={errors.bankName ? true : undefined} className={inputClass} />
            <FieldError message={errors.bankName} />
          </div>
        )}
        <div>
          <label htmlFor={`${uid}-type`} className={lbl}>
            Account type
          </label>
          <SearchableSelect id={`${uid}-type`} value={accountType} onChange={(v) => setAccountType(v as BankAccountType)} options={opts(ACCOUNT_TYPES)} />
        </div>
        <div>
          <label htmlFor={`${uid}-purpose`} className={lbl}>
            Used for
          </label>
          <SearchableSelect id={`${uid}-purpose`} value={purpose} onChange={(v) => setPurpose(v as BankPurpose)} options={opts(PURPOSES)} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-tpl`} className={lbl}>
            Statement format
          </label>
          <SearchableSelect
            id={`${uid}-tpl`}
            value={template}
            onChange={(v) => setTemplate(v as StatementTemplate)}
            options={(Object.keys(TEMPLATES) as StatementTemplate[]).map((k) => ({ value: k, label: TEMPLATES[k].label, hint: TEMPLATES[k].hint }))}
          />
        </div>
      </div>

      {tabular && (
        <fieldset className="rounded-xl border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-medium text-neutral-700">Column headings</legend>
          <p className="mb-3 text-xs text-neutral-500">
            Leave blank to let the reader find the usual headings. Fill in only the ones this bank names differently, exactly as they appear in the file. A file needs a date, narration, balance and either money in and out or a single amount.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLUMN_ROLES.map((r) => (
              <div key={r.key}>
                <label htmlFor={`${uid}-col-${r.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                  {r.label}
                </label>
                <input
                  id={`${uid}-col-${r.key}`}
                  value={mapping[r.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [r.key]: e.target.value }))}
                  maxLength={80}
                  placeholder={r.example}
                  className={cx(inputClass, "!h-10")}
                />
              </div>
            ))}
          </div>
          <FieldError message={errors.columnMapping} />
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-limit`} className={lbl}>
            Low-balance warning <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input id={`${uid}-limit`} inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="5,000,000.00" aria-invalid={errors.lowBalanceThreshold ? true : undefined} className={cx(inputClass, "tabular-nums")} />
          <FieldError message={errors.lowBalanceThreshold} />
        </div>
        <div>
          <label htmlFor={`${uid}-addr`} className={lbl}>
            Address the bank holds <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input id={`${uid}-addr`} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={255} className={inputClass} />
          <p className="mt-1.5 text-xs text-neutral-500">Compared with the address on each statement, to catch outdated KYC.</p>
        </div>
      </div>
    </DialogFrame>
  );
}
