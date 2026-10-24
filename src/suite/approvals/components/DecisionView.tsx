"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CirclePause,
  CornerUpLeft,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  Hand,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Route as RouteIcon,
  ScrollText,
  Send,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Undo2,
  UserRound,
  UserRoundSearch,
  Wallet,
  X,
} from "lucide-react";
import { Button, Chip, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ENROL_HREF, StepUpDialog, stepUpReason } from "@/components/workspace/StepUpDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { isRichBlank, richExcerpt } from "@/lib/richText";
import { ErrorNote, FaceAvatar, IconTile, InfoList, InfoRow, Skeleton, hintClass, inputClass, labelClass } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  approvals,
  formatMoney,
  type ApprovalDetail,
  type MessageView,
  type StageView,
  type TaskView,
} from "@/lib/api/approvals-client";
import {
  approveVerb,
  flagLabel,
  formatDateTime,
  humanise,
  instanceStatus,
  koboToNaira,
  nairaToKobo,
  trailLabel,
} from "../lib/labels";
import { refreshApprovalCounts } from "../lib/useApprovalCounts";
import { processTile } from "../lib/tiles";
import { ColleaguePicker } from "./ColleaguePicker";
import { RouteTimeline } from "./RouteTimeline";

/*
  The decision view: everything somebody needs to decide on a request, and
  the means to decide it, on one screen.

  The header says what it is and what it is worth, with any warning the
  engine raised in plain words. The route shows where it has been and where
  it waits. The actions are only the ones this person may take on their own
  open task. The backend refuses the rest, but offering them would be a lie.

  Every decision sends the revision the person was looking at. If somebody
  else acted in the meantime the API answers 409, and the view reloads with
  a sentence saying why, rather than applying a decision to a request the
  person has not seen.
*/

export const STALE_MESSAGE = "This request changed while you had it open. Here is the latest: check it and decide again.";

type Mode = null | "amend" | "hold" | "ask" | "refer";

type FieldErrors = Record<string, string>;

function fieldErrors(e: ApiError): FieldErrors {
  const out: FieldErrors = {};
  for (const [k, v] of Object.entries(e.errors ?? {})) out[k] = v[0];
  return out;
}

/** The open task(s) this viewer holds, with their stage. */
export function myTasks(detail: ApprovalDetail): { task: TaskView; stage: StageView }[] {
  const ids = new Set(detail.viewer.openTaskIds);
  const out: { task: TaskView; stage: StageView }[] = [];
  for (const stage of detail.stages) {
    for (const task of stage.tasks) if (ids.has(task.id)) out.push({ task, stage });
  }
  return out;
}

/** What the actions panel offers for one task. Pure, so the rules are testable. */
export function availableActions(detail: ApprovalDetail, task: TaskView, stage: StageView) {
  const onHold = task.status === "on_hold";
  const ack = stage.type === "acknowledge";
  const review = stage.type === "review";
  return {
    approve: !onHold,
    approveLabel: approveVerb(stage.type),
    amend: !onHold && !ack && !review && stage.canAmend.includes("amount") && detail.amount != null,
    returnForChanges: !onHold && !ack,
    reject: !onHold && !ack && !review,
    hold: !onHold && !ack,
    release: onHold,
    claim: !onHold && task.source === "pool",
    ask: !onHold && !ack,
    refer: !onHold && !ack,
    commentRequired: detail.flags.length > 0 && !ack,
    /** Approving needs the approver's authenticator code (rejecting, returning and holding never do). */
    stepUp: Boolean(task.stepUp) && !ack,
  };
}

