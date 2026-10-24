"use client";

import { useId, useRef, useState } from "react";
import { Ban, BadgeCheck, CheckCheck, Keyboard, MessageCircleQuestion, ShieldAlert } from "lucide-react";
import { Button, Card, Progress, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, textareaClass } from "@/suite/lms/components/ui/ws";
import { errorCode, spendError, type Mark, type MarkInput, type ReviewOutcome } from "@/lib/api/finance-spend-client";
import { MARKS } from "@/suite/finance/components/requests/labels";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/*
  The FCU's checklist: every item marked OK, Query or N/A, a query always
  saying what it is about, then one outcome. Built for the keyboard: each
  item is a radio group (arrow keys move between its three marks, Tab moves
  to the next item), and O, Q or N marks the item that has focus.
*/

export type Marks = Record<string, { result?: Mark; comment: string }>;

export interface ChecklistItem {
  code: string;
  label: string;
}

const ORDER: Mark[] = ["ok", "query", "na"];

/** The marks as the API takes them. Throws nothing; the API checks completeness. */
export function toMarkInput(marks: Marks): MarkInput {
  const out: MarkInput = {};
  for (const [code, m] of Object.entries(marks)) {
    if (m.result) out[code] = { result: m.result, comment: m.comment.trim() || null };
  }
  return out;
}

/** What separation of duties means, said plainly, when the API refuses on it. */
export function dutiesText(message: string): string {
  return `${message} Separation of duties: one person never holds two roles on the same document. Leave this one for another FCU officer.`;
}

export function MarkList({
  items,
  marks,
  onChange,
  allowQuery = true,
  disabled = false,
}: {
  items: ChecklistItem[];
  marks: Marks;
  onChange: (next: Marks) => void;
  allowQuery?: boolean;
  disabled?: boolean;
}) {
  const options = allowQuery ? ORDER : ORDER.filter((m) => m !== "query");
  const set = (code: string, patch: Partial<Marks[string]>) => onChange({ ...marks, [code]: { ...(marks[code] ?? { comment: "" }), ...patch } });

  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <MarkRow key={item.code} index={i} item={item} mark={marks[item.code]} options={options} disabled={disabled} onSet={(patch) => set(item.code, patch)} />
      ))}
    </ol>
  );
}

