"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, FileDown, FileSpreadsheet, Landmark, ReceiptText, Send, TriangleAlert, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Card, Chip, Empty, PageHeader, Panel, StatGrid, buttonClass } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { downloadCsv } from "@/components/workspace/csv";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount, compact, day } from "@/suite/finance/lib/format";
import { mayDo } from "@/suite/finance/lib/finance-access";
import type { CurrencyCode } from "@/lib/money";
import { errorText, splitPeriod, wht, whtRate, type WhtMonthDetail as Detail, type WhtSupplier } from "@/lib/api/finance-wht-client";
import { scheduleCsv, whtStatus } from "./meta";

/**
 * One month's WHT schedule: every voucher line whose WHT was recognised in
 * the month, by supplier, with the supplier's TIN. Raising the remittance
 * freezes these lines and sends a system memo to the tax authority with the
 * schedule attached; the memo then goes through the FCU, a voucher (coded
 * Dr WHT payable) and payment like any other.
 */
export default function WhtMonthDetail({ period }: { period: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    wht.month(period).then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`This month didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [period, reload]);

  const canRemit = mayDo(user, "wht", "remit");
  const back = (
    <Link href="/suite/finance/wht" className="mb-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-neutral-600 outline-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-primary-300">
      <ArrowLeft size={15} aria-hidden /> Withholding tax
    </Link>
  );

  if (error && !data)
    return (
      <div>
        {back}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!data)
    return (
      <div aria-busy="true">
        {back}
        <p className="sr-only">Loading the month…</p>
        <Skeleton className="mb-5 h-20" />
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const d = data;
  const cur = d.currency as CurrencyCode;
  const s = whtStatus(d.status, d.status === "due" && new Date(d.dueOn) < new Date());
  const [year, month] = splitPeriod(d.period);
  const raisable = canRemit && d.status === "due" && d.totals.wht > 0;

  const raise = async () => {
    const ok = await confirm({
      title: `Raise the WHT remittance for ${d.label}?`,
      body: (
        <>
          A payment memo for <strong>{amount(d.totals.wht, cur)}</strong> to {d.authority?.name ?? "the tax authority"} goes to the FCU with this schedule attached. The{" "}
          {d.totals.lineCount} voucher {d.totals.lineCount === 1 ? "line" : "lines"} listed are frozen into it, and the month can't be raised again.
        </>
      ),
      confirmLabel: "Raise remittance",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      const next = await wht.remit(d.period);
      setData(next);
      setNotice(`Remittance raised for ${d.label}: memo ${next.remittance?.memoReference ?? ""} is waiting for the FCU.`);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {back}
      <PageHeader
        eyebrow="Withholding tax"
        title={`WHT for ${d.label}`}
        subtitle={`Recognised when each voucher was approved. Due to the tax authority by ${day(d.dueOn)}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Chip hue={s.hue} icon={s.icon}>
              {s.label}
            </Chip>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => downloadCsv(`wht-schedule-${d.period}.csv`, scheduleCsv(d))} disabled={d.suppliers.length === 0}>
              Download CSV
            </Button>
            {raisable && (
              <Button variant="primary" icon={Send} onClick={raise} disabled={busy}>
                {busy ? "Raising…" : "Raise remittance"}
              </Button>
            )}
          </div>
        }
      />
      <Notice text={notice} />
      {actionError && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-error-500/30 bg-error-500/5 px-4 py-3 text-sm text-error-700">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {actionError}
        </p>
      )}

      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="WHT to remit" value={compact(d.totals.wht, cur)} icon={Landmark} hint={`On ${compact(d.totals.gross, cur)} gross`} />
          <StatCard label="Suppliers" value={d.suppliers.length} icon={Building2} hue="sky" hint={d.missingTin > 0 ? `${d.missingTin} without a TIN` : "All with a TIN"} />
          <StatCard label="Voucher lines" value={d.totals.lineCount} icon={ReceiptText} hue="grape" hint={d.remittance ? "Frozen in the remittance" : "Recognised so far"} />
          <StatCard label="Due by" value={day(d.dueOn)} icon={TriangleAlert} hue={s.hue === "coral" ? "coral" : "sun"} hint={d.monthEnded ? "The month has ended" : "The month is still running"} />
        </StatGrid>

        <RemittancePanel d={d} />

        {d.missingTin > 0 && (
          <p role="status" className="flex items-start gap-2 rounded-2xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm text-sun-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            {d.missingTin} {d.missingTin === 1 ? "supplier has" : "suppliers have"} no TIN on record. Add it in the vendor register so the tax authority can credit them.
          </p>
        )}

        {d.lateLines.length > 0 && (
          <p role="status" className="flex items-start gap-2 rounded-2xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm text-sun-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            {d.lateLines.length} voucher {d.lateLines.length === 1 ? "line was" : "lines were"} recognised in {d.label} after the remittance was raised ({amount(d.lateLines.reduce((t, l) => t + l.wht, 0), cur)}). They are not in it; raise them with the tax authority separately.
          </p>
        )}

        <section aria-labelledby="wht-suppliers" className="space-y-4">
          <h2 id="wht-suppliers" className="text-[15px] font-semibold text-neutral-900">
            By supplier
          </h2>
          {d.suppliers.length === 0 ? (
            <Card>
              <Empty icon={ReceiptText} title={`No WHT deducted in ${d.label}`} hint="Lines appear here when a voucher with WHT is approved in the month." />
            </Card>
          ) : (
            d.suppliers.map((sup) => <SupplierGroup key={sup.key} s={sup} currency={d.currency} year={year} month={month} />)
          )}
        </section>
      </div>
    </div>
  );
}

