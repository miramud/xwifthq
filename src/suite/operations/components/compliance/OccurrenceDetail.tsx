"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  CheckCheck,
  CircleAlert,
  Download,
  FileCheck2,
  FileText,
  HandCoins,
  History,
  Info,
  Paperclip,
  PenLine,
  PlayCircle,
  ReceiptText,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Card, Chip, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { todayYmd } from "@/components/workspace/Calendar";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { stampOf } from "@/suite/operations/components/assets/labels";
import { FactRow } from "@/suite/operations/components/travel/shared";
import { ApiError, compliance, opsError, type ComplianceBoard, type ComplianceStage, type OccurrenceDetail as Detail } from "@/lib/api/operations-compliance-client";
import { ObligationDialog } from "./ObligationDialog";
import { CompleteDialog, MemoDialog, SubmitDialog } from "./OccurrenceDialogs";
import { StageChip, fileSize } from "./parts";
import { categoryHue, dueRuleText, dueText, reminderText, sortOffsets } from "./labels";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * One time an obligation falls due: where it stands, the evidence on file
 * (nothing completes without it), the filing reference, the fee's payment
 * memo, the reminders that went out, and the obligation's past occurrences.
 */

type Dialog = "submit" | "complete" | "memo" | "edit" | null;

const STEPS: { stage: ComplianceStage; label: string }[] = [
  { stage: "upcoming", label: "Upcoming" },
  { stage: "due_soon", label: "Due soon" },
  { stage: "in_progress", label: "In progress" },
  { stage: "submitted", label: "Submitted" },
  { stage: "completed", label: "Completed" },
];

/** Which step an occurrence is on; an overdue one is on the step its status says. */
export function stepIndex(stage: ComplianceStage, status: string): number {
  if (stage === "overdue") return status === "in_progress" ? 2 : 1;
  return Math.max(0, STEPS.findIndex((s) => s.stage === stage));
}

