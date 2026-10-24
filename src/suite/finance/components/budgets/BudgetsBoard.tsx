"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, CopyPlus, FilePlus2, PiggyBank, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ButtonLink, Button, Card, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { GroupedColumns } from "@/components/workspace/charts";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { budgets, errorText, versionText, type BudgetSummary, type BudgetsIndex } from "@/lib/api/finance-budgets-client";
import { ControlsPanel } from "./ControlsPanel";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { budgetStatus, headlineVersion, inPreparation } from "./meta";

/**
 * Finance › Budgets (Finance PRD §14.2): each fiscal year's versions on a
 * line - the original, then each revision - with the one in force marked;
 * what the year's budget says about income, expense and the net; how the
 * years compare; and the controls that hold vouchers to the budget.
 */

export default function BudgetsBoard() {
  const { user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const [data, setData] = useState<BudgetsIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    budgets.list().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`Budgets didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const shownYear = year ?? data?.currentYear ?? new Date().getFullYear();
  const years = useMemo(() => {
    const s = new Set<number>((data?.budgets ?? []).map((b) => b.fiscalYear));
    if (data) [data.currentYear, data.currentYear + 1].forEach((y) => s.add(y));
    return [...s].sort((a, b) => b - a);
  }, [data]);
  const versions = useMemo(() => (data?.budgets ?? []).filter((b) => b.fiscalYear === shownYear).sort((a, b) => a.versionNo - b.versionNo), [data, shownYear]);
  const head = headlineVersion(versions);
  const preparing = inPreparation(versions);
  const approved = versions.find((b) => b.status === "approved") ?? null;
  const can = { create: mayDo(user, "budgets", "create"), control: mayDo(user, "budgets", "set_control") };

  const start = async () => {
    const revising = approved !== null;
    const ok = await confirm({
      title: revising ? `Start a revision of the FY${shownYear} budget?` : `Start the FY${shownYear} budget?`,
      body: revising
        ? `A draft copy of ${versionText(approved.version).toLowerCase()} is made for you to change, with revenue regenerated from the contract register. ${versionText(approved.version)} stays in force until the revision is approved.`
        : `A draft budget for FY${shownYear} is started, with revenue already filled in from the contract register. You add the other lines, then send it for approval.`,
      confirmLabel: revising ? "Start a revision" : "Start the budget",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setStartError(null);
    try {
      const b = await budgets.create({ fiscalYear: shownYear });
      router.push(`/suite/finance/budgets/${b.id}?tab=lines`);
    } catch (e) {
      setStartError(errorText(e));
      setBusy(false);
    }
  };

  const action = preparing ? (
    <ButtonLink href={`/suite/finance/budgets/${preparing.id}`} variant="primary" icon={ArrowRight}>
      {preparing.status === "draft" ? "Open the draft" : "Open the version in approval"}
    </ButtonLink>
  ) : can.create ? (
    <Button variant="primary" icon={approved ? CopyPlus : FilePlus2} onClick={start} disabled={!data || busy}>
      {busy ? "Starting…" : approved ? "Start a revision" : "Start the budget"}
    </Button>
  ) : null;

  const header = (
    <PageHeader
      eyebrow="Planning"
      title="Budgets"
      subtitle="The company budget for each fiscal year, against what has actually been earned and spent."
      actions={
        <>
          {data && (
            <SearchableSelect
              value={String(shownYear)}
              onChange={(v) => {
                setYear(Number(v));
                setStartError(null);
              }}
              options={years.map((y) => ({ value: String(y), label: `FY${y}`, hint: y === data.currentYear ? "This year" : undefined }))}
              aria-label="Fiscal year"
              searchPlaceholder="Search years"
              className="w-40"
            />
          )}
          {action}
        </>
      }
    />
  );

  if (error && !data)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!data)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading budgets…</p>
        <Skeleton className="mb-5 h-44" />
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const byYear = years
    .slice()
    .reverse()
    .map((y) => ({ y, b: headlineVersion(data.budgets.filter((x) => x.fiscalYear === y)) }))
    .filter((r): r is { y: number; b: BudgetSummary } => r.b !== null);
  const margin = head && head.totals.income > 0 ? Math.round((head.totals.net / head.totals.income) * 1000) / 10 : null;

  return (
    <div>
      {header}
      <Notice text={notice} />
      {startError && <ErrorNote className="mb-6">{startError}</ErrorNote>}
      <div className="space-y-6">
        <VersionLine year={shownYear} versions={versions} current={shownYear === data.currentYear} />

        {head && (
          <StatGrid cols={3}>
            <StatCard label="Income budgeted" value={compact(head.totals.income)} icon={TrendingUp} hue="mint" hint={`${versionText(head.version)}, FY${shownYear}`} />
            <StatCard label="Expense budgeted" value={compact(head.totals.expense)} icon={TrendingDown} hue="coral" hint="Cost of revenue and overheads" />
            <StatCard
              featured
              label="Net budgeted"
              value={compact(head.totals.net)}
              icon={Wallet}
              hint={margin != null ? `${margin}% of income` : head.totals.net < 0 ? "A planned deficit" : "No income budgeted"}
            />
          </StatGrid>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="Year on year" subtitle="Each year's budget in force (or its newest version): income against expense" icon={BarChart3}>
            {byYear.length === 0 ? (
              <Empty icon={PiggyBank} title="No budget yet" hint="Start this year's budget: revenue is filled in from the contract register, and you add the rest." />
            ) : (
              <GroupedColumns
                data={byYear.map(({ y, b }) => ({ label: `FY${y}`, values: { income: b.totals.income, expense: b.totals.expense } }))}
                series={[
                  { key: "income", label: "Income", hue: "mint" },
                  { key: "expense", label: "Expense", hue: "coral" },
                ]}
                format={(v) => compact(v)}
                caption="Budgeted income and expense by fiscal year"
                height={220}
              />
            )}
          </Panel>
          <ControlsPanel
            controls={data.controls}
            canSet={can.control}
            onChanged={(m) => {
              setNotice(m);
              setReload((n) => n + 1);
            }}
          />
        </div>

        <AllVersions rows={data.budgets} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The year's versions, oldest to newest, on one line                 */
/* ------------------------------------------------------------------ */

function VersionLine({ year, versions, current }: { year: number; versions: BudgetSummary[]; current: boolean }) {
  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-50" />
      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">
            FY{year} {current && <span className="ml-1 align-middle text-xs font-semibold uppercase tracking-wide text-primary-600">This year</span>}
          </h2>
          <p className="text-sm text-neutral-500">
            {versions.length === 0 ? "No version yet" : versions.length === 1 ? "1 version" : `${versions.length} versions`}
          </p>
        </div>
        {versions.length === 0 ? (
          <p className="mt-3 max-w-xl text-sm text-neutral-600">
            Nothing is budgeted for FY{year}. Start the budget: a draft opens with revenue from the contract register, you add the costs, and it goes for approval.
          </p>
        ) : (
          <ol aria-label={`FY${year} budget versions`} className="mt-5 flex gap-3 overflow-x-auto pb-1">
            {versions.map((b, i) => {
              const s = budgetStatus(b.status);
              const live = b.status === "approved";
              return (
                <li key={b.id} className="relative flex shrink-0 items-center gap-3">
                  {i > 0 && <span aria-hidden className="h-0.5 w-6 rounded-full bg-neutral-200 sm:w-10" />}
                  <Link
                    href={`/suite/finance/budgets/${b.id}`}
                    className={cx(
                      "block w-56 rounded-[1.25rem] border bg-white p-4 outline-none transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary-300 motion-reduce:hover:translate-y-0",
                      live ? "border-mint-500/50 ring-4 ring-mint-100" : b.status === "superseded" || b.status === "rejected" ? "border-neutral-200 opacity-80" : "border-neutral-200",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-neutral-900">{versionText(b.version)}</span>
                      <Chip hue={s.hue} icon={s.icon} className="!px-2 !py-0.5 text-[11px]">
                        {live ? "In force" : s.label}
                      </Chip>
                    </span>
                    <span className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">Net</span>
                    <span className={cx("block text-xl font-bold tabular-nums tracking-tight", b.totals.net < 0 ? "text-rose-700" : "text-neutral-900")}>{compact(b.totals.net)}</span>
                    <span className="mt-1 block truncate text-xs text-neutral-500">
                      {b.status === "approved" && b.approvedAt ? `Approved ${day(b.approvedAt)}` : b.createdBy ? `Started by ${b.createdBy}` : b.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}

function AllVersions({ rows }: { rows: BudgetSummary[] }) {
  const columns: Column<BudgetSummary>[] = [
    {
      key: "name",
      header: "Budget",
      primary: true,
      sortable: true,
      value: (b) => `${b.fiscalYear} ${b.versionNo}`,
      render: (b) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-neutral-900">{b.name}</span>
          <span className="block text-xs text-neutral-500">
            FY{b.fiscalYear} · {versionText(b.version)}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (b) => budgetStatus(b.status).label,
      render: (b) => {
        const s = budgetStatus(b.status);
        return (
          <Chip hue={s.hue} icon={s.icon}>
            {s.label}
          </Chip>
        );
      },
    },
    { key: "income", header: "Income", align: "right", sortable: true, value: (b) => b.totals.income, render: (b) => <Money value={b.totals.income} /> },
    { key: "expense", header: "Expense", align: "right", sortable: true, value: (b) => b.totals.expense, render: (b) => <Money value={b.totals.expense} /> },
    { key: "net", header: "Net", align: "right", sortable: true, value: (b) => b.totals.net, render: (b) => <Money value={b.totals.net} className="font-semibold" /> },
    { key: "by", header: "Started by", hideOnMobile: true, sortable: true, value: (b) => b.createdBy ?? "" },
  ];
  /* Every version as listed, after the search and the sort. */
  const exportCsv = (list: BudgetSummary[]) =>
    downloadCsv("budgets.csv", [
      ["Fiscal year", "Budget", "Version", "Status", "Currency", "Income", "Expense", "Net", "Started by", "Approved on"],
      ...list.map((b) => [b.fiscalYear, b.name, versionText(b.version), budgetStatus(b.status).label, b.currency || "NGN", csvAmount(b.totals.income), csvAmount(b.totals.expense), csvAmount(b.totals.net), b.createdBy ?? "", csvDate(b.approvedAt)]),
    ]);

  return (
    <section aria-labelledby="bud-all">
      <h2 id="bud-all" className="mb-3 flex items-center gap-2 text-base font-bold tracking-tight text-neutral-900">
        <Scale size={16} className="text-neutral-400" aria-hidden />
        Every version
      </h2>
      {rows.length === 0 ? (
        <Card>
          <Empty icon={PiggyBank} title="No budgets yet" hint="Each year's original and its revisions are kept here, approved or not." />
        </Card>
      ) : (
        <DataView rows={rows} columns={columns} rowKey={(b) => b.id} rowHref={(b) => `/suite/finance/budgets/${b.id}`} views={["table", "list"]} storageKey="finance.budgets.all" caption="Budget versions" searchPlaceholder="Search budgets" onDownload={exportCsv} />
      )}
    </section>
  );
}
