"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Ban, ClipboardList, FileStack, Gavel, Mail, Paperclip, PenLine, ScrollText, Scale, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-store";
import { Button, Panel } from "@/components/workspace/kit";
import { BackLink, ErrorNote, Field, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { RequestRoad, FundsSnapshotView } from "@/suite/finance/components/requests/ui";
import ReasonDialog from "@/suite/finance/components/vouchers/ReasonDialog";
import { Money } from "@/suite/finance/components/banking/ui";
import { mayDoOps, mayUseOperations } from "@/suite/operations/lib/operations-access";
import { dutiesRefusal, opsError, opsFieldErrors, procurement, type PrFull } from "@/lib/api/operations-procurement-client";
import ComparisonSheet from "./ComparisonSheet";
import { RfqDialog, QuotationDialog, useVendorOptions } from "./SourcingDialogs";
import { AwardsList, OrdersList, RequestFacts, RequestLines, RfqList, RuleBanner } from "./RequestParts";
import { picksTotal, prRoad, readSheet } from "./meta";
import { AttachmentsBlock, DocNo, PrOriginChip, PrStatusChip } from "./ui";

/**
 * Sourcing one request: the request itself, the RFQs sent, the quotations
 * entered, and the comparison sheet - which turns into the award ballot when
 * the desk recommends who supplies each line. Then the awards on their way
 * through approval, and the orders they became.
 */
export default function SourcingDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const uid = useId();
  const [pr, setPr] = useState<PrFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"rfq" | "quote" | "cancel" | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [awardErrors, setAwardErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const vendors = useVendorOptions();

  const load = useCallback(() => {
    procurement.requests.get(id).then(
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

  const sheet = useMemo(() => (pr?.comparison ? readSheet(pr.comparison) : null), [pr]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/operations/procurement/requests" label="Requests & sourcing" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!pr)
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the request…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[28rem]" />
      </div>
    );

  const c = pr.comparison;
  const sourcing = pr.status === "approved" || pr.status === "award_pending";
  const canRfq = sourcing && mayDoOps(user, "purchase_requests", "rfq");
  const canQuote = sourcing && mayDoOps(user, "purchase_requests", "quote");
  const canRecommend = pr.status === "approved" && Boolean(c && c.vendors.length > 0) && mayDoOps(user, "purchase_requests", "recommend");
  const canCancel = !["ordered", "cancelled", "rejected"].includes(pr.status) && mayDoOps(user, "purchase_requests", "cancel");
  const canAttach = mayDoOps(user, "attachments", "create");
  const canDetach = mayDoOps(user, "attachments", "delete");
  const allPicked = pr.lines.every((l) => picks[l.id]);
  const pickedTotal = c ? picksTotal(c, picks) : 0;

  const startAward = () => {
    setPicks(Object.fromEntries((sheet?.lowestPicks ?? []).map((p) => [p.prLineId, p.quotationId])));
    setAwardErrors({});
    setAwarding(true);
  };

  const recommend = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!allPicked) local.picks = "Choose a vendor for every line.";
    if (!reason.trim()) local.reason = "Say why these vendors are recommended.";
    if (Object.keys(local).length) {
      setAwardErrors(local);
      return;
    }
    setBusy(true);
    setAwardErrors({});
    try {
      await procurement.requests.award(pr.id, { reason: reason.trim(), picks: Object.entries(picks).map(([prLineId, quotationId]) => ({ prLineId, quotationId })) });
      setAwarding(false);
      setReason("");
      setNotice("Award recommended and sent for approval. The orders are raised once it is approved.");
      setReload((n) => n + 1);
    } catch (err) {
      const duties = dutiesRefusal(err);
      const f = opsFieldErrors(err);
      setAwardErrors(duties ? { general: duties } : f.reason ? { reason: f.reason } : { general: Object.values(f)[0] ?? opsError(err) });
    } finally {
      setBusy(false);
    }
  };

  const vendorCount = c?.vendors.length ?? 0;
  const vendorsOnAward = new Set(Object.values(picks)).size;

  return (
    <div>
      <BackLink href="/suite/operations/procurement/requests" label="Requests & sourcing" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 flex flex-wrap items-center gap-2">
            <DocNo value={pr.number} className="text-primary-700" />
            <PrStatusChip status={pr.status} />
            <PrOriginChip origin={pr.origin} status={pr.status} />
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">{pr.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {pr.requester ?? "—"} · <Money value={pr.estimate} currency={pr.currency} /> estimated · {pr.lines.length} {pr.lines.length === 1 ? "line" : "lines"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCancel && (
            <Button icon={Ban} variant="ghost" onClick={() => setDialog("cancel")}>
              Cancel request
            </Button>
          )}
          {canRfq && (
            <Button icon={Mail} onClick={() => setDialog("rfq")}>
              Invite quotations
            </Button>
          )}
          {canQuote && (
            <Button icon={PenLine} variant={canRecommend ? "secondary" : "primary"} onClick={() => setDialog("quote")}>
              Enter a quotation
            </Button>
          )}
          {canRecommend && !awarding && (
            <Button icon={Gavel} variant="primary" onClick={startAward}>
              Recommend the award
            </Button>
          )}
        </div>
      </div>

      <Notice text={notice} />
      {pr.status === "draft" && (
        <p role="status" className="mb-5 rounded-2xl border border-sky-500/25 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          <span className="font-semibold">Still a draft. </span>
          {pr.origin === "shortfall" ? "Drafted for what the store couldn't issue on a requisition." : pr.origin === "reorder" ? "Drafted to restock items at or below their reorder level." : "Not yet sent for approval."}{" "}
          {pr.requester ?? "Whoever it is under"} checks it and sends it for approval; it is sourced once approved.
          {user?.id === pr.requesterId && (
            <>
              {" "}
              <Link href={`/suite/operations/my/requests/${pr.id}`} className="font-semibold underline underline-offset-2">
                Open it to send
              </Link>
            </>
          )}
        </p>
      )}

      <div className="mb-5 ws-card p-5">
        <RequestRoad stage={{ ...prRoad(pr.status), flagged: false }} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          {c && <RuleBanner rule={c.rule} />}

          {c && (
            <Panel
              title={awarding ? "Choose who supplies each line" : "Comparison sheet"}
              subtitle={
                awarding
                  ? "The lowest on each line is chosen to start with. A line can go to a different vendor than the next."
                  : vendorCount
                    ? `${vendorCount} ${vendorCount === 1 ? "quotation" : "quotations"}, compared line by line. VAT is shown on its own.`
                    : "Quotations appear here as they are entered."
              }
              icon={Scale}
              hue="mint"
              actions={
                awarding && sheet ? (
                  <Button size="sm" icon={Sparkles} onClick={() => setPicks(Object.fromEntries(sheet.lowestPicks.map((p) => [p.prLineId, p.quotationId])))}>
                    Lowest on each line
                  </Button>
                ) : undefined
              }
            >
              <ComparisonSheet comparison={c} currency={pr.currency} picks={awarding ? picks : undefined} onPick={awarding ? (l, q) => setPicks((p) => ({ ...p, [l]: q })) : undefined} />

              {awarding && (
                <form onSubmit={recommend} className="mt-5 space-y-4 rounded-2xl border border-primary-200 bg-primary-50/40 p-4" aria-labelledby={`${uid}-award`}>
                  <h3 id={`${uid}-award`} className="sr-only">
                    The recommendation
                  </h3>
                  <div className="flex flex-wrap items-baseline justify-between gap-2" aria-live="polite">
                    <p className="text-sm text-neutral-700">
                      {allPicked ? `${pr.lines.length} ${pr.lines.length === 1 ? "line" : "lines"} to ${vendorsOnAward} ${vendorsOnAward === 1 ? "vendor" : "vendors"}` : "Some lines have no vendor chosen yet"}
                    </p>
                    <p className="text-sm">
                      Award total <Money value={pickedTotal} currency={pr.currency} className="text-lg font-bold text-neutral-900" />
                    </p>
                  </div>
                  {sheet && pickedTotal > sheet.lowestPicksTotal && (
                    <p className="text-xs text-sun-700">
                      <Money value={pickedTotal - sheet.lowestPicksTotal} currency={pr.currency} /> more than the lowest on each line; say why in the reason.
                    </p>
                  )}
                  <FieldError message={awardErrors.picks} />
                  <Field id={`${uid}-reason`} label="Why these vendors">
                    <textarea
                      id={`${uid}-reason`}
                      rows={3}
                      className={textareaClass}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Lowest price, fastest delivery, meets the specification; delivered our last orders on time."
                      aria-invalid={awardErrors.reason ? true : undefined}
                    />
                    <FieldError message={awardErrors.reason} />
                  </Field>
                  {awardErrors.general && <ErrorNote>{awardErrors.general}</ErrorNote>}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button onClick={() => setAwarding(false)}>Not now</Button>
                    <Button type="submit" variant="primary" icon={Gavel} disabled={busy}>
                      {busy ? "Sending…" : "Send the award for approval"}
                    </Button>
                  </div>
                </form>
              )}
            </Panel>
          )}

          <Panel title="The request" icon={ClipboardList} hue="blue">
            <RequestFacts pr={pr} />
            <div className="mt-5">
              <RequestLines pr={pr} />
            </div>
          </Panel>

          <Panel title="Awards" subtitle="Recommendations and their approval" icon={Gavel} hue="grape">
            <AwardsList awards={pr.awards} pr={pr} />
          </Panel>

          <Panel title="Orders" subtitle="Raised from the approved award" icon={ScrollText} hue="sky">
            <OrdersList orders={pr.orders} linked={mayUseOperations(user, "purchase_orders")} />
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="About this request">
          <Panel title="Requests for quotation" icon={FileStack} hue="sky">
            <RfqList rfqs={pr.rfqs} />
          </Panel>
          {pr.funds && (
            <Panel title="Project funds when sent" icon={Wallet} hue="sun">
              <FundsSnapshotView snapshot={pr.funds} currency={pr.currency} />
            </Panel>
          )}
          <Panel title="Files" subtitle="Specifications and other papers. Each quotation keeps its own on the sheet." icon={Paperclip} hue="slate">
            <AttachmentsBlock
              ownerType="pr"
              ownerId={pr.id}
              attachments={pr.attachments}
              canAdd={canAttach}
              canRemove={canDetach}
              kind="specification"
              addLabel="Attach a specification or other paper"
              empty="No files on this request yet."
              onChange={() => setReload((n) => n + 1)}
            />
          </Panel>
        </aside>
      </div>

      {dialog === "rfq" && (
        <RfqDialog
          pr={pr}
          vendors={vendors}
          onClose={() => setDialog(null)}
          onDone={(no) => {
            setDialog(null);
            setNotice(`${no} sent. Enter each quotation as it arrives.`);
            setReload((n) => n + 1);
          }}
        />
      )}
      {dialog === "quote" && (
        <QuotationDialog
          pr={pr}
          vendors={vendors}
          onClose={() => setDialog(null)}
          onDone={(vendor, warning) => {
            setDialog(null);
            setNotice(`Quotation from ${vendor} saved. It is on the comparison sheet.${warning ? ` ${warning}` : ""}`);
            setReload((n) => n + 1);
          }}
        />
      )}
      {dialog === "cancel" && (
        <ReasonDialog
          title={`Cancel ${pr.number ?? "this request"}?`}
          subtitle="Sourcing stops and any funds held for it are released. The requester sees it as cancelled, with your reason. This can't be undone; they would raise a new request."
          label="Reason"
          confirmLabel="Cancel the request"
          busyLabel="Cancelling…"
          tone="danger"
          placeholder="Why the request is being cancelled"
          onClose={() => setDialog(null)}
          onConfirm={async (text) => {
            await procurement.requests.cancel(pr.id, text);
            setDialog(null);
            setNotice("Request cancelled.");
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
