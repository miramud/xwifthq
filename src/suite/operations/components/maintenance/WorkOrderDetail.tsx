"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  CircleCheck,
  ClipboardPen,
  Coins,
  Hammer,
  Hourglass,
  Lock,
  PackagePlus,
  Play,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  UserCheck,
  UserRound,
} from "lucide-react";
import { Button, Card, Chip, PageHeader, Panel, PersonAvatar, PriorityChip, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { ApiError, OPEN_STATUSES, maintenance, opsError, opsFieldErrors, type WarrantyOutcome, type WorkOrderFull, type WorkOrderPriority } from "@/lib/api/operations-maintenance-client";
import { AssetTag } from "@/suite/operations/components/assets/parts";
import { MoneyInput } from "@/suite/operations/components/travel/shared";
import { stampOf } from "@/suite/operations/components/assets/labels";
import { KIND_LABEL, PRIORITY_LABEL, PRIORITY_ORDER, STATUS_FLOW, WARRANTY, daysBetween, hoursBetween, workOrderStatus, ymdOf } from "./labels";
import { SlaDial, WorkOrderStatusChip } from "./parts";
import { useNow } from "./WorkOrderBoard";
import { AssignDialog, CancelDialog, CompleteDialog, PartDialog, PurchaseDialog } from "./WorkOrderDialogs";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

type Dialog = "assign" | "part" | "purchase" | "complete" | "cancel" | null;

/**
 * A work order: what is wrong and on what, its SLA clock, who has it; the
 * warranty gate before anything is paid for; parts from a store or to buy,
 * labour and the vendor's charge; the purchase request; downtime; and the
 * steps to complete, confirm or cancel it.
 */
export default function WorkOrderDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const now = useNow();
  const [wo, setWo] = useState<WorkOrderFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    maintenance.get(id).then(
      (w) => {
        if (!alive) return;
        setWo(w);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This work order wasn't found." : `This work order didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !wo) {
    return (
      <div>
        <BackLink href="/suite/operations/maintenance" label="Work orders" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!wo) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the work order…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[150px]" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const w = wo;
  const can = (a: string) => mayDoOps(user, "maintenance", a);
  const open = OPEN_STATUSES.includes(w.status);
  const done = (next: WorkOrderFull, message: string) => {
    setWo(next);
    setDialog(null);
    setActionError(null);
    setNotice(message);
  };

  const run = async (fn: () => Promise<WorkOrderFull>, message: string) => {
    setBusy(true);
    setActionError(null);
    try {
      done(await fn(), message);
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const ok = await confirm({
      title: "Start the work?",
      body: w.assetId ? "The asset is marked under maintenance and its downtime starts counting." : "Downtime starts counting from now.",
      confirmLabel: "Start work",
      tone: "primary",
    });
    if (ok) await run(() => maintenance.start(w.id), "Work started. Downtime is running.");
  };

  const confirmBack = async () => {
    const ok = await confirm({
      title: "Confirm it is fixed?",
      body: w.assetId ? "The asset goes back into service and the work order closes." : "The work order closes.",
      confirmLabel: "Confirm fixed",
      tone: "primary",
    });
    if (ok) await run(() => maintenance.confirm(w.id), "Confirmed. The work order is closed.");
  };

  const actions = (
    <>
      {open && can("cancel") && (
        <Button icon={Ban} onClick={() => setDialog("cancel")}>
          Cancel
        </Button>
      )}
      {open && can("assign") && (
        <Button icon={UserCheck} onClick={() => setDialog("assign")}>
          {w.assigneeId || w.vendorId ? "Reassign" : "Assign"}
        </Button>
      )}
      {(w.status === "open" || w.status === "assigned") && can("start") && (
        <Button variant="primary" icon={Play} disabled={busy} onClick={() => void start()}>
          Start work
        </Button>
      )}
      {(w.status === "in_progress" || w.status === "awaiting_parts") && can("complete") && (
        <Button variant="primary" icon={CircleCheck} onClick={() => setDialog("complete")}>
          Mark complete
        </Button>
      )}
      {w.status === "completed" && can("confirm") && (
        <Button variant="primary" icon={BadgeCheck} disabled={busy} onClick={() => void confirmBack()}>
          Confirm fixed
        </Button>
      )}
    </>
  );

  const step = STATUS_FLOW.indexOf(w.status);
  const today = ymdOf(new Date(now));
  const underWarranty = Boolean(w.warrantyUntil && w.warrantyUntil >= today);

  return (
    <div>
      <BackLink href="/suite/operations/maintenance" label="Work orders" />
      <PageHeader
        eyebrow={
          <span className="font-mono">
            {w.number ?? "Work order"} · <span className="font-sans">{KIND_LABEL[w.kind] ?? w.kind}</span>
          </span>
        }
        title={w.title}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <WorkOrderStatusChip status={w.status} />
            <PriorityChip priority={w.priority} />
            {w.overdue && <Chip hue="rose">SLA breached</Chip>}
          </span>
        }
        actions={actions}
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}
      {notice && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700 ring-1 ring-mint-500/20">
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {/* The SLA clock, what it is on, and the road the work travels. */}
      <Card className="mb-5 overflow-hidden">
        <div className="grid gap-6 p-5 md:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)] md:items-center">
          <SlaDial w={w} now={now} />
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">The work is on</p>
            {w.asset ? (
              <Link href={`/suite/operations/assets/${w.assetId}`} className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                <AssetTag tagNo={w.asset.tagNo} size="md" />
                <span className="mt-1 block truncate text-sm font-medium text-neutral-800 group-hover:underline">{w.asset.name}</span>
              </Link>
            ) : w.facility ? (
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Building2 size={16} className="text-grape-600" aria-hidden />
                {w.facility}
              </span>
            ) : (
              <span className="text-sm text-neutral-500">-</span>
            )}
            <p className="text-xs text-neutral-500">{w.dueAt ? `Due ${stampOf(w.dueAt)}` : "No SLA set"}</p>
          </div>
          <div>
            {w.status === "cancelled" ? (
              <p className="flex items-center gap-2 text-sm text-neutral-600">
                <Ban size={16} className="text-neutral-400" aria-hidden />
                Cancelled. {richExcerpt(w.resolution, 300).replace(/^Cancelled:\s*/, "")}
              </p>
            ) : (
              <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Where the work order is">
                {STATUS_FLOW.map((s, i) => {
                  const reached = step >= i;
                  const current = step === i;
                  return (
                    <li key={s} className="min-w-0">
                      <div className={cx("h-2 rounded-full", reached ? (current ? "bg-primary-500" : "bg-primary-300") : "ws-hatch")} />
                      <p className={cx("mt-2 truncate text-xs", current ? "font-semibold text-neutral-900" : reached ? "text-neutral-600" : "text-neutral-500")}>
                        {workOrderStatus(s).label}
                        {current && <span className="sr-only"> (now)</span>}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <FaultPanel wo={w} editable={open && can("update")} onSaved={(n) => done(n, "Saved.")} />

          {(underWarranty || w.warrantyClaim) && <WarrantyGate wo={w} underWarranty={underWarranty} editable={open && can("warranty")} today={today} onSaved={(n) => done(n, "Warranty outcome recorded.")} />}

          <Panel
            title="Parts"
            subtitle={w.parts.length ? `${w.parts.length} ${w.parts.length === 1 ? "line" : "lines"} · ${w.parts.filter((p) => p.source === "purchase").length} to buy` : "Issued from a store, or to buy"}
            icon={PackagePlus}
            hue="grape"
            actions={
              open && can("part") ? (
                <Button size="sm" icon={PackagePlus} onClick={() => setDialog("part")}>
                  Add a part
                </Button>
              ) : undefined
            }
          >
            {w.parts.length === 0 ? (
              <p className="py-3 text-sm text-neutral-500">No parts used yet.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <caption className="sr-only">Parts on this work order</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th scope="col" className="px-5 py-2">
                        Part
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Source
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Qty
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Unit cost
                      </th>
                      <th scope="col" className="px-5 py-2 text-right">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {w.parts.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-2.5 font-medium text-neutral-900">{p.description}</td>
                        <td className="px-3 py-2.5">
                          {p.source === "store" ? (
                            <Chip hue="mint" dot>
                              From store
                            </Chip>
                          ) : (
                            <Chip hue="sun" dot>
                              To buy
                            </Chip>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{p.quantity}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={p.unitCost} />
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold">
                          <Money value={p.cost} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <CostsPanel wo={w} editable={open && can("update")} onSaved={(n) => done(n, "Costs saved.")} />

          <Panel title="Purchase request" subtitle="Parts to buy and the vendor's service, through procurement" icon={ShoppingCart} hue="coral">
            {w.prId ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-700">
                  Drafted as <span className="font-mono font-semibold text-neutral-900">{w.pr ?? "a purchase request"}</span>. Whoever raised it sends it for approval from their requests.
                </p>
                <Link href={`/suite/operations/my/requests/${w.prId}`} className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50">
                  Open the request
                </Link>
              </div>
            ) : w.warrantyBlock ? (
              <p className="flex items-start gap-2 text-sm text-neutral-600">
                <Lock size={16} className="mt-0.5 shrink-0 text-sun-600" aria-hidden />
                Waiting on the warranty outcome: a paid repair can&apos;t be requested yet.
              </p>
            ) : open && can("purchase") ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-600">
                  {w.parts.some((p) => p.source === "purchase") ? "The parts to buy are listed. Add the vendor's estimate and draft the request." : "Add parts to buy, or request the vendor's service on its own."}
                </p>
                <Button icon={Receipt} onClick={() => setDialog("purchase")}>
                  Raise purchase request
                </Button>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No purchase request.</p>
            )}
          </Panel>

          {w.resolution && w.status !== "cancelled" && (
            <Panel title="What was done" icon={Hammer} hue="mint">
              <RichTextView value={w.resolution} size="sm" className="text-neutral-800" />
              {w.usageAt !== null && <p className="mt-2 text-xs text-neutral-500">Meter at completion: {w.usageAt}</p>}
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="People" icon={UserRound} hue="blue">
            <ul className="space-y-3">
              <Person label="Technician" name={w.assignee} empty="Nobody assigned" />
              <Person label="Vendor" name={w.vendor} empty="No vendor" vendor />
              <Person label="Reported by" name={w.requestedBy} empty={w.kind === "preventive" ? "Raised by its plan" : "-"} />
              {w.confirmedBy && <Person label="Confirmed by" name={w.confirmedBy} empty="" />}
            </ul>
          </Panel>

          <DowntimePanel wo={w} now={now} />

          <Panel title="Dates" icon={CalendarClock} hue="sky">
            <dl className="space-y-2.5 text-sm">
              {(
                [
                  ["Raised", w.createdAt],
                  ["Due", w.dueAt],
                  ["Started", w.startedAt],
                  ["Completed", w.completedAt],
                  ["Confirmed", w.confirmedAt],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className={cx("text-right tabular-nums", v ? "text-neutral-900" : "text-neutral-400")}>{v ? stampOf(v) : "-"}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      {dialog === "assign" && <AssignDialog wo={w} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "part" && <PartDialog wo={w} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "purchase" && <PurchaseDialog wo={w} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "complete" && <CompleteDialog wo={w} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "cancel" && <CancelDialog wo={w} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
}

function Person({ label, name, empty, vendor = false }: { label: string; name: string | null; empty: string; vendor?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      {name ? (
        vendor ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral-50 text-coral-700">
            <Building2 size={16} aria-hidden />
          </span>
        ) : (
          <PersonAvatar name={name} size={36} />
        )
      ) : (
        <span className="ws-hatch h-9 w-9 shrink-0 rounded-full" aria-hidden />
      )}
      <span className="min-w-0">
        <span className="block text-xs text-neutral-500">{label}</span>
        <span className={cx("block truncate text-sm font-semibold", name ? "text-neutral-900" : "text-neutral-500")}>{name ?? empty}</span>
      </span>
    </li>
  );
}

/* ---------------------------- fault ---------------------------------- */

function FaultPanel({ wo, editable, onSaved }: { wo: WorkOrderFull; editable: boolean; onSaved: (w: WorkOrderFull) => void }) {
  const uid = useId();
  const [diagnosis, setDiagnosis] = useState(wo.diagnosis ?? "");
  const [priority, setPriority] = useState<WorkOrderPriority>(wo.priority);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = diagnosis.trim() !== (wo.diagnosis ?? "") || priority !== wo.priority;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await maintenance.update(wo.id, { diagnosis: diagnosis.trim() || null, priority }));
    } catch (e) {
      setError(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Fault and diagnosis" icon={Stethoscope} hue="coral">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{wo.kind === "preventive" ? "Checklist" : "Fault reported"}</p>
          <p className={cx("mt-1 whitespace-pre-line text-sm", wo.fault ? "text-neutral-800" : "text-neutral-500")}>{wo.fault || "No details given."}</p>
        </div>
        {editable ? (
          <>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <div>
                <label htmlFor={`${uid}-diag`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Diagnosis
                </label>
                <RichTextEditor id={`${uid}-diag`} minHeight={102} value={diagnosis} onChange={setDiagnosis} placeholder="What the technician found." />
              </div>
              <div>
                <label htmlFor={`${uid}-prio`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Priority
                </label>
                <SearchableSelect id={`${uid}-prio`} value={priority} onChange={(v) => setPriority(v as WorkOrderPriority)} options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
                <p className="mt-1.5 text-xs text-neutral-500">The SLA stays as set when it was raised.</p>
              </div>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end">
              <Button icon={ClipboardPen} disabled={!dirty || busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save diagnosis"}
              </Button>
            </div>
          </>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Diagnosis</p>
            {wo.diagnosis ? <RichTextView value={wo.diagnosis} size="sm" className="mt-1 text-neutral-800" /> : <p className="mt-1 text-sm text-neutral-500">None recorded.</p>}
          </div>
        )}
      </div>
    </Panel>
  );
}

/* --------------------------- warranty -------------------------------- */

const OUTCOMES: WarrantyOutcome[] = ["submitted", "accepted", "rejected", "not_applicable"];

/**
 * Warranty first (§12.5 #3): while the asset is under warranty, a paid
 * repair (a vendor's charge, a purchase request) waits for the claim to be
 * rejected or marked not applicable. The gate shows how long cover runs,
 * where the claim stands, and why money is locked.
 */
function WarrantyGate({ wo, underWarranty, editable, today, onSaved }: { wo: WorkOrderFull; underWarranty: boolean; editable: boolean; today: string; onSaved: (w: WorkOrderFull) => void }) {
  const uid = useId();
  const [outcome, setOutcome] = useState<WarrantyOutcome | "">(wo.warrantyClaim ?? "");
  const [note, setNote] = useState(wo.warrantyNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const left = wo.warrantyUntil ? daysBetween(today, wo.warrantyUntil) : null;
  const current = wo.warrantyClaim ? WARRANTY[wo.warrantyClaim] : null;

  const save = async () => {
    if (!outcome) {
      setError("Choose where the claim stands.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(await maintenance.warranty(wo.id, outcome, note.trim() || null));
    } catch (e) {
      setError(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Warranty gate"
      subtitle={underWarranty ? "Claim on the warranty before paying for a repair" : "The warranty has ended"}
      icon={ShieldCheck}
      hue="mint"
      actions={current ? <Chip hue={current.hue} icon={current.icon}>{current.label}</Chip> : undefined}
    >
      <div className="grid gap-5 md:grid-cols-[13rem_minmax(0,1fr)]">
        <div className={cx("rounded-xl p-4", underWarranty ? "bg-mint-50" : "bg-neutral-50")}>
          <ShieldCheck size={22} className={underWarranty ? "text-mint-600" : "text-neutral-400"} aria-hidden />
          <p className="mt-2 text-xs font-medium text-neutral-500">Under warranty until</p>
          <p className="text-lg font-bold text-neutral-900">{day(wo.warrantyUntil)}</p>
          {left !== null && <p className={cx("text-xs font-semibold", left < 0 ? "text-neutral-500" : left <= 30 ? "text-sun-700" : "text-mint-700")}>{left < 0 ? "Ended" : left === 0 ? "Ends today" : `${left} days left`}</p>}
        </div>
        <div className="space-y-4">
          {wo.warrantyBlock ? (
            <p role="note" className="flex items-start gap-2 rounded-xl border border-sun-500/30 bg-sun-50 px-3.5 py-3 text-sm text-sun-700">
              <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="block font-semibold">Paid repair locked</span>
                {wo.warrantyBlock}
              </span>
            </p>
          ) : (
            underWarranty && (
              <p className="flex items-start gap-2 rounded-xl bg-mint-50 px-3.5 py-3 text-sm text-mint-700">
                <Coins size={16} className="mt-0.5 shrink-0" aria-hidden />
                {wo.warrantyClaim === "accepted" ? "The provider repairs it under warranty." : "A paid repair may go ahead."}
              </p>
            )
          )}
          {editable ? (
            <>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-neutral-700">The claim</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OUTCOMES.map((o) => {
                    const m = WARRANTY[o];
                    const Icon = m.icon;
                    const on = outcome === o;
                    return (
                      <label
                        key={o}
                        className={cx(
                          "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-300",
                          on ? "border-primary-500 bg-primary-50/60" : "border-neutral-200 hover:border-neutral-300",
                        )}
                      >
                        <input type="radio" name={`${uid}-outcome`} value={o} checked={on} onChange={() => setOutcome(o)} className="sr-only" />
                        <Icon size={16} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden />
                        <span>
                          <span className="block font-semibold text-neutral-900">{m.label}</span>
                          <span className="block text-xs text-neutral-500">{m.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div>
                <label htmlFor={`${uid}-note`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Claim reference or note
                </label>
                <input id={`${uid}-note`} className={inputClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Provider case 4411; collected 3 Oct" />
              </div>
              {error && <ErrorNote>{error}</ErrorNote>}
              <div className="flex justify-end">
                <Button icon={ShieldCheck} disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving…" : "Record outcome"}
                </Button>
              </div>
            </>
          ) : (
            wo.warrantyNote && <p className="text-sm text-neutral-700">{wo.warrantyNote}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------- costs ---------------------------------- */

function CostsPanel({ wo, editable, onSaved }: { wo: WorkOrderFull; editable: boolean; onSaved: (w: WorkOrderFull) => void }) {
  const uid = useId();
  const [hours, setHours] = useState(wo.labourHours ? String(wo.labourHours) : "");
  const [labour, setLabour] = useState<number | null>(wo.labourCost || null);
  const [vendor, setVendor] = useState<number | null>(wo.vendorCost || null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const total = wo.partsCost + wo.labourCost + wo.vendorCost;
  const parts = [
    { key: "parts", label: "Parts", value: wo.partsCost, cls: "bg-grape-500" },
    { key: "labour", label: "Labour", value: wo.labourCost, cls: "bg-sky-500" },
    { key: "vendor", label: "Vendor", value: wo.vendorCost, cls: "bg-coral-500" },
  ];
  const locked = Boolean(wo.warrantyBlock);

  const save = async () => {
    const h = hours.trim() ? Number(hours.trim()) : null;
    if (h !== null && (!Number.isFinite(h) || h < 0)) {
      setErrors({ labourHours: "Hours are a number, like 2.5." });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      onSaved(await maintenance.update(wo.id, { labourHours: h, labourCost: labour ?? 0, ...(locked ? {} : { vendorCost: vendor ?? 0 }) }));
    } catch (e) {
      const f = opsFieldErrors(e);
      setErrors(Object.keys(f).length ? f : { general: opsError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Labour and costs" subtitle={`${wo.labourHours ? `${wo.labourHours} hours of labour · ` : ""}what this work has cost so far`} icon={Coins} hue="sky" actions={<Money value={total} className="text-lg font-bold text-neutral-900" />}>
      <div className="mb-5">
        <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label} ${p.value / 100}`).join(", ")}>
          {total === 0 ? <span className="ws-hatch h-full flex-1" /> : parts.map((p) => p.value > 0 && <span key={p.key} className={cx("h-full", p.cls)} style={{ width: `${(100 * p.value) / total}%` }} />)}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600">
          {parts.map((p) => (
            <li key={p.key} className="inline-flex items-center gap-1.5">
              <span className={cx("h-2.5 w-2.5 rounded-full", p.cls)} aria-hidden />
              {p.label} <Money value={p.value} className="font-semibold text-neutral-800" />
            </li>
          ))}
        </ul>
      </div>
      {editable && (
        <div className="space-y-4">
          {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`${uid}-h`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                Labour hours
              </label>
              <input id={`${uid}-h`} inputMode="decimal" className={inputClass} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" aria-invalid={errors.labourHours ? true : undefined} />
              <FieldError message={errors.labourHours} />
            </div>
            <div>
              <label htmlFor={`${uid}-l`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                Labour cost
              </label>
              <MoneyInput id={`${uid}-l`} value={labour} onChange={setLabour} />
              <FieldError message={errors.labourCost} />
            </div>
            <div>
              <label htmlFor={`${uid}-v`} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
                Vendor&apos;s charge {locked && <Lock size={12} className="text-sun-600" aria-label="Locked by the warranty" />}
              </label>
              {locked ? (
                <p className="flex h-11 items-center rounded-xl bg-sun-50 px-3.5 text-xs font-medium text-sun-700">Locked until the warranty claim is settled</p>
              ) : (
                <MoneyInput id={`${uid}-v`} value={vendor} onChange={setVendor} />
              )}
              <FieldError message={errors.vendorCost ?? errors.warrantyClaim} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button icon={Coins} disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save costs"}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* --------------------------- downtime -------------------------------- */

/** Downtime: from when work started to completion (or now), against the SLA window. */
function DowntimePanel({ wo, now }: { wo: WorkOrderFull; now: number }) {
  const hours = hoursBetween(wo.downtimeFrom, wo.downtimeTo, now);
  const running = Boolean(wo.downtimeFrom && !wo.downtimeTo);
  const sla = wo.dueAt && wo.createdAt ? Math.max(1, (Date.parse(wo.dueAt) - Date.parse(wo.createdAt)) / 3_600_000) : null;
  const pct = hours !== null && sla ? Math.min(100, (100 * hours) / sla) : 0;
  return (
    <Panel title="Downtime" icon={Hourglass} hue="sun">
      {hours === null ? (
        <p className="text-sm text-neutral-500">Not started. Downtime counts from when work starts.</p>
      ) : (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-neutral-900">{hours}</span>
            <span className="text-sm text-neutral-500">hours{running ? " and counting" : ""}</span>
          </p>
          {sla && (
            <div className="mt-3">
              <div className="ws-hatch h-2.5 overflow-hidden rounded-full" role="img" aria-label={`${hours} hours down against an SLA of ${Math.round(sla)} hours`}>
                <div className={cx("h-full rounded-full", hours > sla ? "bg-rose-500" : "bg-sun-500")} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-neutral-500">Against an SLA window of {Math.round(sla)} hours</p>
            </div>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            From {stampOf(wo.downtimeFrom)}
            {wo.downtimeTo ? ` to ${stampOf(wo.downtimeTo)}` : ""}
          </p>
        </>
      )}
    </Panel>
  );
}
