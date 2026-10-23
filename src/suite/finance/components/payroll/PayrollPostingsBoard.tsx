"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BookCheck, Clock, ExternalLink, Eye, Hourglass, Stamp, Users, Wallet, X, XCircle } from "lucide-react";
import { Button, ButtonLink, Chip, Empty, PageHeader, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ErrorNote, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { useAuth } from "@/lib/auth-store";
import { banking, errorText, type PayrollPreview, type PayrollRunRow, type PayrollWaiting } from "@/lib/api/finance-banking-client";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, compact, day } from "@/suite/finance/lib/format";
import { humanise } from "@/suite/finance/components/banking/labels";

/**
 * Payroll postings: HR approves a payroll run; Finance puts it in the books.
 * Each approved or paid run shows whether it is posted, and a preview of the
 * journal it makes - HR's lines mapped to the chart's system accounts - with
 * any line the chart cannot take yet called out before anyone sends it.
 *
 * Maker-checker: sending a run drafts its journal for a second person to
 * approve; it is in the books only once they do.
 */

/** Waiting for the second person, or turned down: never mistaken for "in the books". */
function isAwaiting(w: PayrollWaiting | null): boolean {
  return w?.status === "pending_approval";
}

const RUN_STATUS: Record<string, { label: string; hue: "sky" | "mint" | "slate" }> = {
  approved: { label: "Approved in HR", hue: "sky" },
  paid: { label: "Paid", hue: "mint" },
};

