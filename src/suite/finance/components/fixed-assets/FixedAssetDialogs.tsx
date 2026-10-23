"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { accountOptions } from "@/suite/finance/components/accounts/meta";
import { useProjectOptions, pickerText } from "@/suite/finance/components/revenue/ui";
import { ledger } from "@/lib/api/finance-ledger-client";
import { ApiError, errorText, fixedAssets, gainOrLoss, parseRate, rateText, type AssetBook, type AssetClassRow, type ClassPatch } from "@/lib/api/finance-assets-client";

/* Fixed assets' forms: a class's rate and accounts, an asset booked by hand, and a disposal. */

type Errors = Record<string, string>;

function apiErrors(e: unknown): Errors {
  if (e instanceof ApiError && e.errors) {
    const out: Errors = {};
    for (const [k, v] of Object.entries(e.errors)) {
      const first = Array.isArray(v) ? v[0] : v;
      if (typeof first === "string") out[k] = first;
    }
    if (Object.keys(out).length) return out;
  }
  return { general: errorText(e) };
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Footer({ onClose, busy, label, busyLabel, tone = "primary" }: { onClose: () => void; busy: boolean; label: string; busyLabel: string; tone?: "primary" | "danger" }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant={tone} disabled={busy}>
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Class                                                              */
/* ------------------------------------------------------------------ */

export function ClassDialog({ cls, onDone, onClose }: { cls: AssetClassRow; onDone: (message: string) => void; onClose: () => void }) {
  const uid = useId();
  const [name, setName] = useState(cls.name);
  const [rate, setRate] = useState(String(cls.rateBp / 100));
  const [asset, setAsset] = useState(cls.assetAccount?.id ?? "");
  const [accumulated, setAccumulated] = useState(cls.accumulatedAccount?.id ?? "");
  const [expense, setExpense] = useState(cls.expenseAccount?.id ?? "");
  const [accounts, setAccounts] = useState<SelectOption[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    ledger.accounts.list({ postableOnly: true }).then(
      (r) => {
        if (!alive) return;
        const base = accountOptions(r.accounts);
        // A class may point at an account since switched off: keep its label.
        for (const a of [cls.assetAccount, cls.accumulatedAccount, cls.expenseAccount]) if (a && !base.some((o) => o.value === a.id)) base.unshift({ value: a.id, label: `${a.code} ${a.name}`, hint: "Switched off" });
        setAccounts(base);
      },
      () => alive && setLoadFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [cls]);

  const bp = parseRate(rate);
  const years = bp ? 10_000 / bp : null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!name.trim()) local.name = "Name the class.";
    if (bp === null) local.rateBp = "The rate is a percentage a year from 0 to 100, like 25 or 12.5.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const patch: ClassPatch = {};
    if (name.trim() !== cls.name) patch.name = name.trim();
    if (bp !== cls.rateBp) patch.rateBp = bp!;
    if (asset && asset !== cls.assetAccount?.id) patch.assetAccountId = asset;
    if (accumulated && accumulated !== cls.accumulatedAccount?.id) patch.accumulatedAccountId = accumulated;
    if (expense && expense !== cls.expenseAccount?.id) patch.expenseAccountId = expense;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await fixedAssets.updateClass(cls.id, patch);
      onDone(`${name.trim()} saved.${patch.rateBp !== undefined ? " The new rate applies to assets booked from now on; existing books keep theirs." : ""}`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  const picker = (id: string, value: string, onChange: (v: string) => void, field: string) => (
    <>
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        options={accounts ?? []}
        placeholder={accounts ? "Choose an account" : loadFailed ? "Accounts didn't load" : "Loading accounts…"}
        searchPlaceholder="Search by code or name"
        noOptionsText={loadFailed ? "The chart of accounts didn't load. Close and try again." : "Loading accounts…"}
        aria-invalid={errors[field] ? true : undefined}
      />
      <FieldError message={errors[field]} />
    </>
  );

  return (
    <DialogFrame
      as="form"
      size="lg"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={`Edit ${cls.name}`}
      subtitle="Straight line from the month after an asset is capitalised. The accounts are where each month's run and each disposal post."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Save class" busyLabel="Saving…" />}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field id={`${uid}-name`} label="Name">
          <input id={`${uid}-name`} className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? true : undefined} />
          <FieldError message={errors.name} />
        </Field>
        <Field id={`${uid}-rate`} label="Rate a year (%)">
          <input id={`${uid}-rate`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={rate} onChange={(e) => setRate(e.target.value)} aria-invalid={errors.rateBp ? true : undefined} aria-describedby={`${uid}-rate-h`} />
          <p id={`${uid}-rate-h`} className="mt-1.5 text-xs text-neutral-500">
            {years ? `Written off over about ${years % 1 === 0 ? years : years.toFixed(1)} years.` : bp === 0 ? "Not depreciated (land, say)." : " "}
          </p>
          <FieldError message={errors.rateBp} />
        </Field>
      </div>
      <Field id={`${uid}-asset`} label="Cost account" hint="Asset, debited on purchase">
        {picker(`${uid}-asset`, asset, setAsset, "assetAccountId")}
      </Field>
      <Field id={`${uid}-acc`} label="Accumulated depreciation account" hint="Credited each month">
        {picker(`${uid}-acc`, accumulated, setAccumulated, "accumulatedAccountId")}
      </Field>
      <Field id={`${uid}-exp`} label="Depreciation charge account" hint="Expense, debited each month">
        {picker(`${uid}-exp`, expense, setExpense, "expenseAccountId")}
      </Field>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Book by hand                                                       */
/* ------------------------------------------------------------------ */

export function BookDialog({ classes, onDone, onClose }: { classes: AssetClassRow[]; onDone: (book: AssetBook) => void; onClose: () => void }) {
  const uid = useId();
  const projects = useProjectOptions();
  const [classKey, setClassKey] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [cost, setCost] = useState("");
  const [residual, setResidual] = useState("");
  const [rate, setRate] = useState("");
  const [on, setOn] = useState(todayIso());
  const [projectId, setProjectId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const cls = classes.find((c) => c.key === classKey) ?? null;
  const c = parseAmount(cost);
  const r = residual.trim() ? parseAmount(residual) : 0;
  const bp = rate.trim() ? parseRate(rate) : cls?.rateBp ?? null;
  const monthly = c && r !== null && bp ? Math.floor(((c - r) * bp) / 120_000) : 0;

  const classOptions = useMemo(() => classes.map((k) => ({ value: k.key, label: k.name, hint: rateText(k.rateBp) + " a year" })), [classes]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!classKey) local.classKey = "Choose the asset class.";
    if (!description.trim()) local.description = "Describe the asset.";
    if (c === null || c <= 0) local.cost = "Type what it cost, like 4,500,000.00.";
    if (r === null) local.residual = "Type the residual value, or leave it blank for none.";
    else if (c !== null && r >= c) local.residual = "The residual value is less than the cost.";
    if (rate.trim() && parseRate(rate) === null) local.rateBp = "A percentage from 0 to 100, like 25.";
    if (!on) local.capitalisedOn = "Say when it was capitalised.";
    else if (on > todayIso()) local.capitalisedOn = "It can't be capitalised in the future.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const book = await fixedAssets.book({
        classKey,
        description: description.trim(),
        tag: tag.trim() || null,
        cost: c!,
        residual: r ?? 0,
        ...(rate.trim() ? { rateBp: parseRate(rate)! } : {}),
        capitalisedOn: on,
        projectId: projectId || null,
      });
      onDone(book);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      size="lg"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Book an asset by hand"
      subtitle="One bought before XwiftHQ, or without Operations. Assets Operations receives are booked for you."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Book the asset" busyLabel="Booking…" />}
    >
      <Field id={`${uid}-class`} label="Class">
        <SearchableSelect id={`${uid}-class`} value={classKey} onChange={setClassKey} options={classOptions} placeholder="Choose the class" searchPlaceholder="Search classes" aria-invalid={errors.classKey ? true : undefined} />
        <FieldError message={errors.classKey} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field id={`${uid}-desc`} label="Description">
          <input id={`${uid}-desc`} className={inputClass} value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} placeholder="Dell PowerEdge server, ICT Centre" aria-invalid={errors.description ? true : undefined} />
          <FieldError message={errors.description} />
        </Field>
        <Field id={`${uid}-tag`} label="Tag" hint="Optional">
          <input id={`${uid}-tag`} className={cx(inputClass, "font-mono")} value={tag} maxLength={40} onChange={(e) => setTag(e.target.value)} placeholder="FA-0001" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-cost`} label="Cost (₦)">
          <input
            id={`${uid}-cost`}
            inputMode="decimal"
            className={cx(inputClass, "text-right tabular-nums")}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            onBlur={() => c !== null && setCost(amountInput(c) || "0.00")}
            placeholder="0.00"
            aria-invalid={errors.cost ? true : undefined}
          />
          <FieldError message={errors.cost} />
        </Field>
        <Field id={`${uid}-res`} label="Residual (₦)" hint="Optional">
          <input
            id={`${uid}-res`}
            inputMode="decimal"
            className={cx(inputClass, "text-right tabular-nums")}
            value={residual}
            onChange={(e) => setResidual(e.target.value)}
            onBlur={() => {
              const p = parseAmount(residual);
              if (p !== null) setResidual(amountInput(p) || "0.00");
            }}
            placeholder="0.00"
            aria-invalid={errors.residual ? true : undefined}
          />
          <FieldError message={errors.residual} />
        </Field>
        <Field id={`${uid}-rate`} label="Rate a year (%)" hint={cls ? `Class: ${rateText(cls.rateBp)}` : "Optional"}>
          <input id={`${uid}-rate`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={rate} onChange={(e) => setRate(e.target.value)} placeholder={cls ? String(cls.rateBp / 100) : "25"} aria-invalid={errors.rateBp ? true : undefined} />
          <FieldError message={errors.rateBp} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-on`} label="Capitalised on">
          <input id={`${uid}-on`} type="date" max={todayIso()} className={inputClass} value={on} onChange={(e) => setOn(e.target.value)} aria-invalid={errors.capitalisedOn ? true : undefined} />
          <FieldError message={errors.capitalisedOn} />
        </Field>
        <Field id={`${uid}-proj`} label="Project" hint="Optional">
          <SearchableSelect
            id={`${uid}-proj`}
            value={projectId}
            onChange={setProjectId}
            options={projects.items}
            clearable
            clearLabel="No project"
            placeholder="No project"
            searchPlaceholder="Search projects"
            noOptionsText={pickerText(projects, "projects")}
          />
          <FieldError message={errors.projectId} />
        </Field>
      </div>
      <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600" aria-live="polite">
        {monthly > 0 ? (
          <>
            About <Money value={monthly} className="font-semibold text-neutral-900" /> a month, from the month after it is capitalised, until it reaches its residual value.
          </>
        ) : (
          "The monthly charge shows here once the class and cost are in."
        )}
      </p>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Dispose                                                            */
/* ------------------------------------------------------------------ */

export function DisposeDialog({ book, onDone, onClose }: { book: AssetBook; onDone: (book: AssetBook) => void; onClose: () => void }) {
  const uid = useId();
  const [on, setOn] = useState(todayIso());
  const [proceeds, setProceeds] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const p = proceeds.trim() ? parseAmount(proceeds) : 0;
  const result = p === null ? null : gainOrLoss(p, book.nbv);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!on) local.on = "Say when it was disposed of.";
    else if (on > todayIso()) local.on = "A disposal can't be in the future.";
    if (p === null) local.proceeds = "Type what was received, or 0.00 if nothing.";
    if (!reason.trim()) local.reason = "Say why it was disposed of: sold, scrapped, stolen, written off.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      onDone(await fixedAssets.dispose(book.id, { on, proceeds: p!, reason: reason.trim() }));
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={`Dispose of ${book.tag ?? book.description}?`}
      subtitle="Its cost and accumulated depreciation come off the books, the proceeds are booked as a receivable, and the difference is a gain or a loss. This can't be undone."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Dispose of the asset" busyLabel="Disposing…" tone="danger" />}
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-neutral-50 px-2 py-2.5">
          <p className="text-neutral-500">Cost</p>
          <Money value={book.cost} className="text-sm font-bold text-neutral-900" />
        </div>
        <div className="rounded-xl bg-neutral-50 px-2 py-2.5">
          <p className="text-neutral-500">Depreciated</p>
          <Money value={book.accumulated} className="text-sm font-bold text-neutral-900" />
        </div>
        <div className="rounded-xl bg-primary-50 px-2 py-2.5">
          <p className="text-primary-700">Net book value</p>
          <Money value={book.nbv} className="text-sm font-bold text-primary-700" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-on`} label="Disposed of on">
          <input id={`${uid}-on`} type="date" max={todayIso()} className={inputClass} value={on} onChange={(e) => setOn(e.target.value)} aria-invalid={errors.on ? true : undefined} />
          <FieldError message={errors.on} />
        </Field>
        <Field id={`${uid}-p`} label="Proceeds (₦)">
          <input
            id={`${uid}-p`}
            inputMode="decimal"
            className={cx(inputClass, "text-right tabular-nums")}
            value={proceeds}
            onChange={(e) => setProceeds(e.target.value)}
            onBlur={() => {
              const v = parseAmount(proceeds);
              if (v !== null) setProceeds(amountInput(v) || "0.00");
            }}
            placeholder="0.00"
            aria-invalid={errors.proceeds ? true : undefined}
          />
          <FieldError message={errors.proceeds} />
        </Field>
      </div>
      <div
        className={cx(
          "rounded-2xl border px-4 py-3",
          result === null ? "border-neutral-200" : result > 0 ? "border-mint-500/25 bg-mint-50" : result < 0 ? "border-coral-500/25 bg-coral-50" : "border-neutral-200 bg-neutral-50",
        )}
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Expected {result !== null && result < 0 ? "loss" : "gain"} on disposal</p>
        <p className={cx("mt-0.5 text-2xl font-bold tabular-nums", result === null ? "text-neutral-400" : result > 0 ? "text-mint-700" : result < 0 ? "text-coral-700" : "text-neutral-900")}>
          {result === null ? "-" : <Money value={Math.abs(result)} className="!text-inherit" />}
        </p>
        <p className="mt-0.5 text-xs text-neutral-600">Proceeds less net book value{result === 0 ? ": neither a gain nor a loss." : "."}</p>
      </div>
      <Field id={`${uid}-why`} label="Reason">
        <textarea id={`${uid}-why`} rows={3} maxLength={500} className={textareaClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sold to a member of staff at the board-approved price" aria-invalid={errors.reason ? true : undefined} />
        <FieldError message={errors.reason} />
      </Field>
      {(errors.general || errors.asset) && <ErrorNote>{errors.general ?? errors.asset}</ErrorNote>}
    </DialogFrame>
  );
}
