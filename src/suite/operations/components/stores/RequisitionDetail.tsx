"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ban, CircleCheckBig, ClipboardList, FileText, Hourglass, PackageCheck, PackageOpen, ShoppingCart, Store, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, InfoList, InfoRow, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import ReasonDialog from "@/suite/finance/components/vouchers/ReasonDialog";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { opsError, type PrSummary } from "@/lib/api/operations-procurement-client";
import { stores, type Requisition, type RequisitionLine, type StoreIssue } from "@/lib/api/operations-stores-client";
import { parseQty, qty } from "@/suite/operations/components/procurement/meta";
import { ApprovalLink, DocNo, PdfLink, PrStatusChip } from "@/suite/operations/components/procurement/ui";
import { defaultIssue, hasShortfall, remaining, round2 } from "./meta";
import { RequisitionStatusChip } from "./ui";

/**
 * One requisition at the store: each line asked, issued so far and in the
 * store now, with what to issue this time (the rest, or what the store has if
 * that is less). Issuing raises a numbered voucher the requester
 * acknowledges; what the store can't supply becomes a purchase request.
 */

/** A typed issue quantity's problem for a line, or null. Pure, for testing. */
export function issueProblem(l: Pick<RequisitionLine, "quantity" | "issued" | "inStore" | "unit">, typed: string): string | null {
  if (!typed.trim()) return null;
  const q = parseQty(typed);
  if (q === null) return "Issue a number, like 2 or 0.5.";
  if (q > remaining(l) + 0.001) return `Only ${qty(remaining(l))} ${l.unit ?? ""} is left to issue.`.replace(" .", ".");
  if (q > round2(l.inStore ?? 0) + 0.001) return `The store holds only ${qty(l.inStore ?? 0)} ${l.unit ?? ""}.`.replace(" .", ".");
  return null;
}

