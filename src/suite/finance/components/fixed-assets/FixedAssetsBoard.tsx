"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookCheck, Building2, Coins, History, Layers, LineChart, Pencil, Plus, Shapes, TrendingDown, TriangleAlert, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Card, Chip, Empty, PageHeader, Panel, Progress, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { StackedColumns } from "@/components/workspace/charts";
import { HUE } from "@/components/workspace/modules";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day, monthLabel } from "@/suite/finance/lib/format";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { errorText, fixedAssets, monthsLeft, rateText, type AssetBook, type AssetClassRow, type DepreciationRunRow, type FixedAssetsOverview } from "@/lib/api/finance-assets-client";
import { ChargeValueChart } from "./ChargeValueChart";
import { DepreciationRun } from "./DepreciationRun";
import { BookDialog, ClassDialog } from "./FixedAssetDialogs";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { SOURCE_LABEL, bookStatus, classHue, missingAccounts } from "./meta";

/**
 * Finance › Fixed assets (Finance PRD §14.1): what the organisation owns at
 * cost, what has been written off and what is left, class by class; the
 * next twelve months' charge and the value it leaves; the monthly run; and
 * every asset on the books. Assets Operations receives arrive here by
 * themselves; others are booked by hand.
 */

export default function FixedAssetsBoard() {
  const { user } = useAuth();
  const [data, setData] = useState<FixedAssetsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssetClassRow | null>(null);
  const [booking, setBooking] = useState(false);
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");

  useEffect(() => {
    let alive = true;
    fixedAssets.overview().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`Fixed assets didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const can = { create: mayDo(user, "fixed_assets", "create"), editClass: mayDo(user, "fixed_assets", "update_class"), run: mayDo(user, "fixed_assets", "run") };
  const books = useMemo(() => (data?.books ?? []).filter((b) => (!status || b.status === status) && (!classId || b.classId === classId)), [data, status, classId]);

  const header = (
    <PageHeader
      eyebrow="Ledger"
      title="Fixed assets"
      subtitle="What the organisation owns at cost, what has been depreciated, and the net book value left."
      actions={
        can.create && (
          <Button variant="primary" icon={Plus} onClick={() => setBooking(true)} disabled={!data}>
            Book an asset
          </Button>
        )
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
        <p className="sr-only">Loading fixed assets…</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <div className="mb-5 grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-80 xl:col-span-2" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const { totals } = data;
  const writtenPct = totals.cost > 0 ? Math.round((totals.accumulated / totals.cost) * 100) : 0;
  const nextYear = data.forecast.reduce((s, f) => s + f.charge, 0);
  const classesInUse = data.classes.filter((c) => c.count > 0 || c.cost > 0);
  const forecastFrom = data.forecast.findIndex((f) => !data.runs.some((r) => r.month === f.month && r.status === "posted"));
  const unmapped = data.classes.filter((c) => missingAccounts(c).length > 0 && c.count > 0);

  return (
    <div>
      {header}
      <Notice text={notice} />
      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="Net book value" value={compact(totals.nbv)} icon={Wallet} hint={`${100 - writtenPct}% of cost left`} />
          <StatCard label="Cost" value={compact(totals.cost)} icon={Coins} hue="sky" hint="Of assets not disposed of" />
          <StatCard label="Accumulated depreciation" value={compact(totals.accumulated)} icon={TrendingDown} hue="coral" hint={`${writtenPct}% written off`} />
          <StatCard label="Assets" value={totals.count} icon={Building2} hue="grape" hint={`In ${classesInUse.length} ${classesInUse.length === 1 ? "class" : "classes"}`} />
        </StatGrid>

        {unmapped.length > 0 && (
          <p role="status" className="flex items-start gap-2 rounded-2xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm text-sun-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            {unmapped.map((c) => c.name).join(", ")} {unmapped.length === 1 ? "has" : "have"} assets but no accounts set for every posting. Edit the class to set them before the next run.
          </p>
        )}

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="The next twelve months" subtitle={`About ${compact(nextYear)} of depreciation on today's books, and the value it leaves`} icon={LineChart}>
            <ChargeValueChart
              data={data.forecast.map((f) => ({ label: monthLabel(f.month, true), charge: f.charge, nbv: f.nbv }))}
              marker={forecastFrom >= 0 ? forecastFrom : undefined}
              format={(v) => compact(v)}
              caption="Forecast monthly depreciation charge and the net book value after it, for the next twelve months"
            />
          </Panel>
          <Panel title="Value by class" subtitle="Net book value, with what has been written off" icon={Shapes} hue="grape">
            {classesInUse.length === 0 ? (
              <Empty icon={Shapes} title="Nothing on the books yet" hint="Book an asset, or receive one through Operations." hue="grape" />
            ) : (
              <StackedColumns
                data={classesInUse.map((c) => ({ label: c.name, values: { nbv: c.cost - c.accumulated, dep: c.accumulated } }))}
                series={[
                  { key: "nbv", label: "Net book value", hue: "blue" },
                  { key: "dep", label: "Depreciated", hue: "slate", dashed: true },
                ]}
                format={(v) => compact(v)}
                caption="Net book value and accumulated depreciation by asset class"
                height={220}
              />
            )}
          </Panel>
        </div>

        <DepreciationRun
          runs={data.runs}
          classes={data.classes}
          canRun={can.run}
          onPosted={(m) => {
            setNotice(m);
            setReload((n) => n + 1);
          }}
        />

        <ClassesTable classes={data.classes} canEdit={can.editClass} onEdit={setEditing} />

        <section aria-labelledby="fa-books">
          <h2 id="fa-books" className="mb-3 text-[15px] font-semibold text-neutral-900">
            The books
          </h2>
          {data.books.length === 0 ? (
            <Card>
              <Empty icon={Layers} title="No assets on the books" hint="Assets Operations receives are booked here by themselves. Book older ones by hand." />
            </Card>
          ) : (
            <BooksTable
              books={books}
              toolbar={
                <div className="flex flex-wrap gap-2">
                  <SearchableSelect
                    value={classId}
                    onChange={setClassId}
                    options={data.classes.map((c) => ({ value: c.id, label: c.name }))}
                    clearable
                    clearLabel="All classes"
                    placeholder="All classes"
                    searchPlaceholder="Search classes"
                    size="sm"
                    aria-label="Class"
                    className="w-44"
                  />
                  <SearchableSelect
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: "active", label: "Depreciating" },
                      { value: "fully_depreciated", label: "Fully depreciated" },
                      { value: "disposed", label: "Disposed of" },
                    ]}
                    clearable
                    clearLabel="Any status"
                    placeholder="Any status"
                    size="sm"
                    aria-label="Status"
                    className="w-44"
                  />
                </div>
              }
            />
          )}
        </section>

        <RunsTable runs={data.runs} />
      </div>

      {editing && (
        <ClassDialog
          cls={editing}
          onClose={() => setEditing(null)}
          onDone={(m) => {
            setEditing(null);
            setNotice(m);
            setReload((n) => n + 1);
          }}
        />
      )}
      {booking && (
        <BookDialog
          classes={data.classes}
          onClose={() => setBooking(false)}
          onDone={(b) => {
            setBooking(false);
            setNotice(`${b.tag ?? b.description} booked at ${compact(b.cost)}. Its first charge is in the month after it was capitalised.`);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AccountCell({ a, missing }: { a: AssetClassRow["assetAccount"]; missing: string }) {
  return a ? (
    <span className="block min-w-0 text-xs">
      <span className="font-mono text-neutral-500">{a.code}</span> <span className="text-neutral-800">{a.name}</span>
    </span>
  ) : (
    <Chip hue="sun" icon={TriangleAlert} className="!px-2 !py-0.5 text-[11px]">
      No {missing} account
    </Chip>
  );
}

function ClassesTable({ classes, canEdit, onEdit }: { classes: AssetClassRow[]; canEdit: boolean; onEdit: (c: AssetClassRow) => void }) {
  const columns: Column<AssetClassRow>[] = [
    {
      key: "name",
      header: "Class",
      primary: true,
      sortable: true,
      value: (c) => c.name,
      render: (c) => (
        <span className="flex items-center gap-2">
          <span aria-hidden className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[classHue(c.key)].dot)} />
          <span className="font-semibold text-neutral-900">{c.name}</span>
        </span>
      ),
    },
    { key: "rate", header: "Rate a year", align: "right", sortable: true, value: (c) => c.rateBp, render: (c) => <span className="tabular-nums">{rateText(c.rateBp)}</span> },
    { key: "count", header: "Assets", align: "right", sortable: true, value: (c) => c.count },
    { key: "cost", header: "Cost", align: "right", sortable: true, hideOnMobile: true, value: (c) => c.cost, render: (c) => <Money value={c.cost} /> },
    {
      key: "nbv",
      header: "Net book value",
      align: "right",
      sortable: true,
      value: (c) => c.cost - c.accumulated,
      render: (c) => (
        <span className="block min-w-[120px]">
          <Money value={c.cost - c.accumulated} className="font-semibold text-neutral-900" />
          {c.cost > 0 && (
            <span className="mt-1 block">
              <Progress value={((c.cost - c.accumulated) / c.cost) * 100} size="sm" label={`${c.name}: value left`} />
            </span>
          )}
        </span>
      ),
    },
    { key: "asset", header: "Cost account", hideOnMobile: true, render: (c) => <AccountCell a={c.assetAccount} missing="cost" /> },
    { key: "acc", header: "Accumulated", hideOnMobile: true, render: (c) => <AccountCell a={c.accumulatedAccount} missing="accumulated" /> },
    { key: "exp", header: "Charge", hideOnMobile: true, render: (c) => <AccountCell a={c.expenseAccount} missing="charge" /> },
    ...(canEdit
      ? [
          {
            key: "edit",
            header: "Edit",
            tableOnly: true,
            render: (c: AssetClassRow) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(c);
                }}
                aria-label={`Edit ${c.name}`}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <Pencil size={15} aria-hidden />
              </button>
            ),
          } satisfies Column<AssetClassRow>,
        ]
      : []),
  ];

  return (
    <section aria-labelledby="fa-classes">
      <h2 id="fa-classes" className="mb-3 text-[15px] font-semibold text-neutral-900">
        Classes
      </h2>
      <DataView rows={classes} columns={columns} rowKey={(c) => c.id} onRowClick={canEdit ? onEdit : undefined} views={["table", "list"]} storageKey="finance.fixed-assets.classes" caption="Asset classes" searchable={false} />
    </section>
  );
}

