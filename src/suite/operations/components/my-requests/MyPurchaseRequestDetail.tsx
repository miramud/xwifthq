"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, ChevronDown, ClipboardList, Gavel, PenLine, Scale, ScrollText, Send, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, ButtonLink, Panel, cx } from "@/components/workspace/kit";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { FundsSnapshotView, RequestRoad } from "@/suite/finance/components/requests/ui";
import ReasonDialog from "@/suite/finance/components/vouchers/ReasonDialog";
import { Money } from "@/suite/finance/components/banking/ui";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { mayUseOperations } from "@/suite/operations/lib/operations-access";
import { fundsCode, opsError, procurement, type FundsCode, type MeOptions, type PrFull } from "@/lib/api/operations-procurement-client";
import ComparisonSheet from "@/suite/operations/components/procurement/ComparisonSheet";
import { AwardsList, OrdersList, RequestFacts, RequestLines, RuleBanner } from "@/suite/operations/components/procurement/RequestParts";
import { prRoad } from "@/suite/operations/components/procurement/meta";
import { ApprovalLink, DocNo, PrStatusChip } from "@/suite/operations/components/procurement/ui";
import FundsRefusal from "./FundsRefusal";
import MyRequestFiles from "./MyRequestFiles";

/**
 * My purchase request: where it is, what was asked for, and - once it is
 * being sourced - the quotations, the award and the orders, read-only. A
 * draft can be finished and sent from here; a request not yet ordered can be
 * withdrawn.
 */

const NEXT: Record<string, string> = {
  draft: "Next: finish it and send it for approval.",
  in_approval: "Next: the approvers decide. You are told when they do.",
  approved: "Next: procurement invites quotations and compares them.",
  award_pending: "Next: the recommended vendors are approved.",
  awarded: "Next: the orders are raised with the vendors.",
  ordered: "Ordered. Procurement follows the delivery from here.",
  rejected: "The approvers turned it down. Raise a new request if it is still needed.",
  cancelled: "Cancelled.",
};

