"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CircleCheckBig, ClipboardList, Hourglass, Inbox, PackageCheck, PackageOpen, Plus } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { opsError, procurement, type MeOptions } from "@/lib/api/operations-procurement-client";
import { stores, type Catalogue, type Requisition, type StoreIssue } from "@/lib/api/operations-stores-client";
import { qty } from "@/suite/operations/components/procurement/meta";
import { DocNo, ApprovalLink, PdfLink } from "@/suite/operations/components/procurement/ui";
import { IssueCard } from "@/suite/operations/components/stores/RequisitionDetail";
import { remaining } from "@/suite/operations/components/stores/meta";
import { RequisitionStatusChip } from "@/suite/operations/components/stores/ui";
import { NewRequisitionDialog } from "./NewRequisitionDialog";

/**
 * My requisitions: what I asked the stores for, where each stands, and the
 * store issue vouchers waiting for me to say "I received these".
 */

/** Vouchers issued to me that I haven't acknowledged, newest first. Pure. */
export function toAcknowledge(rows: Requisition[]): { issue: StoreIssue; req: Requisition }[] {
  return rows
    .flatMap((req) => (req.issues ?? []).filter((s) => !s.acknowledgedAt).map((issue) => ({ issue, req })))
    .sort((a, b) => (b.issue.issuedAt ?? "").localeCompare(a.issue.issuedAt ?? ""));
}

/** The confirmation before saying "I received these". */
export function acknowledgePrompt(issue: StoreIssue) {
  return {
    title: `Confirm you received ${issue.number ?? "these items"}?`,
    body: `${issue.lines.map((l) => `${qty(l.quantity)} ${l.unit} ${l.name}`).join(", ")}. The store's record shows you took them.`,
    confirmLabel: "I received these",
    tone: "primary" as const,
  };
}

/** The confirmation before cancelling a requisition, or closing a partly issued one. */
export function cancelPrompt(r: Requisition) {
  return r.status === "partly_issued"
    ? {
        title: `Close ${r.number ?? "this requisition"}?`,
        body: "What the store has issued stays yours. The rest is no longer owed, and the store stops working on it. This can't be undone.",
        confirmLabel: "Close requisition",
      }
    : {
        title: `Cancel ${r.number ?? "this requisition"}?`,
        body: r.status === "in_approval" ? "It is withdrawn from your head of unit and won't be issued. This can't be undone." : "The store won't issue it. This can't be undone.",
        confirmLabel: "Cancel requisition",
      };
}