function BooksTable({ books, toolbar }: { books: AssetBook[]; toolbar: React.ReactNode }) {
  const columns: Column<AssetBook>[] = [
    {
      key: "description",
      header: "Asset",
      primary: true,
      sortable: true,
      value: (b) => `${b.tag ?? ""} ${b.description}`,
      render: (b) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-neutral-900">{b.description}</span>
          <span className="block text-xs text-neutral-500">
            <span className="font-mono">{b.tag ?? "No tag"}</span> · {SOURCE_LABEL[b.source ?? ""] ?? b.source ?? "-"}
          </span>
        </span>
      ),
    },
    { key: "class", header: "Class", sortable: true, hideOnMobile: true, value: (b) => b.class ?? "" },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (b) => bookStatus(b.status).label,
      render: (b) => {
        const s = bookStatus(b.status);
        return (
          <Chip hue={s.hue} icon={s.icon}>
            {s.label}
          </Chip>
        );
      },
    },
    { key: "on", header: "Capitalised", sortable: true, hideOnMobile: true, value: (b) => b.capitalisedOn ?? "", render: (b) => <span className="text-sm">{day(b.capitalisedOn)}</span> },
    { key: "cost", header: "Cost", align: "right", sortable: true, value: (b) => b.cost, render: (b) => <Money value={b.cost} /> },
    { key: "acc", header: "Depreciated", align: "right", sortable: true, hideOnMobile: true, value: (b) => b.accumulated, render: (b) => <Money value={b.accumulated} className="text-neutral-600" /> },
    {
      key: "nbv",
      header: "Net book value",
      align: "right",
      sortable: true,
      value: (b) => b.nbv,
      render: (b) => (
        <span className="block min-w-[110px]">
          <Money value={b.status === "disposed" ? 0 : b.nbv} className="font-semibold text-neutral-900" />
          {b.status !== "disposed" && b.cost > 0 && (
            <span className="mt-1 block">
              <Progress value={(b.nbv / b.cost) * 100} size="sm" hue={b.status === "active" ? "blue" : "slate"} label={`${b.description}: value left`} />
            </span>
          )}
        </span>
      ),
    },
    {
      key: "monthly",
      header: "A month",
      align: "right",
      sortable: true,
      hideOnMobile: true,
      value: (b) => b.monthly,
      render: (b) => {
        const left = monthsLeft(b);
        return (
          <span className="block text-xs">
            <Money value={b.monthly} className="text-sm text-neutral-800" />
            {left != null && <span className="block text-neutral-500">{left} months to go</span>}
          </span>
        );
      },
    },
  ];
  /* The register as listed: the class and status filters, the search and the sort. */
  const exportCsv = (list: AssetBook[]) =>
    downloadCsv("fixed-assets.csv", [
      ["Tag", "Asset", "Class", "Source", "Status", "Capitalised", "Rate", "Currency", "Cost", "Residual", "Depreciated", "Net book value", "Monthly charge", "Disposed on", "Proceeds", "Gain or loss"],
      ...list.map((b) => [
        b.tag ?? "",
        b.description,
        b.class ?? "",
        SOURCE_LABEL[b.source ?? ""] ?? b.source ?? "",
        bookStatus(b.status).label,
        csvDate(b.capitalisedOn),
        rateText(b.rateBp),
        "NGN",
        csvAmount(b.cost),
        csvAmount(b.residual),
        csvAmount(b.accumulated),
        csvAmount(b.status === "disposed" ? 0 : b.nbv),
        csvAmount(b.monthly),
        csvDate(b.disposedOn),
        csvAmount(b.proceeds),
        csvAmount(b.gainLoss),
      ]),
    ]);

  return (
    <DataView
      rows={books}
      columns={columns}
      rowKey={(b) => b.id}
      rowHref={(b) => `/suite/finance/fixed-assets/${b.id}`}
      views={["table", "list"]}
      storageKey="finance.fixed-assets.books"
      caption="Assets on the books"
      searchPlaceholder="Search by tag or description"
      toolbar={toolbar}
      onDownload={exportCsv}
      empty={<Empty icon={Layers} title="Nothing matches" hint="Clear the filters to see every asset." />}
    />
  );
}

