"use client";

import { useEffect, useId, useState } from "react";
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
  type BankCode,
  type BankPurpose,
  type StatementTemplate,
} from "@/lib/api/finance-banking-client";
import { parseAmount } from "@/suite/finance/lib/format";
import { ACCOUNT_TYPES, BANKS, PURPOSES, TEMPLATES } from "./labels";

/**
 * Register a bank account. Every bank account posts to one GL account: link
 * an asset account already in the chart, or let Finance make one under the
 * cash heading.
 */

const CURRENCIES: SelectOption[] = [
  { value: "NGN", label: "NGN · Naira" },
  { value: "USD", label: "USD · US dollar" },
  { value: "GBP", label: "GBP · Pound sterling" },
  { value: "EUR", label: "EUR · Euro" },
];

const opts = <K extends string>(m: Record<K, string>): SelectOption[] => (Object.keys(m) as K[]).map((k) => ({ value: k, label: m[k] }));

export default function AddBankAccountDialog({
  takenGlIds,
  onClose,
  onCreated,
}: {
  /** GL accounts that already belong to a bank account. */
  takenGlIds: string[];
  onClose: () => void;
  onCreated: (account: BankAccount) => void;
}) {
  const uid = useId();
  const [name, setName] = useState("");
  const [bankCode, setBankCode] = useState<BankCode>("uba");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [accountType, setAccountType] = useState<BankAccountType>("current");
  const [purpose, setPurpose] = useState<BankPurpose>("ops");
  const [template, setTemplate] = useState<StatementTemplate>("uba_pdf");
  const [glMode, setGlMode] = useState<"create" | "link">("create");
  const [glAccountId, setGlAccountId] = useState("");
  const [address, setAddress] = useState("");
  const [threshold, setThreshold] = useState("");
  const [gl, setGl] = useState<{ status: "loading" | "ready" | "error"; options: SelectOption[] }>({ status: "loading", options: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lbl = "mb-1.5 block text-sm font-medium text-neutral-700";

  useEffect(() => {
    let alive = true;
    banking
      .glAccounts()
      .then((rows) => {
        if (!alive) return;
        setGl({
          status: "ready",
          options: rows
            .filter((a) => a.type === "asset" && a.isPostable && a.active && !takenGlIds.includes(a.id))
            .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}`, hint: [a.isBank ? "Bank" : null, a.currency].filter(Boolean).join(" · ") || undefined })),
        });
      })
      .catch(() => alive && setGl({ status: "error", options: [] }));
    return () => {
      alive = false;
    };
  }, [takenGlIds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim() === "") found.name = "Give the account a name people will recognise, like “UBA operating account”.";
    if (!/^\d{6,20}$/.test(accountNumber.replace(/\s/g, ""))) found.accountNumber = "Type the account number: 6 to 20 digits, no spaces.";
    if (bankCode === "other" && bankName.trim() === "") found.bankName = "Name the bank.";
    if (glMode === "link" && glAccountId === "") found.glAccountId = "Choose the GL account this bank posts to, or let Finance create one.";
    const limit = threshold.trim() === "" ? null : parseAmount(threshold);
    if (threshold.trim() !== "" && limit === null) found.lowBalanceThreshold = "Type an amount like 5,000,000.00.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const made = await banking.accounts.create({
        name: name.trim(),
        bankCode,
        bankName: bankCode === "other" ? bankName.trim() : null,
        accountNumber: accountNumber.replace(/\s/g, ""),
        currency,
        accountType,
        purpose,
        statementTemplate: template,
        glAccountId: glMode === "link" ? glAccountId : null,
        addressOnRecord: address.trim() || null,
        lowBalanceThreshold: limit,
      });
      onCreated(made);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const radio = (on: boolean) =>
    cx(
      "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition focus-within:ring-2 focus-within:ring-primary-300",
      on ? "border-primary-500 bg-primary-50/60" : "border-neutral-200 bg-white hover:border-neutral-300",
    );

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title="Add bank account"
      subtitle="Statements for this account are checked against the number you type here."
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Adding…" : "Add bank account"}
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
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="UBA operating account" aria-invalid={errors.name ? true : undefined} className={inputClass} />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label htmlFor={`${uid}-bank`} className={lbl}>
            Bank
          </label>
          <SearchableSelect id={`${uid}-bank`} value={bankCode} onChange={(v) => setBankCode(v as BankCode)} options={opts(BANKS)} searchPlaceholder="Search banks" />
        </div>
        <div>
          <label htmlFor={`${uid}-number`} className={lbl}>
            Account number
          </label>
          <input id={`${uid}-number`} inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={24} aria-invalid={errors.accountNumber ? true : undefined} className={cx(inputClass, "font-mono")} />
          <FieldError message={errors.accountNumber} />
        </div>
        {bankCode === "other" && (
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-bankname`} className={lbl}>
              Bank name
            </label>
            <input id={`${uid}-bankname`} value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={120} aria-invalid={errors.bankName ? true : undefined} className={inputClass} />
            <FieldError message={errors.bankName} />
          </div>
        )}
        <div>
          <label htmlFor={`${uid}-cur`} className={lbl}>
            Currency
          </label>
          <SearchableSelect id={`${uid}-cur`} value={currency} onChange={setCurrency} options={CURRENCIES} />
        </div>
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
        <div>
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

      <fieldset>
        <legend className={lbl}>Ledger account</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={radio(glMode === "create")}>
            <input type="radio" name={`${uid}-gl`} checked={glMode === "create"} onChange={() => setGlMode("create")} className="mt-0.5 accent-primary-600" />
            <span>
              <span className="block font-semibold text-neutral-900">Create one for me</span>
              <span className="block text-xs text-neutral-500">A new account under the cash heading, named after this bank account.</span>
            </span>
          </label>
          <label className={radio(glMode === "link")}>
            <input type="radio" name={`${uid}-gl`} checked={glMode === "link"} onChange={() => setGlMode("link")} className="mt-0.5 accent-primary-600" />
            <span>
              <span className="block font-semibold text-neutral-900">Link an existing account</span>
              <span className="block text-xs text-neutral-500">A postable asset account in the chart that no other bank uses.</span>
            </span>
          </label>
        </div>
        {glMode === "link" && (
          <div className="mt-3">
            <label htmlFor={`${uid}-gl-account`} className="sr-only">
              GL account
            </label>
            <SearchableSelect
              id={`${uid}-gl-account`}
              value={glAccountId}
              onChange={setGlAccountId}
              options={gl.options}
              placeholder={gl.status === "loading" ? "Loading accounts…" : "Choose an asset account"}
              searchPlaceholder="Search by code or name"
              noOptionsText={gl.status === "error" ? "The chart of accounts didn't load. Close this and try again." : "No free asset accounts. Let Finance create one instead."}
              aria-invalid={errors.glAccountId ? true : undefined}
            />
            <FieldError message={errors.glAccountId} />
          </div>
        )}
      </fieldset>

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
