"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CalendarClock, Coins, FileText, Hash, Info, LineChart, Percent, Shapes, Tag, Trash2, TrendingDown, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Card, Chip, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { BackLink, InfoList, InfoRow, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day, monthLabel } from "@/suite/finance/lib/format";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { errorText, fixedAssets, monthsLeft, rateText, type AssetBookDetail, type ScheduleMonth } from "@/lib/api/finance-assets-client";
import { ChargeValueChart } from "./ChargeValueChart";
import { DisposeDialog } from "./FixedAssetDialogs";
import { SOURCE_LABEL, bookStatus } from "./meta";

/**
 * One asset on the books: what it cost, what each posted month charged and
 * the value it left, the months still to come at today's rate, and its
 * disposal. An asset Operations holds is disposed of there.
 */

const nextKey = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Posted months, then the months to come at the book's monthly charge until it reaches its residual (at most `limit`). Pure. */
export function scheduleWithProjection(b: Pick<AssetBookDetail, "schedule" | "cost" | "residual" | "accumulated" | "monthly" | "status" | "capitalisedOn">, limit = 24): { rows: (ScheduleMonth & { projected: boolean })[]; firstProjected: number | null } {
  const rows = b.schedule.map((s) => ({ ...s, projected: false }));
  if (b.status !== "active" || b.monthly <= 0) return { rows, firstProjected: null };
  let acc = b.accumulated;
  let key = rows.length ? rows[rows.length - 1].month : (b.capitalisedOn ?? "").slice(0, 7);
  if (!key) return { rows, firstProjected: null };
  const first = rows.length;
  for (let i = 0; i < limit && acc < b.cost - b.residual; i++) {
    key = nextKey(key);
    const charge = Math.min(b.monthly, b.cost - b.residual - acc);
    acc += charge;
    rows.push({ month: key, charge, accumulated: acc, nbv: b.cost - acc, projected: true });
  }
  return { rows, firstProjected: rows.length > first ? first : null };
}

