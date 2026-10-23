"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ban, BookOpen, Download, FileCheck2, FileClock, HandCoins, Landmark, Link2, PiggyBank, ReceiptText, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { revenue, revenueError, type ReceiptDetail as Receipt } from "@/lib/api/finance-revenue-client";
import { Button, Card, Chip, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { BackLink, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import ReasonDialog from "../vouchers/ReasonDialog";
import ApplyAdvanceDialog from "./ApplyAdvanceDialog";
import { amountInWords } from "../vouchers/words";
import { DocNo, VoidedNote } from "./ui";

/**
 * One receipt: the money that came in, the invoices it settled (cash, WHT
 * deducted and retention released on each), any advance left over, the
 * journal it posted, and - when the client deducted WHT - the credit note
 * still to collect. Cash held as an advance can be applied to the client's
 * open invoices later; each such allocation says when, with its journal. A receipt keyed in error is voided: the journal is
 * reversed and the invoices reopen.
 */

export default function ReceiptDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const [r, setR] = useState<Receipt | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<"void" | "note" | "apply" | null>(null);
  const [notice, setNotice] = useState<string | null>(() => (params?.get("notice") === "recorded" ? "Receipt recorded and posted." : null));

  const load = useCallback(() => {
    revenue.receipts.get(id).then(
      (x) => {
        setR(x);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(revenueError(e, "The receipt didn't load.")),
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load, reload]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/revenue/receipts" label="All receipts" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!r)
    return (
      <div className="space-y-4">
        <Skeleton className="h-52" />
        <Skeleton className="h-64" />
      </div>
    );

  const cur = r.currency as CurrencyCode;
  const posted = r.status === "posted";
  const canVoid = posted && mayDo(user, "receipts", "void");
  const canApply = posted && r.unallocated > 0 && mayDo(user, "receipts", "apply_advance");
  const canNote = posted && r.wht > 0 && r.whtCreditNote === "expected" && mayDo(user, "receipts", "credit_note");

  return (
    <div>
      <BackLink href="/suite/finance/revenue/receipts" label="All receipts" />
      <Notice text={notice} />

      <Card className="relative mb-5 overflow-hidden p-5 sm:p-6">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-mint-500 via-sky-500 to-primary-600" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-mint-700">Receipt</p>
            <h1 className="mt-2">
              <span className="sr-only">Receipt </span>
              <DocNo value={r.receiptNo} size="xl" />
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {posted ? <Chip hue="mint">Posted</Chip> : <Chip hue="rose" icon={Ban}>Void</Chip>}
              <span className="text-sm text-neutral-500">Received {day(r.date)}</span>
            </div>
            <p className="mt-4 text-sm text-neutral-500">From</p>
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-neutral-900">
              <UserRound size={17} className="text-neutral-400" aria-hidden />
              <Link href={`/suite/finance/revenue/clients/${r.clientId}`} className="hover:text-primary-700 hover:underline">
                {r.client}
              </Link>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-neutral-600">
              <Landmark size={14} className="text-neutral-400" aria-hidden />
              Into {r.bankAccount}
              {r.reference && <span className="font-mono text-xs text-neutral-500">· {r.reference}</span>}
            </p>
            {r.statementLineId && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                <Link2 size={13} aria-hidden /> Matched to its bank statement line.
              </p>
            )}
          </div>
          <div className="lg:max-w-sm lg:text-right">
            <p className="text-sm text-neutral-500">Received</p>
            <p className="text-[32px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">{amount(r.cash, cur)}</p>
            <p className="mt-1 text-sm italic text-neutral-600">{amountInWords(r.cash, cur)}</p>
            <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
              <a href={revenue.receipts.pdfUrl(r.id)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                <Download size={15} aria-hidden />
                Download receipt
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {r.journalId && (
                <Link href={`/suite/finance/journals/${r.journalId}`} className={buttonClass("secondary", "sm")}>
                  <BookOpen size={15} aria-hidden />
                  Journal
                </Link>
              )}
              {canVoid && (
                <Button size="sm" variant="ghost" icon={Ban} onClick={() => setDialog("void")}>
                  Void
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {!posted && (
        <VoidedNote className="mb-5" at={r.voidedAt} by={r.voidedBy} reason={r.voidReason}>
          Its journal was reversed and the invoices it settled are open again.
        </VoidedNote>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Invoices settled" icon={ReceiptText} bodyClassName="p-0">
          {r.allocations.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">Not applied to an invoice. The whole amount is held as the client&apos;s advance.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {r.allocations.map((a, i) => (
                <li key={`${a.invoiceId}-${a.appliedOn ?? "receipt"}-${i}`} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_repeat(3,8rem)] sm:items-baseline">
                  <span className="min-w-0">
                    <Link href={`/suite/finance/revenue/invoices/${a.invoiceId}`} className="hover:underline">
                      <DocNo value={a.invoiceNo} />
                    </Link>
                    {a.fromAdvance && (
                      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500">
                        <PiggyBank size={13} className="text-grape-600" aria-hidden />
                        From the advance{a.appliedOn ? ` on ${day(a.appliedOn)}` : ""}
                        {a.journalId && (
                          <Link
                            href={`/suite/finance/journals/${a.journalId}`}
                            aria-label={`Journal for the advance applied to ${a.invoiceNo ?? "this invoice"}`}
                            className="font-semibold text-primary-700 hover:underline"
                          >
                            Journal
                          </Link>
                        )}
                      </span>
                    )}
                  </span>
                  <Fig label="Cash" v={a.cash} />
                  <Fig label="WHT deducted" v={a.wht} />
                  <Fig label="Retention released" v={a.retention} />
                  {a.realisedFx ? (
                    <p className="text-xs text-neutral-500 sm:col-span-4">
                      Cleared at the booked rate {a.trancheRate}
                      {r.rate ? `, received at ${r.rate}` : ""}: realised FX {a.realisedFx > 0 ? "gain" : "loss"}{" "}
                      <span className={cx("font-semibold tabular-nums", a.realisedFx > 0 ? "text-mint-700" : "text-rose-700")}>{accounting(Math.abs(a.realisedFx))}</span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {r.realisedFx ? (
            <p className="border-t border-neutral-100 bg-neutral-50/70 px-5 py-3 text-sm text-neutral-700">
              Realised FX {r.realisedFx > 0 ? "gain" : "loss"} in base <span className="font-semibold tabular-nums">{accounting(Math.abs(r.realisedFx))}</span>
              <span className="text-neutral-500"> · posted with the receipt</span>
            </p>
          ) : null}
        </Panel>

        <aside className="space-y-5">
          {posted && r.unallocated > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
                <PiggyBank size={16} className="text-grape-600" aria-hidden />
                Held as an advance
              </h2>
              <p className="mt-1 text-[24px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">{amount(r.unallocated, cur)}</p>
              <p className="mt-1 text-sm text-neutral-600">Cash {r.client ?? "the client"} paid ahead of an invoice. Apply it when one is open.</p>
              {canApply && (
                <Button size="sm" variant="primary" icon={HandCoins} className="mt-3" onClick={() => setDialog("apply")}>
                  Apply the advance
                </Button>
              )}
            </Card>
          )}
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-neutral-900">How it was spread</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Received" v={r.cash} strong />
              <Row label="Applied to invoices" v={r.cash - r.unallocated} />
              <Row label="Of which retention released" v={r.retention} quiet />
              <Row label="Kept as the client's advance" v={r.unallocated} />
              <Row label="WHT deducted (no cash)" v={r.wht} />
            </dl>
          </Card>
          {r.wht > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
                {r.whtCreditNote === "received" ? <FileCheck2 size={16} className="text-mint-600" aria-hidden /> : <FileClock size={16} className="text-sun-600" aria-hidden />}
                WHT credit note
              </h2>
              {r.whtCreditNote === "received" ? (
                <p className="mt-2 text-sm text-neutral-700">
                  Received: <span className="font-mono">{r.whtCreditNoteRef}</span>. It can be used against tax due.
                </p>
              ) : (
                <p className="mt-2 text-sm text-neutral-700">
                  {r.client} deducted <span className="font-semibold tabular-nums">{amount(r.wht, cur)}</span>. Their credit note for it is still to come.
                </p>
              )}
              {canNote && (
                <Button size="sm" icon={FileCheck2} className="mt-3" onClick={() => setDialog("note")}>
                  Credit note received
                </Button>
              )}
            </Card>
          )}
        </aside>
      </div>

      {dialog === "void" && (
        <ReasonDialog
          title={`Void ${r.receiptNo ?? "this receipt"}?`}
          subtitle="Its journal is reversed, the invoices it settled reopen, and any statement line it matched is free again."
          label="Why it is voided"
          confirmLabel="Void receipt"
          busyLabel="Voiding…"
          tone="danger"
          onConfirm={async (reason) => {
            await revenue.receipts.void(r.id, reason);
            setDialog(null);
            setNotice(`${r.receiptNo ?? "Receipt"} voided. The invoices it settled are open again.`);
            setReload((n) => n + 1);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "apply" && (
        <ApplyAdvanceDialog
          receipt={r}
          onApplied={(fresh) => {
            setR(fresh);
            setDialog(null);
            setNotice(fresh.unallocated > 0 ? `Advance applied. ${amount(fresh.unallocated, cur)} is still held.` : "Advance applied. Nothing is held now.");
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "note" && (
        <ReasonDialog
          title="Credit note received"
          subtitle={`For the ${amount(r.wht, cur)} WHT ${r.client ?? "the client"} deducted.`}
          label="Credit note reference"
          hint="As printed on the client's WHT credit note."
          confirmLabel="Save reference"
          busyLabel="Saving…"
          single
          maxLength={120}
          onConfirm={async (reference) => {
            const res = await revenue.receipts.creditNote(r.id, reference);
            setR((x) => (x ? { ...x, whtCreditNote: res.whtCreditNote, whtCreditNoteRef: res.whtCreditNoteRef } : x));
            setDialog(null);
            setNotice("Credit note recorded.");
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function Fig({ label, v }: { label: string; v: number }) {
  return (
    <span className="flex justify-between gap-3 text-sm sm:block sm:text-right">
      <span className="text-xs text-neutral-500 sm:block">{label}</span>
      <span className="font-semibold tabular-nums text-neutral-900">{v ? accounting(v) : "-"}</span>
    </span>
  );
}

function Row({ label, v, strong, quiet }: { label: string; v: number; strong?: boolean; quiet?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={quiet ? "pl-3 text-neutral-500" : strong ? "font-semibold text-neutral-900" : "text-neutral-600"}>{label}</dt>
      <dd className={strong ? "font-bold tabular-nums text-neutral-900" : "font-semibold tabular-nums text-neutral-800"}>{accounting(v)}</dd>
    </div>
  );
}