export default function RequisitionDetail({ id }: { id: string }) {
  const uid = useId();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [req, setReq] = useState<Requisition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"issue" | "shortfall" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pr, setPr] = useState<PrSummary | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    stores.requisitions.get(id).then(
      (r) => {
        if (!alive) return;
        setReq(r);
        setTyped(Object.fromEntries(r.lines.map((l) => [l.id, defaultIssue(l) > 0 ? String(defaultIssue(l)) : ""])));
        setError(null);
      },
      (e: unknown) => alive && setError(`The requisition didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const can = { issue: mayDoOps(user, "stores", "issue"), shortfall: mayDoOps(user, "stores", "shortfall"), close: mayDoOps(user, "stores", "close") };
  const issuable = req ? req.status === "approved" || req.status === "partly_issued" : false;

  const plan = useMemo(() => {
    if (!req) return { lines: [] as { line: RequisitionLine; q: number; problem: string | null }[], count: 0 };
    const lines = req.lines.map((line) => {
      const t = typed[line.id] ?? "";
      return { line, q: parseQty(t) ?? 0, problem: issueProblem(line, t) };
    });
    return { lines, count: lines.filter((l) => l.q > 0 && !l.problem).length };
  }, [req, typed]);

  const issue = async () => {
    if (!req) return;
    if (plan.lines.some((l) => l.problem)) {
      setActionError("Fix the quantities marked below first.");
      return;
    }
    const lines = Object.fromEntries(plan.lines.filter((l) => l.q > 0).map((l) => [l.line.id, l.q]));
    if (Object.keys(lines).length === 0) {
      setActionError("Type a quantity to issue on at least one line.");
      return;
    }
    const ok = await confirm({
      title: `Issue ${plan.count} ${plan.count === 1 ? "line" : "lines"} to ${req.requester ?? "the requester"}?`,
      body: "The items leave the store now, on a numbered store issue voucher, and are charged to the requisition's project or cost centre. The requester then acknowledges them.",
      confirmLabel: "Issue the items",
      tone: "primary",
    });
    if (!ok) return;
    setBusy("issue");
    setActionError(null);
    try {
      const r = await stores.requisitions.issue(req.id, lines);
      setNotice(`${r.issued.number ?? "Store issue voucher"} raised for ${r.issued.lines.length} ${r.issued.lines.length === 1 ? "line" : "lines"}. ${r.status === "issued" ? "Everything asked for is issued." : "Something is still owed; issue it when it arrives, or buy the shortfall."}`);
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  const shortfall = async () => {
    if (!req) return;
    const owed = req.lines.filter((l) => remaining(l) > 0);
    const ok = await confirm({
      title: "Buy the shortfall?",
      body: `A draft purchase request is raised under your name for what is still owed on ${owed.length} ${owed.length === 1 ? "line" : "lines"}, charged where this requisition is. Check it and send it for approval.`,
      confirmLabel: "Draft purchase request",
      tone: "primary",
    });
    if (!ok) return;
    setBusy("shortfall");
    setActionError(null);
    try {
      setPr(await stores.requisitions.shortfall(req.id));
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  if (error && !req)
    return (
      <div>
        <BackLink href="/suite/operations/stores/requisitions" label="Requisitions" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!req)
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the requisition…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-96 xl:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );

  const owed = hasShortfall(req);
  // A shortfall already being bought: no second request until that one is rejected or cancelled.
  const live = req.shortfallPr && !["rejected", "cancelled"].includes(req.shortfallPr.status) ? req.shortfallPr : null;

  return (
    <div>
      <BackLink href="/suite/operations/stores/requisitions" label="Requisitions" />
      <PageHeader
        eyebrow={<DocNo value={req.number} className="!text-[12px] text-primary-600" />}
        title={`Items for ${req.requester ?? "a member of staff"}`}
        subtitle={req.purpose ?? "No purpose given."}
        actions={
          <>
            <RequisitionStatusChip status={req.status} />
            {can.shortfall && owed && issuable && !live && !pr && (
              <Button icon={ShoppingCart} onClick={() => void shortfall()} disabled={busy !== null}>
                {busy === "shortfall" ? "Drafting…" : "Buy the shortfall"}
              </Button>
            )}
            {can.close && issuable && (
              <Button variant="ghost" icon={Ban} onClick={() => setClosing(true)} disabled={busy !== null}>
                {req.status === "partly_issued" ? "Close requisition" : "Cancel requisition"}
              </Button>
            )}
          </>
        }
      />
      <Notice text={notice} />
      {pr && (
        <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mint-500/25 bg-mint-50 px-4 py-3">
          <p className="text-sm text-mint-700">
            <span className="font-semibold">Purchase request drafted</span> · <DocNo value={pr.number} /> · <Money value={pr.estimate} />
          </p>
          <Link href={`/suite/operations/my/requests/${pr.id}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
            Open the request <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel
            title={issuable && can.issue ? "Issue now" : "What was asked for"}
            subtitle={issuable && can.issue ? "Each line starts at what is left, or what the store holds if that is less" : `${req.lines.length} ${req.lines.length === 1 ? "line" : "lines"}`}
            icon={PackageOpen}
            hue="sky"
          >
            <ul className="space-y-3">
              {plan.lines.map(({ line: l, q, problem }) => {
                const left = remaining(l);
                const issuedPct = l.quantity > 0 ? (Math.min(l.issued, l.quantity) / l.quantity) * 100 : 0;
                const nowPct = l.quantity > 0 ? (Math.min(q, left) / l.quantity) * 100 : 0;
                const short = left > 0 && (l.inStore ?? 0) < left;
                return (
                  <li key={l.id} className={cx("rounded-2xl border p-4", problem ? "border-error-500/40" : "border-neutral-200")}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900">{l.name ?? "An item"}</p>
                        <p className="font-mono text-[12px] text-neutral-500">{l.code}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {left <= 0 ? (
                          <Chip hue="mint" icon={CircleCheckBig}>
                            All issued
                          </Chip>
                        ) : short ? (
                          <Chip hue="coral">Store is short</Chip>
                        ) : null}
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
                      {(
                        [
                          ["Asked", l.quantity],
                          ["Issued", l.issued],
                          ["Left", left],
                          ["In store", l.inStore ?? 0],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-neutral-500">{k}</dt>
                          <dd className={cx("font-semibold tabular-nums", k === "In store" && short ? "text-coral-700" : "text-neutral-900")}>
                            {qty(v)} <span className="font-normal text-neutral-500">{l.unit}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="ws-hatch mt-3 flex h-2 overflow-hidden rounded-full" aria-hidden>
                      <span className="h-full bg-mint-500" style={{ width: `${issuedPct}%` }} />
                      <span className="h-full bg-sky-400" style={{ width: `${nowPct}%` }} />
                    </div>
                    {issuable && can.issue && left > 0 && (
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <div className="w-32">
                          <label htmlFor={`${uid}-q-${l.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                            Issue now<span className="sr-only">, {l.name}</span>
                          </label>
                          <input
                            id={`${uid}-q-${l.id}`}
                            inputMode="decimal"
                            value={typed[l.id] ?? ""}
                            onChange={(e) => setTyped((t) => ({ ...t, [l.id]: e.target.value }))}
                            aria-invalid={problem ? true : undefined}
                            aria-describedby={problem ? `${uid}-p-${l.id}` : undefined}
                            placeholder="0"
                            className={cx(inputClass, "text-right tabular-nums")}
                          />
                        </div>
                        <p className="pb-3 text-xs text-neutral-500">{l.unit}</p>
                      </div>
                    )}
                    {problem && (
                      <p id={`${uid}-p-${l.id}`} className="mt-1.5 text-xs font-medium text-error-700">
                        {problem}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-mint-500" />
                Issued
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-sky-400" />
                Issuing now
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="ws-hatch h-2.5 w-2.5 rounded-sm" />
                Still owed
              </li>
            </ul>
            {issuable && can.issue && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                <p className="text-sm text-neutral-600" aria-live="polite">
                  {plan.count ? `${plan.count} ${plan.count === 1 ? "line" : "lines"} to issue` : "Nothing to issue yet"}
                </p>
                <Button variant="primary" icon={PackageCheck} onClick={() => void issue()} disabled={busy !== null || plan.count === 0}>
                  {busy === "issue" ? "Issuing…" : "Issue the items"}
                </Button>
              </div>
            )}
            {!issuable && req.status === "in_approval" && <p className="mt-4 text-sm text-neutral-600">It is still with the approver. It can be issued once approved.</p>}
            {actionError && <ErrorNote className="mt-3">{actionError}</ErrorNote>}
          </Panel>

          <Panel title="Store issue vouchers" subtitle="What has left the store against this requisition" icon={FileText} hue="mint">
            {(req.issues ?? []).length === 0 ? (
              <Empty icon={FileText} title="Nothing issued yet" hint="Each issue raises a numbered voucher the requester acknowledges." hue="mint" />
            ) : (
              <ol className="space-y-3">
                {(req.issues ?? []).map((s) => (
                  <IssueCard key={s.id} issue={s} action={<PdfLink href={stores.requisitions.issuePdfUrl(s.id)} label="Print voucher" name={s.number} />} />
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="About this requisition">
          <Panel title="Details" icon={ClipboardList} hue="grape">
            <InfoList>
              <InfoRow icon={UserRound} label="Asked by">
                {req.requester ?? "-"}
              </InfoRow>
              <InfoRow icon={Store} label="From store">
                {req.store ?? "-"}
              </InfoRow>
              <InfoRow icon={ClipboardList} label="Charged to">
                {req.project ? `${req.project.name}${req.project.code ? ` (${req.project.code})` : ""}` : req.costCentreId ? "A cost centre" : "-"}
              </InfoRow>
              <InfoRow icon={Hourglass} label="Raised">
                {day(req.createdAt)}
              </InfoRow>
              {req.shortfallPr && (
                <InfoRow icon={ShoppingCart} label="Shortfall bought on">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/suite/operations/procurement/requests/${req.shortfallPr.id}`} className="font-semibold text-primary-700 hover:underline">
                      {req.shortfallPr.number ?? "Draft purchase request"}
                    </Link>
                    <PrStatusChip status={req.shortfallPr.status} />
                  </span>
                </InfoRow>
              )}
            </InfoList>
            {req.approvalId && (
              <div className="mt-3">
                <ApprovalLink id={req.approvalId} />
              </div>
            )}
          </Panel>
        </aside>
      </div>

      {closing && (
        <ReasonDialog
          title={req.status === "partly_issued" ? `Close ${req.number ?? "this requisition"}?` : `Cancel ${req.number ?? "this requisition"}?`}
          subtitle={
            req.status === "partly_issued"
              ? "It closes as issued: what has gone out stays on its vouchers, and nothing more is owed to the requester. This can't be undone."
              : "Nothing has been issued on it. The requester sees it as cancelled. This can't be undone."
          }
          label="Reason"
          placeholder="e.g. Item discontinued; requester agreed"
          tone="danger"
          confirmLabel={req.status === "partly_issued" ? "Close requisition" : "Cancel requisition"}
          busyLabel={req.status === "partly_issued" ? "Closing…" : "Cancelling…"}
          onClose={() => setClosing(false)}
          onConfirm={async (reason) => {
            const r = await stores.requisitions.close(req.id, reason);
            setClosing(false);
            setNotice(r.status === "cancelled" ? `${req.number ?? "Requisition"} cancelled.` : `${req.number ?? "Requisition"} closed as issued.`);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

export function IssueCard({ issue: s, action }: { issue: StoreIssue; action?: React.ReactNode }) {
  const value = s.lines.reduce((sum, l) => sum + Math.round(l.quantity * l.unitCost), 0);
  return (
    <li className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <DocNo value={s.number} className="!text-[13px] font-semibold text-neutral-800" />
          <p className="text-xs text-neutral-500">
            Issued {day(s.issuedAt)}
            {s.issuedBy ? ` by ${s.issuedBy}` : ""} · <Money value={value} />
          </p>
        </div>
        {s.acknowledgedAt ? (
          <Chip hue="mint" icon={CircleCheckBig}>
            Received {day(s.acknowledgedAt)}
          </Chip>
        ) : (
          <Chip hue="sun" icon={Hourglass}>
            Not acknowledged yet
          </Chip>
        )}
      </div>
      <ul className="mt-2 divide-y divide-neutral-100 text-sm">
        {s.lines.map((l) => (
          <li key={l.itemId} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate text-neutral-800">{l.name}</span>
            <span className="shrink-0 tabular-nums text-neutral-600">
              {qty(l.quantity)} {l.unit}
            </span>
          </li>
        ))}
      </ul>
      {action && <div className="mt-3">{action}</div>}
    </li>
  );
}
