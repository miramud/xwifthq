"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { BadgeCheck, Info, ScrollText } from "lucide-react";
import { Button, Chip, Empty, Segmented, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ErrorNote, hintClass, inputClass, labelClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  LICENCE_METHOD_LABEL,
  platformOrganisations,
  type LicenceCurrency,
  type LicencePreview,
  type LicenceRow,
  type NewLicence,
} from "@/lib/api/platform-client";
import { currencySymbol, formatMoney, majorText, parseMajor } from "@/lib/money";
import { MODULE_LABEL, type SuiteModuleKey } from "@/lib/module-access";
import { formatDate, ModuleChip } from "../ui";

/*
  Licensing modules by hand (27 Sep 2026). Online payment for modules is off,
  so the platform owner records what an organisation paid — a first purchase
  or an upgrade up the ladder — and the modules switch on for good. Every
  licence keeps the list price and credit beside what was actually paid, so
  finance can audit the discount without asking anybody.
*/

type Method = NewLicence["method"];

const METHODS: Method[] = ["bank_transfer", "cheque", "cash", "card", "complimentary", "other"];

/** Methods where a bank, cheque or receipt reference is expected. */
const needsReference = (m: Method) => m !== "complimentary" && m !== "cash";
/** Methods that have to say why, for the audit trail. */
const needsNote = (m: Method) => m === "complimentary" || m === "other";

export function licenceModuleName(key: string, labels?: Record<string, string>): string {
  return labels?.[key] ?? MODULE_LABEL[key as SuiteModuleKey] ?? key.toUpperCase();
}

