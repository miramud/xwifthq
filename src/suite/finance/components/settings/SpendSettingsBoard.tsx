"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, FileCheck2, Percent, Plus, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  fieldMessages,
  plainError,
  spend,
  type ChecklistItem,
  type ChecklistMemoType,
  type SpendLimits,
  type SpendSettings,
  type WhtRateRow,
} from "@/lib/api/finance-payments-client";
import { Button, PageHeader, Panel, UnderlineTabs, cx } from "@/components/workspace/kit";
import { ErrorNote, Skeleton, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, parseAmount } from "@/suite/finance/lib/format";
import { bpFromPct, pct } from "../vouchers/meta";

/**
 * Spend settings: the limits and the fund-control switch, the documents
 * each kind of request must carry, and the withholding tax table. Each part
 * saves on its own, and says so when it has.
 */

const MEMO_TYPES: { key: ChecklistMemoType; label: string; hint: string }[] = [
  { key: "payment", label: "Payment requests", hint: "Paying a vendor or a staff claim" },
  { key: "advance", label: "Advances", hint: "Cash advanced to staff, retired later" },
  { key: "system", label: "System requests", hint: "Raised by the software, such as payroll" },
  { key: "retirement", label: "Retirements", hint: "Accounting for an advance" },
];

const LIMITS: { key: Exclude<keyof SpendLimits, "fund_control" | "commitment_auto_expire">; label: string; hint: string; max: number }[] = [
  { key: "advance_retirement_days", label: "Retire an advance within", hint: "After this, the advance shows as overdue and the person can't take another.", max: 365 },
  { key: "memo_clear_days", label: "FCU vets a request within", hint: "A request waiting longer than this is flagged on the exceptions board.", max: 365 },
  { key: "statement_match_days", label: "Match a payment to the statement within", hint: "A provisional payment not matched to a statement line by then is flagged.", max: 90 },
  { key: "memo_reminder_days", label: "Remind about an approved request with no voucher after", hint: "The requester and Finance are reminded once.", max: 365 },
  { key: "commitment_alert_days", label: "Flag an unpaid commitment after", hint: "It shows on the exceptions board and in the MD's weekly digest.", max: 730 },
  { key: "commitment_expiry_days", label: "Finance may expire an unpaid request after", hint: "Expiring frees the money held back for it. Before then, only whoever can change these settings may.", max: 730 },
];