export default function MyPurchaseRequestDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const [pr, setPr] = useState<PrFull | null>(null);
  const [options, setOptions] = useState<MeOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(() => (params?.get("sent") ? "Sent for approval." : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funds, setFunds] = useState<{ code: FundsCode; message: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const load = useCallback(() => {
    procurement.me.get(id).then(
      (p) => {
        setPr(p);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(`The request didn't load. ${opsError(e)}`),
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load, reload]);

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

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/operations/my/requests" label="My purchase requests" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!pr)
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading your request…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[28rem]" />
      </div>
    );

  const draft = pr.status === "draft";
  const canCancel = ["draft", "in_approval", "approved", "award_pending"].includes(pr.status);
  const costCentre = options?.costCentres.find((c) => c.id === pr.costCentreId);
  const c = pr.comparison;

  const send = async (overrideReason?: string) => {
    setBusy(true);
    setError(null);
    try {
      setPr(await procurement.me.submit(pr.id, overrideReason ?? null));
      setFunds(null);
      setNotice("Sent for approval.");
    } catch (e) {
      const code = fundsCode(e);
      if (code) setFunds({ code, message: opsError(e) });
      else setError(`It wasn't sent. ${opsError(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <BackLink href="/suite/operations/my/requests" label="My purchase requests" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 flex flex-wrap items-center gap-2">
            <DocNo value={pr.number ?? "Not sent yet"} className="text-primary-700" />
            <PrStatusChip status={pr.status} />
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">{pr.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            <Money value={pr.estimate} currency={pr.currency} /> estimated · {pr.categoryLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCancel && (
            <Button variant="ghost" icon={Ban} onClick={() => setCancelling(true)}>
              {draft ? "Cancel draft" : "Withdraw request"}
            </Button>
          )}
          {draft && (
            <>
              <ButtonLink href={`/suite/operations/my/requests/new?id=${pr.id}`} icon={PenLine}>
                Edit
              </ButtonLink>
              <Button variant="primary" icon={Send} disabled={busy} onClick={() => void send()}>
                {busy ? "Sending…" : "Send for approval"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Notice text={notice} />
      {error && <ErrorNote className="mb-5">{error}</ErrorNote>}
      {funds && (
        <div className="mb-5">
          <FundsRefusal code={funds.code} message={funds.message} canOverride={mayDo(user, "memos", "override")} busy={busy} onOverride={(r) => void send(r)} />
        </div>
      )}

      <div className="mb-5 ws-card p-5">
        <RequestRoad stage={{ ...prRoad(pr.status), flagged: draft }} />
        <p className={cx("mt-3 text-sm", draft ? "font-semibold text-neutral-900" : "text-neutral-600")}>{NEXT[pr.status] ?? ""}</p>
        {pr.approvalId && pr.status === "in_approval" && (
          <div className="mt-2">
            <ApprovalLink id={pr.approvalId} label="See who is deciding" />
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel title="Your request" icon={ClipboardList} hue="grape">
            <RequestFacts pr={pr} costCentre={costCentre ? `${costCentre.code} · ${costCentre.name}` : null} />
            <div className="mt-5">
              <RequestLines pr={pr} />
            </div>
          </Panel>

          <MyRequestFiles pr={pr} onChange={() => setReload((n) => n + 1)} />

          {c && (
            <Panel title="Sourcing" subtitle="Quotations procurement has gathered" icon={Scale} hue="mint">
              <div className="space-y-4">
                <RuleBanner rule={c.rule} />
                {c.vendors.length > 0 && (
                  <div>
                    <button
                      type="button"
                      aria-expanded={showSheet}
                      onClick={() => setShowSheet((s) => !s)}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <ChevronDown size={16} aria-hidden className={cx("transition-transform", showSheet && "rotate-180")} />
                      {showSheet ? "Hide the quotations" : `See the ${c.vendors.length} ${c.vendors.length === 1 ? "quotation" : "quotations"}`}
                    </button>
                    {showSheet && (
                      <div className="mt-3">
                        <ComparisonSheet comparison={c} currency={pr.currency} showFiles={false} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {(pr.awards.length > 0 || pr.orders.length > 0) && (
            <>
              <Panel title="Award" icon={Gavel} hue="grape">
                <AwardsList awards={pr.awards} pr={pr} />
              </Panel>
              <Panel title="Orders" subtitle="Raised with the vendors" icon={ScrollText} hue="sky">
                <OrdersList orders={pr.orders} linked={mayUseOperations(user, "purchase_orders")} />
              </Panel>
            </>
          )}
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Funds">
          {pr.funds ? (
            <Panel title="Project funds when sent" icon={Wallet} hue="sun">
              <FundsSnapshotView snapshot={pr.funds} currency={pr.currency} />
            </Panel>
          ) : (
            <Panel title="Funds" icon={Wallet} hue="sun">
              <p className="text-sm text-neutral-600">
                {draft
                  ? "If a project pays, its funds are checked when you send the request."
                  : pr.eventId
                    ? "Funded by the event's approved budget."
                    : "No project funds check was recorded for this request."}
              </p>
            </Panel>
          )}
        </aside>
      </div>

      {cancelling && (
        <ReasonDialog
          title={draft ? "Cancel this draft?" : `Withdraw ${pr.number ?? "this request"}?`}
          subtitle={
            draft
              ? "The draft is closed and can't be sent. Raise a new request if it is needed again."
              : "The approval or sourcing stops and any funds held for it are released. This can't be undone; raise a new request if it is needed again."
          }
          label="Reason"
          confirmLabel={draft ? "Cancel the draft" : "Withdraw the request"}
          busyLabel="Withdrawing…"
          tone="danger"
          placeholder="No longer needed: the supplier donated two laptops"
          onClose={() => setCancelling(false)}
          onConfirm={async (reason) => {
            await procurement.me.cancel(pr.id, reason);
            setCancelling(false);
            setNotice(draft ? "Draft cancelled." : "Request withdrawn.");
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