function MarkRow({
  index,
  item,
  mark,
  options,
  disabled,
  onSet,
}: {
  index: number;
  item: ChecklistItem;
  mark: Marks[string] | undefined;
  options: Mark[];
  disabled: boolean;
  onSet: (patch: Partial<Marks[string]>) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  const commentId = useId();
  const current = mark?.result;
  const focusIndex = current ? options.indexOf(current) : 0;

  const choose = (m: Mark, focus = false) => {
    onSet({ result: m });
    if (focus) refs.current[options.indexOf(m)]?.focus();
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const k = e.key.toLowerCase();
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      choose(options[(i + 1) % options.length], true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      choose(options[(i - 1 + options.length) % options.length], true);
    } else {
      const hit = options.find((m) => MARKS[m].key === k);
      if (hit && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        choose(hit, true);
      }
    }
  };

  return (
    <li
      className={cx(
        "rounded-2xl border p-3.5 transition-colors",
        current === "query" ? "border-sun-500/40 bg-sun-50/50" : current === "ok" ? "border-mint-500/30 bg-mint-50/30" : current === "na" ? "border-neutral-200 bg-neutral-50/60" : "border-neutral-200/80 bg-white",
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <p id={labelId} className="min-w-0 text-sm text-neutral-800">
          <span className="mr-1.5 font-semibold tabular-nums text-neutral-400" aria-hidden>
            {index + 1}.
          </span>
          {item.label}
        </p>
        <div role="radiogroup" aria-labelledby={labelId} className="inline-flex shrink-0 self-start rounded-xl bg-neutral-100 p-1">
          {options.map((m, i) => {
            const on = current === m;
            return (
              <button
                key={m}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={MARKS[m].label}
                tabIndex={i === focusIndex ? 0 : -1}
                disabled={disabled}
                onClick={() => choose(m)}
                onKeyDown={(e) => onKey(e, i)}
                className={cx(
                  "h-9 min-w-[3.25rem] cursor-pointer rounded-lg px-2.5 text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed",
                  on ? cx(HUE[MARKS[m].hue].soft, "shadow-sm ring-1 ring-black/5") : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {MARKS[m].short}
              </button>
            );
          })}
        </div>
      </div>
      {current === "query" && (
        <div className="mt-3">
          <label htmlFor={commentId} className="mb-1 block text-xs font-medium text-sun-700">
            What is the query about? (required)
          </label>
          <textarea
            id={commentId}
            rows={2}
            className={textareaClass}
            value={mark?.comment ?? ""}
            disabled={disabled}
            onChange={(e) => onSet({ comment: e.target.value })}
            placeholder="The invoice is for ₦1,200,000; the memo asks for ₦1,150,000."
            aria-invalid={!mark?.comment.trim() || undefined}
          />
        </div>
      )}
    </li>
  );
}

export type ReviewKind = "memo" | "voucher" | "retirement";

const CLEAR_LABEL: Record<ReviewKind, string> = {
  memo: "Clear for payment",
  voucher: "Clear for authorisation",
  retirement: "Clear and post",
};

/**
 * The review side of an FCU screen: the checklist, a note, and the outcome.
 * Clear needs every item marked and none queried; Query needs at least one
 * queried item; Reject (memos only) needs a reason.
 */
export function ReviewPanel({
  kind,
  items,
  onSubmit,
  disabled = false,
  disabledReason,
}: {
  kind: ReviewKind;
  items: ChecklistItem[];
  onSubmit: (outcome: ReviewOutcome, marks: MarkInput, comment: string | null) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const confirm = useConfirm();
  const [marks, setMarks] = useState<Marks>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<ReviewOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commentId = useId();

  const marked = items.filter((i) => marks[i.code]?.result).length;
  const queried = items.filter((i) => marks[i.code]?.result === "query");
  const queryWithoutText = queried.find((i) => !marks[i.code]?.comment.trim());
  const complete = marked === items.length && items.length > 0;
  const canClear = complete && queried.length === 0;
  const canQuery = complete && queried.length > 0 && !queryWithoutText;

  const submit = async (outcome: ReviewOutcome) => {
    if (outcome === "rejected") {
      if (!comment.trim()) {
        setError("Say why it is rejected in the note; the requester and approvers are told.");
        return;
      }
      const ok = await confirm({ title: "Reject this memo?", body: "It stops here: its funds are released and the requester and approvers are told why. This can't be undone.", confirmLabel: "Reject memo" });
      if (!ok) return;
    }
    setBusy(outcome);
    setError(null);
    try {
      await onSubmit(outcome, toMarkInput(marks), comment.trim() || null);
    } catch (e) {
      const text = spendError(e);
      setError(errorCode(e) === "SOD_VIOLATION" ? dutiesText(text) : text);
    } finally {
      setBusy(null);
    }
  };

  const restOk = () => {
    const next = { ...marks };
    for (const i of items) if (!next[i.code]?.result) next[i.code] = { result: "ok", comment: next[i.code]?.comment ?? "" };
    setMarks(next);
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-neutral-900">The checklist</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Mark every item. A query says what it is about.</p>
        </div>
        <Button size="sm" variant="ghost" icon={CheckCheck} onClick={restOk} disabled={disabled || complete}>
          Mark the rest OK
        </Button>
      </div>
      <div className="mt-4">
        <Progress value={items.length ? (marked / items.length) * 100 : 0} hue={queried.length ? "sun" : "mint"} label={`${marked} of ${items.length} marked${queried.length ? `, ${queried.length} queried` : ""}`} showValue size="sm" />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
        <Keyboard size={13} aria-hidden /> Arrow keys move between marks; O, Q and N mark the item in focus.
      </p>

      <div className="mt-4">
        <MarkList items={items} marks={marks} onChange={setMarks} disabled={disabled || busy !== null} />
      </div>

      <div className="mt-5">
        <label htmlFor={commentId} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Note {kind === "memo" ? "(needed to reject)" : "(optional)"}
        </label>
        <RichTextEditor id={commentId} value={comment} onChange={setComment} disabled={disabled || busy !== null} placeholder="Anything the requester, preparer or approvers should know" />
      </div>

      {disabledReason && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
          {disabledReason}
        </p>
      )}
      {error && <ErrorNote className="mt-4">{error}</ErrorNote>}
      {queryWithoutText && <p className="mt-3 text-xs font-medium text-sun-700">Say what the query on &ldquo;{queryWithoutText.label}&rdquo; is about.</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:flex-wrap">
        <Button variant="primary" icon={BadgeCheck} onClick={() => void submit("cleared")} disabled={disabled || busy !== null || !canClear}>
          {busy === "cleared" ? "Clearing…" : CLEAR_LABEL[kind]}
        </Button>
        <Button icon={MessageCircleQuestion} onClick={() => void submit("queried")} disabled={disabled || busy !== null || !canQuery}>
          {busy === "queried" ? "Sending…" : "Query it"}
        </Button>
        {kind === "memo" && (
          <Button variant="ghost" icon={Ban} className="text-error-700 hover:bg-error-500/10" onClick={() => void submit("rejected")} disabled={disabled || busy !== null || !complete}>
            {busy === "rejected" ? "Rejecting…" : "Reject"}
          </Button>
        )}
      </div>
      {!complete && !disabled && <p className="mt-2 text-xs text-neutral-500">Mark every item to clear, query{kind === "memo" ? " or reject" : ""} it.</p>}
    </Card>
  );
}