export default function PayrollPostingsBoard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PayrollRunRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<PayrollRunRow | null>(null);

  useEffect(() => {
    let alive = true;
    banking.payroll
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`Payroll runs didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = rows ?? [];
  const waiting = all.filter((r) => r.journal === null);
  const awaiting = waiting.filter((r) => isAwaiting(r.waiting)).length;
  const canPost = mayDo(user, "payroll", "post");

  const columns: Column<PayrollRunRow>[] = [
    {
      key: "period",
      header: "Payroll",
      primary: true,
      sortable: true,
      value: (r) => r.periodEnd,
      render: (r) => (
        <span className="block">
          <span className="block font-medium text-neutral-900">{r.period}</span>
          <span className="block text-xs text-neutral-500">{r.reference ?? "No reference"} · ends {day(r.periodEnd)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "In HR",
      sortable: true,
      value: (r) => r.status,
      render: (r) => {
        const s = RUN_STATUS[r.status] ?? { label: humanise(r.status), hue: "slate" as const };
        return (
          <Chip hue={s.hue} dot>
            {s.label}
          </Chip>
        );
      },
    },
    { key: "people", header: "People", align: "right", sortable: true, value: (r) => r.headcount, hideOnMobile: true, render: (r) => <span className="tabular-nums">{r.headcount}</span> },
    { key: "gross", header: "Gross pay", align: "right", sortable: true, value: (r) => r.gross, render: (r) => <span className="tabular-nums">{amount(r.gross)}</span> },
    { key: "net", header: "Net pay", align: "right", sortable: true, value: (r) => r.net, hideOnMobile: true, render: (r) => <span className="tabular-nums">{amount(r.net)}</span> },
    {
      key: "books",
      header: "In the books",
      sortable: true,
      value: (r) => (r.journal ? 2 : isAwaiting(r.waiting) ? 1 : 0),
      render: (r) =>
        r.journal ? (
          <Link href={`/suite/finance/journals/${r.journal.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-mint-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
            <BookCheck size={14} aria-hidden />
            {r.journal.journalNo ?? "Posted"}
          </Link>
        ) : isAwaiting(r.waiting) ? (
          <Chip hue="sky" icon={Hourglass}>
            Awaiting approval
          </Chip>
        ) : r.waiting?.status === "rejected" ? (
          <Chip hue="rose" icon={XCircle}>
            Rejected
          </Chip>
        ) : (
          <Chip hue="sun" icon={Clock}>
            Not posted
          </Chip>
        ),
    },
    {
      key: "preview",
      header: "Journal",
      tableOnly: true,
      render: (r) => (
        <Button size="sm" variant="ghost" icon={Eye} onClick={(e) => { e.stopPropagation(); setOpen(r); }} aria-label={`Preview the journal for ${r.period}`}>
          Preview
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader eyebrow="Banking" title="Payroll postings" subtitle="Payroll runs approved in HR. Each goes into the books as one journal, once a second person approves it." />

      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !loadError ? (
        <div aria-busy="true">
          <p className="sr-only">Loading payroll runs…</p>
          <Skeleton className="h-[360px]" />
        </div>
      ) : rows !== null && rows.length === 0 ? (
        <div className="ws-card">
          <Empty
            icon={Users}
            title="No approved payroll runs yet."
            hint="Runs appear here once they are approved in HR → Payroll. Then preview the journal and post it."
            action={
              <ButtonLink href="/suite/hrm/payroll" icon={ArrowUpRight}>
                Open HR payroll
              </ButtonLink>
            }
          />
        </div>
      ) : rows !== null ? (
        <>
          <div className="mb-5">
            <StatGrid cols={3}>
              <StatCard featured label="Waiting to be posted" value={waiting.length} icon={Clock} hint={
                  waiting.length
                    ? `${compact(waiting.reduce((s, r) => s + r.gross, 0))} gross${awaiting ? ` · ${awaiting} awaiting approval` : ""}`
                    : "Everything is in the books"
                } />
              <StatCard label="Posted" value={all.length - waiting.length} icon={BookCheck} hue="mint" />
              <StatCard label="Latest gross pay" value={compact(all[0]?.gross)} icon={Wallet} hue="grape" hint={all[0]?.period} />
            </StatGrid>
          </div>
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpen(r)}
            views={["table", "list"]}
            storageKey="finance.payroll"
            caption="Payroll runs"
            searchPlaceholder="Search by period or reference"
          />
        </>
      ) : null}

      {open && (
        <PreviewDrawer
          run={open}
          canPost={canPost}
          onClose={() => setOpen(null)}
          onPosted={() => {
            setReload((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function PreviewDrawer({ run, canPost, onClose, onPosted }: { run: PayrollRunRow; canPost: boolean; onClose: () => void; onPosted: () => void }) {
  const confirm = useConfirm();
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<PayrollWaiting | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    closeRef.current?.focus();
    banking.payroll
      .preview(run.id)
      .then((p) => alive && setPreview(p))
      .catch((e: unknown) => alive && setError(`The preview didn't load. ${errorText(e)}`));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", esc);
    return () => {
      alive = false;
      window.removeEventListener("keydown", esc);
    };
  }, [run.id]);

  const journal = preview?.journal ?? null;
  const waiting = sent ?? preview?.waiting ?? null;
  const awaiting = isAwaiting(waiting);
  const rejected = waiting?.status === "rejected";
  const blocked = (preview?.missing.length ?? 0) > 0;

  const post = async () => {
    const ok = await confirm({
      title: `Send payroll for ${run.period} for approval?`,
      body: `One journal of ${amount(preview?.debit)}, dated ${day(run.periodEnd)}, goes to a second person to approve. It is in the books once they do.`,
      confirmLabel: "Send for approval",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const j = await banking.payroll.post(run.id);
      setSent({ id: j.id, status: j.status, approvalId: j.approvalId });
      onPosted();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="fixed inset-0 cursor-default bg-neutral-900/40 backdrop-blur-sm" />
      <aside role="dialog" aria-modal="true" aria-labelledby="payroll-preview-title" className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Payroll journal</p>
            <h2 id="payroll-preview-title" className="text-lg font-bold tracking-tight text-neutral-900">
              {run.period}
            </h2>
            <p className="text-sm text-neutral-500">
              {run.headcount} people · gross {amount(run.gross)} · net {amount(run.net)}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="-m-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300">
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error && <ErrorNote>{error}</ErrorNote>}
          {journal && (
            <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">
              <BookCheck size={16} aria-hidden />
              In the books as{" "}
              <Link href={`/suite/finance/journals/${journal.id}`} className="font-semibold underline-offset-2 hover:underline">
                {journal.journalNo ?? "a posted journal"}
              </Link>
            </p>
          )}
          {!journal && awaiting && waiting && (
            <div role="status" className="rounded-xl border border-sky-500/20 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              <p className="flex items-center gap-2 font-semibold">
                <Hourglass size={16} aria-hidden />
                Waiting for a second person to approve it
              </p>
              <p className="mt-1">
                It goes into the books when they do. {waiting.approvalId ? "Whoever sent it can't approve it." : "Somebody other than the sender posts it from the journal."}
              </p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {waiting.approvalId && (
                  <Link href={`/suite/approvals/${waiting.approvalId}`} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
                    Open the approval
                    <ExternalLink size={13} aria-hidden />
                  </Link>
                )}
                <Link href={`/suite/finance/journals/${waiting.id}`} className="font-semibold underline-offset-2 hover:underline">
                  Open the journal
                </Link>
              </p>
            </div>
          )}
          {!journal && rejected && (
            <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <XCircle size={16} aria-hidden />
              The last posting was rejected. Fix what the checker raised, then send it again.
            </p>
          )}
          {blocked && !journal && (
            <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} aria-hidden />
                The chart has no account for {preview?.missing.length === 1 ? "this payroll line" : "these payroll lines"} yet
              </p>
              <ul className="mt-1.5 list-inside list-disc">
                {preview?.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-2">
                Add them in{" "}
                <Link href="/suite/finance/accounts" className="font-semibold underline">
                  Chart of accounts
                </Link>{" "}
                with the matching system account, then come back to post.
              </p>
            </div>
          )}

          {preview === null && !error ? (
            <Skeleton className="h-64" />
          ) : preview ? (
            <table className="w-full text-sm">
              <caption className="sr-only">Journal lines for payroll, {run.period}</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th scope="col" className="py-2 pr-3 font-semibold">HR line → account</th>
                  <th scope="col" className="py-2 pl-3 text-right font-semibold">Debit</th>
                  <th scope="col" className="py-2 pl-3 text-right font-semibold">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {preview.lines.map((l, i) => (
                  <tr key={`${l.label}-${i}`} className={cx(!l.account && "bg-rose-50/60")}>
                    <td className="py-2.5 pr-3">
                      <span className="block font-medium text-neutral-900">{l.label}</span>
                      <span className={cx("block text-xs", l.account ? "text-neutral-500" : "font-semibold text-rose-700")}>
                        {l.account ? `${l.account.code} · ${l.account.name}` : `No account${l.systemKey ? ` (needs ${humanise(l.systemKey)})` : ""}`}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">{l.side === "debit" ? accounting(l.amount) : ""}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">{l.side === "credit" ? accounting(l.amount) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-900/80 font-semibold text-neutral-900">
                  <th scope="row" className="py-2.5 pr-3 text-left">
                    Total
                    {preview.debit !== preview.credit && <span className="ml-2 text-xs font-semibold text-rose-700">Doesn&apos;t balance</span>}
                  </th>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{accounting(preview.debit)}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{accounting(preview.credit)}</td>
                </tr>
              </tfoot>
            </table>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Close</Button>
          {canPost && !journal && !awaiting && (
            <Button variant="primary" icon={Stamp} disabled={busy || preview === null || blocked} onClick={() => void post()}>
              {busy ? "Sending…" : rejected ? "Send again" : "Send for approval"}
            </Button>
          )}
        </footer>
      </aside>
    </div>
  );
}
