"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  FilePen,
  FileSpreadsheet,
  Landmark,
  NotebookPen,
  PiggyBank,
  Plus,
  Scale,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { financeRequest } from "@/lib/api/finance-request";
import {
  ledger,
  type BalanceSheet,
  type IncomeStatement,
  type JournalSummary,
  type Period,
} from "@/lib/api/finance-ledger-client";
import { ButtonLink, Chip, Panel, PageHeader, StatGrid, cx } from "@/components/workspace/kit";
import { Donut, GroupedColumns, Legend, Sparkline, type DonutSlice } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";
import { ErrorNote, IconTile, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { mayDo, mayUseFinance } from "@/suite/finance/lib/finance-access";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { PeriodLegend, PeriodStrip, dayKey, monthKey } from "../periods/PeriodStrip";

/**
 * The bursar's morning: what is in the bank and whether it agrees with the
 * books, how the year is running, how far the months are closed, and what is
 * waiting on somebody. Each block loads on its own, so a viewer without
 * banking still gets the ledger, and one slow report holds nothing else up.
 */

/* Banking, read directly with only the fields this page uses. */
interface BankLite {
  id: string;
  name: string;
  number: string | null;
  currency: string;
  glAccount: { id: string; code: string; name: string } | null;
  bookBalance: number;
  bankBalance: number | null;
  bankBalanceDate: string | null;
  lastReconciled: string | null;
  unreconciledCount: number;
  unreconciledValue: number;
  lowBalanceThreshold: number | null;
  status?: string;
}

interface StatementLite {
  id: string;
  bankAccount: string | null;
  fileName: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  lineCount: number | null;
}

type Slot<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "error"; message: string } | { state: "hidden" };

const LOADING = { state: "loading" } as const;
const HIDDEN = { state: "hidden" } as const satisfies Slot<never>;

function settle<T>(p: Promise<T>, set: (s: Slot<T>) => void, fallback: string) {
  p.then((data) => set({ state: "ready", data })).catch((e: unknown) =>
    set({ state: "error", message: e instanceof Error && e.message ? e.message : fallback }),
  );
}

/** Whole months between two `YYYY-MM` keys (b after a → positive). */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

const EXPENSE_HUES: Hue[] = ["coral", "sun", "grape", "sky", "rose", "slate"];

