"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Eraser, HandCoins, Landmark, Link2, Link2Off, Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  revenue,
  revenueError,
  revenueFieldErrors,
  type AllocationInput,
  type InvoiceSummary,
  type ReceiptCandidate,
} from "@/lib/api/finance-revenue-client";
import { Button, Card, Empty, PageHeader, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, day, parseAmount } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { allocationSummary, payInFullLessWht, share, today, whtLeft, type AllocationRow, type OpenInvoice } from "./meta";
import { DocNo, FieldShell, LateChip, pickerText, useBankAccounts, useClientOptions } from "./ui";

/**
 * Money in from a client. Say who paid, into which account, when and how
 * much - or pick the line off a bank statement and those fill themselves.
 * Then spread it over the client's open invoices: cash against each, the
 * WHT they deducted (no cash; a credit note to collect), and any retention
 * they released. The summary keeps count as you go, and whatever is left
 * over is kept as the client's advance.
 *
 * Money in one currency settles invoice parts in that currency: an invoice
 * billed in naira and dollars shows a row per tranche, and once the account
 * is chosen only the tranches in its currency take money. A foreign tranche
 * is cleared at the rate it was booked at; the difference against the
 * receipt date's rate is posted as realised FX.
 */

/** One open invoice, or one tranche of a multi-currency invoice: what a row of the spread settles. */
interface OpenRow extends OpenInvoice {
  /** The row's key: the invoice id, or `invoice:tranche` for a tranche of a multi-currency one. */
  key: string;
  trancheId: string | null;
  /** The rate the tranche was booked at (foreign currency only). */
  rate: string | null;
  multi: boolean;
}

/** Each open invoice as rows: one, or a row per open tranche when it bills in several currencies. */
export function openRows(invoices: InvoiceSummary[]): OpenRow[] {
  const out: OpenRow[] = [];
  for (const i of invoices) {
    if (!i.open) continue;
    const ts = i.tranches ?? [];
    if (ts.length <= 1) {
      out.push({ key: i.id, invoice: ts[0] ? { ...i, currency: ts[0].currency } : i, open: i.open, trancheId: ts[0]?.id ?? null, rate: ts[0]?.rate ?? null, multi: false });
      continue;
    }
    for (const t of ts) {
      if (!t.open || t.open.trade + t.open.retention <= 0) continue;
      out.push({ key: `${i.id}:${t.id}`, invoice: { ...i, currency: t.currency, subtotal: t.subtotal }, open: t.open, trancheId: t.id, rate: t.rate, multi: true });
    }
  }
  return out;
}

interface RowText {
  cash: string;
  wht: string;
  retention: string;
}

const EMPTY: RowText = { cash: "", wht: "", retention: "" };
const toText = (r: AllocationRow): RowText => ({ cash: r.cash ? accounting(r.cash) : "", wht: r.wht ? accounting(r.wht) : "", retention: r.retention ? accounting(r.retention) : "" });

type Errors = Record<string, string>;