function RunsTable({ runs }: { runs: DepreciationRunRow[] }) {
  const columns: Column<DepreciationRunRow>[] = [
    { key: "month", header: "Month", primary: true, sortable: true, value: (r) => r.month, render: (r) => <span className="font-semibold text-neutral-900">{monthLabel(r.month)}</span> },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => r.status,
      render: (r) =>
        r.status === "posted" ? (
          <Chip hue="mint" dot>
            Posted
          </Chip>
        ) : (
          <Chip hue="slate" dot>
            Reversed
          </Chip>
        ),
    },
    { key: "total", header: "Charged", align: "right", sortable: true, value: (r) => r.total, render: (r) => <Money value={r.total} className={cx("font-semibold", r.status !== "posted" && "text-neutral-500 line-through")} /> },
    { key: "posted", header: "Posted", sortable: true, hideOnMobile: true, value: (r) => r.postedAt ?? "", render: (r) => <span className="text-sm">{day(r.postedAt)}</span> },
    {
      key: "journal",
      header: "Journal",
      render: (r) =>
        r.journalId ? (
          <Link
            href={`/suite/finance/journals/${r.journalId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-lg font-mono text-[13px] font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <BookCheck size={14} aria-hidden />
            {r.journalNo ?? "Open journal"}
          </Link>
        ) : (
          <span className="text-neutral-500">-</span>
        ),
    },
  ];
  return (
    <section aria-labelledby="fa-runs">
      <h2 id="fa-runs" className="mb-3 text-[15px] font-semibold text-neutral-900">
        Depreciation runs
      </h2>
      {runs.length === 0 ? (
        <Card>
          <Empty icon={History} title="No run posted yet" hint="Each month's run shows here with its journal. A month run twice keeps both: the reversed one and the one that replaced it." />
        </Card>
      ) : (
        <DataView rows={runs} columns={columns} rowKey={(r) => r.id} views={["table", "list"]} storageKey="finance.fixed-assets.runs" caption="Depreciation runs" searchable={false} />
      )}
    </section>
  );
}
