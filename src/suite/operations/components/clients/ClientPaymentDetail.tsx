"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, FileStack, History, Info, ListChecks, Milestone, NotebookPen } from "lucide-react";
import { Button, PageHeader, Panel } from "@/components/workspace/kit";
import { BackLink, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { mayUseFinance } from "@/suite/finance/lib/finance-access";
import { ApiError, clientPayments, opsError, type ClientPaymentFull } from "@/lib/api/operations-travel-client";
import { plural } from "../travel/labels";
import { ApprovalLink, FactRow, MetaChip } from "../travel/shared";
import { FollowUp, StageChip } from "./ClientPaymentsBoard";
import { FINISHED, packSendable, packStatus } from "./labels";
import { PackChecklist, StageForm, StageHistory, StageRoad } from "./PackParts";
import ChecklistEditor from "./ChecklistEditor";

/**
 * One client payment request: the pack (the client's checklist, a file per
 * item, sent for approval once every mandatory document is in), then the
 * chase - each stage of the client's process recorded with whom and when
 * to follow up - until Finance receives the money.
 */
export default function ClientPaymentDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [req, setReq] = useState<ClientPaymentFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [editingList, setEditingList] = useState(false);

  useEffect(() => {
    let alive = true;
    clientPayments.get(id).then(
      (r) => {
        if (!alive) return;
        setReq(r);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This request wasn't found." : `This request didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !req) {
    return (
      <div>
        <BackLink href="/suite/operations/clients/requests" label="Client payments" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!req) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the request…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const r = req;
  const finished = FINISHED.includes(r.stage);
  const canAttach = mayDoOps(user, "client_payments", "attach") && !finished && (packSendable(r.packStatus) || r.stage === "queried");
  const canSubmit = mayDoOps(user, "client_payments", "submit_pack");
  const canMove = mayDoOps(user, "client_payments", "move") && r.stage !== "closed";
  const canEditList = mayDoOps(user, "client_payments", "save_checklist");

  const upload = async (itemId: string, file: File) => {
    setBusyItem(itemId);
    setItemErrors({});
    try {
      setReq(await clientPayments.attach(r.id, itemId, file));
    } catch (e) {
      setItemErrors({ [itemId]: opsError(e) });
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <div>
      <BackLink href="/suite/operations/clients/requests" label="Client payments" />
      <PageHeader
        eyebrow={`${r.number} · ${r.client}`}
        title={r.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StageChip stage={r.stage} label={r.stageLabel} />
            <MetaChip meta={packStatus(r.packStatus)} />
          </span>
        }
        actions={
          <>
            <ApprovalLink approvalId={r.approvalId} />
            {canEditList && (
              <Button icon={ListChecks} onClick={() => setEditingList(true)}>
                {r.client}&apos;s checklist
              </Button>
            )}
          </>
        }
      />

      {/* The numbers that matter, in one strip. */}
      <section aria-label="Request at a glance" className="ws-card mb-5 grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-neutral-500">Amount</p>
          <Money value={r.amount} currency={r.currency} className="mt-0.5 block text-xl font-bold text-neutral-900" />
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Days in this stage</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">{finished ? "-" : r.daysInStage}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Since submission</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">{r.daysSinceSubmission == null ? "Not sent" : plural(r.daysSinceSubmission, "day")}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs font-medium text-neutral-500">
            <BellRing size={12} aria-hidden />
            Next follow-up
          </p>
          <p className="mt-0.5 text-sm">
            <FollowUp row={r} />
          </p>
        </div>
      </section>

      <Panel title="Where it is with the client" icon={Milestone} hue="sky" className="mb-5">
        <StageRoad stage={r.stage} history={r.history} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel
            title="The pack"
            subtitle={
              r.packStatus === "in_approval"
                ? "With the approvers. It can be submitted to the client once approved."
                : r.packStatus === "approved"
                  ? "Approved. Record “Submitted” below when it reaches the client."
                  : "The client's checklist: attach a file for each document"
            }
            icon={FileStack}
            hue="grape"
          >
            <PackChecklist
              items={r.items}
              packStatus={r.packStatus}
              canAttach={canAttach}
              canSubmit={canSubmit}
              busyItem={busyItem}
              itemErrors={itemErrors}
              onUpload={(itemId, f) => void upload(itemId, f)}
              onSubmit={async () => setReq(await clientPayments.submitPack(r.id))}
            />
          </Panel>

          {canMove && (
            <Panel title="Record a stage" subtitle="Where it is now, who you dealt with, and when to chase next" icon={NotebookPen} hue="mint">
              <StageForm stages={r.stages} current={r.stage} packApproved={r.packStatus === "approved"} onSave={async (input) => setReq(await clientPayments.move(r.id, input))} />
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Details and history">
          <Panel title="Details" icon={Info} hue="slate">
            <dl className="space-y-3">
              <FactRow label="Client">{r.client}</FactRow>
              <FactRow label="Invoice">
                {r.invoiceNo ? (
                  mayUseFinance(user, "invoices") && r.invoiceId ? (
                    <Link href={`/suite/finance/revenue/invoices/${r.invoiceId}`} className="font-mono font-semibold text-primary-700 underline-offset-2 hover:underline">
                      {r.invoiceNo}
                    </Link>
                  ) : (
                    <span className="font-mono font-semibold">{r.invoiceNo}</span>
                  )
                ) : (
                  <span className="text-neutral-500">Prepared by hand</span>
                )}
              </FactRow>
              <FactRow label="Project">{r.project?.name ?? <span className="text-neutral-500">None</span>}</FactRow>
              <FactRow label="Account manager">{r.accountManager ?? "-"}</FactRow>
              <FactRow label="Expected payment">{day(r.expectedPaymentOn)}</FactRow>
              {r.paidAt && <FactRow label="Paid">{day(r.paidAt)}</FactRow>}
            </dl>
          </Panel>
          <Panel title="History" icon={History} hue="slate">
            <StageHistory history={r.history} />
          </Panel>
        </aside>
      </div>

      {editingList && <ChecklistEditor clientId={r.clientId} client={r.client ?? "The client"} onClose={() => setEditingList(false)} />}
    </div>
  );
}
