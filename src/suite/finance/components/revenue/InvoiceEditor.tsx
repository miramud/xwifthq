"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Coins, Plus, Save, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  revenue,
  revenueError,
  revenueFieldErrors,
  type ContractSummary,
  type InvoiceDetail,
  type InvoiceInput,
} from "@/lib/api/finance-revenue-client";
import { Button, Card, PageHeader, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { CURRENCIES, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, day, parseAmount } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { bpFromPct, invoiceTotals, mulBp, pct, pctInput, today, tranchesOf } from "./meta";
import { FieldShell, pickerText, useClientOptions, useProjectOptions, useRevenueAccounts } from "./ui";
import TranchesPanel from "./TranchesPanel";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * A draft invoice: who it is to, what it bills, and the money it will ask
 * for. The totals beside the lines are worked out as you type, the way the
 * API will store them - VAT per line, retention on the total, the WHT the
 * client is expected to deduct - down to what the client will pay now.
 * From here a draft is saved, deleted, or issued: numbered and posted.
 *
 * An invoice can bill in several currencies (a contract paid 60% NGN / 40%
 * USD drafts a line per currency): each line says its currency, and the
 * totals, retention and WHT are worked per currency - a tranche each, with
 * its own rate, shown beside the totals once the draft is saved.
 */

interface Line {
  key: string;
  description: string;
  accountId: string;
  amount: string;
  vat: string;
  /** The currency it bills in; "" is the invoice's. */
  currency: string;
  shareBp: number | null;
}

let seq = 0;
const newKey = () => `l${++seq}`;
const blankLine = (accountId = "", vatBp = 750, currency = ""): Line => ({ key: newKey(), description: "", accountId, amount: "", vat: pctInput(vatBp), currency, shareBp: null });

interface Defaults {
  accountId: string;
  vatBp: number;
}

type Errors = Record<string, string>;

/** What a contract's lines start from: its revenue account, and its VAT rate when it charges VAT. */
const contractDefaults = (c: ContractSummary): Defaults => ({ accountId: c.revenueAccountId ?? "", vatBp: c.vatApplicable ? c.vatRateBp : 0 });

export default function InvoiceEditor({ invoiceId }: { invoiceId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const uid = useId();
  const { user } = useAuth();
  const confirm = useConfirm();
  const clients = useClientOptions();
  const accounts = useRevenueAccounts();
  const projects = useProjectOptions();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [clientId, setClientId] = useState("");
  const [contractId, setContractId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [notes, setNotes] = useState("");
  const [retention, setRetention] = useState("0");
  const [wht, setWht] = useState("0");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  /** Lines may each say a currency. */
  const [multi, setMulti] = useState(false);
  const [defaults, setDefaults] = useState<Defaults>({ accountId: "", vatBp: 750 });

  const [errors, setErrors] = useState<Errors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | "issue" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const focusNext = useRef<string | null>(null);
  const [notice] = useState<string | null>(() => {
    const n = params?.get("notice");
    if (n === "drafted") return "Draft invoice raised from the milestone. Check it, then issue it.";
    if (n === "saved") return "Draft saved.";
    return null;
  });

  useEffect(() => {
    let alive = true;
    Promise.all([invoiceId ? revenue.invoices.get(invoiceId) : Promise.resolve(null), revenue.contracts.list().then((r) => r.contracts).catch(() => [] as ContractSummary[])])
      .then(([inv, cs]) => {
        if (!alive) return;
        setContracts(cs);
        setInvoice(inv);
        if (inv) {
          setClientId(inv.clientId ?? "");
          setContractId(inv.contract?.id ?? "");
          setProjectId(inv.project?.id ?? "");
          setMilestoneId(inv.milestoneId);
          setDate(inv.date ?? "");
          // A multi-currency draft's own currency is the base; its first line's is the one to show.
          setCurrency((inv.multiCurrency ? inv.lines[0]?.currency : inv.currency) || inv.currency || "NGN");
          setMulti(Boolean(inv.multiCurrency) || new Set(inv.lines.map((l) => l.currency ?? inv.currency)).size > 1);
          setNotes(inv.notes ?? "");
          setRetention(pctInput(inv.retentionBp));
          setWht(pctInput(inv.expectedWhtBp));
          setLines(
            inv.lines.length
              ? inv.lines.map((l) => ({
                  key: newKey(),
                  description: l.description,
                  accountId: l.accountId ?? "",
                  amount: accounting(l.amount),
                  vat: pctInput(l.vatRateBp),
                  currency: l.currency ?? "",
                  shareBp: l.shareBp ?? null,
                }))
              : [blankLine()],
          );
          // Lines added to a contract's draft start from the contract's account and VAT.
          const c = inv.contract ? cs.find((x) => x.id === inv.contract?.id) : undefined;
          if (c) setDefaults(contractDefaults(c));
        } else {
          setDate(today());
          const c = params?.get("contract");
          const cl = params?.get("client");
          const found = c ? cs.find((x) => x.id === c) : undefined;
          if (found) applyContract(found);
          else if (cl) setClientId(cl);
        }
        setReady(true);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(revenueError(e, "The invoice didn't load.")));
    return () => {
      alive = false;
    };
    // `params` is read once, when a new invoice starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, reload]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(`${uid}-${focusNext.current}-description`)?.focus();
    focusNext.current = null;
  }, [lines, uid]);

  /* A contract brings its client, project, terms, VAT and revenue account. */
  function applyContract(c: ContractSummary) {
    setContractId(c.id);
    setClientId(c.clientId);
    setProjectId(c.project?.id ?? "");
    setCurrency(c.currency || "NGN");
    if (c.currencySplit?.length) setMulti(true);
    setRetention(pctInput(c.retentionBp));
    setWht(pctInput(c.expectedWhtBp));
    const next = contractDefaults(c);
    setDefaults(next);
    setLines((ls) => ls.map((l) => ({ ...l, accountId: l.accountId || next.accountId, vat: l.amount ? l.vat : pctInput(next.vatBp) })));
  }

  const canUpdate = invoiceId ? mayDo(user, "invoices", "update") : mayDo(user, "invoices", "create");
  const canDelete = Boolean(invoiceId) && mayDo(user, "invoices", "delete");
  const canIssue = mayDo(user, "invoices", "issue");
  const cur = (currency || "NGN") as CurrencyCode;
  const retentionBp = bpFromPct(retention) ?? 0;
  const whtBp = bpFromPct(wht) ?? 0;
  const parsed = lines.map((l) => ({ amount: parseAmount(l.amount) ?? 0, vatRateBp: bpFromPct(l.vat) ?? 0, currency: multi ? l.currency || cur : cur }));
  const totals = invoiceTotals(parsed, retentionBp, whtBp);
  /* Per currency: the tranches the API will make, each with its own totals. */
  const groups = tranchesOf(parsed, cur).map((g) => ({ currency: g.currency, totals: invoiceTotals(g.lines, retentionBp, whtBp) }));
  const base = invoice?.baseCurrency ?? (invoice?.multiCurrency ? invoice.currency : null) ?? "NGN";

  const contractOptions = useMemo<SelectOption[]>(
    () =>
      contracts
        .filter((c) => !clientId || c.clientId === clientId)
        .map((c) => ({ value: c.id, label: c.title, hint: [c.project?.code, c.client, c.reference].filter(Boolean).join(" · ") })),
    [contracts, clientId],
  );

  const touch = () => setDirty(true);
  const patch = (key: string, p: Partial<Line>) => {
    touch();
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  };
  const addLine = () => {
    touch();
    const l = blankLine(defaults.accountId, defaults.vatBp, multi ? cur : "");
    focusNext.current = l.key;
    setLines((ls) => [...ls, l]);
  };

  /* ------------------------------ saving ------------------------------ */

  const prepare = (): InvoiceInput | null => {
    const e: Errors = {};
    if (!clientId && !contractId) e.clientId = "Choose the client to invoice.";
    if (bpFromPct(retention) === null) e.retentionBp = "Enter a retention rate from 0 to 50.";
    if (bpFromPct(wht) === null) e.expectedWhtBp = "Enter a WHT rate from 0 to 50.";
    const out: InvoiceInput["lines"] = [];
    lines.forEach((l, i) => {
      const amt = parseAmount(l.amount);
      if (!l.description.trim()) e[`lines.${i}.description`] = "Say what this line bills for.";
      if (amt === null || amt <= 0) e[`lines.${i}.amount`] = "Enter an amount above zero.";
      if (!l.accountId) e[`lines.${i}.accountId`] = "Choose the revenue account this line earns.";
      const vat = bpFromPct(l.vat);
      if (vat === null) e[`lines.${i}.vatRateBp`] = "VAT is a rate from 0 to 50, like 7.5.";
      out.push({
        description: l.description.trim(),
        accountId: l.accountId || null,
        amount: amt ?? 0,
        vatRateBp: vat ?? 0,
        ...(multi ? { currency: l.currency || cur, shareBp: l.shareBp } : {}),
      });
    });
    setErrors(e);
    if (Object.keys(e).length) {
      setGeneral("Some fields need attention. They are marked below.");
      return null;
    }
    setGeneral(null);
    return {
      clientId: clientId || null,
      contractId: contractId || null,
      projectId: projectId || null,
      milestoneId: contractId ? milestoneId : null,
      currency: cur,
      invoiceDate: date || null,
      notes: notes.trim() || null,
      retentionBp,
      expectedWhtBp: whtBp,
      lines: out,
    };
  };

  const placeErrors = (err: unknown, fallback: string) => {
    const f = revenueFieldErrors(err);
    setErrors(f);
    const placed = Object.keys(f).some((k) => k !== "invoice" && k !== "lines");
    setGeneral(f.invoice ?? f.lines ?? (placed ? "Some fields need attention. They are marked below." : revenueError(err, fallback)));
  };

  /** Saves, and says where the draft now lives. */
  const persist = async (): Promise<string | null> => {
    const input = prepare();
    if (!input) return null;
    if (invoiceId) {
      const saved = await revenue.invoices.update(invoiceId, input);
      setInvoice(saved);
      return saved.id;
    }
    const made = await revenue.invoices.create(input);
    return made.id;
  };

  const save = async () => {
    setBusy("save");
    try {
      const id = await persist();
      if (!id) return;
      setDirty(false);
      if (!invoiceId) router.replace(`/suite/finance/revenue/invoices/${id}?notice=saved`);
      else setGeneral(null);
    } catch (err) {
      placeErrors(err, "The draft wasn't saved.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!invoiceId) return;
    const ok = await confirm({
      title: "Delete this draft invoice?",
      body: "A draft has no number and nothing is posted, so nothing is lost but the draft itself. This can't be undone.",
      confirmLabel: "Delete draft",
    });
    if (!ok) return;
    setBusy("delete");
    try {
      await revenue.invoices.remove(invoiceId);
      setDirty(false);
      router.push("/suite/finance/revenue/invoices?status=draft");
    } catch (err) {
      setGeneral(revenueError(err, "The draft wasn't deleted."));
      setBusy(null);
    }
  };

  const issue = async (on: string) => {
    setBusy("issue");
    try {
      const id = await persist();
      if (!id) {
        setIssuing(false);
        return;
      }
      setDirty(false);
      await revenue.invoices.issue(id, on || null);
      router.push(`/suite/finance/revenue/invoices/${id}?notice=issued`);
    } catch (err) {
      setIssuing(false);
      placeErrors(err, "The invoice wasn't issued.");
      setBusy(null);
    }
  };

  /* ------------------------------ render ------------------------------ */

  const back = <BackLink href="/suite/finance/revenue/invoices" label="All invoices" />;
  if (loadError)
    return (
      <div>
        {back}
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!ready)
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-[26rem]" />
      </div>
    );
  if (invoice && invoice.status !== "draft")
    return (
      <div>
        {back}
        <ErrorNote>Only a draft can change. This invoice is issued: void it and raise another instead.</ErrorNote>
      </div>
    );

  const id = (f: string) => `${uid}-${f}`;
  const readOnly = !canUpdate;

  return (
    <div>
      {back}
      <PageHeader
        eyebrow="Revenue · invoice"
        title={invoiceId ? "Draft invoice" : "New invoice"}
        subtitle="A draft has no number and posts nothing. Issuing numbers it, dates it and posts it to the ledger."
      />
      <Notice text={notice} />
      {general && <ErrorNote className="mb-4">{general}</ErrorNote>}
      {readOnly && <p className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">You can read this draft. Changing it needs the permission to edit invoices.</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell id={id("client")} label="Client" required error={errors.clientId}>
                <SearchableSelect
                  id={id("client")}
                  value={clientId}
                  onChange={(v) => {
                    touch();
                    setClientId(v);
                    if (contractId && contracts.find((c) => c.id === contractId)?.clientId !== v) setContractId("");
                  }}
                  options={clients.items}
                  disabled={readOnly || Boolean(contractId)}
                  placeholder="Choose the client"
                  searchPlaceholder="Search the organisation register"
                  noOptionsText={pickerText(clients, "clients")}
                  aria-invalid={Boolean(errors.clientId) || undefined}
                  aria-describedby={errors.clientId ? `${id("client")}-err` : undefined}
                />
              </FieldShell>
              <FieldShell id={id("contract")} label="Contract" error={errors.contractId} hint={contractId ? "The client and project come from the contract." : "Optional. A contract brings its terms."}>
                <SearchableSelect
                  id={id("contract")}
                  value={contractId}
                  onChange={(v) => {
                    touch();
                    const c = contracts.find((x) => x.id === v);
                    if (c) applyContract(c);
                    else {
                      setContractId("");
                      setMilestoneId(null);
                    }
                  }}
                  options={contractOptions}
                  disabled={readOnly}
                  clearable
                  clearLabel="No contract"
                  placeholder="No contract"
                  searchPlaceholder="Search contracts"
                  noOptionsText={clientId ? "This client has no contracts." : "No contracts yet."}
                />
              </FieldShell>
              <FieldShell id={id("project")} label="Project" error={errors.projectId}>
                <SearchableSelect
                  id={id("project")}
                  value={projectId}
                  onChange={(v) => {
                    touch();
                    setProjectId(v);
                  }}
                  options={projects.items}
                  disabled={readOnly || Boolean(contractId)}
                  clearable
                  clearLabel="No project"
                  placeholder="No project"
                  searchPlaceholder="Search projects"
                  noOptionsText={pickerText(projects, "projects")}
                />
              </FieldShell>
              <div className="grid grid-cols-2 gap-4">
                <FieldShell id={id("date")} label="Invoice date" error={errors.invoiceDate}>
                  <input
                    id={id("date")}
                    type="date"
                    value={date}
                    disabled={readOnly}
                    onChange={(e) => {
                      touch();
                      setDate(e.target.value);
                    }}
                    className={inputClass}
                  />
                </FieldShell>
                <FieldShell id={id("currency")} label={multi ? "Main currency" : "Currency"}>
                  <SearchableSelect
                    id={id("currency")}
                    value={currency}
                    onChange={(v) => {
                      touch();
                      setCurrency(v || "NGN");
                    }}
                    options={CURRENCIES}
                    disabled={readOnly || Boolean(contractId)}
                    searchPlaceholder="Search currencies"
                  />
                </FieldShell>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <h2 className="text-base font-bold tracking-tight text-neutral-900">What it bills</h2>
              {errors.lines && (
                <p role="alert" className="mt-2 text-sm font-medium text-error-700">
                  {errors.lines}
                </p>
              )}
            </div>
            <ol className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
              {lines.map((l, i) => {
                const f = (k: string) => `${uid}-${l.key}-${k}`;
                const err = (k: string) => errors[`lines.${i}.${k}`];
                const a = parseAmount(l.amount) ?? 0;
                const v = mulBp(a, bpFromPct(l.vat) ?? 0);
                return (
                  <li key={l.key} className="px-5 py-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9.5rem_5.5rem_2.5rem]">
                      <div>
                        <label htmlFor={f("description")} className="mb-1 block text-xs font-medium text-neutral-600">
                          Description, line {i + 1}
                        </label>
                        <input
                          id={f("description")}
                          value={l.description}
                          maxLength={255}
                          disabled={readOnly}
                          onChange={(e) => patch(l.key, { description: e.target.value })}
                          placeholder="What the client is paying for"
                          aria-invalid={Boolean(err("description")) || undefined}
                          className={cx(inputClass, "h-10", err("description") && "border-error-500")}
                        />
                        {err("description") && <p role="alert" className="mt-1 text-xs font-medium text-error-700">{err("description")}</p>}
                      </div>
                      <div>
                        <label htmlFor={f("account")} className="mb-1 block text-xs font-medium text-neutral-600">
                          Revenue account
                        </label>
                        <SearchableSelect
                          id={f("account")}
                          size="sm"
                          value={l.accountId}
                          onChange={(val) => patch(l.key, { accountId: val })}
                          options={accounts.items}
                          disabled={readOnly}
                          placeholder="Choose an account"
                          searchPlaceholder="Search code or name"
                          noOptionsText={pickerText(accounts, "revenue accounts")}
                          aria-invalid={Boolean(err("accountId")) || undefined}
                        />
                        {err("accountId") && <p role="alert" className="mt-1 text-xs font-medium text-error-700">{err("accountId")}</p>}
                      </div>
                      <div>
                        <label htmlFor={f("amount")} className="mb-1 block text-xs font-medium text-neutral-600">
                          Amount, before VAT
                        </label>
                        <input
                          id={f("amount")}
                          inputMode="decimal"
                          autoComplete="off"
                          value={l.amount}
                          disabled={readOnly}
                          onChange={(e) => patch(l.key, { amount: e.target.value })}
                          onBlur={(e) => {
                            const p = parseAmount(e.target.value);
                            if (p !== null) patch(l.key, { amount: p === 0 ? "" : accounting(p) });
                          }}
                          placeholder="0.00"
                          aria-invalid={Boolean(err("amount")) || undefined}
                          className={cx(inputClass, "h-10 text-right tabular-nums", err("amount") && "border-error-500")}
                        />
                        {err("amount") && <p role="alert" className="mt-1 text-xs font-medium text-error-700">{err("amount")}</p>}
                      </div>
                      <div>
                        <label htmlFor={f("vat")} className="mb-1 block text-xs font-medium text-neutral-600">
                          VAT %
                        </label>
                        <input
                          id={f("vat")}
                          inputMode="decimal"
                          value={l.vat}
                          disabled={readOnly}
                          onChange={(e) => patch(l.key, { vat: e.target.value })}
                          aria-invalid={Boolean(err("vatRateBp")) || undefined}
                          className={cx(inputClass, "h-10 text-right tabular-nums", err("vatRateBp") && "border-error-500")}
                        />
                        {err("vatRateBp") && <p role="alert" className="mt-1 text-xs font-medium text-error-700">{err("vatRateBp")}</p>}
                      </div>
                      {multi && (
                        <div className="lg:col-start-3 lg:col-end-5 lg:row-start-2">
                          <label htmlFor={f("currency")} className="mb-1 block text-xs font-medium text-neutral-600">
                            Billed in
                          </label>
                          <SearchableSelect
                            id={f("currency")}
                            size="sm"
                            value={l.currency || cur}
                            onChange={(val) => patch(l.key, { currency: val || cur })}
                            options={CURRENCIES}
                            disabled={readOnly}
                            searchPlaceholder="Search currencies"
                          />
                        </div>
                      )}
                      <div className="flex items-end lg:row-start-1 lg:col-start-5">
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              touch();
                              setLines((ls) => (ls.length <= 1 ? [blankLine(defaults.accountId, defaults.vatBp)] : ls.filter((x) => x.key !== l.key)));
                            }}
                            aria-label={`Remove line ${i + 1}`}
                            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>
                    {a > 0 && (
                      <p className="mt-2 text-right text-xs tabular-nums text-neutral-500">
                        VAT {accounting(v)} · line total <span className="font-semibold text-neutral-800">{multi ? amount(a + v, (l.currency || cur) as CurrencyCode) : accounting(a + v)}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            {!readOnly && (
              <div className="border-t border-neutral-100 px-5 py-3">
                <Button size="sm" icon={Plus} onClick={addLine}>
                  Add a line
                </Button>
                {!multi && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Coins}
                    className="ml-2"
                    onClick={() => {
                      touch();
                      setMulti(true);
                      setLines((ls) => ls.map((l) => ({ ...l, currency: l.currency || cur })));
                    }}
                  >
                    Bill some lines in another currency
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldShell id={id("ret")} label="Retention held (%)" error={errors.retentionBp} hint="Held back until the client releases it.">
                <input
                  id={id("ret")}
                  inputMode="decimal"
                  value={retention}
                  disabled={readOnly}
                  onChange={(e) => {
                    touch();
                    setRetention(e.target.value);
                  }}
                  aria-invalid={Boolean(errors.retentionBp) || undefined}
                  className={cx(inputClass, "text-right tabular-nums", errors.retentionBp && "border-error-500")}
                />
              </FieldShell>
              <FieldShell id={id("wht")} label="WHT the client deducts (%)" error={errors.expectedWhtBp} hint="On the amount before VAT; they send a credit note for it.">
                <input
                  id={id("wht")}
                  inputMode="decimal"
                  value={wht}
                  disabled={readOnly}
                  onChange={(e) => {
                    touch();
                    setWht(e.target.value);
                  }}
                  aria-invalid={Boolean(errors.expectedWhtBp) || undefined}
                  className={cx(inputClass, "text-right tabular-nums", errors.expectedWhtBp && "border-error-500")}
                />
              </FieldShell>
              <FieldShell id={id("notes")} label="Notes" className="sm:col-span-2" hint="Printed on the invoice: bank details, a purchase order, thanks.">
                <RichTextEditor
                  id={id("notes")}
                  value={notes}
                  disabled={readOnly}
                  onChange={(html) => {
                    touch();
                    setNotes(html);
                  }}
                />
              </FieldShell>
            </div>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <Card className="p-5">
            <h2 className="text-base font-bold tracking-tight text-neutral-900">Totals</h2>
            {groups.length > 1 ? (
              groups.map((g) => (
                <section key={g.currency} aria-label={`Totals in ${g.currency}`} className="mt-4 border-t border-neutral-100 pt-3 first-of-type:border-t-0 first-of-type:pt-0">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">In {g.currency}</h3>
                  <InvoiceTotalsList totals={g.totals} retentionBp={retentionBp} whtBp={whtBp} currency={g.currency as CurrencyCode} />
                </section>
              ))
            ) : (
              <InvoiceTotalsList totals={totals} retentionBp={retentionBp} whtBp={whtBp} currency={(groups[0]?.currency ?? cur) as CurrencyCode} />
            )}
            {!readOnly && (
              <div className="mt-5 flex flex-col gap-2">
                {canIssue && (
                  <Button variant="primary" icon={Send} onClick={() => setIssuing(true)} disabled={busy !== null}>
                    Issue invoice
                  </Button>
                )}
                <Button icon={Save} onClick={save} disabled={busy !== null}>
                  {busy === "save" ? "Saving…" : "Save draft"}
                </Button>
                {canDelete && (
                  <Button variant="ghost" icon={Trash2} onClick={remove} disabled={busy !== null} className="text-error-700 hover:bg-error-500/10">
                    {busy === "delete" ? "Deleting…" : "Delete draft"}
                  </Button>
                )}
              </div>
            )}
            <p className="mt-3 text-xs text-neutral-500">
              {invoice?.contract ? `On ${invoice.contract.title}.` : contractId ? "Billed against the contract." : "Not billed against a contract."}
              {date ? ` Dated ${day(date)}.` : ""}
            </p>
          </Card>
          {invoice && (invoice.tranches?.length ?? 0) > 0 && (invoice.tranches!.length > 1 || invoice.tranches![0].currency !== base) && (
            <div className="mt-5">
              <TranchesPanel invoice={invoice} base={base} draft dirty={dirty} onChanged={setInvoice} />
            </div>
          )}
        </aside>
      </div>

      {issuing && <IssueDialog totals={groups.map((g) => amount(g.totals.total, g.currency as CurrencyCode))} defaultDate={date || today()} busy={busy === "issue"} onIssue={issue} onClose={() => setIssuing(false)} />}
    </div>
  );
}

/** Subtotal down to what the client pays now, as a short statement. */
export function InvoiceTotalsList({
  totals,
  retentionBp,
  whtBp,
  currency,
}: {
  totals: ReturnType<typeof invoiceTotals>;
  retentionBp: number;
  whtBp: number;
  currency: CurrencyCode;
}) {
  const row = (label: string, v: number, opts: { minus?: boolean; strong?: boolean; quiet?: boolean } = {}) => (
    <div className={cx("flex items-baseline justify-between gap-3 py-1.5", opts.strong && "border-t border-neutral-200 pt-2.5")}>
      <dt className={cx("text-sm", opts.quiet ? "text-neutral-500" : "text-neutral-700", opts.strong && "font-semibold text-neutral-900")}>{label}</dt>
      <dd className={cx("tabular-nums", opts.strong ? "text-base font-bold text-neutral-900" : "text-sm font-semibold text-neutral-800")}>
        {opts.minus && v ? `−${accounting(v)}` : accounting(v)}
      </dd>
    </div>
  );
  return (
    <div aria-live="polite">
      <dl className="mt-3">
        {row("Subtotal", totals.subtotal)}
        {row("VAT", totals.vat)}
        {row("Invoice total", totals.total, { strong: true })}
        {row(`Retention held (${pct(retentionBp)})`, totals.retention, { minus: true, quiet: true })}
        {row(`WHT expected (${pct(whtBp)})`, totals.expectedWht, { minus: true, quiet: true })}
      </dl>
      <div className="mt-3 rounded-xl bg-primary-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Client will pay now</p>
        <p className="mt-0.5 text-[24px] font-bold leading-tight tabular-nums text-neutral-900">{amount(totals.payNow, currency)}</p>
        <p className="mt-0.5 text-xs text-primary-800">Total less retention and the WHT they deduct.</p>
      </div>
    </div>
  );
}

function IssueDialog({
  totals,
  defaultDate,
  busy,
  onIssue,
  onClose,
}: {
  /** The total per currency, formatted. */
  totals: string[];
  defaultDate: string;
  busy: boolean;
  onIssue: (date: string) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [on, setOn] = useState(defaultDate);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        onIssue(on);
      }}
      titleId={`${uid}-title`}
      title="Issue this invoice?"
      subtitle={`It is saved, given the next number and posted for ${totals.join(" and ")}. After this it can only be voided.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep as a draft</Button>
          <Button type="submit" variant="primary" icon={Send} disabled={busy}>
            {busy ? "Issuing…" : "Issue invoice"}
          </Button>
        </div>
      }
    >
      <div>
        <label htmlFor={`${uid}-date`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Issue date
        </label>
        <input id={`${uid}-date`} type="date" value={on} onChange={(e) => setOn(e.target.value)} className={inputClass} />
        <p className="mt-1.5 text-xs text-neutral-500">
          The due date follows from the contract&apos;s days to pay. The period it falls in must be open.
          {totals.length > 1 ? " Each currency is booked at that date's recorded rate, unless its rate was overridden." : ""}
        </p>
      </div>
    </DialogFrame>
  );
}
