"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CircleCheckBig, ClipboardList, FileText } from "lucide-react";
import { Button, Empty, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { opsError } from "@/lib/api/operations-procurement-client";
import { stores, type Requisition, type StoreIssue } from "@/lib/api/operations-stores-client";
import { qty } from "@/suite/operations/components/procurement/meta";
import { ApprovalLink, DocNo, PdfLink } from "@/suite/operations/components/procurement/ui";
import { IssueCard } from "@/suite/operations/components/stores/RequisitionDetail";
import { remaining } from "@/suite/operations/components/stores/meta";
import { RequisitionStatusChip } from "@/suite/operations/components/stores/ui";
import { CANCELLABLE, acknowledgePrompt, cancelPrompt } from "./MyRequisitions";

/**
 * One of my requisitions: each line asked for and issued, where the
 * approval is, and every store issue voucher, printable, with the ones I
 * have not yet signed for to acknowledge.
 */

const NEXT: Record<string, string> = {
  draft: "Not sent yet.",
  in_approval: "Next: your head of unit approves it.",
  approved: "Approved. The store issues it next.",
  partly_issued: "Part of it is issued. The store issues the rest when it has it.",
  issued: "Everything you asked for is issued.",
  rejected: "Your head of unit turned it down.",
  cancelled: "Cancelled.",
};

export default function MyRequisitionDetail({ id }: { id: string }) {
  const confirm = useConfirm();
  const [r, setR] = useState<Requisition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    stores.me.requisition(id).then(
      (d) => {
        if (!alive) return;
        setR(d);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(`The requisition didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  const back = <BackLink href="/suite/operations/my/requisitions" label="My requisitions" />;
  if (loadError)
    return (
      <div>
        {back}
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  if (!r)
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading your requisition…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
      </div>
    );

  const run = async (key: string, fn: () => Promise<unknown>, ok: string, failed: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setNotice(ok);
      refresh();
    } catch (e) {
      setError(`${failed} ${opsError(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const acknowledge = async (issue: StoreIssue) => {
    if (await confirm(acknowledgePrompt(issue)))
      await run(issue.id, () => stores.me.acknowledge(issue.id), `${issue.number ?? "Voucher"} acknowledged. Thank you.`, "It wasn't acknowledged.");
  };

  const partly = r.status === "partly_issued";
  const cancel = async () => {
    if (await confirm(cancelPrompt(r)))
      await run(
        "cancel",
        () => stores.me.cancelRequisition(r.id),
        partly ? `${r.number ?? "Your requisition"} closed. Nothing more is owed on it.` : `${r.number ?? "Your requisition"} cancelled.`,
        partly ? "It wasn't closed." : "It wasn't cancelled.",
      );
  };

  const issues = r.issues ?? [];

  return (
    <div>
      {back}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 flex flex-wrap items-center gap-2">
            <DocNo value={r.number ?? "Not sent yet"} className="text-primary-700" />
            <RequisitionStatusChip status={r.status} mine />
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">{r.store ?? "A store"}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Raised {day(r.createdAt)}
            {r.project && ` · ${r.project.name}`}
          </p>
        </div>
        {CANCELLABLE.includes(r.status) && (
          <Button variant="ghost" icon={Ban} disabled={busy !== null} onClick={() => void cancel()}>
            {busy === "cancel" ? (partly ? "Closing…" : "Cancelling…") : partly ? "Close requisition" : "Cancel requisition"}
          </Button>
        )}
      </div>

      <Notice text={notice} />
      {error && <ErrorNote className="mb-5">{error}</ErrorNote>}

      <div className="mb-5 ws-card p-5">
        <p className="text-sm font-semibold text-neutral-900">{NEXT[r.status] ?? ""}</p>
        {r.purpose && <p className="mt-1 text-sm text-neutral-600">{r.purpose}</p>}
        {r.approvalId && (
          <div className="mt-2">
            <ApprovalLink id={r.approvalId} label={r.status === "in_approval" ? "See who is deciding" : "See the approval"} />
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel title="What you asked for" icon={ClipboardList} hue="grape" className="min-w-0 xl:col-span-2" bodyClassName="p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Items asked for and issued</caption>
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-500">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Item
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Asked
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">
                  Issued
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {r.lines.map((l) => {
                const owed = remaining(l);
                return (
                  <tr key={l.id}>
                    <td className="px-5 py-3">
                      <span className="block font-medium text-neutral-900">{l.name ?? "—"}</span>
                      {l.code && <span className="font-mono text-[11px] text-neutral-500">{l.code}</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700">
                      {qty(l.quantity)} {l.unit}
                    </td>
                    <td className={cx("px-5 py-3 text-right tabular-nums", owed > 0 ? "text-neutral-700" : "font-semibold text-mint-700")}>
                      {qty(l.issued)}
                      {owed > 0 && <span className="block text-[11px] font-normal text-neutral-500">{qty(owed)} owed</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Store issue vouchers" subtitle="What the store gave you, to print or sign for" icon={FileText} hue="mint" className="min-w-0 xl:col-span-3">
          {issues.length === 0 ? (
            <Empty icon={FileText} title="Nothing issued yet" hint="Each issue gives you a numbered voucher to sign for." hue="mint" />
          ) : (
            <ol className="space-y-3">
              {issues.map((s) => (
                <IssueCard
                  key={s.id}
                  issue={s}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      {!s.acknowledgedAt && (
                        <Button variant="primary" size="sm" icon={CircleCheckBig} disabled={busy !== null} onClick={() => void acknowledge(s)}>
                          {busy === s.id ? "Confirming…" : "I received these"}
                        </Button>
                      )}
                      <PdfLink href={stores.me.issuePdfUrl(s.id)} label="Voucher" name={s.number} />
                    </div>
                  }
                />
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