export default function MyRequisitions() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Requisition[] | null>(null);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [options, setOptions] = useState<MeOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ackErrors, setAckErrors] = useState<Record<string, string>>({});
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    Promise.all([stores.me.requisitions(), stores.me.catalogue()]).then(
      ([r, c]) => {
        if (!alive) return;
        setRows(r);
        setCatalogue(c);
        setError(null);
      },
      (e: unknown) => alive && setError(`Your requisitions didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    let alive = true;
    procurement.me.options().then(
      (o) => alive && setOptions(o),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  const pending = useMemo(() => toAcknowledge(rows ?? []), [rows]);

  const acknowledge = async (issue: StoreIssue) => {
    const ok = await confirm(acknowledgePrompt(issue));
    if (!ok) return;
    setBusy(issue.id);
    setAckErrors((e) => ({ ...e, [issue.id]: "" }));
    try {
      await stores.me.acknowledge(issue.id);
      setNotice(`${issue.number ?? "Voucher"} acknowledged. Thank you.`);
      setReload((n) => n + 1);
    } catch (e) {
      setAckErrors((cur) => ({ ...cur, [issue.id]: opsError(e) }));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (r: Requisition) => {
    const ok = await confirm(cancelPrompt(r));
    if (!ok) return;
    setBusy(`cancel-${r.id}`);
    setCancelErrors((e) => ({ ...e, [r.id]: "" }));
    try {
      const done = await stores.me.cancelRequisition(r.id);
      setNotice(done.status === "cancelled" ? `${r.number ?? "Your requisition"} cancelled.` : `${r.number ?? "Your requisition"} closed. Nothing more is owed on it.`);
      setReload((n) => n + 1);
    } catch (e) {
      setCancelErrors((cur) => ({ ...cur, [r.id]: opsError(e) }));
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <PageHeader
      eyebrow="Me"
      title="My requisitions"
      subtitle="Ask the stores for consumables, follow each request, and confirm what you received."
      actions={
        <Button variant="primary" icon={Plus} onClick={() => setAsking(true)} disabled={!catalogue}>
          New requisition
        </Button>
      }
    />
  );

  if (error && !rows)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!rows || !catalogue)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading your requisitions…</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const open = rows.filter((r) => ["in_approval", "approved", "partly_issued"].includes(r.status));
  const waitingApproval = rows.filter((r) => r.status === "in_approval");
  const issued = rows.filter((r) => r.status === "issued");

  return (
    <div>
      {header}
      <Notice text={notice} />
      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="To acknowledge" value={pending.length} icon={Inbox} hint={pending.length ? "Vouchers waiting for you" : "Nothing waiting"} />
          <StatCard label="Open" value={open.length} icon={PackageOpen} hue="sky" hint="In approval or with the store" />
          <StatCard label="In approval" value={waitingApproval.length} icon={Hourglass} hue="grape" hint="With your head of unit" />
          <StatCard label="Fully issued" value={issued.length} icon={PackageCheck} hue="mint" hint="Everything you asked for" />
        </StatGrid>

        {pending.length > 0 && (
          <Panel title="Did you receive these?" subtitle="Confirm what the store issued to you" icon={Inbox} hue="sun">
            <ol className="grid gap-3 lg:grid-cols-2">
              {pending.map(({ issue, req }) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  action={
                    <div>
                      <p className="mb-2 text-xs text-neutral-500">
                        Against {req.number ?? "your requisition"} from {req.store ?? "the store"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="primary" size="sm" icon={CircleCheckBig} onClick={() => void acknowledge(issue)} disabled={busy !== null}>
                          {busy === issue.id ? "Confirming…" : "I received these"}
                        </Button>
                        <PdfLink href={stores.me.issuePdfUrl(issue.id)} label="Voucher" name={issue.number} />
                      </div>
                      {ackErrors[issue.id] && <ErrorNote className="mt-2">{ackErrors[issue.id]}</ErrorNote>}
                    </div>
                  }
                />
              ))}
            </ol>
          </Panel>
        )}

        <section aria-labelledby="my-reqs">
          <h2 id="my-reqs" className="mb-3 text-[15px] font-semibold text-neutral-900">
            Everything I asked for
          </h2>
          {rows.length === 0 ? (
            <Card>
              <Empty
                icon={ClipboardList}
                title="No requisitions yet"
                hint="Need paper, toner or refreshments? Ask the store; your head of unit approves and the store issues it."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => setAsking(true)}>
                    New requisition
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => (
                <RequisitionCard key={r.id} req={r} onCancel={() => void cancel(r)} busy={busy === `cancel-${r.id}`} disabled={busy !== null} error={cancelErrors[r.id]} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {asking && (
        <NewRequisitionDialog
          catalogue={catalogue}
          options={options}
          onClose={() => setAsking(false)}
          onDone={(r) => {
            setAsking(false);
            setNotice(`${r.number ?? "Your requisition"} sent. ${r.status === "approved" ? "It is with the store to issue." : "It is with your head of unit to approve."}`);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/** Statuses the requester can still cancel (or, partly issued, close). */
export const CANCELLABLE = ["draft", "in_approval", "approved", "partly_issued"];

function RequisitionCard({ req: r, onCancel, busy, disabled, error }: { req: Requisition; onCancel: () => void; busy: boolean; disabled: boolean; error?: string }) {
  const asked = r.lines.reduce((s, l) => s + l.quantity, 0);
  const got = r.lines.reduce((s, l) => s + Math.min(l.issued, l.quantity), 0);
  const pct = asked > 0 ? (got / asked) * 100 : 0;
  const owed = r.lines.filter((l) => remaining(l) > 0).length;
  const unacknowledged = (r.issues ?? []).filter((s) => !s.acknowledgedAt).length;
  return (
    <li className="ws-card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DocNo value={r.number} />
          <p className="mt-0.5 truncate text-[15px] font-semibold text-neutral-900">
            <Link
              href={`/suite/operations/my/requisitions/${r.id}`}
              className="rounded outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
              aria-label={`Open ${r.number ?? "requisition"} from ${r.store ?? "the store"}`}
            >
              {r.store ?? "A store"}
            </Link>
          </p>
        </div>
        <RequisitionStatusChip status={r.status} mine />
      </div>
      {r.purpose && <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{r.purpose}</p>}
      <ul className="mt-3 space-y-1 text-sm">
        {r.lines.slice(0, 4).map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-neutral-800">{l.name}</span>
            <span className={cx("shrink-0 text-xs tabular-nums", l.issued >= l.quantity ? "text-mint-700" : "text-neutral-500")}>
              {qty(l.issued)} of {qty(l.quantity)} {l.unit}
            </span>
          </li>
        ))}
        {r.lines.length > 4 && <li className="text-xs text-neutral-500">and {r.lines.length - 4} more</li>}
      </ul>
      <div className="mt-auto pt-4">
        <div className="ws-hatch h-2 overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Issued so far">
          <div className={cx("h-full rounded-full", pct >= 100 ? "bg-mint-500" : "bg-sky-500")} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
          <span>
            Raised {day(r.createdAt)} ·{" "}
            <Link href={`/suite/operations/my/requisitions/${r.id}`} className="font-semibold text-primary-700 hover:underline">
              Details
            </Link>
          </span>
          <span className="flex flex-wrap gap-1.5">
            {unacknowledged > 0 && <Chip hue="sun">{unacknowledged} to acknowledge</Chip>}
            {owed > 0 && (r.status === "partly_issued" || r.status === "approved") && <Chip hue="slate">{owed} still owed</Chip>}
          </span>
        </div>
        {r.status === "in_approval" && r.approvalId && (
          <div className="mt-2">
            <ApprovalLink id={r.approvalId} label="See the approval" />
          </div>
        )}
        {CANCELLABLE.includes(r.status) && (
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <Button size="sm" variant="ghost" icon={Ban} onClick={onCancel} disabled={disabled} aria-label={`${r.status === "partly_issued" ? "Close" : "Cancel"} ${r.number ?? "requisition"}`}>
              {busy ? (r.status === "partly_issued" ? "Closing…" : "Cancelling…") : r.status === "partly_issued" ? "Close requisition" : "Cancel requisition"}
            </Button>
            {error && <ErrorNote className="mt-2">{error}</ErrorNote>}
          </div>
        )}
      </div>
    </li>
  );
}