export default function OverviewBoard({ today: asOf }: { today?: Date }) {
  const { user } = useAuth();
  const [today] = useState(() => asOf ?? new Date());
  const can = useMemo(
    () => ({
      reports: mayUseFinance(user, "reports"),
      // The months come from `periods.view`; month-end runs alone do not open them.
      periods: mayUseFinance(user, "periods"),
      journals: mayUseFinance(user, "journals"),
      banking: mayUseFinance(user, "banking"),
      statements: mayUseFinance(user, "statements"),
      keyJournal: mayDo(user, "journals", "create"),
    }),
    [user],
  );

  /* Nobody here for the ledger, banking or reports: their Finance is their own requests. */
  const router = useRouter();
  const nothingHere = Boolean(user) && !can.reports && !can.journals && !can.banking;
  useEffect(() => {
    if (nothingHere) router.replace("/suite/finance/requests");
  }, [nothingHere, router]);

  const year = today.getFullYear();
  const [incomeS, setIncome] = useState<Slot<IncomeStatement>>(LOADING);
  const [positionS, setPosition] = useState<Slot<BalanceSheet>>(LOADING);
  const [periodsS, setPeriods] = useState<Slot<Period[]>>(LOADING);
  const [queueS, setQueue] = useState<Slot<{ pending: JournalSummary[]; drafts: JournalSummary[] }>>(LOADING);
  const [banksS, setBanks] = useState<Slot<BankLite[]>>(LOADING);
  const [statementsS, setStatements] = useState<Slot<StatementLite[]>>(LOADING);
  /* A block this person may not see is hidden rather than fetched. */
  const income = can.reports ? incomeS : HIDDEN;
  const position = can.reports ? positionS : HIDDEN;
  const periods = can.periods ? periodsS : HIDDEN;
  const queue = can.journals ? queueS : HIDDEN;
  const banks = can.banking ? banksS : HIDDEN;
  const statements = can.statements ? statementsS : HIDDEN;
  const [trends, setTrends] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (!user) return;
    /* Each block on its own: a refusal or a slow report holds nothing else up. */
    if (can.reports) {
      settle(ledger.reports.incomeStatement(), setIncome, "The income statement didn't load.");
      settle(ledger.reports.balanceSheet(), setPosition, "The financial position didn't load.");
    }
    if (can.periods) settle(ledger.periods.list(year), setPeriods, "The months didn't load.");
    if (can.journals)
      settle(
        Promise.all([ledger.journals.list({ status: "pending_approval" }), ledger.journals.list({ status: "draft" })]).then(([pending, drafts]) => ({ pending, drafts })),
        setQueue,
        "Journals didn't load.",
      );
    if (can.banking) settle(financeRequest<{ data: BankLite[] }>("bank-accounts").then((r) => r.data), setBanks, "Bank accounts didn't load.");
    if (can.statements)
      settle(
        financeRequest<{ data: StatementLite[] }>("statements", { query: { status: "ready_for_review" } }).then((r) => r.data),
        setStatements,
        "Statements didn't load.",
      );
  }, [user, can, year]);

  /* A month-end balance per bank for its sparkline, from its ledger account. */
  useEffect(() => {
    if (banksS.state !== "ready" || !can.reports) return;
    let alive = true;
    const from = `${year}-01-01`;
    banksS.data.forEach((b) => {
      if (!b.glAccount) return;
      ledger.reports
        .ledger(b.glAccount.id, { from })
        .then((l) => {
          const byMonth = new Map<string, number>();
          for (const line of l.lines) byMonth.set(line.date.slice(0, 7), line.balance);
          const points: number[] = [];
          let last = l.opening;
          for (let m = 1; m <= today.getMonth() + 1; m++) {
            const k = `${year}-${String(m).padStart(2, "0")}`;
            last = byMonth.get(k) ?? last;
            points.push(last);
          }
          if (alive) setTrends((t) => ({ ...t, [b.id]: points }));
        })
        .catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, [banksS, can.reports, year, today]);

  const nowKey = monthKey(today);
  const lastClosedKey = monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1));

  /* --------------------------- figures --------------------------- */

  const bankList = banks.state === "ready" ? banks.data.filter((b) => b.status !== "closed") : [];
  const baseCurrency = income.state === "ready" ? income.data.currency : position.state === "ready" ? position.data.currency : "NGN";
  const cashBase = bankList.filter((b) => b.currency === baseCurrency).reduce((s, b) => s + b.bookBalance, 0);
  const foreign = Object.entries(
    bankList.filter((b) => b.currency !== baseCurrency).reduce<Record<string, number>>((m, b) => ({ ...m, [b.currency]: (m[b.currency] ?? 0) + b.bookBalance }), {}),
  );

  const monthly = income.state === "ready" ? income.data.monthly : [];
  const spend = (m: { directCosts: number; expenses: number }) => m.directCosts + m.expenses;
  const mix = useMemo<DonutSlice[]>(() => {
    if (income.state !== "ready") return [];
    const is = income.data;
    const groups = new Map<string, number>();
    for (const r of [...is.costOfRevenue.rows, ...is.expenses.rows, ...is.otherExpenses.rows]) {
      const g = r.group ?? r.name;
      groups.set(g, (groups.get(g) ?? 0) + r.amount);
    }
    const sorted = [...groups.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) top.push(["Everything else", rest]);
    return top.map(([label, value], i) => ({ label, value, hue: EXPENSE_HUES[i] ?? "slate" }));
  }, [income]);

  /* ---------------------------- waiting ---------------------------- */

  const waiting: { key: string; icon: typeof Clock; hue: Hue; title: string; meta: string; href: string }[] = [];
  if (queue.state === "ready") {
    if (queue.data.pending.length)
      waiting.push({
        key: "pending",
        icon: Clock,
        hue: "sun",
        title: `${queue.data.pending.length} ${queue.data.pending.length === 1 ? "journal" : "journals"} awaiting approval`,
        meta: `${amount(queue.data.pending.reduce((s, j) => s + j.total, 0), baseCurrency)} in all`,
        href: "/suite/finance/journals?status=pending_approval",
      });
    if (queue.data.drafts.length)
      waiting.push({
        key: "drafts",
        icon: FilePen,
        hue: "slate",
        title: `${queue.data.drafts.length} draft ${queue.data.drafts.length === 1 ? "journal" : "journals"}`,
        meta: "Finish them or delete them before the month closes",
        href: "/suite/finance/journals?status=draft",
      });
  }
  if (statements.state === "ready")
    for (const s of statements.data.slice(0, 4))
      waiting.push({
        key: `st-${s.id}`,
        icon: FileSpreadsheet,
        hue: "sky",
        title: `Review ${s.bankAccount ?? "a bank"} statement`,
        meta: [s.periodFrom && s.periodTo ? `${day(s.periodFrom)} – ${day(s.periodTo)}` : s.fileName, s.lineCount ? `${s.lineCount} lines` : null].filter(Boolean).join(" · "),
        href: `/suite/finance/banking/imports/${s.id}`,
      });
  for (const b of bankList) {
    const behind = b.lastReconciled ? monthsBetween(b.lastReconciled.slice(0, 7), lastClosedKey) : null;
    if (behind === null || behind > 0)
      waiting.push({
        key: `rec-${b.id}`,
        icon: Scale,
        hue: "grape",
        title: behind === null ? `Reconcile ${b.name}` : `${b.name}: ${behind} ${behind === 1 ? "month" : "months"} to reconcile`,
        meta: b.lastReconciled ? `Last reconciled to ${day(b.lastReconciled)}` : "Never reconciled",
        href: `/suite/finance/banking/${b.id}`,
      });
  }
  if (periods.state === "ready")
    for (const p of periods.data.filter((p) => p.key < nowKey && p.status === "open"))
      waiting.push({
        key: `p-${p.id}`,
        icon: CalendarClock,
        hue: "blue",
        title: `${p.label} is still open`,
        meta: p.drafts || p.pending ? `${p.drafts} drafts, ${p.pending} awaiting approval` : "Ready to close",
        href: "/suite/finance/periods",
      });

  const waitingCount =
    (queue.state === "ready" ? queue.data.pending.length + queue.data.drafts.length : 0) + (statements.state === "ready" ? statements.data.length : 0);

  /* ----------------------------- render ---------------------------- */

  if (nothingHere) {
    return (
      <p role="status" className="text-sm text-neutral-500">
        Opening your requests…
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Overview"
        subtitle={`Where the money stands on ${day(dayKey(today))}. Figures are for the financial year to date.`}
        actions={
          <>
            {can.reports && (
              <ButtonLink href="/suite/finance/reports/trial-balance" icon={BookOpenCheck}>
                Trial balance
              </ButtonLink>
            )}
            {can.keyJournal && (
              <ButtonLink href="/suite/finance/journals/new" variant="primary" icon={Plus}>
                New journal
              </ButtonLink>
            )}
          </>
        }
      />

      {periods.state !== "hidden" && (
        <section className="ws-card mb-6 p-5" aria-labelledby="year-strip">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="year-strip" className="text-[15px] font-semibold text-neutral-900">
                {year} month by month
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">How far each month is closed. Choose a month to manage it.</p>
            </div>
            <PeriodLegend />
          </div>
          {periods.state === "loading" && <Skeleton className="h-[84px]" />}
          {periods.state === "error" && <ErrorNote>{periods.message}</ErrorNote>}
          {periods.state === "ready" && <PeriodStrip periods={periods.data} today={today} />}
        </section>
      )}

      <StatGrid>
        {banks.state === "hidden" ? (
          <StatCard
            featured
            label="Total assets"
            icon={Wallet}
            value={position.state === "ready" ? compact(position.data.totalAssets, baseCurrency) : "…"}
            hint={position.state === "ready" ? `As at ${day(position.data.asAt)}` : undefined}
          />
        ) : (
          <StatCard
            featured
            label="Cash at bank"
            icon={Landmark}
            value={banks.state === "ready" ? compact(cashBase, baseCurrency) : "…"}
            hint={
              banks.state === "ready"
                ? [`${bankList.length} ${bankList.length === 1 ? "account" : "accounts"}`, ...foreign.map(([c, v]) => `plus ${compact(v, c)}`)].join(" · ")
                : undefined
            }
            href="/suite/finance/banking"
          />
        )}
        <StatCard
          label={income.state === "ready" && income.data.netSurplus < 0 ? "Deficit this year" : "Surplus this year"}
          icon={PiggyBank}
          hue={income.state === "ready" && income.data.netSurplus < 0 ? "rose" : "mint"}
          value={income.state === "ready" ? compact(Math.abs(income.data.netSurplus), baseCurrency) : income.state === "hidden" ? "—" : "…"}
          hint={income.state === "ready" ? `Income ${compact(income.data.revenue.total + income.data.otherIncome.total, baseCurrency)}` : undefined}
          href={can.reports ? "/suite/finance/reports/income-statement" : undefined}
        />
        <StatCard
          label="Net assets"
          icon={Scale}
          hue="grape"
          value={position.state === "ready" ? compact(position.data.totalAssets - position.data.totalLiabilities, baseCurrency) : position.state === "hidden" ? "—" : "…"}
          hint={position.state === "ready" ? (position.data.balanced ? "Books balance" : "Books do not balance") : undefined}
          href={can.reports ? "/suite/finance/reports/balance-sheet" : undefined}
        />
        <StatCard
          label="Waiting on someone"
          icon={NotebookPen}
          hue="sun"
          value={queue.state === "ready" || statements.state === "ready" ? String(waitingCount) : "…"}
          hint="Journals and statements"
          href={can.journals ? "/suite/finance/journals?status=pending_approval" : undefined}
        />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {banks.state !== "hidden" && (
          <Panel
            title="Cash position"
            subtitle="Book balance against the last statement balance, per account"
            icon={Landmark}
            hue="sky"
            className="xl:col-span-2"
            actions={
              <Link href="/suite/finance/banking" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                Banking <ArrowRight size={14} aria-hidden />
              </Link>
            }
            bodyClassName="px-3 pb-3 pt-2"
          >
            {banks.state === "loading" && <Skeleton className="m-2 h-40" />}
            {banks.state === "error" && <ErrorNote className="m-2">{banks.message}</ErrorNote>}
            {banks.state === "ready" && bankList.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-neutral-500">No bank accounts yet. Add one under Banking to see cash here.</p>
            )}
            {banks.state === "ready" && bankList.length > 0 && (
              <ul className="divide-y divide-neutral-100">
                {bankList.map((b) => (
                  <BankRow key={b.id} bank={b} trend={trends[b.id]} />
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="Work waiting" subtitle="What needs a decision or a finish" icon={CheckCircle2} hue="sun" bodyClassName="px-3 pb-3 pt-2" className={banks.state === "hidden" ? "xl:col-span-3" : undefined}>
          {(queue.state === "loading" || statements.state === "loading") && waiting.length === 0 ? (
            <Skeleton className="m-2 h-40" />
          ) : waiting.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <IconTile icon={CheckCircle2} hue="mint" size={44} />
              <p className="text-sm font-semibold text-neutral-900">Nothing waiting</p>
              <p className="text-xs text-neutral-500">Every journal is posted and every statement reviewed.</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {waiting.slice(0, 8).map((w) => (
                <li key={w.key}>
                  <Link href={w.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300">
                    <IconTile icon={w.icon} hue={w.hue} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{w.title}</span>
                      <span className="block truncate text-xs text-neutral-500">{w.meta}</span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-neutral-400" aria-hidden />
                  </Link>
                </li>
              ))}
              {waiting.length > 8 && <li className="px-2 pt-2 text-xs text-neutral-500">and {waiting.length - 8} more</li>}
            </ul>
          )}
        </Panel>
      </div>

      {income.state !== "hidden" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel
            title="Income and expenditure"
            subtitle={monthly.length ? `${monthLabel(monthly[0].month, true)} to ${monthLabel(monthly[monthly.length - 1].month, true)}` : "By month"}
            icon={BookOpenCheck}
            hue="mint"
            className="xl:col-span-2"
            actions={<Legend items={[{ label: "Income", hue: "mint" }, { label: "Expenditure", hue: "coral" }]} />}
          >
            {income.state === "loading" && <Skeleton className="h-56" />}
            {income.state === "error" && <ErrorNote>{income.message}</ErrorNote>}
            {income.state === "ready" && (
              <GroupedColumns
                data={monthly.map((m) => ({ label: monthLabel(m.month, true).split(" ")[0], values: { income: m.income, spend: spend(m) } }))}
                series={[
                  { key: "income", label: "Income", hue: "mint" },
                  { key: "spend", label: "Expenditure", hue: "coral" },
                ]}
                format={(v) => compact(v, baseCurrency)}
                caption="Income and expenditure by month"
                height={230}
              />
            )}
          </Panel>
          <Panel title="Where the money went" subtitle="Expenditure by group, year to date" icon={Wallet} hue="coral">
            {income.state === "loading" && <Skeleton className="h-56" />}
            {income.state === "error" && <ErrorNote>{income.message}</ErrorNote>}
            {income.state === "ready" &&
              (mix.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-500">No expenditure posted this year yet.</p>
              ) : (
                <Donut
                  data={mix}
                  size={170}
                  legend="below"
                  total={compact(mix.reduce((s, d) => s + d.value, 0), baseCurrency)}
                  centerLabel="spent"
                  caption="Expenditure by group"
                />
              ))}
          </Panel>
        </div>
      )}

      {position.state !== "hidden" && (
        <div className="mt-6">
          <Panel
            title="Financial position"
            subtitle={position.state === "ready" ? `As at ${day(position.data.asAt)}` : undefined}
            icon={Scale}
            hue="grape"
            actions={
              position.state === "ready" &&
              (position.data.balanced ? (
                <Chip hue="mint" icon={CheckCircle2}>
                  Balanced
                </Chip>
              ) : (
                <Chip hue="rose" icon={TriangleAlert}>
                  Does not balance
                </Chip>
              ))
            }
          >
            {position.state === "loading" && <Skeleton className="h-28" />}
            {position.state === "error" && <ErrorNote>{position.message}</ErrorNote>}
            {position.state === "ready" && <PositionEquation bs={position.data} />}
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BankRow({ bank: b, trend }: { bank: BankLite; trend?: number[] }) {
  const diff = b.bankBalance === null ? null : b.bankBalance - b.bookBalance;
  const low = b.lowBalanceThreshold !== null && b.lowBalanceThreshold > 0 && b.bookBalance < b.lowBalanceThreshold;
  return (
    <li>
      <Link
        href={`/suite/finance/banking/${b.id}`}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl px-2 py-3 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300 sm:grid-cols-[auto_1fr_auto_auto]"
      >
        <IconTile icon={Landmark} hue={b.currency === "NGN" ? "sky" : "grape"} size={38} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-neutral-900">{b.name}</span>
          <span className="block truncate text-xs text-neutral-500">
            {[b.number, b.glAccount?.code, b.currency].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="hidden sm:block">
          {trend && trend.length > 1 ? (
            <Sparkline values={trend} hue={b.currency === "NGN" ? "sky" : "grape"} width={96} height={30} label={`${b.name} month-end book balance this year`} format={(v) => compact(v)} />
          ) : (
            <span className="block w-24" aria-hidden />
          )}
        </span>
        <span className="text-right">
          <span className="block text-[15px] font-bold tabular-nums text-neutral-900">{amount(b.bookBalance, b.currency)}</span>
          <span className="block text-xs tabular-nums text-neutral-500">
            {b.bankBalance === null ? "No statement yet" : `Bank ${amount(b.bankBalance, b.currency)}${b.bankBalanceDate ? ` on ${day(b.bankBalanceDate)}` : ""}`}
          </span>
        </span>
        {(low || (diff !== null && diff !== 0) || diff === 0) && (
          <span className="col-span-3 flex flex-wrap gap-1.5 pl-[50px] sm:col-span-4">
            {diff !== null && diff !== 0 && (
              <Chip hue="sun" icon={TriangleAlert} className="!py-0.5 !text-[11px]">
                Bank differs by {amount(Math.abs(diff), b.currency)}
              </Chip>
            )}
            {diff === 0 && (
              <Chip hue="mint" icon={CheckCircle2} className="!py-0.5 !text-[11px]">
                Agrees with the bank
              </Chip>
            )}
            {low && (
              <Chip hue="rose" icon={TriangleAlert} className="!py-0.5 !text-[11px]">
                Below the {compact(b.lowBalanceThreshold, b.currency)} floor
              </Chip>
            )}
            {b.unreconciledCount > 0 && (
              <Chip hue="slate" className="!py-0.5 !text-[11px]">
                {b.unreconciledCount} statement lines not in the books
              </Chip>
            )}
          </span>
        )}
      </Link>
    </li>
  );
}

/** Assets = liabilities + net assets, written out and drawn as two bars of one length. */
function PositionEquation({ bs }: { bs: BalanceSheet }) {
  const c = bs.currency;
  const assets = Math.max(1, bs.totalAssets);
  const liab = Math.max(0, bs.totalLiabilities);
  const eq = Math.max(0, bs.totalEquity);
  const scale = Math.max(assets, liab + eq);
  const pct = (v: number) => `${Math.max(0, (v / scale) * 100)}%`;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
      <dl className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2 text-center">
        <div>
          <dt className="text-xs font-medium text-neutral-500">Assets</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-neutral-900 sm:text-xl">{compact(bs.totalAssets, c)}</dd>
        </div>
        <span className="pb-1 text-lg font-semibold text-neutral-400" aria-hidden>
          =
        </span>
        <div>
          <dt className="text-xs font-medium text-neutral-500">Liabilities</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-neutral-900 sm:text-xl">{compact(bs.totalLiabilities, c)}</dd>
        </div>
        <span className="pb-1 text-lg font-semibold text-neutral-400" aria-hidden>
          +
        </span>
        <div>
          <dt className="text-xs font-medium text-neutral-500">Net assets</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-neutral-900 sm:text-xl">{compact(bs.totalEquity, c)}</dd>
        </div>
      </dl>
      <div className="space-y-2.5" aria-hidden>
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-neutral-500">What we own</span>
          <div className="ws-hatch flex h-4 flex-1 overflow-hidden rounded-full">
            <span className="h-full rounded-full bg-sky-500" style={{ width: pct(bs.totalAssets) }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-neutral-500">How it is funded</span>
          <div className="ws-hatch flex h-4 flex-1 gap-0.5 overflow-hidden rounded-full">
            <span className="h-full rounded-l-full bg-coral-500" style={{ width: pct(liab) }} />
            <span className={cx("h-full bg-grape-500", liab === 0 ? "rounded-full" : "rounded-r-full")} style={{ width: pct(eq) }} />
          </div>
        </div>
        <Legend
          items={[
            { label: "Assets", hue: "sky" },
            { label: "Liabilities", hue: "coral" },
            { label: `Net assets (incl. ${compact(bs.unclosedSurplus, c)} unclosed surplus)`, hue: "grape" },
          ]}
        />
      </div>
    </div>
  );
}