export default function OccurrenceDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [occ, setOcc] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [meta, setMeta] = useState<ComplianceBoard | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let alive = true;
    compliance.occurrence(id).then(
      (d) => {
        if (!alive) return;
        setOcc(d);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This compliance item wasn't found." : `This compliance item didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !occ) {
    return (
      <div>
        <BackLink href="/suite/operations/compliance" label="Compliance" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!occ) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the compliance item…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const o = occ.obligation;
  const can = (a: string) => mayDoOps(user, "compliance", a);
  const today = todayYmd();
  const closed = occ.stage === "completed" || occ.stage === "cancelled";
  const open = !closed && occ.status === "open";
  const step = stepIndex(occ.stage, occ.status);
  const late = occ.stage === "overdue";
  const done = () => {
    setDialog(null);
    setActionError(null);
    refresh();
  };

  const start = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await compliance.start(occ.id);
      refresh();
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setActionError(null);
    try {
      await compliance.uploadEvidence(occ.id, file);
      refresh();
    } catch (e) {
      setActionError(`${file.name} wasn't attached. ${opsError(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (attachmentId: string, name: string) => {
    const ok = await confirm({ title: "Remove this evidence?", body: `${name} comes off this item. Upload it again if you need it back.`, confirmLabel: "Remove" });
    if (!ok) return;
    setActionError(null);
    try {
      await compliance.removeEvidence(occ.id, attachmentId);
      refresh();
    } catch (e) {
      setActionError(opsError(e));
    }
  };

  const openEdit = () => {
    setDialog("edit");
    if (!meta) compliance.board({ from: today, to: today }).then(setMeta, (e: unknown) => setActionError(opsError(e)));
  };

  const actions = (
    <>
      {can("update") && (
        <Button icon={PenLine} onClick={openEdit}>
          Edit obligation
        </Button>
      )}
      {open && can("start") && (
        <Button icon={PlayCircle} disabled={busy} onClick={() => void start()}>
          Start work
        </Button>
      )}
      {!closed && occ.status !== "submitted" && can("submit") && (
        <Button icon={Send} onClick={() => setDialog("submit")}>
          Mark submitted
        </Button>
      )}
      {!closed && can("complete") && (
        <Button variant="primary" icon={CheckCheck} onClick={() => setDialog("complete")}>
          {o.isCertificate ? "Record certificate" : "Mark completed"}
        </Button>
      )}
    </>
  );

  return (
    <div>
      <BackLink href="/suite/operations/compliance" label="Compliance" />
      <PageHeader
        eyebrow={[o.categoryLabel, o.authority].filter(Boolean).join(" · ")}
        title={o.name}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <StageChip stage={occ.stage} />
            {occ.period && <Chip hue={categoryHue(o.category)}>{occ.period}</Chip>}
            {o.mandatory && <Chip hue="rose">Mandatory</Chip>}
            {o.isCertificate && <Chip hue="mint">Certificate</Chip>}
          </span>
        }
        actions={actions}
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      {/* Where it stands, and how long is left. */}
      <Card className="mb-5 overflow-hidden">
        <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className={cx("flex min-w-[9rem] flex-col rounded-2xl px-5 py-4", late ? "bg-rose-50 text-rose-700" : closed ? "bg-mint-50 text-mint-700" : "bg-primary-50 text-primary-800")}>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{closed ? "Completed" : "Due"}</span>
            <span className="text-2xl font-bold tabular-nums">{closed ? day(occ.completedAt?.slice(0, 10) ?? null) : day(occ.dueOn)}</span>
            <span className="text-sm font-semibold">{closed ? (occ.completedBy ? `By ${occ.completedBy}` : "") : dueText(occ.dueOn, today, occ.stage)}</span>
          </div>
          <div>
            <ol className="grid grid-cols-5 gap-2" aria-label="Where this item stands">
              {STEPS.map((s, i) => {
                const reached = step >= i;
                const current = step === i;
                const isLate = late && current;
                return (
                  <li key={s.stage} className="min-w-0">
                    <div className={cx("h-2 rounded-full", isLate ? "bg-rose-500" : reached ? (current ? "bg-primary-500" : "bg-primary-300") : "ws-hatch")} />
                    <p className={cx("mt-2 truncate text-xs", isLate ? "font-semibold text-rose-700" : current ? "font-semibold text-neutral-900" : reached ? "text-neutral-600" : "text-neutral-500")}>
                      {isLate ? "Overdue" : s.label}
                      {current && <span className="sr-only"> (now)</span>}
                    </p>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-sm text-neutral-600">
              {dueRuleText(o.dueRule, o.frequency)}
              {o.owner || o.ownerRole ? ` · owned by ${o.owner ?? o.ownerRole}` : ""}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel
            title="Evidence"
            subtitle={closed ? "Kept on file with the completed item" : "Required to complete this item"}
            icon={Paperclip}
            hue="sky"
            actions={
              !closed && can("evidence") ? (
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-primary-600 px-3 text-[13px] font-semibold text-white outline-none focus-within:ring-2 focus-within:ring-primary-300 hover:bg-primary-700">
                  <Upload size={15} aria-hidden />
                  {uploading ? "Uploading…" : "Upload evidence"}
                  <input
                    type="file"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      void upload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : undefined
            }
          >
            {o.evidenceRequired && (
              <p className="mb-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3.5 py-2.5 text-sm text-sky-700">
                <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold">What counts: </span>
                  {o.evidenceRequired}
                </span>
              </p>
            )}
            {occ.evidence.length === 0 ? (
              <div className="ws-hatch rounded-2xl px-5 py-8 text-center">
                <p className="text-sm font-semibold text-neutral-800">No evidence yet</p>
                <p className="mt-1 text-sm text-neutral-600">{closed ? "Nothing was attached." : "Upload the receipt, acknowledgement or certificate. It cannot be completed without one."}</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                {occ.evidence.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                      <FileText size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <a href={compliance.evidenceHref(f.id)} className="block truncate text-sm font-semibold text-neutral-900 hover:text-primary-700 hover:underline">
                        {f.name}
                      </a>
                      <span className="block truncate text-xs text-neutral-500">{[fileSize(f.size), f.uploadedBy, f.uploadedAt ? stampOf(f.uploadedAt) : null].filter(Boolean).join(" · ")}</span>
                    </span>
                    <a
                      href={compliance.evidenceHref(f.id)}
                      aria-label={`Download ${f.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <Download size={17} aria-hidden />
                    </a>
                    {!closed && can("remove_evidence") && (
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => void remove(f.id, f.name)}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <Trash2 size={17} aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Filing" subtitle="What was filed and what came back" icon={FileCheck2} hue="grape">
            <dl className="grid gap-4 sm:grid-cols-3">
              <FactRow label="Period">{occ.period ?? "—"}</FactRow>
              <FactRow label="Due on">{day(occ.dueOn)}</FactRow>
              <FactRow label="Reference">{occ.reference ? <span className="font-mono">{occ.reference}</span> : "—"}</FactRow>
              {o.isCertificate && (
                <>
                  <FactRow label="Issued on">{day(occ.issuedOn)}</FactRow>
                  <FactRow label="Expires on">{day(occ.expiresOn)}</FactRow>
                </>
              )}
              <FactRow label="Completed">{occ.completedAt ? `${stampOf(occ.completedAt)}${occ.completedBy ? ` by ${occ.completedBy}` : ""}` : "—"}</FactRow>
            </dl>
            {occ.notes && <RichTextView value={occ.notes} size="sm" className="mt-5 rounded-xl bg-neutral-50 px-4 py-3 text-neutral-700" />}
          </Panel>

          <Panel title="Earlier occurrences" subtitle="The same obligation, newest first" icon={History} hue="slate">
            {occ.history.length === 0 ? (
              <p className="py-4 text-sm text-neutral-500">This is the first one on the register.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Earlier occurrences of {o.name}</caption>
                  <thead>
                    <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      <th scope="col" className="px-5 py-2.5">
                        Period
                      </th>
                      <th scope="col" className="px-5 py-2.5">
                        Due
                      </th>
                      <th scope="col" className="px-5 py-2.5">
                        Stage
                      </th>
                      <th scope="col" className="hidden px-5 py-2.5 sm:table-cell">
                        Reference
                      </th>
                      <th scope="col" className="hidden px-5 py-2.5 md:table-cell">
                        Evidence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {occ.history.map((h) => (
                      <tr key={h.id} className="hover:bg-neutral-50/60">
                        <td className="px-5 py-3">
                          <Link href={`/suite/operations/compliance/${h.id}`} className="font-semibold text-primary-700 underline-offset-2 hover:underline">
                            {h.period ?? "—"}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 tabular-nums text-neutral-700">{day(h.dueOn)}</td>
                        <td className="px-5 py-3">
                          <StageChip stage={h.stage} />
                        </td>
                        <td className="hidden px-5 py-3 font-mono text-xs text-neutral-600 sm:table-cell">{h.reference ?? "—"}</td>
                        <td className="hidden px-5 py-3 tabular-nums text-neutral-600 md:table-cell">{h.evidenceCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          {(o.needsPayment || occ.memoId) && (
            <Panel title="Payment" subtitle="The fee, paid through Finance" icon={HandCoins} hue="mint">
              {occ.memoId ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-600">Memo</span>
                    <Link href={`/suite/finance/memos/${occ.memoId}`} className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-primary-700 underline-offset-2 hover:underline">
                      <ReceiptText size={15} aria-hidden />
                      {occ.memo?.reference ?? "Open the memo"}
                    </Link>
                  </div>
                  {occ.memo && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-neutral-600">Status</span>
                        <Chip hue={occ.memo.paid > 0 ? "mint" : "sky"}>{occ.memo.status.replace(/_/g, " ")}</Chip>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-neutral-600">Amount</span>
                        <Money value={occ.memo.amount || occ.amount} className="font-semibold text-neutral-900" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-neutral-600">Paid</span>
                        <Money value={occ.memo.paid} className="font-semibold text-neutral-900" />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-600">
                    {o.typicalFee ? (
                      <>
                        Usually <Money value={o.typicalFee} className="font-semibold text-neutral-900" />.{" "}
                      </>
                    ) : null}
                    Raise a draft payment memo and send it through Finance.
                  </p>
                  {!closed && can("memo") && (
                    <Button icon={HandCoins} onClick={() => setDialog("memo")} className="w-full">
                      Raise payment memo
                    </Button>
                  )}
                </div>
              )}
            </Panel>
          )}

          <Panel title="Reminders" subtitle="Sent to the owner before it falls due" icon={BellRing} hue="sun">
            <p className="text-sm text-neutral-600">
              {o.reminderDays.length ? `${sortOffsets(o.reminderDays).join(", ")} days before, then an overdue notice.` : "Only the overdue notice."}
            </p>
            {occ.reminders.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">None sent for this one yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {occ.reminders.map((r) => (
                  <li key={`${r.kind}-${r.sentAt}`} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                    <span className={cx("inline-flex items-center gap-2 font-medium", r.kind === "overdue" ? "text-rose-700" : "text-neutral-800")}>
                      {r.kind === "overdue" ? <CircleAlert size={14} aria-hidden /> : <BellRing size={14} className="text-sun-600" aria-hidden />}
                      {reminderText(r.kind)}
                    </span>
                    <span className="text-xs tabular-nums text-neutral-500">{r.sentAt ? stampOf(r.sentAt.replace(" ", "T")) : "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {dialog === "submit" && <SubmitDialog occ={occ} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "complete" && <CompleteDialog occ={occ} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "memo" && <MemoDialog occ={occ} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "edit" && meta && (
        <ObligationDialog obligation={o} categories={meta.categories} frequencies={meta.frequencies} owners={meta.owners} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}