/** The paid module keys a history holds — what the organisation owns outright. */
export function licensedModules(history: LicenceRow[]): Set<string> {
  return new Set(history.filter((l) => l.status === "paid").flatMap((l) => l.modules));
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "₦250,000 below list" / "₦10,000 above list" / "At list price". */
export function discountLabel(discountMinor: number, currency: string): string {
  if (discountMinor === 0) return "At list price";
  return discountMinor > 0
    ? `${formatMoney(discountMinor, currency)} below list`
    : `${formatMoney(-discountMinor, currency)} above list`;
}

/* ------------------------------------------------------------------ */
/*  The ladder, drawn                                                  */
/* ------------------------------------------------------------------ */

/**
 * Owned steps, the steps this licence adds, and the rest of the ladder in
 * the workspace hatch — "not yet" reads as texture, as everywhere else.
 */
export function LadderSteps({ before, after }: { before: number; after: number }) {
  const total = Math.max(5, after);
  return (
    <div
      className="flex items-end gap-1"
      role="img"
      aria-label={`${before} module${before === 1 ? "" : "s"} owned, ${after} after this licence`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx(
            "w-5 rounded-md",
            i < before ? "bg-primary-200" : i < after ? "bg-primary-600" : "ws-hatch",
          )}
          style={{ height: `${10 + i * 5}px` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  History                                                            */
/* ------------------------------------------------------------------ */

export function LicenceHistory({
  rows,
  labels,
  action,
}: {
  rows: LicenceRow[];
  labels: Record<string, string>;
  action?: React.ReactNode;
}) {
  const columns: Column<LicenceRow>[] = [
    {
      key: "reference",
      header: "Licence",
      primary: true,
      sortable: true,
      value: (l) => l.reference,
      render: (l) => (
        <span className="min-w-0">
          <span className="block truncate font-mono text-xs font-semibold text-neutral-900">{l.reference}</span>
          <span className="block text-xs text-neutral-500">
            {l.paidAt ? `Paid ${formatDate(l.paidAt)}` : l.status === "paid" ? "Paid" : `Not paid (${l.status})`}
          </span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      value: (l) => l.kind,
      render: (l) => (
        <span className="flex flex-wrap gap-1">
          <Chip hue={l.kind === "upgrade" ? "grape" : "mint"} dot>
            {l.kind === "upgrade" ? "Upgrade" : "New purchase"}
          </Chip>
          <Chip hue={l.channel === "offline" ? "slate" : "sky"}>{l.channel === "offline" ? "By hand" : "Online"}</Chip>
        </span>
      ),
    },
    {
      key: "modules",
      header: "Modules",
      value: (l) => l.modules.map((m) => licenceModuleName(m, labels)).join(" "),
      render: (l) => (
        <span className="min-w-0">
          <span className="flex flex-wrap gap-1" aria-label="Modules licensed">
            {l.modules.map((m) => (
              <ModuleChip key={m} moduleKey={m} label={licenceModuleName(m, labels)} />
            ))}
          </span>
          <span className="mt-1 block text-xs tabular-nums text-neutral-500">
            {l.modulesBefore} → {l.modulesAfter} modules
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Paid / list",
      align: "right",
      sortable: true,
      value: (l) => l.amountMinor,
      render: (l) => (
        <span className="tabular-nums">
          <span className="block font-semibold text-neutral-900">{formatMoney(l.amountMinor, l.currency)}</span>
          <span className="block text-xs text-neutral-500">
            List {formatMoney(l.listPriceMinor, l.currency)}
            {l.creditMinor > 0 && ` · credit ${formatMoney(l.creditMinor, l.currency)}`}
          </span>
          <span className={cx("block text-xs", l.discountMinor > 0 ? "text-sun-700" : "text-neutral-500")}>
            {discountLabel(l.discountMinor, l.currency)}
          </span>
        </span>
      ),
    },
    {
      key: "method",
      header: "Payment",
      hideOnMobile: true,
      value: (l) => `${l.paymentMethod ?? ""} ${l.paymentReference ?? ""}`,
      render: (l) => (
        <span className="min-w-0 text-sm">
          <span className="block text-neutral-800">{l.paymentMethod ? LICENCE_METHOD_LABEL[l.paymentMethod] ?? l.paymentMethod : "—"}</span>
          <span className="block truncate font-mono text-xs text-neutral-500">{l.paymentReference ?? "No reference"}</span>
          {l.note && (
            <span className="block max-w-[16rem] truncate text-xs text-neutral-500" title={l.note}>
              {l.note}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "by",
      header: "Recorded by",
      hideOnMobile: true,
      value: (l) => l.recordedBy?.name ?? l.paidBy?.name ?? "",
      render: (l) =>
        l.recordedBy ? (
          <span className="text-sm text-neutral-700">{l.recordedBy.name}</span>
        ) : l.paidBy ? (
          <span className="text-sm text-neutral-700">
            {l.paidBy.name}
            <span className="block text-xs text-neutral-500">Paid online</span>
          </span>
        ) : (
          <span className="text-neutral-500">—</span>
        ),
    },
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(l) => l.id}
      storageKey="platform.org.licences"
      caption="Licence history"
      searchable={false}
      gridCols={2}
      empty={
        <Empty
          icon={ScrollText}
          hue="grape"
          title="No licences yet"
          hint="When this organisation pays for modules, record it here. The modules switch on for good and their admins are emailed."
          action={action}
        />
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Recording one                                                      */
/* ------------------------------------------------------------------ */

type FieldKey = "modules" | "amount" | "method" | "reference" | "paidOn" | "note" | "currency";

/** Server field names to the boxes they belong to. */
const SERVER_FIELD: Record<string, FieldKey> = {
  modules: "modules",
  amountMinor: "amount",
  method: "method",
  reference: "reference",
  paidOn: "paidOn",
  note: "note",
  currency: "currency",
};

function fieldErrorsOf(errors: Record<string, string[]> | undefined): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  for (const [k, v] of Object.entries(errors ?? {})) {
    const field = SERVER_FIELD[k.split(".")[0]];
    if (field && !out[field] && v[0]) out[field] = v[0];
  }
  return out;
}

export function RecordLicenceDialog({
  slug,
  organisationName,
  modules,
  owned,
  onClose,
  onRecorded,
}: {
  slug: string;
  organisationName: string;
  /** Every module that can be licensed, key and label. */
  modules: { key: string; label: string }[];
  /** Module keys already bought. */
  owned: Set<string>;
  onClose: () => void;
  onRecorded: (licence: LicenceRow) => void;
}) {
  const id = useId();
  const [picked, setPicked] = useState<string[]>([]);
  const [currency, setCurrency] = useState<LicenceCurrency>("NGN");
  const [preview, setPreview] = useState<LicencePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Anything the preview says is already licensed joins what we knew.
  const [alsoOwned, setAlsoOwned] = useState<string[]>([]);

  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState<Method>("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isOwned = (key: string) => owned.has(key) || alsoOwned.includes(key);
  const labels = useMemo(() => Object.fromEntries(modules.map((m) => [m.key, m.label])), [modules]);
  const pickKey = picked.join(",");

  useEffect(() => {
    if (pickKey === "") return;
    let alive = true;
    platformOrganisations
      .previewLicence(slug, { modules: pickKey.split(","), currency })
      .then((p) => {
        if (!alive) return;
        setPreview(p);
        setPreviewError(null);
        if (p.alreadyLicensed.length > 0) {
          setAlsoOwned((prev) => [...new Set([...prev, ...p.alreadyLicensed])]);
          setPicked((prev) => prev.filter((k) => !p.alreadyLicensed.includes(k)));
        }
        if (!amountTouched) setAmount(majorText(p.suggestedMinor));
      })
      .catch((e: unknown) => {
        if (alive) setPreviewError(e instanceof ApiError ? e.message : "The price didn't load. Pick again to retry.");
      })
      .finally(() => {
        if (alive) setPreviewing(false);
      });
    return () => {
      alive = false;
    };
    // `amountTouched` is read, not watched: typing an amount must not re-price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, pickKey, currency]);

  function toggle(key: string, on: boolean) {
    const next = on ? [...picked, key] : picked.filter((k) => k !== key);
    setPicked(next);
    setErrors((e) => ({ ...e, modules: undefined }));
    if (next.length === 0) setPreview(null);
    else setPreviewing(true);
  }

  function chooseCurrency(c: LicenceCurrency) {
    setCurrency(c);
    // A figure typed in naira means nothing in dollars.
    setAmountTouched(false);
    if (picked.length > 0) setPreviewing(true);
  }

  function chooseMethod(m: Method) {
    setMethod(m);
    if (m === "complimentary") {
      setAmount("0");
      setAmountTouched(true);
    }
    setErrors((e) => ({ ...e, reference: undefined, note: undefined, amount: undefined }));
  }

  const live = picked.length > 0 ? preview : null;
  const parsed = parseMajor(amount);
  const canSubmit = picked.length > 0 && live !== null && live.modulesAdded > 0 && !previewing && !saving;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !live) return;

    const problems: Partial<Record<FieldKey, string>> = {};
    if (parsed === "invalid" || parsed === null) problems.amount = "Enter the amount paid, like 2500000.";
    else if (parsed === 0 && method !== "complimentary")
      problems.amount = "Enter what was paid, or choose Complimentary if nothing was.";
    if (needsReference(method) && reference.trim() === "")
      problems.reference = "Enter the bank, cheque or receipt reference, so finance can match it.";
    if (needsNote(method) && note.trim() === "") problems.note = "Say why, for the audit trail.";
    if (!paidOn) problems.paidOn = "Enter the day the money arrived.";
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const licence = await platformOrganisations.recordLicence(slug, {
        modules: picked,
        currency,
        amountMinor: parsed as number,
        method,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        paidOn,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onRecorded(licence);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError) {
        const fields = fieldErrorsOf(err.errors);
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? "Check the fields marked below." : err.message);
      } else {
        setFormError("The licence wasn't recorded. Try again.");
      }
    }
  }

  const err = (k: FieldKey) =>
    errors[k] ? (
      <p id={`${id}-${k}-error`} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
        {errors[k]}
      </p>
    ) : null;
  const describedBy = (k: FieldKey, hint?: boolean) =>
    [errors[k] ? `${id}-${k}-error` : null, hint ? `${id}-${k}-help` : null].filter(Boolean).join(" ") || undefined;

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${id}-title`}
      title="Record a licence"
      subtitle={`What ${organisationName} paid for modules. Recording it switches them on for good and emails the organisation's admins.`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="space-y-3">
          {formError && <ErrorNote>{formError}</ErrorNote>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" icon={BadgeCheck} disabled={!canSubmit}>
              {saving ? "Recording…" : "Record licence"}
            </Button>
          </div>
        </div>
      }
    >
      <fieldset aria-describedby={describedBy("modules")}>
        <legend className={labelClass}>
          Modules paid for <span className="text-error-600">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map((m) => {
            const already = isOwned(m.key);
            const on = picked.includes(m.key);
            return (
              <label
                key={m.key}
                className={cx(
                  "flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  already
                    ? "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-500"
                    : on
                      ? "cursor-pointer border-primary-300 bg-primary-50/60 text-neutral-900"
                      : "cursor-pointer border-neutral-200 text-neutral-800 hover:bg-neutral-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={already || on}
                  disabled={already || saving}
                  onChange={(e) => toggle(m.key, e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
                />
                <span className="flex-1 font-medium">{m.label}</span>
                {already && <Chip hue="mint" dot>Licensed</Chip>}
              </label>
            );
          })}
        </div>
        {err("modules")}
      </fieldset>

      <div>
        <p className={labelClass} id={`${id}-currency`}>
          Paid in
        </p>
        <Segmented
          label="Currency paid in"
          value={currency}
          onChange={chooseCurrency}
          options={[
            { key: "NGN", label: "Naira (₦)" },
            { key: "USD", label: "Dollars ($)" },
          ]}
        />
        {err("currency")}
      </div>

      {picked.length > 0 && (
        <section
          aria-label="Price on the ladder"
          aria-busy={previewing}
          className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
        >
          {previewError ? (
            <p role="alert" className="text-sm text-error-700">{previewError}</p>
          ) : !live ? (
            <p className="text-sm text-neutral-500">Working out the price…</p>
          ) : (
            <div className={cx("space-y-4 transition-opacity", previewing && "opacity-60")}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Chip hue={live.kind === "upgrade" ? "grape" : "mint"} dot>
                    {live.kind === "upgrade" ? "Upgrade" : "New purchase"}
                  </Chip>
                  <p className="mt-2 text-sm text-neutral-700">
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {live.modulesBefore} → {live.modulesAfter}
                    </span>{" "}
                    modules
                    {live.modules.length > 0 && (
                      <span className="text-neutral-500"> · adds {live.modules.map((k) => licenceModuleName(k, labels)).join(", ")}</span>
                    )}
                  </p>
                </div>
                <LadderSteps before={live.modulesBefore} after={live.modulesAfter} />
              </div>
              <dl className="grid grid-cols-3 gap-3 border-t border-neutral-200 pt-3 text-sm">
                <div>
                  <dt className="text-xs text-neutral-500">List price</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">{formatMoney(live.listPriceMinor, live.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Credit</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">
                    {live.creditMinor > 0 ? `− ${formatMoney(live.creditMinor, live.currency)}` : formatMoney(0, live.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Suggested</dt>
                  <dd className="font-bold tabular-nums text-primary-700">{formatMoney(live.suggestedMinor, live.currency)}</dd>
                </div>
              </dl>
              {live.modulesAdded === 0 && (
                <p role="alert" className="text-sm text-error-700">
                  Every module you picked is already licensed. Pick one they don&apos;t own yet.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-amount`} className={labelClass}>
            Amount paid <span className="text-error-600">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-neutral-500" aria-hidden>
              {currencySymbol(currency)}
            </span>
            <input
              id={`${id}-amount`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountTouched(true);
                setErrors((x) => ({ ...x, amount: undefined }));
              }}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={describedBy("amount", true)}
              className={cx(inputClass, "pl-8 tabular-nums")}
              placeholder="0"
            />
          </div>
          <p id={`${id}-amount-help`} className={hintClass}>
            {live && typeof parsed === "number" && parsed !== live.suggestedMinor ? (
              <>
                {discountLabel(live.suggestedMinor - parsed, currency)} ·{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAmount(majorText(live.suggestedMinor));
                    setAmountTouched(false);
                  }}
                  className="cursor-pointer font-semibold text-primary-700 underline-offset-2 hover:underline"
                >
                  Use suggested
                </button>
              </>
            ) : (
              `In ${currency === "NGN" ? "naira" : "dollars"}, what actually arrived.`
            )}
          </p>
          {err("amount")}
        </div>

        <div>
          <label htmlFor={`${id}-method`} className={labelClass}>
            Payment method <span className="text-error-600">*</span>
          </label>
          <SearchableSelect
            id={`${id}-method`}
            value={method}
            onChange={(v) => chooseMethod(v as Method)}
            aria-describedby={describedBy("method")}
            options={METHODS.map((m) => ({ value: m, label: LICENCE_METHOD_LABEL[m] }))}
          />
          {err("method")}
        </div>

        <div>
          <label htmlFor={`${id}-reference`} className={labelClass}>
            Payment reference {needsReference(method) && <span className="text-error-600">*</span>}
          </label>
          <input
            id={`${id}-reference`}
            value={reference}
            onChange={(e) => {
              setReference(e.target.value);
              setErrors((x) => ({ ...x, reference: undefined }));
            }}
            maxLength={120}
            aria-invalid={Boolean(errors.reference)}
            aria-describedby={describedBy("reference")}
            className={inputClass}
            placeholder={method === "cheque" ? "Cheque number" : "Bank or receipt reference"}
          />
          {err("reference")}
        </div>

        <div>
          <label htmlFor={`${id}-paidOn`} className={labelClass}>
            Paid on <span className="text-error-600">*</span>
          </label>
          <input
            id={`${id}-paidOn`}
            type="date"
            value={paidOn}
            max={today()}
            onChange={(e) => setPaidOn(e.target.value)}
            aria-describedby={describedBy("paidOn")}
            className={inputClass}
          />
          {err("paidOn")}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-note`} className={labelClass}>
          Note {needsNote(method) && <span className="text-error-600">*</span>}
        </label>
        <textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setErrors((x) => ({ ...x, note: undefined }));
          }}
          rows={2}
          maxLength={500}
          aria-invalid={Boolean(errors.note)}
          aria-describedby={describedBy("note", true)}
          className={textareaClass}
          placeholder={method === "complimentary" ? "Why it was given free" : "Anything finance should know"}
        />
        <p id={`${id}-note-help`} className={hintClass}>
          {needsNote(method) ? "Required for this method — it is kept with the licence and in the audit log." : "Optional."}
        </p>
        {err("note")}
      </div>

      <p className="flex items-start gap-2 text-xs text-neutral-500">
        <Info size={14} className="mt-px shrink-0 text-info-600" aria-hidden />
        Payments and Sales list it as licensed by hand, with the list price and credit beside what was paid.
      </p>
    </DialogFrame>
  );
}