export default function FixedAssetDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [book, setBook] = useState<AssetBookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [disposing, setDisposing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fixedAssets.get(id).then(
      (b) => {
        if (!alive) return;
        setBook(b);
        setError(null);
      },
      (e: unknown) => alive && setError(`The asset didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const plan = useMemo(() => (book ? scheduleWithProjection(book) : { rows: [], firstProjected: null }), [book]);

  if (error && !book)
    return (
      <div>
        <BackLink href="/suite/finance/fixed-assets" label="Fixed assets" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!book)
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the asset…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const s = bookStatus(book.status);
  const fromOps = book.source === "ops_asset";
  const canDispose = mayDo(user, "fixed_assets", "dispose") && book.status !== "disposed" && !fromOps;
  const left = monthsLeft(book);
  const writtenPct = book.cost > 0 ? Math.round((book.accumulated / book.cost) * 100) : 0;

  const columns: Column<ScheduleMonth & { projected: boolean }>[] = [
    {
      key: "month",
      header: "Month",
      primary: true,
      sortable: true,
      value: (r) => r.month,
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold text-neutral-900">{monthLabel(r.month)}</span>
          {r.projected && <Chip hue="slate">Forecast</Chip>}
        </span>
      ),
    },
    { key: "charge", header: "Charge", align: "right", sortable: true, value: (r) => r.charge, render: (r) => <Money value={r.charge} /> },
    { key: "acc", header: "Accumulated", align: "right", sortable: true, value: (r) => r.accumulated, render: (r) => <Money value={r.accumulated} className="text-neutral-600" /> },
    { key: "nbv", header: "Net book value", align: "right", sortable: true, value: (r) => r.nbv, render: (r) => <Money value={r.nbv} className="font-semibold text-neutral-900" /> },
  ];

  return (
    <div>
      <BackLink href="/suite/finance/fixed-assets" label="Fixed assets" />
      <PageHeader
        eyebrow={book.tag ?? "Fixed asset"}
        title={book.description}
        subtitle={`${book.class ?? "Asset"} · ${SOURCE_LABEL[book.source ?? ""] ?? "On the books"}`}
        actions={
          <>
            <Chip hue={s.hue} icon={s.icon}>
              {s.label}
            </Chip>
            {canDispose && (
              <Button variant="danger" icon={Trash2} onClick={() => setDisposing(true)}>
                Dispose of it
              </Button>
            )}
          </>
        }
      />
      <Notice text={notice} />

      {fromOps && book.status !== "disposed" && (
        <p className="mb-5 flex items-start gap-2 rounded-2xl border border-sky-500/25 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            This asset is on the Operations register, so it is disposed of there, with the MD&apos;s approval; the books follow.
            {book.assetRef && (
              <>
                {" "}
                <Link href={`/suite/operations/assets/${book.assetRef}`} className="font-semibold underline">
                  Open it in Operations
                </Link>
              </>
            )}
          </span>
        </p>
      )}

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Net book value" value={compact(book.status === "disposed" ? 0 : book.nbv)} icon={Wallet} hint={book.status === "disposed" ? "Disposed of" : `${100 - writtenPct}% of cost left`} />
          <StatCard label="Cost" value={compact(book.cost)} icon={Coins} hue="sky" hint={book.residual ? `Residual ${compact(book.residual)}` : "No residual value"} />
          <StatCard label="Depreciated" value={compact(book.accumulated)} icon={TrendingDown} hue="coral" hint={`${writtenPct}% written off`} />
          <StatCard label="A month" value={compact(book.monthly)} icon={CalendarClock} hue="grape" hint={left != null ? `${left} months to go` : s.label} />
        </StatGrid>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="Depreciation schedule" subtitle={plan.firstProjected != null ? "Posted months, then what is to come at today's rate" : "Each posted month and the value it left"} icon={LineChart}>
            {plan.rows.length === 0 ? (
              <Empty icon={LineChart} title="Nothing charged yet" hint="The first charge is in the month after the asset was capitalised, once that month's run is posted." />
            ) : (
              <ChargeValueChart
                data={plan.rows.map((r) => ({ label: monthLabel(r.month, true), charge: r.charge, nbv: r.nbv }))}
                marker={plan.firstProjected ?? undefined}
                format={(v) => compact(v)}
                caption={`${book.description}: monthly depreciation and net book value`}
              />
            )}
          </Panel>

          <Panel title="About it" icon={FileText} hue="grape">
            <InfoList>
              <InfoRow icon={Shapes} label="Class">
                {book.class ?? "-"}
              </InfoRow>
              <InfoRow icon={Percent} label="Rate a year">
                {rateText(book.rateBp)} straight line
              </InfoRow>
              <InfoRow icon={CalendarClock} label="Capitalised">
                {day(book.capitalisedOn)}
              </InfoRow>
              <InfoRow icon={Tag} label="Tag">
                <span className="font-mono">{book.tag ?? "-"}</span>
              </InfoRow>
              <InfoRow icon={Hash} label="Where it came from">
                {SOURCE_LABEL[book.source ?? ""] ?? book.source ?? "-"}
              </InfoRow>
              {book.status === "disposed" && (
                <InfoRow icon={Ban} label="Disposed of" hue="rose">
                  {day(book.disposedOn)} for <Money value={book.proceeds ?? 0} />
                  {book.gainLoss != null && (
                    <span className={book.gainLoss < 0 ? "block text-coral-700" : "block text-mint-700"}>
                      {book.gainLoss < 0 ? "Loss" : "Gain"} of <Money value={Math.abs(book.gainLoss)} className="!text-inherit" />
                    </span>
                  )}
                </InfoRow>
              )}
            </InfoList>
          </Panel>
        </div>

        <section aria-labelledby="fa-schedule">
          <h2 id="fa-schedule" className="mb-3 text-base font-bold tracking-tight text-neutral-900">
            Month by month
          </h2>
          {plan.rows.length === 0 ? (
            <Card>
              <Empty icon={CalendarClock} title="No months yet" hint="Posted depreciation runs show here, month by month." />
            </Card>
          ) : (
            <DataView rows={plan.rows} columns={columns} rowKey={(r) => `${r.month}-${r.projected ? "f" : "p"}`} views={["table", "list"]} storageKey="finance.fixed-assets.schedule" caption="Depreciation schedule" searchable={false} />
          )}
        </section>
      </div>

      {disposing && (
        <DisposeDialog
          book={book}
          onClose={() => setDisposing(false)}
          onDone={(b) => {
            setDisposing(false);
            setNotice(`Disposed of. ${b.gainLoss != null ? `${b.gainLoss < 0 ? "Loss" : "Gain"} of ${compact(Math.abs(b.gainLoss))} booked.` : ""}`);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