export function DecisionView({
  id,
  variant = "page",
  onClose,
  onChanged,
}: {
  id: string;
  variant?: "page" | "panel";
  onClose?: () => void;
  /** Told after any change, so a list can refresh. */
  onChanged?: (detail: ApprovalDetail) => void;
}) {
  const confirm = useConfirm();
  const uid = useId();

  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);

  const [taskIndex, setTaskIndex] = useState(0);
  const [mode, setMode] = useState<Mode>(null);
  const [comment, setComment] = useState("");
  const [amount, setAmount] = useState("");
  const [until, setUntil] = useState("");
  const [question, setQuestion] = useState("");
  const [referTo, setReferTo] = useState("");
  const [referNote, setReferNote] = useState("");
  const [reply, setReply] = useState("");
  /** The approval waiting for an authenticator code: what to send once it is typed. */
  const [stepUp, setStepUp] = useState<null | { taskId: string; revision: number; comment?: string; lower: number | null; done: string }>(null);

  useEffect(() => {
    let alive = true;
    approvals
      .get(id)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadError(
          e instanceof ApiError && e.status === 404
            ? "No request with that link. It may have been withdrawn."
            : e instanceof ApiError && e.status === 403
              ? "This request isn't shared with you."
              : "The request didn't load. Try again.",
        );
      });
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  const tasks = useMemo(() => (detail ? myTasks(detail) : []), [detail]);
  const current = tasks[Math.min(taskIndex, Math.max(0, tasks.length - 1))];

  const resetForms = () => {
    setMode(null);
    setComment("");
    setAmount("");
    setUntil("");
    setQuestion("");
    setReferTo("");
    setReferNote("");
    setReply("");
    setErrors({});
  };

  /** After a decision went through: show it, clear the forms, refresh counts. */
  const applied = useCallback(
    (next: ApprovalDetail, done: string) => {
      setDetail(next);
      resetForms();
      setNotice(done);
      void refreshApprovalCounts();
      onChanged?.(next);
    },
    [onChanged],
  );

  /** Runs one action: busy state, error mapping, 409 reload, counts refresh. */
  const run = useCallback(
    async (key: string, fn: () => Promise<ApprovalDetail>, done: string, onStepUp?: () => void) => {
      setBusy(key);
      setError(null);
      setErrors({});
      setNotice(null);
      try {
        applied(await fn(), done);
      } catch (e) {
        const reason = stepUpReason(e);
        if (onStepUp && (reason === "MFA_REQUIRED" || reason === "MFA_NOT_ENROLLED")) {
          // The amount reached the step-up limit after this screen loaded: ask for the code now.
          onStepUp();
        } else if (e instanceof ApiError && e.status === 409) {
          setError(STALE_MESSAGE);
          setReloadKey((k) => k + 1);
        } else if (e instanceof ApiError && e.status === 403) {
          setError("This isn't yours to decide any more. It may have been claimed or reassigned.");
          setReloadKey((k) => k + 1);
        } else if (e instanceof ApiError && e.status === 422) {
          const fe = fieldErrors(e);
          setErrors(fe);
          if (Object.keys(fe).length === 0) setError(e.message);
        } else {
          setError("That didn't go through. Check your connection and try again.");
        }
      } finally {
        setBusy(null);
      }
    },
    [applied],
  );

  if (loadError) {
    return (
      <div className="space-y-3">
        <ErrorNote>{loadError}</ErrorNote>
        <Button icon={RefreshCw} onClick={() => setReloadKey((k) => k + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading the request">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const status = instanceStatus(detail.status);
  const acts = current ? availableActions(detail, current.task, current.stage) : null;
  const rev = detail.revision;
  const people = knownPeople(detail);

  /* ---------------------------- handlers ---------------------------- */

  const approve = () => {
    if (!current || !acts) return;
    const lower = mode === "amend" ? nairaToKobo(amount) : null;
    if (mode === "amend") {
      if (lower === null || Number.isNaN(lower)) return setErrors({ amendments: "Enter the amount you approve, in naira." });
      if (detail.amount != null && lower >= detail.amount) {
        return setErrors({ amendments: `Enter less than ${formatMoney(detail.amount, detail.currency)}. You can lower an amount, never raise it.` });
      }
    }
    if (acts.commentRequired && isRichBlank(comment)) {
      return setErrors({ comment: "This request carries a warning. Say why you are approving it." });
    }
    const verb = acts.approveLabel;
    const done = verb === "Recommend" ? "Recommended." : verb === "Acknowledge" ? "Acknowledged." : lower != null ? `Approved at ${formatMoney(lower, detail.currency)}.` : "Approved.";
    const pending = { taskId: current.task.id, revision: rev, comment: comment.trim() || undefined, lower, done };
    if (acts.stepUp) {
      setError(null);
      setErrors({});
      setStepUp(pending);
      return;
    }
    void run(
      "approve",
      () => approvals.approve(current.task.id, rev, pending.comment, lower != null ? { amount: lower } : undefined),
      done,
      () => setStepUp(pending),
    );
  };

  /** The step-up dialog's submit: wrong-code errors stay in the dialog; anything else closes it and shows here. */
  const approveWithCode = async (code: string) => {
    if (!stepUp) return;
    try {
      const next = await approvals.approve(stepUp.taskId, stepUp.revision, stepUp.comment, stepUp.lower != null ? { amount: stepUp.lower } : undefined, code);
      setStepUp(null);
      applied(next, stepUp.done);
    } catch (e) {
      if (stepUpReason(e) !== null) throw e;
      setStepUp(null);
      if (e instanceof ApiError && e.status === 409) {
        setError(STALE_MESSAGE);
        setReloadKey((k) => k + 1);
      } else if (e instanceof ApiError && e.status === 422) {
        const fe = fieldErrors(e);
        setErrors(fe);
        if (Object.keys(fe).length === 0) setError(e.message);
      } else {
        setError(e instanceof ApiError ? e.message : "That didn't go through. Check your connection and try again.");
      }
    }
  };

  const sendBack = () => {
    if (!current) return;
    if (isRichBlank(comment)) return setErrors({ reason: "Say what needs to change before you return it." });
    void run("return", () => approvals.returnForChanges(current.task.id, rev, comment.trim()), "Returned to the requester.");
  };

  const reject = async () => {
    if (!current) return;
    if (isRichBlank(comment)) return setErrors({ reason: "Say why you are rejecting it." });
    const ok = await confirm({
      title: "Reject this request?",
      body: "The requester is told, with your reason, and the request ends here. They would need to raise it again.",
      confirmLabel: "Reject request",
    });
    if (!ok) return;
    void run("reject", () => approvals.reject(current.task.id, rev, comment.trim()), "Rejected.");
  };

  const hold = () => {
    if (!current) return;
    const fe: FieldErrors = {};
    if (isRichBlank(comment)) fe.reason = "Say why it is on hold.";
    if (!until) fe.until = "Choose the date you will look at it again.";
    if (Object.keys(fe).length) return setErrors(fe);
    void run("hold", () => approvals.hold(current.task.id, rev, comment.trim(), until), "On hold. The clock stops until you release it.");
  };

  const ask = () => {
    if (!current) return;
    if (isRichBlank(question)) return setErrors({ question: "Write your question." });
    void run("ask", () => approvals.ask(current.task.id, question.trim()), "Question sent to the requester.");
  };

  const refer = () => {
    if (!current) return;
    const fe: FieldErrors = {};
    if (!referTo) fe.userId = "Choose who to ask.";
    if (isRichBlank(referNote)) fe.note = "Say what you want their view on.";
    if (Object.keys(fe).length) return setErrors(fe);
    void run("refer", () => approvals.refer(current.task.id, referTo, referNote.trim()), "Referred. They can add their view; the decision stays with you.");
  };

  const withdraw = async () => {
    const ok = await confirm({
      title: "Withdraw this request?",
      body: "Approvers stop seeing it and nothing more is decided. You can raise it again later.",
      confirmLabel: "Withdraw request",
    });
    if (!ok) return;
    void run("recall", () => approvals.recall(detail.id), "Withdrawn.");
  };

  const toggleWatch = () =>
    void run(
      "watch",
      () => (detail.viewer.watching ? approvals.unwatch(detail.id) : approvals.watch(detail.id)),
      detail.viewer.watching ? "You'll no longer be told about this request." : "You'll be told when this request moves.",
    );

  const referralId = detail.viewer.referralsToMe[detail.viewer.referralsToMe.length - 1];
  const openQuestion = detail.viewer.isRequester && hasOpenQuestion(detail.messages);
  const canReply = Boolean(referralId) || openQuestion;

  const sendReply = () => {
    if (isRichBlank(reply)) return setErrors({ body: "Write your reply first." });
    void run(
      "reply",
      () => approvals.reply(detail.id, reply.trim(), referralId && !openQuestion ? referralId : undefined),
      referralId && !openQuestion ? "Your view is on the request." : "Answer sent.",
    );
  };

  /* ----------------------------- layout ----------------------------- */

  const tile = processTile(detail.process.code);
  const header = (
    <header className="ws-card relative overflow-hidden p-5 sm:p-6">
      <span className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary-50" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <IconTile icon={tile.icon} hue={tile.hue} size={48} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{detail.process.name}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">{detail.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {detail.ref ? <span className="font-medium tabular-nums text-neutral-700">{detail.ref}</span> : "No reference yet"}
              {detail.requester && <> · raised by {detail.requester.name}</>} · {formatDateTime(detail.submittedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {detail.amount != null && (
            <p className="rounded-2xl bg-neutral-50 px-3.5 py-2 text-2xl font-bold tabular-nums tracking-tight text-neutral-900">
              {formatMoney(detail.amount, detail.currency)}
            </p>
          )}
          <Chip hue={status.hue} dot>
            {status.label}
          </Chip>
        </div>
      </div>
      {detail.flags.length > 0 && (
        <ul className="relative mt-4 flex flex-wrap gap-2" aria-label="Warnings">
          {detail.flags.map((f) => (
            <li key={f}>
              <Chip hue="sun" icon={TriangleAlert}>
                {flagLabel(f)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
        <a href={approvals.pdfUrl(detail.id)} download className={buttonClass("secondary", "sm")}>
          <FileDown size={15} aria-hidden />
          Download approval record (PDF)
        </a>
        {detail.documentUrl && (
          <Link href={detail.documentUrl} className={buttonClass("ghost", "sm")}>
            <FileText size={15} aria-hidden />
            {detail.viewer.canResubmit ? "Open it to change and resend" : "Open the document"}
          </Link>
        )}
        <Button size="sm" variant="ghost" icon={detail.viewer.watching ? EyeOff : Eye} onClick={toggleWatch} disabled={busy !== null}>
          {detail.viewer.watching ? "Stop watching" : "Watch"}
        </Button>
        {detail.viewer.canRecall && (
          <Button size="sm" variant="ghost" icon={Undo2} onClick={withdraw} disabled={busy !== null} className="text-error-700 hover:bg-error-500/10 hover:text-error-700">
            Withdraw request
          </Button>
        )}
      </div>
      {(detail.documents?.length ?? 0) > 0 && (
        <div className="relative mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sent with</p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Documents sent with it">
            {detail.documents!.map((d) => (
              <li key={d.id}>
                <a href={d.url} download className={buttonClass("ghost", "sm")}>
                  <Paperclip size={15} aria-hidden />
                  <span className="max-w-[16rem] truncate">{d.fileName}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );

  const feedback = (
    <>
      {error && <ErrorNote>{error}</ErrorNote>}
      {notice && !error && (
        <p role="status" className="flex items-center gap-3 rounded-2xl bg-mint-50 px-4 py-3 text-sm font-semibold text-mint-700">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden />
          {notice}
        </p>
      )}
    </>
  );

  const stepUpDialog = stepUp && (
    <StepUpDialog
      title={acts?.approveLabel === "Recommend" ? "Recommend with your code" : "Approve with your code"}
      summary={
        <>
          {detail.title}
          {detail.amount != null && ` · ${formatMoney(stepUp.lower ?? detail.amount, detail.currency)}`}
        </>
      }
      actionLabel={acts?.approveLabel ?? "Approve"}
      enrolled={detail.viewer.mfaEnrolled ?? null}
      onSubmit={approveWithCode}
      onCancel={() => setStepUp(null)}
    />
  );

  const actionsPanel = current && acts && (
    <Panel title="Your decision" icon={Hand} subtitle={`${current.stage.name}${current.task.onBehalfOf ? ` · for ${current.task.onBehalfOf}` : ""}`}>
      {tasks.length > 1 && (
        <div className="mb-3">
          <label htmlFor={`${uid}-task`} className={labelClass}>
            You hold {tasks.length} tasks here
          </label>
          <SearchableSelect
            id={`${uid}-task`}
            value={String(taskIndex)}
            onChange={(v) => setTaskIndex(Number(v))}
            options={tasks.map((t, i) => ({ value: String(i), label: `${t.stage.name}${t.task.scope ? ` · ${t.task.scope}` : ""}` }))}
          />
        </div>
      )}

      {acts.release ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-neutral-700">
            <CirclePause size={16} className="mt-0.5 text-sun-700" aria-hidden />
            <span>
              You put this on hold{current.task.holdUntil ? ` until ${formatDateTime(current.task.holdUntil)}` : ""}.
              {current.task.comment ? ` “${richExcerpt(current.task.comment, 200)}”` : ""} Release it to decide.
            </span>
          </p>
          <Button variant="primary" onClick={() => void run("release", () => approvals.release(current.task.id), "Released. It is back in your queue.")} disabled={busy !== null}>
            Release from hold
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {acts.claim && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-700">
              <p>This sits with a shared pool. Claim it so colleagues stop seeing it.</p>
              <Button size="sm" className="mt-2" onClick={() => void run("claim", () => approvals.claim(current.task.id), "Claimed. It is yours alone now.")} disabled={busy !== null}>
                Claim this request
              </Button>
            </div>
          )}

          {current.stage.type !== "acknowledge" && (
            <div>
              <label htmlFor={`${uid}-comment`} className={labelClass}>
                {acts.commentRequired ? "Your comment (required)" : "Your comment"}
              </label>
              <RichTextEditor
                id={`${uid}-comment`}
                value={comment}
                onChange={setComment}
                invalid={Boolean(errors.comment || errors.reason)}
                describedBy={`${uid}-comment-hint`}
              />
              <p id={`${uid}-comment-hint`} className={cx(hintClass, (errors.comment || errors.reason) && "text-error-700")} role={errors.comment || errors.reason ? "alert" : undefined}>
                {errors.comment ??
                  errors.reason ??
                  (acts.commentRequired
                    ? "This request carries a warning, so say why you are approving it."
                    : "Needed to return, reject or hold it. Optional to approve.")}
              </p>
            </div>
          )}

          {acts.amend && (
            <div>
              {mode === "amend" ? (
                <div className="rounded-xl border border-neutral-200 p-3">
                  <label htmlFor={`${uid}-amount`} className={labelClass}>
                    Amount you approve (₦)
                  </label>
                  <input
                    id={`${uid}-amount`}
                    inputMode="decimal"
                    className={inputClass}
                    value={amount}
                    placeholder={koboToNaira(detail.amount)}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-invalid={Boolean(errors.amendments)}
                    aria-describedby={`${uid}-amount-hint`}
                  />
                  <p id={`${uid}-amount-hint`} className={cx(hintClass, errors.amendments && "text-error-700")}>
                    {errors.amendments ?? `Lower than ${formatMoney(detail.amount, detail.currency)}. You can lower it, never raise it.`}
                  </p>
                  <button type="button" onClick={() => { setMode(null); setAmount(""); }} className="mt-2 text-xs font-medium text-neutral-600 underline-offset-2 hover:underline">
                    Approve the full amount instead
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setMode("amend")} className={cx(buttonClass("ghost", "sm"), "px-2")}>
                  <Wallet size={15} aria-hidden />
                  Approve with a lower amount
                </button>
              )}
            </div>
          )}

          {acts.stepUp && (
            <p className="flex items-start gap-2 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary-600" aria-hidden />
              <span>
                {detail.viewer.mfaEnrolled === false ? (
                  <>
                    Approving this needs a code from an authenticator app.{" "}
                    <Link href={ENROL_HREF} className="font-semibold underline underline-offset-2">
                      Set up two-step verification
                    </Link>{" "}
                    first.
                  </>
                ) : (
                  "Approving this needs the 6-digit code from your authenticator app."
                )}
              </span>
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="primary" onClick={approve} disabled={busy !== null}>
              {busy === "approve"
                ? "Saving…"
                : mode === "amend" && nairaToKobo(amount)
                  ? `${acts.approveLabel} ${formatMoney(nairaToKobo(amount), detail.currency)}`
                  : acts.approveLabel}
            </Button>
            {acts.returnForChanges && (
              <Button icon={CornerUpLeft} onClick={sendBack} disabled={busy !== null}>
                Return for changes
              </Button>
            )}
            {acts.reject && (
              <Button icon={X} onClick={reject} disabled={busy !== null} className="text-error-700 hover:border-error-500/40 hover:bg-error-500/5">
                Reject
              </Button>
            )}
          </div>

          {(acts.hold || acts.ask || acts.refer) && (
            <div className="border-t border-neutral-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Not ready to decide?</p>
              <div className="flex flex-wrap gap-2">
                {acts.hold && (
                  <Button size="sm" variant={mode === "hold" ? "secondary" : "ghost"} icon={CalendarClock} aria-expanded={mode === "hold"} onClick={() => setMode(mode === "hold" ? null : "hold")}>
                    Hold until a date
                  </Button>
                )}
                {acts.ask && (
                  <Button size="sm" variant={mode === "ask" ? "secondary" : "ghost"} icon={MessageSquare} aria-expanded={mode === "ask"} onClick={() => setMode(mode === "ask" ? null : "ask")}>
                    Ask the requester
                  </Button>
                )}
                {acts.refer && (
                  <Button size="sm" variant={mode === "refer" ? "secondary" : "ghost"} icon={UserRoundSearch} aria-expanded={mode === "refer"} onClick={() => setMode(mode === "refer" ? null : "refer")}>
                    Refer to a colleague
                  </Button>
                )}
              </div>

              {mode === "hold" && (
                <div className="mt-3 rounded-xl border border-neutral-200 p-3">
                  <label htmlFor={`${uid}-until`} className={labelClass}>
                    Look at it again on
                  </label>
                  <input
                    id={`${uid}-until`}
                    type="date"
                    className={inputClass}
                    value={until}
                    min={tomorrow()}
                    max={inDays(90)}
                    onChange={(e) => setUntil(e.target.value)}
                    aria-invalid={Boolean(errors.until)}
                  />
                  <p className={cx(hintClass, errors.until && "text-error-700")}>
                    {errors.until ?? "Within 90 days. Your comment above is the reason. The clock stops while it is on hold."}
                  </p>
                  <Button size="sm" className="mt-2" onClick={hold} disabled={busy !== null}>
                    Put on hold
                  </Button>
                </div>
              )}

              {mode === "ask" && (
                <div className="mt-3 rounded-xl border border-neutral-200 p-3">
                  <label htmlFor={`${uid}-question`} className={labelClass}>
                    Your question for {detail.requester?.name ?? "the requester"}
                  </label>
                  <RichTextEditor id={`${uid}-question`} value={question} onChange={setQuestion} invalid={Boolean(errors.question)} />
                  {errors.question && <p className={cx(hintClass, "text-error-700")}>{errors.question}</p>}
                  <Button size="sm" className="mt-2" icon={Send} onClick={ask} disabled={busy !== null}>
                    Send question
                  </Button>
                </div>
              )}

              {mode === "refer" && (
                <div className="mt-3 space-y-3 rounded-xl border border-neutral-200 p-3">
                  <div>
                    <label htmlFor={`${uid}-refer`} className={labelClass}>
                      Who to ask
                    </label>
                    <ColleaguePicker id={`${uid}-refer`} value={referTo} onChange={setReferTo} known={people} invalid={Boolean(errors.userId)} />
                    {errors.userId && <p className={cx(hintClass, "text-error-700")}>{errors.userId}</p>}
                  </div>
                  <div>
                    <label htmlFor={`${uid}-note`} className={labelClass}>
                      What you want their view on
                    </label>
                    <RichTextEditor id={`${uid}-note`} value={referNote} onChange={setReferNote} invalid={Boolean(errors.note)} />
                    <p className={cx(hintClass, errors.note && "text-error-700")}>{errors.note ?? "They add a view. The decision stays with you."}</p>
                  </div>
                  <Button size="sm" icon={Send} onClick={refer} disabled={busy !== null}>
                    Send referral
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );

  const routePanel = (
    <Panel title="Route" icon={RouteIcon} hue="sky" subtitle={routeSubtitle(detail)}>
      <RouteTimeline stages={detail.stages} notes={detail.notes} />
    </Panel>
  );

  const threadPanel = (detail.messages.length > 0 || canReply) && (
    <Panel title="Questions and views" icon={MessageSquare} hue="coral">
      {detail.messages.length > 0 ? (
        <ol className="space-y-3">
          {detail.messages.map((m) => {
            const asking = m.kind === "question" || m.kind === "refer";
            return (
              <li key={m.id} className={cx("flex gap-3 rounded-2xl p-3", asking ? "bg-sky-50/70" : "border border-neutral-100 bg-white")}>
                <FaceAvatar name={m.author ?? "Someone"} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-500">
                    <span className="font-semibold text-neutral-800">{m.author ?? "Someone"}</span> {messageVerb(m)}
                    {m.to && <span className="font-semibold text-neutral-800"> {m.to}</span>}
                    {m.at && <> · {formatDateTime(m.at)}</>}
                  </p>
                  <RichTextView value={m.body} size="sm" className="mt-1" />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-neutral-500">No questions yet.</p>
      )}
      {canReply && (
        <div className="mt-4">
          <label htmlFor={`${uid}-reply`} className={labelClass}>
            {openQuestion ? "Your answer" : "Your view"}
          </label>
          <RichTextEditor id={`${uid}-reply`} value={reply} onChange={setReply} invalid={Boolean(errors.body)} />
          {errors.body && <p className={cx(hintClass, "text-error-700")}>{errors.body}</p>}
          <Button size="sm" className="mt-2" icon={Send} onClick={sendReply} disabled={busy !== null}>
            {openQuestion ? "Send answer" : "Add your view"}
          </Button>
        </div>
      )}
    </Panel>
  );

  const detailsPanel = (
    <Panel title="Details" icon={FileText} hue="slate">
      <InfoList>
        <InfoRow icon={UserRound} label="Raised by">
          {detail.requester?.name ?? "-"}
        </InfoRow>
        {detail.amount != null && (
          <InfoRow icon={Wallet} label="Amount">
            <span className="tabular-nums">{formatMoney(detail.amount, detail.currency)}</span>
          </InfoRow>
        )}
        {contextRows(detail.context).map(([k, v]) => (
          <InfoRow key={k} icon={CircleAlert} label={humanise(k)}>
            {v}
          </InfoRow>
        ))}
        {detail.completedAt && (
          <InfoRow icon={CalendarClock} label="Finished">
            {formatDateTime(detail.completedAt)}
          </InfoRow>
        )}
      </InfoList>
    </Panel>
  );

  const trail = <TrailPanel key={`${detail.id}-${detail.revision}`} detail={detail} />;

  if (variant === "panel") {
    return (
      <div className="space-y-4">
        {header}
        {feedback}
        {actionsPanel}
        {stepUpDialog}
        {routePanel}
        {threadPanel}
        {trail}
        {detailsPanel}
        {onClose && (
          <Button onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      {feedback}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {routePanel}
          {threadPanel}
          {trail}
        </div>
        <div className="min-w-0 space-y-6">
          {actionsPanel}
          {stepUpDialog}
          {detailsPanel}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TrailPanel({ detail }: { detail: ApprovalDetail }) {
  const [verified, setVerified] = useState<boolean>(detail.trailVerified);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    try {
      const r = await approvals.verifyTrail(detail.id);
      setVerified(r.verified);
      setCheckedAt(new Date().toISOString());
    } catch {
      /* keep the last answer */
    } finally {
      setChecking(false);
    }
  };

  return (
    <Panel
      title="Record of everything that happened"
      icon={ScrollText}
      hue="grape"
      actions={
        verified ? (
          <Chip hue="mint" icon={ShieldCheck}>
            Trail verified
          </Chip>
        ) : (
          <Chip hue="rose" icon={ShieldAlert}>
            Trail doesn&apos;t verify
          </Chip>
        )
      }
    >
      <p className="text-sm text-neutral-600">
        Each entry is chained to the one before it, so an edited or deleted entry breaks the chain.
        {!verified && " The chain is broken. Tell your administrator."}
      </p>
      <details className="mt-3 rounded-xl border border-neutral-200">
        <summary className="flex min-h-11 cursor-pointer select-none items-center px-3 text-sm font-medium text-neutral-800">
          Show all {detail.trail.length} entries
        </summary>
        <ol className="divide-y divide-neutral-100 border-t border-neutral-100">
          {detail.trail.map((e) => (
            <li key={e.seq} className="flex gap-3 px-3 py-2.5 text-[13px]">
              <span className="w-6 shrink-0 text-right tabular-nums text-neutral-400">{e.seq}</span>
              <div className="min-w-0">
                <p className="text-neutral-900">
                  <span className="font-semibold">{trailLabel(e.event)}</span>
                  {e.actor && <span className="text-neutral-600"> by {e.actor}</span>}
                  {e.onBehalfOf && <span className="text-neutral-600"> for {e.onBehalfOf}</span>}
                  {e.stageName && <span className="text-neutral-500"> · {e.stageName}</span>}
                </p>
                <p className="text-xs text-neutral-500">{formatDateTime(e.at)}</p>
                {e.note && <RichTextView value={e.note} size="sm" className="mt-1 border-l-2 border-neutral-200 pl-2 text-xs" />}
                {e.stepUp && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-mint-700">
                    <ShieldCheck size={12} aria-hidden />
                    {e.stepUp === "backup_code" ? "Confirmed with a backup code" : "Confirmed with an authenticator code"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </details>
      <button type="button" onClick={check} disabled={checking} className={cx(buttonClass("ghost", "sm"), "mt-2 px-2")}>
        <RefreshCw size={14} aria-hidden className={checking ? "animate-spin" : undefined} />
        {checking ? "Checking…" : "Check the chain again"}
      </button>
      {checkedAt && <span className="ml-2 text-xs text-neutral-500" role="status">Checked just now.</span>}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function routeSubtitle(d: ApprovalDetail): string {
  const active = d.stages.filter((s) => s.status === "active");
  if (d.status === "in_progress" && active.length) return `Waiting at ${active.map((s) => s.name).join(", ")}`;
  return instanceStatus(d.status).label;
}

function messageVerb(m: MessageView): string {
  switch (m.kind) {
    case "question":
      return "asked";
    case "answer":
      return "answered";
    case "refer":
      return "asked the view of";
    case "minute":
      return "gave a view";
    default:
      return "commented";
  }
}

/** A question nobody has answered since it was asked. */
function hasOpenQuestion(messages: MessageView[]): boolean {
  let open = false;
  for (const m of messages) {
    if (m.kind === "question") open = true;
    if (m.kind === "answer") open = false;
  }
  return open;
}

/** Everybody this request names, for the referral picker's fallback. */
function knownPeople(d: ApprovalDetail): { id: string; name: string }[] {
  const out = new Map<string, string>();
  if (d.requester) out.set(d.requester.id, d.requester.name);
  for (const s of d.stages) for (const t of s.tasks) if (t.assignee) out.set(t.assignee.id, t.assignee.name);
  return [...out].map(([id, name]) => ({ id, name }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The context's plain values, as rows. Amounts and currency are already shown
 * above; internal ids (unitId, requesterId, …) mean nothing to a reader.
 */
function contextRows(ctx: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(ctx ?? {})) {
    if (/amount|currency/i.test(k) || /(Id|_id|Ids)$/.test(k) || k === "id") continue;
    if (typeof v === "string" && UUID_RE.test(v)) continue;
    if (typeof v === "string" && v !== "") out.push([k, v]);
    else if (typeof v === "number") out.push([k, String(v)]);
    else if (typeof v === "boolean") out.push([k, v ? "Yes" : "No"]);
  }
  return out.slice(0, 8);
}

function tomorrow(): string {
  return inDays(1);
}

function inDays(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