function RemittancePanel({ d }: { d: Detail }) {
  const r = d.remittance;

  if (!r)
    return (
      <Panel title="Remittance" subtitle={d.monthEnded ? "Not raised yet" : "Raise it once the month has ended"} icon={Send} hue="grape">
        <p className="text-sm text-neutral-600">
          Raising it sends a payment memo to {d.authority?.name ?? "the tax authority (added to your counterparties the first time)"} with this schedule attached. The voucher drawn on it is coded <strong>Dr WHT payable</strong>, with no WHT on the line.
        </p>
        {d.authority && !d.authority.hasBankAccount && (
          <p className="mt-3 flex items-start gap-2 text-sm text-sun-700">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden /> {d.authority.name} has no approved bank account yet. Add its collection account in the vendor register before the voucher is sent.
          </p>
        )}
      </Panel>
    );

  const rows: [string, React.ReactNode][] = [
    [
      "Memo",
      r.memoId ? (
        <Link href={`/suite/finance/memos/${r.memoId}`} className="font-mono text-primary-700 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
          {r.memoReference ?? "Open memo"}
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Memo status", r.memoStatus ? r.memoStatus.replace(/_/g, " ") : "—"],
    ["Raised", r.raisedAt ? `${day(r.raisedAt)}${r.raisedBy ? ` by ${r.raisedBy}` : ""}` : "—"],
    [
      "Voucher",
      r.pvId ? (
        <Link href={`/suite/finance/vouchers/${r.pvId}`} className="font-mono text-primary-700 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
          {r.pvNo}
        </Link>
      ) : (
        "Not paid yet"
      ),
    ],
    ["Bank reference", r.bankReference ?? "—"],
    ["Paid", r.paidAt ? day(r.paidAt) : "—"],
  ];

  return (
    <Panel title="Remittance" subtitle={`${amount(r.wht, d.currency as CurrencyCode)} to ${d.authority?.name ?? "the tax authority"}`} icon={Send} hue={r.status === "paid" ? "mint" : "grape"}>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{k}</dt>
            <dd className="mt-0.5 text-sm text-neutral-900">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function SupplierGroup({ s, currency, year, month }: { s: WhtSupplier; currency: string; year: number; month: number }) {
  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700" aria-hidden>
            {s.counterpartyId ? <Building2 size={18} /> : <UserRound size={18} />}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-neutral-900">{s.name}</h3>
            <p className="text-xs text-neutral-500">
              {s.tin ? (
                <>
                  TIN <span className="font-mono">{s.tin}</span>
                </>
              ) : (
                <span className="text-sun-700">No TIN on record</span>
              )}{" "}
              · {s.lineCount} {s.lineCount === 1 ? "line" : "lines"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-right">
            <span className="block text-xs text-neutral-500">WHT</span>
            <Money value={s.wht} currency={currency} className="text-base font-bold text-neutral-900" />
          </span>
          {s.counterpartyId && (
            <a href={wht.certificateUrl(s.counterpartyId, year, month)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")} aria-label={`Certificate PDF for ${s.name}`}>
              <FileDown size={15} aria-hidden /> Certificate PDF
            </a>
          )}
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">WHT lines for {s.name}</caption>
          <thead>
            <tr className="text-left text-xs font-medium text-neutral-500">
              <th scope="col" className="px-5 py-2.5">Recognised</th>
              <th scope="col" className="px-3 py-2.5">Voucher</th>
              <th scope="col" className="px-3 py-2.5">Description</th>
              <th scope="col" className="px-3 py-2.5 text-right">Gross</th>
              <th scope="col" className="px-3 py-2.5 text-right">Rate</th>
              <th scope="col" className="px-5 py-2.5 text-right">WHT</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.lineId} className="border-t border-neutral-100">
                <td className="whitespace-nowrap px-5 py-2.5 text-neutral-700">{day(l.date)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <Link href={`/suite/finance/vouchers/${l.pvId}`} className="font-mono text-xs text-primary-700 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                    {l.pvNo}
                  </Link>
                  {l.memoReference && <span className="block font-mono text-[11px] text-neutral-500">{l.memoReference}</span>}
                </td>
                <td className="px-3 py-2.5 text-neutral-700">{l.description}</td>
                <td className="px-3 py-2.5 text-right">
                  <Money value={l.gross} currency={currency} className="text-neutral-600" />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">{whtRate(l.rateBp)}</td>
                <td className="px-5 py-2.5 text-right">
                  <Money value={l.wht} currency={currency} className="font-semibold text-neutral-900" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
