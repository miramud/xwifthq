"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, BookOpen, FileSignature, HandCoins, Printer, ReceiptText, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { revenue, revenueError, type InvoiceDetail as Invoice } from "@/lib/api/finance-revenue-client";
import { Button, Card, Empty, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { BackLink, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import ReasonDialog from "../vouchers/ReasonDialog";
import { amountInWords } from "../vouchers/words";
import InvoiceEditor, { InvoiceTotalsList } from "./InvoiceEditor";
import { onlyRetention, pct, share } from "./meta";
import { DocNo, InvoiceStatusChip, LateChip, RetentionChip, VoidedNote, stamp } from "./ui";
import TranchesPanel from "./TranchesPanel";
import SendTo from "@/suite/org/components/foundations/SendTo";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * One invoice. A draft opens in the editor; anything issued is shown the
 * way the client reads it - number, client, lines and totals - with what is
 * still open on it (the trade balance and the retention held), the receipts
 * applied, and the journal it posted. From here it is printed, a receipt is
 * recorded against it, or (while nothing is paid) it is voided.
 *
 * An invoice billed in several currencies shows each tranche - its totals,
 * rate and what is still owed on it, in its own money - and the invoice's
 * headline figures as base equivalents at the booked rates.
 */

const when = stamp;

export default function InvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const load = useCallback(() => {
    revenue.invoices.get(id).then(
      (i) => {
        setInvoice(i);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(revenueError(e, "The invoice didn't load.")),
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load, reload]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/revenue/invoices" label="All invoices" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!invoice)
    return (
      <div className="space-y-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-72" />
      </div>
    );
  if (invoice.status === "draft") return <InvoiceEditor invoiceId={id} />;
  return <InvoiceView invoice={invoice} onChanged={() => setReload((n) => n + 1)} />;
}

function InvoiceView({ invoice: inv, onChanged }: { invoice: Invoice; onChanged: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const [voiding, setVoiding] = useState(false);
  const [notice, setNotice] = useState<string | null>(() => (params?.get("notice") === "issued" ? "Invoice issued. It is numbered and posted to the ledger." : null));
  const cur = inv.currency as CurrencyCode;
  const open = inv.status === "issued" || inv.status === "part_paid";
  const canVoid = inv.status === "issued" && inv.settled === 0 && mayDo(user, "invoices", "void");
  const canReceive = open && mayDo(user, "receipts", "create");
  const payNow = inv.total - inv.retention - inv.expectedWht;
  const wht = inv.receipts.reduce((s, r) => s + r.wht, 0);
  const cash = inv.receipts.reduce((s, r) => s + r.cash + r.retention, 0);
  const multi = Boolean(inv.multiCurrency) && (inv.tranches?.length ?? 0) > 1;
  const tranches = inv.tranches ?? [];
  const base = inv.baseCurrency ?? (multi ? inv.currency : "NGN");
  const showRates = multi || tranches.some((t) => t.currency !== base);
  const inOwn = (v: number, c?: string) => (multi ? amount(v, (c ?? cur) as CurrencyCode) : accounting(v));

  return (
    <div>
      <BackLink href="/suite/finance/revenue/invoices" label="All invoices" />
      <Notice text={notice} />

      <Card className="relative mb-5 overflow-hidden p-5 sm:p-6">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-600 via-sky-500 to-mint-500" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Invoice</p>
            <h1 className="mt-2">
              <span className="sr-only">Invoice </span>
              <DocNo value={inv.invoiceNo} size="xl" />
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <InvoiceStatusChip status={inv.status} />
              {onlyRetention(inv) ? <RetentionChip /> : <LateChip days={inv.daysLate} />}
              <span className="text-sm text-neutral-500">
                Dated {day(inv.date)} · due {day(inv.dueOn)}
              </span>
            </div>
            {(inv.issuedAt || inv.issuedBy) && (
              <p className="mt-1.5 text-xs text-neutral-500">
                Issued{inv.issuedAt ? ` ${when(inv.issuedAt)}` : ""}
                {inv.issuedBy ? ` by ${inv.issuedBy}` : ""}.
              </p>
            )}
            <p className="mt-4 text-sm text-neutral-500">Billed to</p>
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-neutral-900">
              <UserRound size={17} className="text-neutral-400" aria-hidden />
              <Link href={`/suite/finance/revenue/clients/${inv.clientId}`} className="hover:text-primary-700 hover:underline">
                {inv.client ?? "Client"}
              </Link>
            </p>
            <SendTo counterpartyId={inv.clientId} className="mt-1" />
            {(inv.project || inv.contract) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-neutral-600">
                <FileSignature size={14} className="text-neutral-400" aria-hidden />
                {inv.contract && inv.project ? (
                  <Link href={`/suite/finance/revenue/contracts/${inv.project.id}`} className="hover:text-primary-700 hover:underline">
                    {inv.contract.title}
                  </Link>
                ) : (
                  inv.contract?.title
                )}
                {inv.project && (
                  <span className="text-neutral-500">
                    {inv.contract ? "· " : ""}
                    {inv.project.code && <span className="font-mono">{inv.project.code} </span>}
                    {inv.project.name}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="lg:max-w-sm lg:text-right">
            <p className="text-sm text-neutral-500">{open ? "Outstanding" : "Invoice total"}</p>
            {multi ? (
              <>
                <ul className="space-y-0.5">
                  {tranches.map((t) => (
                    <li key={t.id} className="text-[26px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">
                      {amount(open ? t.outstanding : t.total, t.currency as CurrencyCode)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-sm text-neutral-600">
                  {amount(open ? inv.outstanding : inv.total, cur)} in {base} at the booked rates
                </p>
              </>
            ) : (
              <>
                <p className="text-[32px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">{amount(open ? inv.outstanding : inv.total, cur)}</p>
                <p className="mt-1 text-sm italic text-neutral-600">{amountInWords(open ? inv.outstanding : inv.total, cur)}</p>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
              <a href={revenue.invoices.pdfUrl(inv.id)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                <Printer size={15} aria-hidden />
                Print
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {inv.journalId && (
                <Link href={`/suite/finance/journals/${inv.journalId}`} className={buttonClass("ghost", "sm")}>
                  <BookOpen size={15} aria-hidden />
                  Journal
                </Link>
              )}
              {canVoid && (
                <Button size="sm" variant="ghost" icon={Ban} onClick={() => setVoiding(true)}>
                  Void
                </Button>
              )}
              {canReceive && (
                <Link href={`/suite/finance/revenue/receipts/new?client=${inv.clientId}&invoice=${inv.id}`} className={buttonClass("primary", "sm")}>
                  <HandCoins size={15} aria-hidden />
                  Record a receipt
                </Link>
              )}
            </div>
          </div>
        </div>
        {inv.status === "part_paid" && mayDo(user, "invoices", "void") && (
          <p className="mt-4 text-xs text-neutral-500">Money has been received against this invoice, so it can&apos;t be voided. Void its receipts first.</p>
        )}
      </Card>

      {inv.status === "void" && (
        <VoidedNote className="mb-5" at={inv.voidedAt} by={inv.voidedBy} reason={inv.voidReason}>
          Its journal was reversed, and {inv.invoiceNo ?? "its number"} stays in the register so the sequence has no gaps.
        </VoidedNote>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Panel title="Lines" icon={ReceiptText} bodyClassName="p-0">
            <ul className="divide-y divide-neutral-100">
              {inv.lines.map((l, i) => (
                <li key={l.id} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[2rem_minmax(0,1fr)_8rem_9rem] sm:items-baseline sm:gap-3">
                  <span className="hidden text-xs font-semibold tabular-nums text-neutral-400 sm:block">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-900">{l.description}</span>
                    <span className="block text-xs text-neutral-500">{l.account ?? "No account"}</span>
                  </span>
                  <span className="text-xs tabular-nums text-neutral-500 sm:text-right">
                    VAT {pct(l.vatRateBp)} · {inOwn(l.vat, l.currency)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-neutral-900 sm:text-right">{inOwn(l.amount, l.currency)}</span>
                </li>
              ))}
            </ul>
            {inv.notes && <RichTextView value={inv.notes} size="sm" className="border-t border-neutral-100 px-5 py-3.5 text-neutral-600" />}
          </Panel>

          <Panel title="Receipts applied" icon={HandCoins} hue="mint" bodyClassName="p-0">
            {inv.receipts.length === 0 ? (
              <Empty
                icon={HandCoins}
                title="Nothing received yet"
                hint={open ? "When the client pays, record the money and spread it over this invoice." : "No money was applied to this invoice."}
                action={
                  canReceive && (
                    <Link href={`/suite/finance/revenue/receipts/new?client=${inv.clientId}&invoice=${inv.id}`} className={buttonClass("secondary", "sm")}>
                      Record a receipt
                    </Link>
                  )
                }
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {inv.receipts.map((r) => (
                  <li key={r.receiptId} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3.5">
                    <span>
                      <Link href={`/suite/finance/revenue/receipts/${r.receiptId}`} className="hover:underline">
                        <DocNo value={r.receiptNo} />
                      </Link>
                      <span className="ml-2 text-xs text-neutral-500">{day(r.date)}</span>
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      <span className="font-semibold text-neutral-900">{amount(r.cash + r.retention, (r.currency ?? cur) as CurrencyCode)}</span>
                      {(r.wht > 0 || r.retention > 0) && (
                        <span className="block text-xs text-neutral-500">
                          {r.wht > 0 && `WHT ${accounting(r.wht)}`}
                          {r.wht > 0 && r.retention > 0 && " · "}
                          {r.retention > 0 && `retention released ${accounting(r.retention)}`}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
                {!multi && (
                <li className="flex justify-between gap-3 bg-neutral-50/70 px-5 py-3 text-sm">
                  <span className="text-neutral-600">Received {wht > 0 ? "and WHT deducted" : ""}</span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {accounting(cash)}
                    {wht > 0 && <span className="font-normal text-neutral-500"> + {accounting(wht)}</span>}
                  </span>
                </li>
                )}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-neutral-900">Totals</h2>
            {multi ? (
              tranches.map((t) => (
                <section key={t.id} aria-label={`Totals in ${t.currency}`} className="mt-4 border-t border-neutral-100 pt-3 first-of-type:border-t-0 first-of-type:pt-0">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">In {t.currency}</h3>
                  <InvoiceTotalsList
                    totals={{ subtotal: t.subtotal, vat: t.vat, total: t.total, retention: t.retention, expectedWht: t.expectedWht, payNow: t.total - t.retention - t.expectedWht }}
                    retentionBp={inv.retentionBp}
                    whtBp={inv.expectedWhtBp}
                    currency={t.currency as CurrencyCode}
                  />
                </section>
              ))
            ) : (
              <InvoiceTotalsList
                totals={{ subtotal: inv.subtotal, vat: inv.vat, total: inv.total, retention: inv.retention, expectedWht: inv.expectedWht, payNow }}
                retentionBp={inv.retentionBp}
                whtBp={inv.expectedWhtBp}
                currency={cur}
              />
            )}
          </Card>
          {showRates && <TranchesPanel invoice={inv} base={base} />}
          {inv.open && multi && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold text-neutral-900">Still open</h2>
              {tranches.map((t) =>
                t.open ? (
                  <div key={t.id}>
                    <OpenBar label={`To pay now, ${t.currency}`} open={t.open.trade} whole={t.total - t.retention} currency={t.currency as CurrencyCode} />
                    {t.retention > 0 && <OpenBar label={`Retention held, ${t.currency}`} open={t.open.retention} whole={t.retention} currency={t.currency as CurrencyCode} />}
                  </div>
                ) : null,
              )}
            </Card>
          )}
          {inv.open && !multi && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold text-neutral-900">Still open</h2>
              <OpenBar label="To pay now" open={inv.open.trade} whole={inv.total - inv.retention} currency={cur} />
              {inv.retention > 0 && <OpenBar label="Retention held" open={inv.open.retention} whole={inv.retention} currency={cur} />}
            </Card>
          )}
        </aside>
      </div>

      {voiding && (
        <ReasonDialog
          title={`Void ${inv.invoiceNo ?? "this invoice"}?`}
          subtitle="Its journal is reversed and the invoice stays in the register marked void. Raise a fresh invoice if the client still owes."
          label="Why it is voided"
          confirmLabel="Void invoice"
          busyLabel="Voiding…"
          tone="danger"
          onConfirm={async (reason) => {
            await revenue.invoices.void(inv.id, reason);
            setVoiding(false);
            setNotice(`${inv.invoiceNo ?? "Invoice"} voided. Its journal is reversed.`);
            onChanged();
            router.refresh();
          }}
          onClose={() => setVoiding(false)}
        />
      )}
    </div>
  );
}

/** What is left of a part, as a bar: settled solid, still open hatched. */
function OpenBar({ label, open, whole, currency }: { label: string; open: number; whole: number; currency: CurrencyCode }) {
  const settled = Math.max(0, whole - open);
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-neutral-600">{label}</span>
        <span className="font-semibold tabular-nums text-neutral-900">{amount(open, currency)}</span>
      </div>
      <div className="ws-hatch mt-2 h-2 overflow-hidden rounded-full" aria-hidden>
        <span className={cx("block h-full rounded-full bg-mint-500")} style={{ width: `${share(settled, whole)}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {amount(settled, currency)} of {amount(whole, currency)} settled
      </p>
    </div>
  );
}