export default function SpendSettingsBoard() {
  const { user } = useAuth();
  const [data, setData] = useState<SpendSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    spend.settings.get().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(plainError(e, "Spend settings didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const refresh = (message: string) => {
    setNotice(message);
    setReload((n) => n + 1);
  };

  return (
    <div>
      <PageHeader eyebrow="Spend to pay" title="Spend settings" subtitle="The limits, the documents each request needs, and the withholding tax rates vouchers use." />
      <Notice text={notice} />
      {error && <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />}
      {!data ? (
        !error && (
          <div className="space-y-5">
            <Skeleton className="h-64" />
            <Skeleton className="h-80" />
          </div>
        )
      ) : (
        <div className="space-y-5">
          <LimitsPanel limits={data.settings} canEdit={mayDo(user, "spend_settings", "update_settings")} onSaved={refresh} />
          <ChecklistsPanel
            items={data.checklists}
            canAdd={mayDo(user, "spend_settings", "create_checklist_item")}
            canEdit={mayDo(user, "spend_settings", "update_checklist_item")}
            onSaved={refresh}
          />
          <WhtPanel rates={data.whtRates} canEdit={mayDo(user, "spend_settings", "update_wht_rate")} onSaved={refresh} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ limits ------------------------------ */

function LimitsPanel({ limits, canEdit, onSaved }: { limits: SpendLimits; canEdit: boolean; onSaved: (m: string) => void }) {
  const uid = useId();
  const [fund, setFund] = useState(limits.fund_control);
  const [autoExpire, setAutoExpire] = useState(Boolean(limits.commitment_auto_expire));
  const [days, setDays] = useState<Record<string, string>>(() => Object.fromEntries(LIMITS.map((l) => [l.key, String(limits[l.key])])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const changed: Partial<SpendLimits> = {};
  if (fund !== limits.fund_control) changed.fund_control = fund;
  if (autoExpire !== Boolean(limits.commitment_auto_expire)) changed.commitment_auto_expire = autoExpire;
  for (const l of LIMITS) if (days[l.key] !== String(limits[l.key])) changed[l.key] = Number(days[l.key]);
  const dirty = Object.keys(changed).length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const l of LIMITS) {
      const v = days[l.key];
      if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > l.max) errs[l.key] = `Enter a whole number of days from 1 to ${l.max}.`;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await spend.settings.update(changed);
      onSaved("Limits saved.");
    } catch (err) {
      const f = fieldMessages(err);
      setErrors(Object.keys(f).length ? f : { general: plainError(err, "The limits weren't saved.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Limits and fund control" subtitle="How long things may wait, and whether project funds are enforced" icon={SlidersHorizontal}>
      <form onSubmit={save} noValidate className="space-y-4">
        {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Fund control</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {fund
                ? "On: a request against a project is refused when the project hasn't the released funds, unless the MD allows it with a reason."
                : "Off: requests are not checked against released funds. Budgets and releases are still recorded."}
            </p>
          </div>
          <span className="flex items-center gap-2">
            <span className={cx("text-xs font-semibold", fund ? "text-mint-700" : "text-neutral-500")} aria-hidden>
              {fund ? "On" : "Off"}
            </span>
            <Switch checked={fund} onChange={setFund} label="Fund control" disabled={!canEdit} />
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Expire unpaid requests automatically</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {autoExpire
                ? `On: each morning, approved requests unpaid after ${days.commitment_expiry_days || "the"} days expire by themselves and their funds are freed. The requester is told.`
                : "Off: they are listed on the exceptions board for Finance to expire, with a reason."}
            </p>
          </div>
          <span className="flex items-center gap-2">
            <span className={cx("text-xs font-semibold", autoExpire ? "text-mint-700" : "text-neutral-500")} aria-hidden>
              {autoExpire ? "On" : "Off"}
            </span>
            <Switch checked={autoExpire} onChange={setAutoExpire} label="Expire unpaid requests automatically" disabled={!canEdit} />
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {LIMITS.map((l) => (
            <div key={l.key}>
              <label htmlFor={`${uid}-${l.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                {l.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${uid}-${l.key}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={l.max}
                  value={days[l.key]}
                  disabled={!canEdit}
                  onChange={(e) => setDays((d) => ({ ...d, [l.key]: e.target.value }))}
                  aria-invalid={Boolean(errors[l.key]) || undefined}
                  aria-describedby={`${uid}-${l.key}-hint`}
                  className={cx(inputClass, "w-28 text-right tabular-nums")}
                />
                <span className="text-sm text-neutral-600">days</span>
              </div>
              {errors[l.key] ? (
                <FieldError message={errors[l.key]} />
              ) : (
                <p id={`${uid}-${l.key}-hint`} className="mt-1.5 text-xs text-neutral-500">
                  {l.hint}
                </p>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={!dirty || busy}>
              {busy ? "Saving…" : "Save limits"}
            </Button>
          </div>
        )}
      </form>
    </Panel>
  );
}

/* ----------------------------- checklists ---------------------------- */

function ChecklistsPanel({ items, canAdd, canEdit, onSaved }: { items: ChecklistItem[]; canAdd: boolean; canEdit: boolean; onSaved: (m: string) => void }) {
  const [type, setType] = useState<ChecklistMemoType>("payment");
  const shown = items.filter((i) => i.memoType === type);
  const meta = MEMO_TYPES.find((m) => m.key === type)!;
  return (
    <Panel title="Document checklists" subtitle="What each kind of request must carry before the FCU clears it" icon={FileCheck2} hue="coral" bodyClassName="px-5 pb-5">
      <UnderlineTabs
        tabs={MEMO_TYPES.map((m) => ({ key: m.key, label: m.label, count: items.filter((i) => i.memoType === m.key && i.active).length }))}
        active={type}
        onChange={(k) => setType(k as ChecklistMemoType)}
        className="mb-4"
      />
      <p className="mb-3 text-xs text-neutral-500">{meta.hint}. A document can be required always, or only from an amount up.</p>
      {shown.length === 0 ? (
        <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">No documents asked for on {meta.label.toLowerCase()} yet.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((it) => (
            <ChecklistRow key={it.id} item={it} canEdit={canEdit} onSaved={onSaved} />
          ))}
        </ul>
      )}
      {canAdd && <AddChecklistItem memoType={type} label={meta.label} onSaved={onSaved} />}
    </Panel>
  );
}

function ChecklistRow({ item, canEdit, onSaved }: { item: ChecklistItem; canEdit: boolean; onSaved: (m: string) => void }) {
  const uid = useId();
  const [label, setLabel] = useState(item.label);
  const [hint, setHint] = useState(item.hint ?? "");
  const [required, setRequired] = useState(item.required);
  const [from, setFrom] = useState(item.requiredFrom ? accounting(item.requiredFrom) : "");
  const [active, setActive] = useState(item.active);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const fromMinor = from.trim() ? parseAmount(from) : null;
  const dirty =
    label !== item.label || hint !== (item.hint ?? "") || required !== item.required || active !== item.active || (from.trim() ? fromMinor : null) !== (item.requiredFrom ?? null);

  const save = async () => {
    if (!label.trim()) return setError("Name the document.");
    if (from.trim() && fromMinor === null) return setError("The amount is in naira, like 500,000.00.");
    setBusy(true);
    setError(undefined);
    try {
      await spend.settings.updateChecklistItem(item.id, { label: label.trim(), hint: hint.trim() || null, required, requiredFrom: from.trim() ? fromMinor : null, active });
      onSaved(`“${label.trim()}” saved.`);
    } catch (e) {
      setError(plainError(e, "It wasn't saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cx("rounded-2xl border p-4", active ? "border-neutral-200/80 bg-white" : "border-dashed border-neutral-300 bg-neutral-50/60")}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_10rem_auto]">
        <div>
          <label htmlFor={`${uid}-l`} className="mb-1 block text-xs font-medium text-neutral-600">
            Document
          </label>
          <input id={`${uid}-l`} value={label} maxLength={160} disabled={!canEdit} onChange={(e) => setLabel(e.target.value)} className={cx(inputClass, "h-10")} />
        </div>
        <div>
          <label htmlFor={`${uid}-h`} className="mb-1 block text-xs font-medium text-neutral-600">
            Hint for the requester
          </label>
          <input id={`${uid}-h`} value={hint} maxLength={255} disabled={!canEdit} onChange={(e) => setHint(e.target.value)} placeholder="Optional" className={cx(inputClass, "h-10")} />
        </div>
        <div>
          <label htmlFor={`${uid}-f`} className="mb-1 block text-xs font-medium text-neutral-600">
            Required from (₦)
          </label>
          <input
            id={`${uid}-f`}
            inputMode="decimal"
            value={from}
            disabled={!canEdit || !required}
            onChange={(e) => setFrom(e.target.value)}
            onBlur={() => fromMinor !== null && from.trim() && setFrom(accounting(fromMinor))}
            placeholder="Any amount"
            className={cx(inputClass, "h-10 text-right tabular-nums")}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex h-10 items-center gap-2 text-sm text-neutral-700">
            <Switch checked={required} onChange={setRequired} label={`Required: ${item.label}`} disabled={!canEdit} />
            Required
          </label>
          <label className="flex h-10 items-center gap-2 text-sm text-neutral-700">
            <Switch checked={active} onChange={setActive} label={`In use: ${item.label}`} disabled={!canEdit} />
            In use
          </label>
        </div>
      </div>
      {(dirty || error) && canEdit && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          <FieldError message={error} />
          <Button size="sm" variant="primary" icon={Check} onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </li>
  );
}

function AddChecklistItem({ memoType, label: typeLabel, onSaved }: { memoType: ChecklistMemoType; label: string; onSaved: (m: string) => void }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [hint, setHint] = useState("");
  const [required, setRequired] = useState(true);
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  if (!open)
    return (
      <Button size="sm" variant="ghost" icon={Plus} onClick={() => setOpen(true)} className="mt-3">
        Add a document
      </Button>
    );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const fromMinor = from.trim() ? parseAmount(from) : null;
    if (!label.trim()) return setError("Name the document, like “Signed contract”.");
    if (from.trim() && fromMinor === null) return setError("The amount is in naira, like 500,000.00.");
    setBusy(true);
    setError(undefined);
    try {
      await spend.settings.addChecklistItem({ memoType, label: label.trim(), hint: hint.trim() || null, required, requiredFrom: fromMinor });
      onSaved(`“${label.trim()}” added to ${typeLabel.toLowerCase()}.`);
      setOpen(false);
      setLabel("");
      setHint("");
      setFrom("");
    } catch (err) {
      setError(plainError(err, "It wasn't added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={add} className="mt-4 rounded-2xl border border-primary-200 bg-primary-50/40 p-4">
      <p className="mb-3 text-sm font-semibold text-neutral-900">New document for {typeLabel.toLowerCase()}</p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_10rem_auto]">
        <div>
          <label htmlFor={`${uid}-l`} className="mb-1 block text-xs font-medium text-neutral-600">
            Document
          </label>
          <input id={`${uid}-l`} value={label} autoFocus maxLength={160} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Signed contract" className={cx(inputClass, "h-10")} />
        </div>
        <div>
          <label htmlFor={`${uid}-h`} className="mb-1 block text-xs font-medium text-neutral-600">
            Hint for the requester
          </label>
          <input id={`${uid}-h`} value={hint} maxLength={255} onChange={(e) => setHint(e.target.value)} placeholder="Optional" className={cx(inputClass, "h-10")} />
        </div>
        <div>
          <label htmlFor={`${uid}-f`} className="mb-1 block text-xs font-medium text-neutral-600">
            Required from (₦)
          </label>
          <input id={`${uid}-f`} inputMode="decimal" value={from} disabled={!required} onChange={(e) => setFrom(e.target.value)} placeholder="Any amount" className={cx(inputClass, "h-10 text-right tabular-nums")} />
        </div>
        <label className="flex h-10 items-center gap-2 self-end text-sm text-neutral-700">
          <Switch checked={required} onChange={setRequired} label="Required" />
          Required
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        <FieldError message={error} />
        <Button size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" type="submit" variant="primary" disabled={busy}>
          {busy ? "Adding…" : "Add document"}
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------- WHT -------------------------------- */

function WhtPanel({ rates, canEdit, onSaved }: { rates: WhtRateRow[]; canEdit: boolean; onSaved: (m: string) => void }) {
  const classes = useMemo(() => {
    const m = new Map<string, { code: string; label: string; company?: WhtRateRow; individual?: WhtRateRow }>();
    for (const r of rates) {
      if (r.code === "none") continue;
      const c = m.get(r.code) ?? { code: r.code, label: r.label };
      c[r.payeeKind] = r;
      m.set(r.code, c);
    }
    return [...m.values()];
  }, [rates]);

  return (
    <Panel title="Withholding tax rates" subtitle="Deducted on the amount before VAT. Confirm them with your tax adviser." icon={Percent} hue="sun" bodyClassName="p-0 pt-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Withholding tax rates by class and payee</caption>
          <thead>
            <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th scope="col" className="py-2.5 pl-5 pr-2">Class</th>
              <th scope="col" className="w-48 px-2 py-2.5 text-right">Company payee</th>
              <th scope="col" className="w-48 py-2.5 pl-2 pr-5 text-right">Individual payee</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.code} className="border-b border-neutral-100 last:border-b-0">
                <th scope="row" className="py-3 pl-5 pr-2 text-left font-medium text-neutral-900">
                  {c.label}
                </th>
                <td className="px-2 py-2 text-right">{c.company ? <RateCell rate={c.company} who="company" canEdit={canEdit} onSaved={onSaved} /> : "—"}</td>
                <td className="py-2 pl-2 pr-5 text-right">{c.individual ? <RateCell rate={c.individual} who="individual" canEdit={canEdit} onSaved={onSaved} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
        A changed rate applies to vouchers coded from now on. A preparer can still change the rate on one line, with a reason.
      </p>
    </Panel>
  );
}

function RateCell({ rate, who, canEdit, onSaved }: { rate: WhtRateRow; who: string; canEdit: boolean; onSaved: (m: string) => void }) {
  const [text, setText] = useState(pct(rate.rateBp).replace("%", ""));
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const bp = bpFromPct(text);
  const dirty = bp !== rate.rateBp;

  const save = async () => {
    if (bp === null) return setError("A rate from 0 to 100.");
    setBusy(true);
    setError(undefined);
    try {
      await spend.settings.updateWhtRate(rate.id, { rateBp: bp });
      onSaved(`${rate.label}, ${who}: ${pct(bp)}.`);
    } catch (e) {
      setError(plainError(e, "Not saved."));
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) return <span className="font-semibold tabular-nums text-neutral-900">{pct(rate.rateBp)}</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <span className="inline-flex items-center gap-1.5">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && dirty && save()}
          aria-label={`${rate.label}, ${who} payee, rate in percent`}
          aria-invalid={Boolean(error) || undefined}
          className="h-9 w-20 rounded-lg border border-neutral-200 bg-white px-2 text-right text-sm tabular-nums outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
        />
        <span className="text-sm text-neutral-500" aria-hidden>
          %
        </span>
        {dirty && (
          <Button size="sm" variant="primary" onClick={save} disabled={busy} aria-label={`Save ${rate.label}, ${who} payee`}>
            {busy ? "…" : "Save"}
          </Button>
        )}
      </span>
      <FieldError message={error} />
    </span>
  );
}