export default function ReceiptForm() {
  const router = useRouter();
  const params = useSearchParams();
  const uid = useId();
  const { user } = useAuth();
  const clients = useClientOptions();
  const banks = useBankAccounts();

  const [clientId, setClientId] = useState(() => params?.get("client") ?? "");
  const [bankId, setBankId] = useState("");
  const [date, setDate] = useState(today);
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [line, setLine] = useState<ReceiptCandidate | null>(null);
  const [candidates, setCandidates] = useState<{ key: string; rows: ReceiptCandidate[] | null }>({ key: "", rows: null });
  const [moreLines, setMoreLines] = useState(false);
  const [open, setOpen] = useState<{ client: string; rows: OpenRow[] | null; error: string | null }>({ client: "", rows: null, error: null });
  const [texts, setTexts] = useState<Record<string, RowText>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefill] = useState(() => params?.get("invoice") ?? null);

  /* Statement lines not yet in the books, for the account chosen (or every account). */
  useEffect(() => {
    let alive = true;
    revenue.receipts.candidates(bankId || undefined).then(
      (rows) => alive && setCandidates({ key: bankId, rows }),
      () => alive && setCandidates({ key: bankId, rows: [] }),
    );
    return () => {
      alive = false;
    };
  }, [bankId]);

  /* The client's open invoices; each row carries its balances and the WHT already taken. */
  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    revenue.invoices
      .list({ client: clientId, status: "open" })
      .then(({ invoices }) => {
        if (!alive) return;
        const rows = openRows([...invoices].sort((x, y) => (x.dueOn ?? "").localeCompare(y.dueOn ?? "")));
        setOpen({ client: clientId, rows, error: null });
        const pre = prefill ? rows.find((r) => r.invoice.id === prefill) : undefined;
        if (pre) {
          const r = payInFullLessWht(pre);
          setTexts({ [pre.key]: toText(r) });
          setReceived((t) => t || accounting(r.cash));
        } else setTexts({});
      })
      .catch((e: unknown) => alive && setOpen({ client: clientId, rows: [], error: revenueError(e, "The client's invoices didn't load.") }));
    return () => {
      alive = false;
    };
  }, [clientId, prefill]);

  const bank = (banks.items ?? []).find((b) => b.id === (line?.bankAccountId ?? bankId)) ?? null;
  const cur = (bank?.currency ?? "NGN") as CurrencyCode;
  const cash = parseAmount(received) ?? 0;
  const allOpen = open.client === clientId ? (open.rows ?? null) : null;
  /* Once the account is known, only parts in its currency take this money. */
  const invoices = allOpen === null ? null : bank ? allOpen.filter((o) => o.invoice.currency === bank.currency) : allOpen;
  const elsewhere = allOpen && bank ? allOpen.filter((o) => o.invoice.currency !== bank.currency) : [];
  // Rows are keyed by `key` (an invoice, or an invoice's tranche); summaries reuse the `invoiceId` slot for it.
  const rows: AllocationRow[] = (invoices ?? []).map((o) => {
    const t = texts[o.key] ?? EMPTY;
    return { invoiceId: o.key, cash: parseAmount(t.cash) ?? 0, wht: parseAmount(t.wht) ?? 0, retention: parseAmount(t.retention) ?? 0 };
  });
  const byKey = Object.fromEntries((invoices ?? []).map((o) => [o.key, o]));
  const balances = Object.fromEntries((invoices ?? []).map((o) => [o.key, o.open]));
  const labelOf = (key: string) => {
    const o = byKey[key];
    return o ? `${o.invoice.invoiceNo ?? "That invoice"}${o.multi ? ` (${o.invoice.currency})` : ""}` : "That invoice";
  };
  const foreign = (invoices ?? []).some((o) => o.rate && o.rate !== "1" && o.invoice.currency === cur && rows.some((r) => r.invoiceId === o.key && r.cash + r.wht + r.retention > 0));
  const sum = allocationSummary(cash, rows, balances, labelOf, cur);
  const problemFor = (id: string, field: "cash" | "retention") => sum.problems.find((p) => p.invoiceId === id && p.field === field)?.message;

  const bankOptions = useMemo(
    () => banks.items.map((b) => ({ value: b.id, label: b.name, hint: [b.bankName, b.number, b.currency].filter(Boolean).join(" · ") })),
    [banks.items],
  );
  const lines = candidates.key === bankId ? candidates.rows : null;
  const shownLines = (lines ?? []).slice(0, moreLines ? 100 : 6);

  const setRow = (id: string, p: Partial<RowText>) => setTexts((t) => ({ ...t, [id]: { ...(t[id] ?? EMPTY), ...p } }));
  const tidy = (id: string, f: keyof RowText, text: string) => {
    const v = parseAmount(text);
    if (v !== null) setRow(id, { [f]: v === 0 ? "" : accounting(v) });
  };

  const pick = (l: ReceiptCandidate) => {
    if (line?.id === l.id) {
      setLine(null);
      return;
    }
    setLine(l);
    setBankId(l.bankAccountId);
    setDate(l.date);
    setReceived(accounting(l.amount));
    if (l.reference) setReference(l.reference);
    if (l.counterpartyId && !clientId) setClientId(l.counterpartyId);
  };

  /* ------------------------------ saving ------------------------------ */

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Errors = {};
    if (!clientId) err.clientId = "Choose the client who paid.";
    if (!(line?.bankAccountId ?? bankId)) err.bankAccountId = "Choose the account the money came into.";
    if (!date) err.receivedOn = "Enter the date the money arrived.";
    if (parseAmount(received) === null || cash <= 0) err.cash = "Enter the amount received, like 7,284,375.00.";
    if (sum.over) err.allocations = `You applied ${amount(sum.applied, cur)} but only ${amount(cash, cur)} came in.`;
    for (const p of sum.problems) err[`row.${p.invoiceId}.${p.field}`] = p.message;
    setErrors(err);
    if (Object.keys(err).length) {
      setGeneral("Some fields need attention. They are marked below.");
      return;
    }
    const used = rows.filter((r) => r.cash + r.wht + r.retention > 0);
    const allocations: AllocationInput[] = used.map((r) => {
      const o = byKey[r.invoiceId];
      return { invoiceId: o?.invoice.id ?? r.invoiceId, ...(o?.multi && o.trancheId ? { trancheId: o.trancheId } : {}), cash: r.cash, wht: r.wht, retention: r.retention };
    });
    setBusy(true);
    setGeneral(null);
    try {
      const made = await revenue.receipts.create({
        clientId,
        bankAccountId: line?.bankAccountId ?? bankId,
        receivedOn: date,
        cash,
        reference: reference.trim() || null,
        statementLineId: line?.id ?? null,
        allocations,
      });
      router.push(`/suite/finance/revenue/receipts/${made.id}?notice=recorded`);
    } catch (x) {
      const f = revenueFieldErrors(x);
      // `allocations.2.cash` → the row of the invoice that was third in the list sent.
      const placed: Errors = {};
      for (const [k, v] of Object.entries(f)) {
        const m = /^allocations\.(\d+)\.(\w+)$/.exec(k);
        const a = m ? used[Number(m[1])] : undefined;
        if (m && a) placed[`row.${a.invoiceId}.${m[2] === "retention" ? "retention" : "cash"}`] = v;
        else placed[k] = v;
      }
      setErrors(placed);
      setGeneral(f.allocations ?? f.receipt ?? (Object.keys(f).length ? "Some fields need attention. They are marked below." : revenueError(x, "The receipt wasn't recorded.")));
      setBusy(false);
    }
  };

  if (!mayDo(user, "receipts", "create"))
    return (
      <div>
        <BackLink href="/suite/finance/revenue/receipts" label="All receipts" />
        <ErrorNote>Recording money in needs the permission to record receipts. Ask a finance admin.</ErrorNote>
      </div>
    );

  const id = (f: string) => `${uid}-${f}`;
  const linked = Boolean(line);

  return (
    <form onSubmit={submit} noValidate>
      <BackLink href="/suite/finance/revenue/receipts" label="All receipts" />
      <PageHeader
        eyebrow="Revenue · receipt"
        title="Record a receipt"
        subtitle="Money in from a client, spread over their open invoices. It is posted to the ledger when recorded."
      />
      {general && <ErrorNote className="mb-4">{general}</ErrorNote>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="text-base font-bold tracking-tight text-neutral-900">The money</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FieldShell id={id("client")} label="Client" required error={errors.clientId}>
                <SearchableSelect
                  id={id("client")}
                  value={clientId}
                  onChange={(v) => {
                    setClientId(v);
                    setTexts({});
                  }}
                  options={clients.items}
                  placeholder="Choose who paid"
                  searchPlaceholder="Search the organisation register"
                  noOptionsText={pickerText(clients, "clients")}
                  aria-invalid={Boolean(errors.clientId) || undefined}
                  aria-describedby={errors.clientId ? `${id("client")}-err` : undefined}
                />
              </FieldShell>
              <FieldShell id={id("bank")} label="Into account" required error={errors.bankAccountId}>
                <SearchableSelect
                  id={id("bank")}
                  value={line?.bankAccountId ?? bankId}
                  onChange={setBankId}
                  options={bankOptions}
                  disabled={linked}
                  placeholder="Choose the bank account"
                  searchPlaceholder="Search bank accounts"
                  noOptionsText={pickerText(banks, "bank accounts")}
                  aria-invalid={Boolean(errors.bankAccountId) || undefined}
                  aria-describedby={errors.bankAccountId ? `${id("bank")}-err` : undefined}
                />
              </FieldShell>
              <FieldShell id={id("date")} label="Received on" required error={errors.receivedOn}>
                <input
                  id={id("date")}
                  type="date"
                  value={date}
                  disabled={linked}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={Boolean(errors.receivedOn) || undefined}
                  className={cx(inputClass, errors.receivedOn && "border-error-500")}
                />
              </FieldShell>
              <FieldShell id={id("amount")} label="Amount received" required error={errors.cash}>
                <input
                  id={id("amount")}
                  inputMode="decimal"
                  autoComplete="off"
                  value={received}
                  disabled={linked}
                  onChange={(e) => setReceived(e.target.value)}
                  onBlur={(e) => {
                    const v = parseAmount(e.target.value);
                    if (v !== null) setReceived(v === 0 ? "" : accounting(v));
                  }}
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.cash) || undefined}
                  aria-describedby={errors.cash ? `${id("amount")}-err` : undefined}
                  className={cx(inputClass, "text-right text-base font-semibold tabular-nums", errors.cash && "border-error-500")}
                />
              </FieldShell>
              <FieldShell id={id("ref")} label="Bank reference" className="md:col-span-2" error={errors.reference} hint="As the statement shows it, so the receipt is easy to find.">
                <input id={id("ref")} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} className={cx(inputClass, "font-mono")} />
              </FieldShell>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
              <div>
                <h2 className="text-base font-bold tracking-tight text-neutral-900">From a bank statement</h2>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Optional. Pick the line the money arrived on and it is matched as it is recorded{bankId ? "" : ". Showing every account"}.
                </p>
              </div>
              {line && (
                <Button size="sm" variant="ghost" icon={Link2Off} onClick={() => setLine(null)}>
                  Unlink the line
                </Button>
              )}
            </div>
            {errors.statementLineId && (
              <p role="alert" className="mx-5 mt-2 text-sm font-medium text-error-700">
                {errors.statementLineId}
              </p>
            )}
            {lines === null ? (
              <Skeleton className="m-5 h-24" />
            ) : lines.length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-sm text-neutral-500">No money in on the statements is waiting to be recorded{bankId ? " for this account" : ""}.</p>
            ) : (
              <div role="radiogroup" aria-label="Statement lines not yet in the books" className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
                {shownLines.map((l) => {
                  const on = line?.id === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pick(l)}
                      className={cx(
                        "flex w-full cursor-pointer items-start gap-3 px-5 py-3 text-left outline-none transition focus-visible:bg-primary-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300",
                        on ? "bg-primary-50" : "hover:bg-neutral-50",
                      )}
                    >
                      <span className={cx("mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary-600" : "border-neutral-300")} aria-hidden>
                        {on && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">{l.counterparty ?? l.narration ?? "Money in"}</span>
                        <span className="block truncate font-mono text-xs text-neutral-500">{l.narration}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums text-neutral-900">{amount(l.amount)}</span>
                        <span className="block text-xs text-neutral-500">{day(l.date)}</span>
                      </span>
                    </button>
                  );
                })}
                {lines.length > 6 && (
                  <div className="px-5 py-2.5">
                    <Button size="sm" variant="ghost" onClick={() => setMoreLines((v) => !v)}>
                      {moreLines ? "Show fewer" : `Show all ${lines.length}`}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {line && (
              <p className="flex items-center gap-1.5 border-t border-neutral-100 bg-primary-50/50 px-5 py-2.5 text-xs text-primary-800">
                <Link2 size={13} aria-hidden /> Linked: the account, date and amount come from the statement.
              </p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <h2 className="text-base font-bold tracking-tight text-neutral-900">Spread it over open invoices</h2>
              <p className="mt-0.5 text-sm text-neutral-500">Cash and WHT settle what is due now; released retention is cash too. Leave a row empty to skip it.</p>
              {errors.allocations && (
                <p role="alert" className="mt-2 text-sm font-medium text-error-700">
                  {errors.allocations}
                </p>
              )}
            </div>
            {!clientId ? (
              <Empty icon={HandCoins} title="Choose the client first" hint="Their open invoices appear here to spread the money over." />
            ) : invoices === null ? (
              <Skeleton className="m-5 h-32" />
            ) : open.error ? (
              <ErrorNote className="m-5">{open.error}</ErrorNote>
            ) : invoices.length === 0 ? (
              <Empty
                icon={CheckCircle2}
                title="Nothing open for this client"
                hint="Record the money anyway and it is kept as the client's advance, to apply when an invoice is issued."
              />
            ) : (
              <ol className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
                {invoices.map((o) => {
                  const t = texts[o.key] ?? EMPTY;
                  const f = (k: string) => `${uid}-${o.key}-${k}`;
                  const cashErr = errors[`row.${o.key}.cash`] ?? problemFor(o.key, "cash");
                  const retErr = errors[`row.${o.key}.retention`] ?? problemFor(o.key, "retention");
                  const left = whtLeft(o);
                  const rc = (o.invoice.currency || cur) as CurrencyCode;
                  return (
                    <li key={o.key} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <DocNo value={o.invoice.invoiceNo} />
                          {o.multi && <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">{o.invoice.currency} part</span>}
                          <span className="ml-2 text-xs text-neutral-500">due {day(o.invoice.dueOn)}</span>
                          <span className="ml-2 inline-block align-middle">
                            <LateChip days={o.invoice.daysLate} />
                          </span>
                          <p className="mt-1 text-xs text-neutral-500">
                            To pay now <span className="font-semibold tabular-nums text-neutral-800">{amount(o.open.trade, rc)}</span>
                            {o.open.retention > 0 && (
                              <>
                                {" "}
                                · retention held <span className="font-semibold tabular-nums text-neutral-800">{amount(o.open.retention, rc)}</span>
                              </>
                            )}
                            {left > 0 && (
                              <>
                                {" "}
                                · WHT expected <span className="font-semibold tabular-nums text-neutral-800">{amount(left, rc)}</span>
                              </>
                            )}
                            {o.rate && o.rate !== "1" && <> · booked at {o.rate}</>}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" icon={Wand2} onClick={() => setRow(o.key, toText(payInFullLessWht(o)))} aria-label={`Pay ${labelOf(o.key)} in full less WHT`}>
                            Pay in full less WHT
                          </Button>
                          {(t.cash || t.wht || t.retention) && (
                            <Button size="sm" variant="ghost" icon={Eraser} onClick={() => setRow(o.key, EMPTY)} aria-label={`Clear ${labelOf(o.key)}`}>
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {(
                          [
                            ["cash", "Cash", cashErr],
                            ["wht", "WHT deducted", undefined],
                            ["retention", "Retention released", retErr],
                          ] as const
                        ).map(([k, label, err]) => (
                          <div key={k}>
                            <label htmlFor={f(k)} className="mb-1 block text-xs font-medium text-neutral-600">
                              {label}
                              <span className="sr-only">, {o.invoice.invoiceNo}</span>
                            </label>
                            <input
                              id={f(k)}
                              inputMode="decimal"
                              autoComplete="off"
                              value={t[k]}
                              disabled={k === "retention" && o.open.retention === 0}
                              onChange={(e) => setRow(o.key, { [k]: e.target.value })}
                              onBlur={(e) => tidy(o.key, k, e.target.value)}
                              placeholder={k === "retention" && o.open.retention === 0 ? "None held" : "0.00"}
                              aria-invalid={Boolean(err) || undefined}
                              aria-describedby={err ? `${f(k)}-err` : undefined}
                              className={cx(inputClass, "h-10 text-right tabular-nums", err && "border-error-500")}
                            />
                          </div>
                        ))}
                      </div>
                      {(cashErr || retErr) && (
                        <div className="mt-1.5 space-y-1">
                          {cashErr && (
                            <p id={`${f("cash")}-err`} role="alert" className="text-xs font-medium text-error-700">
                              {cashErr}
                            </p>
                          )}
                          {retErr && (
                            <p id={`${f("retention")}-err`} role="alert" className="text-xs font-medium text-error-700">
                              {retErr}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {elsewhere.length > 0 && (
              <p className="border-t border-neutral-100 bg-neutral-50/70 px-5 py-3 text-xs text-neutral-600">
                {elsewhere.length === 1 ? "One more open part is" : `${elsewhere.length} more open parts are`} billed in{" "}
                {[...new Set(elsewhere.map((o) => o.invoice.currency))].join(" and ")}: record that money into an account in that currency.
              </p>
            )}
            {foreign && (
              <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
                Each {cur} part is cleared at the rate it was booked at. The difference against the {cur} rate on the receipt date is posted as realised FX gain or loss.
              </p>
            )}
          </Card>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <AllocationPanel received={cash} applied={sum.applied} wht={sum.wht} unallocated={sum.unallocated} currency={cur} bankName={bank?.name ?? null} busy={busy} />
        </aside>
      </div>
    </form>
  );
}

/** Received against applied, with what is left over and where it goes. */
export function AllocationPanel({
  received,
  applied,
  wht,
  unallocated,
  currency,
  bankName,
  busy,
}: {
  received: number;
  applied: number;
  wht: number;
  unallocated: number;
  currency: CurrencyCode;
  bankName: string | null;
  busy: boolean;
}) {
  const over = unallocated < 0;
  const scale = Math.max(received, applied, 1);
  return (
    <Card className="p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <Landmark size={13} aria-hidden /> {bankName ?? "Money in"}
      </p>
      <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">{amount(received, currency)}</p>
      <div className="ws-hatch mt-4 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        <span className={cx("h-full transition-[width] duration-300", over ? "bg-sun-500" : "bg-primary-500")} style={{ width: `${share(Math.min(applied, received), scale)}%` }} />
        {over && <span className="h-full bg-rose-500" style={{ width: `${share(applied - received, scale)}%` }} />}
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">Applied to invoices</dt>
          <dd className="font-semibold tabular-nums text-neutral-900">{accounting(applied)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">WHT deducted</dt>
          <dd className="font-semibold tabular-nums text-neutral-900">{accounting(wht)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-neutral-200 pt-2">
          <dt className={cx("font-semibold", over ? "text-rose-700" : "text-neutral-900")}>{over ? "Over-applied" : "Unallocated"}</dt>
          <dd className={cx("font-bold tabular-nums", over ? "text-rose-700" : "text-neutral-900")}>{accounting(Math.abs(unallocated))}</dd>
        </div>
      </dl>
      <p role="status" aria-live="polite" className={cx("mt-3 flex items-start gap-1.5 text-xs", over ? "font-semibold text-rose-700" : "text-neutral-500")}>
        {over ? <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden /> : <CheckCircle2 size={14} className="mt-px shrink-0 text-mint-600" aria-hidden />}
        {over
          ? `${amount(-unallocated, currency)} more than came in is applied. Lower a row or check the amount received.`
          : unallocated > 0
            ? `${amount(unallocated, currency)} goes to the client's advances, to apply to a later invoice.`
            : received > 0
              ? "All of it is applied to invoices."
              : "Enter the amount, then spread it."}
        {wht > 0 && !over && " The WHT is a credit note to collect from the client."}
      </p>
      <Button type="submit" variant="primary" icon={HandCoins} className="mt-5 w-full" disabled={busy || over}>
        {busy ? "Recording…" : "Record receipt"}
      </Button>
    </Card>
  );
}
