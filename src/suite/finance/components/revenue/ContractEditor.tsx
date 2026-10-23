"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Lock, Plus, ReceiptText, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  revenue,
  revenueError,
  revenueFieldErrors,
  type BillingType,
  type ContractDetail,
  type ContractInput,
  type ContractsMeta,
  type MilestoneStatus,
  type ProgressMethod,
  type ProjectContractView,
  type WorkItemOption,
} from "@/lib/api/finance-revenue-client";
import { Button, Card, PageHeader, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { CURRENCIES, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, amountInput, day, parseAmount } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { BILLING_TYPES, PROGRESS_METHODS, apportion, bpFromPct, pct, pctInput, splitProblem, today } from "./meta";
import { BillingRail, FieldShell, MilestoneChip, pickerText, useClientOptions, useRevenueAccounts } from "./ui";
import CurrencySplitEditor, { draftsFrom, splitInput, splitRows, type SplitDraft } from "./CurrencySplitEditor";

/**
 * A project's contract, set up or replaced in full: who the client is, what
 * the work is worth, the tax and retention terms the invoices will carry,
 * and the billing milestones. The rail beside the form fills as milestone
 * amounts are typed, and refuses - here, before the API does - a schedule
 * that adds up to more than the contract. Milestones already invoiced are
 * locked; a planned one with no Projects work behind it can be marked
 * accepted by hand, and an accepted one invoiced.
 */

interface Row {
  key: string;
  id: string | null;
  name: string;
  amount: string;
  dueOn: string;
  weight: string;
  workItemId: string;
  status: MilestoneStatus;
  completedAt: string | null;
  /** "" follows the contract's split; a currency bills it all in that currency; "custom" keeps shares set elsewhere. */
  paidIn: string;
}

let seq = 0;
const newKey = () => `m${++seq}`;

const blankRow = (): Row => ({ key: newKey(), id: null, name: "", amount: "", dueOn: "", weight: "", workItemId: "", status: "planned", completedAt: null, paidIn: "" });

const paidInFrom = (split: ContractDetail["milestones"][number]["currencySplit"]): string =>
  !split || split.length === 0 ? "" : split.length === 1 && split[0].shareBp === 10_000 ? split[0].currency : "custom";

const rowsFrom = (c: ContractDetail): Row[] =>
  [...c.milestones]
    .sort((a, b) => a.sequence - b.sequence)
    .map((m) => ({
      key: newKey(),
      id: m.id,
      name: m.name,
      amount: m.amount ? accounting(m.amount) : "",
      dueOn: m.dueOn ?? "",
      weight: m.weightBp === null ? "" : pctInput(m.weightBp),
      workItemId: m.workItemId ?? "",
      status: m.status,
      completedAt: m.completedAt,
      paidIn: paidInFrom(m.currencySplit),
    }));

interface Form {
  clientId: string;
  title: string;
  reference: string;
  billingType: BillingType;
  value: string;
  currency: string;
  vatApplicable: boolean;
  vatRate: string;
  wht: string;
  retention: string;
  terms: string;
  revenueAccountId: string;
  progressMethod: ProgressMethod;
  startsOn: string;
  endsOn: string;
}

const formFrom = (c: ContractDetail | null): Form => ({
  clientId: c?.clientId ?? "",
  title: c?.title ?? "",
  reference: c?.reference ?? "",
  billingType: c?.billingType ?? "milestone",
  value: c ? amountInput(c.value) : "",
  currency: c?.currency ?? "NGN",
  vatApplicable: c?.vatApplicable ?? true,
  vatRate: pctInput(c?.vatRateBp ?? 750),
  wht: pctInput(c?.expectedWhtBp ?? 0),
  retention: pctInput(c?.retentionBp ?? 0),
  terms: String(c?.paymentTermsDays ?? 30),
  revenueAccountId: c?.revenueAccountId ?? "",
  progressMethod: c?.progressMethod ?? "milestone_weighted",
  startsOn: c?.startsOn ?? "",
  endsOn: c?.endsOn ?? "",
});

type Errors = Record<string, string>;

export default function ContractEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const uid = useId();
  const { user } = useAuth();
  const confirm = useConfirm();
  const clients = useClientOptions();
  const accounts = useRevenueAccounts();
  const [project, setProject] = useState<ProjectContractView | null>(null);
  const [meta, setMeta] = useState<ContractsMeta | null>(null);
  const [workItems, setWorkItems] = useState<WorkItemOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<Form>(() => formFrom(null));
  const [rows, setRows] = useState<Row[]>([]);
  const [split, setSplit] = useState<SplitDraft[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      revenue.contracts.forProject(projectId),
      revenue.contracts.list().then((r) => r.meta).catch(() => null),
      revenue.contracts.workItems(projectId).catch(() => [] as WorkItemOption[]),
    ])
      .then(([p, m, w]) => {
        if (!alive) return;
        setProject(p);
        setMeta(m);
        setWorkItems(w);
        setForm(formFrom(p.contract));
        setRows(p.contract ? rowsFrom(p.contract) : [blankRow()]);
        setSplit(draftsFrom(p.contract?.currencySplit));
        setDirty(false);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(revenueError(e, "The project didn't load.")));
    return () => {
      alive = false;
    };
  }, [projectId, reload]);

  /* A new contract with only one revenue account to choose from takes it. */
  useEffect(() => {
    if (project && !project.contract && !form.revenueAccountId && accounts.status === "ready" && accounts.items.length === 1)
      setForm((f) => ({ ...f, revenueAccountId: accounts.items[0].value }));
  }, [project, accounts, form.revenueAccountId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const canSave = mayDo(user, "contracts", "save");
  const canComplete = mayDo(user, "contracts", "complete_milestone");
  const canInvoice = mayDo(user, "contracts", "invoice_milestone");
  const currency = (form.currency || "NGN") as CurrencyCode;
  const value = parseAmount(form.value) ?? 0;
  const live = rows.map((r) => ({ amount: parseAmount(r.amount) ?? 0, status: r.status }));
  const scheduled = live.reduce((s, m) => s + m.amount, 0);
  const weights = rows.reduce((s, r) => s + (bpFromPct(r.weight, 10_000) ?? 0), 0);
  const over = scheduled > value;
  const base = meta?.baseCurrency ?? "NGN";
  const splitOn = split.length > 0;
  const plannedParts = splitOn ? apportion(value, form.currency, splitRows(split), base) : [];

  const billingOptions = useMemo<SelectOption[]>(
    () => Object.entries(meta?.billingTypes ?? BILLING_TYPES).map(([k, label]) => ({ value: k, label })),
    [meta],
  );
  const progressOptions = useMemo<SelectOption[]>(
    () => Object.entries(meta?.progressMethods ?? PROGRESS_METHODS).map(([k, label]) => ({ value: k, label })),
    [meta],
  );
  const workOptions = useMemo<SelectOption[]>(
    () =>
      workItems.map((w) => ({
        value: w.id,
        label: w.title,
        hint: [w.type === "milestone" ? "Milestone" : "Epic", w.dueOn ? `due ${day(w.dueOn)}` : null, w.done ? "done" : w.status].filter(Boolean).join(" · "),
      })),
    [workItems],
  );

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const patch = (key: string, p: Partial<Row>) => {
    setDirty(true);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };
  const tidy = (key: string, text: string) => {
    const v = parseAmount(text);
    if (v !== null) patch(key, { amount: v === 0 ? "" : accounting(v) });
  };

  /* ------------------------------ saving ------------------------------ */

  const prepare = (): ContractInput | null => {
    const e: Errors = {};
    if (!form.clientId) e.clientId = "Choose the client this contract is with.";
    if (!form.title.trim()) e.title = "Give the contract a title, as the client's paperwork names it.";
    const v = parseAmount(form.value);
    if (v === null) e.value = "Enter the contract value, like 95,000,000.00.";
    const vat = bpFromPct(form.vatRate);
    if (form.vatApplicable && vat === null) e.vatRateBp = "Enter a VAT rate from 0 to 50, like 7.5.";
    const wht = bpFromPct(form.wht);
    if (wht === null) e.expectedWhtBp = "Enter a WHT rate from 0 to 50, like 5.";
    const ret = bpFromPct(form.retention);
    if (ret === null) e.retentionBp = "Enter a retention rate from 0 to 50, like 5.";
    const terms = Number(form.terms);
    if (!/^\d{1,3}$/.test(form.terms.trim()) || terms > 365) e.paymentTermsDays = "Enter the days to pay, from 0 to 365.";
    if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) e.endsOn = "The end date comes before the start.";

    const milestones: NonNullable<ContractInput["milestones"]> = [];
    rows.forEach((r, i) => {
      const empty = !r.id && !r.name.trim() && !r.amount.trim();
      if (empty) return;
      const amt = parseAmount(r.amount);
      if (!r.name.trim()) e[`milestones.${i}.name`] = "Name the milestone.";
      if (amt === null) e[`milestones.${i}.amount`] = "Enter an amount, like 12,500,000.00.";
      const w = r.weight.trim() ? bpFromPct(r.weight, 10_000) : null;
      if (r.weight.trim() && w === null) e[`milestones.${i}.weightBp`] = "A weight is a percent from 0 to 100.";
      milestones.push({
        id: r.id,
        name: r.name.trim(),
        amount: amt ?? 0,
        dueOn: r.dueOn || null,
        weightBp: w,
        workItemId: r.workItemId || null,
        // "custom" (shares set elsewhere) is left out, so the milestone keeps them.
        ...(r.paidIn === "custom" ? {} : { currencySplit: splitOn && r.paidIn ? [{ currency: r.paidIn, shareBp: 10_000 }] : null }),
      });
    });
    const sp = splitOn ? splitProblem(splitRows(split), form.currency, base) : null;
    if (sp) e.currencySplit = sp;
    if (v !== null && scheduled > v) e.milestones = `The milestones add up to ${amount(scheduled - v, currency)} more than the contract value.`;
    if (weights > 10_000) e.milestones = "Milestone weights add up to more than 100%.";

    setErrors(e);
    if (Object.keys(e).length) {
      setGeneral("Some fields need attention. They are marked below.");
      return null;
    }
    setGeneral(null);
    return {
      clientId: form.clientId,
      title: form.title.trim(),
      reference: form.reference.trim() || null,
      billingType: form.billingType,
      value: v ?? 0,
      currency: form.currency,
      vatApplicable: form.vatApplicable,
      vatRateBp: vat ?? 0,
      expectedWhtBp: wht ?? 0,
      retentionBp: ret ?? 0,
      paymentTermsDays: terms,
      revenueAccountId: form.revenueAccountId || null,
      progressMethod: form.progressMethod,
      startsOn: form.startsOn || null,
      endsOn: form.endsOn || null,
      currencySplit: splitOn ? splitInput(split, base) : null,
      milestones,
    };
  };

  const save = async () => {
    const input = prepare();
    if (!input) return;
    setBusy("save");
    try {
      await revenue.contracts.save(projectId, input);
      setDirty(false);
      setNotice(project?.contract ? "Contract saved." : "Contract set up. Its milestones can now be billed as they are accepted.");
      setReload((n) => n + 1);
    } catch (err) {
      const f = revenueFieldErrors(err);
      setErrors(f);
      const splitErr = Object.entries(f).find(([k]) => k.startsWith("currencySplit"))?.[1];
      if (splitErr) f.currencySplit = splitErr;
      setErrors(f);
      setGeneral(Object.keys(f).length ? (f.milestones ?? f.project ?? "Some fields need attention. They are marked below.") : revenueError(err, "The contract wasn't saved."));
    } finally {
      setBusy(null);
    }
  };

  const accept = async (r: Row) => {
    if (!r.id) return;
    const ok = await confirm({
      title: `Mark “${r.name}” accepted?`,
      body: "Accepting says the client has signed this milestone off. It becomes ready to bill, and anybody with invoicing rights can raise its invoice.",
      confirmLabel: "Mark accepted",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(`accept-${r.id}`);
    setGeneral(null);
    try {
      await revenue.contracts.completeMilestone(r.id, today());
      setNotice(`${r.name} marked accepted. It is ready to bill.`);
      setReload((n) => n + 1);
    } catch (err) {
      setGeneral(revenueError(err, "The milestone wasn't marked accepted."));
    } finally {
      setBusy(null);
    }
  };

  const invoiceIt = async (r: Row) => {
    if (!r.id) return;
    setBusy(`invoice-${r.id}`);
    setGeneral(null);
    try {
      const draft = await revenue.contracts.invoiceMilestone(r.id);
      router.push(`/suite/finance/revenue/invoices/${draft.id}?notice=drafted`);
    } catch (err) {
      setGeneral(revenueError(err, "The invoice wasn't drafted."));
      setBusy(null);
    }
  };

  /* ------------------------------ render ------------------------------ */

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/revenue/contracts" label="All contracts" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!project)
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-[28rem]" />
      </div>
    );

  const id = (f: string) => `${uid}-${f}`;
  const readOnly = !canSave;

  return (
    <div>
      <BackLink href="/suite/finance/revenue/contracts" label="All contracts" />
      <PageHeader
        eyebrow={
          <>
            {project.code && <span className="font-mono">{project.code} · </span>}
            {project.name}
          </>
        }
        title={project.contract ? "Contract" : "Set up the contract"}
        subtitle={
          project.contract
            ? "Saving replaces the contract and its milestones as they stand here. Invoiced milestones are locked."
            : "Say who the client is, what the work is worth and how it is billed. Invoices on this project start from these terms."
        }
      />
      <Notice text={notice} />
      {general && <ErrorNote className="mb-4">{general}</ErrorNote>}
      {readOnly && (
        <p className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">You can read this contract. Changing it needs the permission to save contracts.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-neutral-900">The client and the work</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FieldShell id={id("client")} label="Client" required error={errors.clientId} className="md:col-span-2">
                <SearchableSelect
                  id={id("client")}
                  value={form.clientId}
                  onChange={(v) => set("clientId", v)}
                  options={clients.items}
                  disabled={readOnly}
                  placeholder="Choose the client"
                  searchPlaceholder="Search the organisation register"
                  noOptionsText={pickerText(clients, "clients")}
                  aria-invalid={Boolean(errors.clientId) || undefined}
                  aria-describedby={errors.clientId ? `${id("client")}-err` : undefined}
                />
              </FieldShell>
              <FieldShell id={id("title")} label="Title" required error={errors.title}>
                <input
                  id={id("title")}
                  value={form.title}
                  maxLength={255}
                  disabled={readOnly}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="As the client's paperwork names it"
                  aria-invalid={Boolean(errors.title) || undefined}
                  aria-describedby={errors.title ? `${id("title")}-err` : undefined}
                  className={cx(inputClass, errors.title && "border-error-500")}
                />
              </FieldShell>
              <FieldShell id={id("ref")} label="Client's reference" error={errors.reference} hint="Their contract or LPO number, printed on every invoice.">
                <input
                  id={id("ref")}
                  value={form.reference}
                  maxLength={64}
                  disabled={readOnly}
                  onChange={(e) => set("reference", e.target.value)}
                  className={cx(inputClass, "font-mono")}
                />
              </FieldShell>
              <FieldShell id={id("billing")} label="How it is billed">
                <SearchableSelect id={id("billing")} value={form.billingType} onChange={(v) => set("billingType", v as BillingType)} options={billingOptions} disabled={readOnly} searchPlaceholder="Search billing types" />
              </FieldShell>
              <FieldShell id={id("progress")} label="How progress is measured" hint="Used for revenue recognised to date.">
                <SearchableSelect id={id("progress")} value={form.progressMethod} onChange={(v) => set("progressMethod", v as ProgressMethod)} options={progressOptions} disabled={readOnly} searchPlaceholder="Search methods" />
              </FieldShell>
              <FieldShell id={id("starts")} label="Starts">
                <input id={id("starts")} type="date" value={form.startsOn} disabled={readOnly} onChange={(e) => set("startsOn", e.target.value)} className={inputClass} />
              </FieldShell>
              <FieldShell id={id("ends")} label="Ends" error={errors.endsOn}>
                <input
                  id={id("ends")}
                  type="date"
                  value={form.endsOn}
                  min={form.startsOn || undefined}
                  disabled={readOnly}
                  onChange={(e) => set("endsOn", e.target.value)}
                  aria-invalid={Boolean(errors.endsOn) || undefined}
                  className={cx(inputClass, errors.endsOn && "border-error-500")}
                />
              </FieldShell>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-neutral-900">Money and terms</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FieldShell id={id("value")} label="Contract value, before VAT" required error={errors.value} className="sm:col-span-2">
                <input
                  id={id("value")}
                  inputMode="decimal"
                  autoComplete="off"
                  value={form.value}
                  disabled={readOnly}
                  onChange={(e) => set("value", e.target.value)}
                  onBlur={(e) => {
                    const v = parseAmount(e.target.value);
                    if (v !== null) set("value", v === 0 ? "" : accounting(v));
                  }}
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.value) || undefined}
                  aria-describedby={errors.value ? `${id("value")}-err` : undefined}
                  className={cx(inputClass, "text-right text-base font-semibold tabular-nums", errors.value && "border-error-500")}
                />
              </FieldShell>
              <FieldShell id={id("currency")} label="Currency">
                <SearchableSelect id={id("currency")} value={form.currency} onChange={(v) => set("currency", v || "NGN")} options={CURRENCIES} disabled={readOnly} searchPlaceholder="Search currencies" />
              </FieldShell>
              <FieldShell id={id("terms")} label="Days to pay" error={errors.paymentTermsDays}>
                <input
                  id={id("terms")}
                  inputMode="numeric"
                  value={form.terms}
                  disabled={readOnly}
                  onChange={(e) => set("terms", e.target.value)}
                  aria-invalid={Boolean(errors.paymentTermsDays) || undefined}
                  className={cx(inputClass, "text-right tabular-nums", errors.paymentTermsDays && "border-error-500")}
                />
              </FieldShell>
              <div className="sm:col-span-2 xl:col-span-1">
                <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-neutral-700">
                  <label htmlFor={id("vat")}>VAT rate (%)</label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-600">
                    <input
                      type="checkbox"
                      checked={form.vatApplicable}
                      disabled={readOnly}
                      onChange={(e) => set("vatApplicable", e.target.checked)}
                      className="h-4 w-4 accent-primary-600"
                    />
                    Charge VAT
                  </label>
                </span>
                <input
                  id={id("vat")}
                  inputMode="decimal"
                  value={form.vatApplicable ? form.vatRate : "0"}
                  disabled={readOnly || !form.vatApplicable}
                  onChange={(e) => set("vatRate", e.target.value)}
                  aria-invalid={Boolean(errors.vatRateBp) || undefined}
                  className={cx(inputClass, "text-right tabular-nums", errors.vatRateBp && "border-error-500")}
                />
                {errors.vatRateBp && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-error-700">
                    {errors.vatRateBp}
                  </p>
                )}
              </div>
              <FieldShell id={id("wht")} label="WHT the client deducts (%)" error={errors.expectedWhtBp}>
                <input
                  id={id("wht")}
                  inputMode="decimal"
                  value={form.wht}
                  disabled={readOnly}
                  onChange={(e) => set("wht", e.target.value)}
                  aria-invalid={Boolean(errors.expectedWhtBp) || undefined}
                  className={cx(inputClass, "text-right tabular-nums", errors.expectedWhtBp && "border-error-500")}
                />
              </FieldShell>
              <FieldShell id={id("ret")} label="Retention held (%)" error={errors.retentionBp}>
                <input
                  id={id("ret")}
                  inputMode="decimal"
                  value={form.retention}
                  disabled={readOnly}
                  onChange={(e) => set("retention", e.target.value)}
                  aria-invalid={Boolean(errors.retentionBp) || undefined}
                  className={cx(inputClass, "text-right tabular-nums", errors.retentionBp && "border-error-500")}
                />
              </FieldShell>
              <FieldShell
                id={id("account")}
                label="Revenue account"
                error={errors.revenueAccountId}
                hint="What invoices on this contract earn, unless a line says otherwise."
                className="sm:col-span-2 xl:col-span-1"
              >
                <SearchableSelect
                  id={id("account")}
                  value={form.revenueAccountId}
                  onChange={(v) => set("revenueAccountId", v)}
                  options={accounts.items}
                  disabled={readOnly}
                  clearable
                  clearLabel="Choose on each invoice"
                  placeholder="Choose the account"
                  searchPlaceholder="Search code or name"
                  noOptionsText={pickerText(accounts, "revenue accounts")}
                  aria-invalid={Boolean(errors.revenueAccountId) || undefined}
                />
              </FieldShell>
            </div>
          </Card>

          <CurrencySplitEditor
            drafts={split}
            onChange={(next) => {
              setDirty(true);
              setSplit(next);
            }}
            value={value}
            currency={form.currency}
            base={base}
            readOnly={readOnly}
            error={errors.currencySplit}
          />

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
              <div>
                <h2 className="text-[15px] font-semibold text-neutral-900">Billing milestones</h2>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Each one is invoiced when it is accepted: by its Projects milestone being done, or by hand here.
                </p>
              </div>
              <p className={cx("text-sm tabular-nums", over ? "font-semibold text-rose-700" : "text-neutral-600")}>
                {amount(scheduled, currency)} of {amount(value, currency)}
              </p>
            </div>
            {errors.milestones && (
              <p role="alert" className="mx-5 mt-3 text-sm font-medium text-error-700">
                {errors.milestones}
              </p>
            )}
            <ol className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
              {rows.map((r, i) => {
                const locked = r.status === "invoiced" || readOnly;
                const f = (k: string) => `${uid}-${r.key}-${k}`;
                const err = (k: string) => errors[`milestones.${i}.${k}`];
                return (
                  <li key={r.key} className={cx("px-5 py-4", r.status === "invoiced" && "bg-neutral-50/70")}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Milestone {i + 1}
                        {r.status === "invoiced" && (
                          <span className="flex items-center gap-1 normal-case tracking-normal text-neutral-500">
                            <Lock size={12} aria-hidden /> locked
                          </span>
                        )}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {r.id && <MilestoneChip status={r.status} />}
                        {r.status === "completed" && r.completedAt && <span className="text-xs text-neutral-500">accepted {day(r.completedAt)}</span>}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] lg:grid-cols-[minmax(0,1fr)_10rem_9.5rem_6rem]">
                      <div>
                        <label htmlFor={f("name")} className="mb-1 block text-xs font-medium text-neutral-600">
                          Name
                        </label>
                        <input
                          id={f("name")}
                          value={r.name}
                          maxLength={255}
                          disabled={locked}
                          onChange={(e) => patch(r.key, { name: e.target.value })}
                          placeholder="What the client signs off, e.g. Go-live"
                          aria-invalid={Boolean(err("name")) || undefined}
                          className={cx(inputClass, "h-10", err("name") && "border-error-500")}
                        />
                        {err("name") && <p role="alert" className="mt-1 text-xs font-medium text-error-700">{err("name")}</p>}
                      </div>
                      <div>
                        <label htmlFor={f("amount")} className="mb-1 block text-xs font-medium text-neutral-600">
                          Amount
                        </label>
                        <input
                          id={f("amount")}
                          inputMode="decimal"
                          autoComplete="off"
                          value={r.amount}
                          disabled={locked}
                          onChange={(e) => patch(r.key, { amount: e.target.value })}
                          onBlur={(e) => tidy(r.key, e.target.value)}
                          placeholder="0.00"
                          aria-invalid={Boolean(err("amount")) || undefined}
                          className={cx(inputClass, "h-10 text-right tabular-nums", err("amount") && "border-error-500")}
                        />
                        {err("amount") && <p role="alert" className="mt-1 text-xs font-medium text-error-700">{err("amount")}</p>}
                      </div>
                      <div>
                        <label htmlFor={f("due")} className="mb-1 block text-xs font-medium text-neutral-600">
                          Due
                        </label>
                        <input id={f("due")} type="date" value={r.dueOn} disabled={locked} onChange={(e) => patch(r.key, { dueOn: e.target.value })} className={cx(inputClass, "h-10")} />
                      </div>
                      <div>
                        <label htmlFor={f("weight")} className="mb-1 block text-xs font-medium text-neutral-600">
                          Weight %
                        </label>
                        <input
                          id={f("weight")}
                          inputMode="decimal"
                          value={r.weight}
                          disabled={locked}
                          onChange={(e) => patch(r.key, { weight: e.target.value })}
                          placeholder="-"
                          aria-invalid={Boolean(err("weightBp")) || undefined}
                          className={cx(inputClass, "h-10 text-right tabular-nums", err("weightBp") && "border-error-500")}
                        />
                        {err("weightBp") && <p role="alert" className="mt-1 text-xs font-medium text-error-700">{err("weightBp")}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={f("work")} className="mb-1 block text-xs font-medium text-neutral-600">
                          Accepted when this Projects work is done
                        </label>
                        <SearchableSelect
                          id={f("work")}
                          size="sm"
                          value={r.workItemId}
                          onChange={(v) => patch(r.key, { workItemId: v })}
                          options={workOptions}
                          disabled={locked}
                          clearable
                          clearLabel="Nothing: accept it by hand"
                          placeholder="Nothing: accept it by hand"
                          searchPlaceholder="Search milestones and epics"
                          noOptionsText="This project has no milestones or epics in Projects."
                        />
                      </div>
                      {splitOn && (
                        <div className="sm:w-48">
                          <label htmlFor={f("paid")} className="mb-1 block text-xs font-medium text-neutral-600">
                            Paid in
                          </label>
                          <SearchableSelect
                            id={f("paid")}
                            size="sm"
                            value={r.paidIn}
                            onChange={(v) => patch(r.key, { paidIn: v })}
                            options={[
                              { value: "", label: "The contract's split" },
                              ...(r.paidIn === "custom" ? [{ value: "custom", label: "Its own shares" }] : []),
                              ...split.filter((s) => s.currency).map((s) => ({ value: s.currency, label: `All in ${s.currency}` })),
                            ]}
                            disabled={locked}
                            searchPlaceholder="Search currencies"
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {r.id && r.status === "planned" && !r.workItemId && canComplete && (
                          <Button size="sm" icon={BadgeCheck} disabled={busy !== null || dirty} onClick={() => accept(r)} title={dirty ? "Save your changes first" : undefined}>
                            {busy === `accept-${r.id}` ? "Marking…" : "Mark accepted"}
                          </Button>
                        )}
                        {r.id && r.status === "completed" && canInvoice && (
                          <Button size="sm" icon={ReceiptText} disabled={busy !== null || dirty} onClick={() => invoiceIt(r)} title={dirty ? "Save your changes first" : undefined}>
                            {busy === `invoice-${r.id}` ? "Drafting…" : "Invoice it"}
                          </Button>
                        )}
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => {
                              setDirty(true);
                              setRows((rs) => (rs.length <= 1 ? [blankRow()] : rs.filter((x) => x.key !== r.key)));
                            }}
                            aria-label={`Remove milestone ${i + 1}`}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {!readOnly && (
              <div className="border-t border-neutral-100 px-5 py-3">
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setDirty(true);
                    setRows((rs) => [...rs, blankRow()]);
                  }}
                >
                  Add a milestone
                </Button>
                {dirty && rows.some((r) => r.id && r.status !== "invoiced") && (
                  <span className="ml-3 text-xs text-neutral-500">Save before accepting or invoicing a milestone.</span>
                )}
              </div>
            )}
          </Card>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Contract value</p>
            <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">{amount(value, currency)}</p>
            <p className="text-xs text-neutral-500">
              {form.vatApplicable ? `Plus VAT at ${pct(bpFromPct(form.vatRate) ?? 0)}` : "No VAT"}
              {bpFromPct(form.retention) ? ` · ${pct(bpFromPct(form.retention))} held as retention` : ""}
            </p>
            {splitOn && plannedParts.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm" aria-label="Paid in each currency">
                {plannedParts.map((p, i) => (
                  <li key={`${p.currency}-${i}`} className="flex items-baseline justify-between gap-2">
                    <span className="text-neutral-600">
                      {pct(p.shareBp)} in {p.currency || "…"}
                    </span>
                    <span className="font-semibold tabular-nums text-neutral-900">{p.amount === null ? "-" : amount(p.amount, p.currency as CurrencyCode)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4" aria-live="polite">
              <BillingRail value={value} milestones={live} currency={currency} live />
            </div>
            {weights > 0 && (
              <p className={cx("mt-3 text-xs", weights > 10_000 ? "font-semibold text-rose-700" : "text-neutral-500")}>Weights add up to {pct(weights)}.</p>
            )}
            {canSave && (
              <Button variant="primary" icon={Save} className="mt-5 w-full" onClick={save} disabled={busy !== null || over}>
                {busy === "save" ? "Saving…" : project.contract ? "Save the contract" : "Set up the contract"}
              </Button>
            )}
            {over && canSave && <p className="mt-2 text-xs text-neutral-500">Bring the milestones within the value to save.</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
