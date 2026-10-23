"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Building2, CircleCheck, ClipboardList, ExternalLink, Laptop, MessageSquare, RotateCcw, Star } from "lucide-react";
import { Button, Chip, PageHeader, Panel, PriorityChip } from "@/components/workspace/kit";
import { BackLink, ErrorNote, Field, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { help, opsError, type TicketFull } from "@/lib/api/operations-desk-client";
import { StarPicker, Stars } from "@/suite/operations/components/facilities/parts";
import { Answers, CategoryIcon, ReplyBox, SlaPill, Thread, TicketStatusChip } from "@/suite/operations/components/desk/parts";
import { LINKED_TYPES, stampText, statusMeta, useNow } from "@/suite/operations/components/desk/labels";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * One of my requests: where it stands against its clock, the conversation
 * with the desk, and — once they say it's done — a rating to close it, or a
 * reason to reopen it.
 */
export default function MyHelpDetail({ id }: { id: string }) {
  const now = useNow();
  const [t, setT] = useState<TicketFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    help.get(id).then(
      (d) => {
        if (!alive) return;
        setT(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`This request didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  if (error && !t) {
    return (
      <div>
        <BackLink href="/suite/operations/my/help" label="Ask for help" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!t) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading your request…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const open = statusMeta(t.status).open;
  const linkedLabel = t.linked ? `${LINKED_TYPES[t.linked.type] ?? "Record"} ${t.linked.reference ?? ""}`.trim() : null;

  return (
    <div>
      <BackLink href="/suite/operations/my/help" label="Ask for help" />
      <PageHeader
        eyebrow={t.number ?? "Request"}
        title={t.title}
        subtitle={
          <span className="mt-1 inline-flex flex-wrap items-center gap-2">
            <TicketStatusChip status={t.status} />
            <PriorityChip priority={t.priority} />
            {open && <SlaPill ticket={t} now={now} />}
            {t.assignee && <span className="text-neutral-500">With {t.assignee}</span>}
          </span>
        }
      />
      <Notice text={notice} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {t.status === "resolved" && <CloseCard ticket={t} onDone={(next, msg) => { setT(next); setNotice(msg); }} />}

          <Panel title="Conversation" icon={MessageSquare} hue="grape" subtitle="Your messages and the desk's replies.">
            <div className="space-y-5">
              <Thread comments={t.comments} requesterId={t.requesterId} empty="No replies yet. The desk will answer here." />
              {(open || t.status === "resolved") && (
                <ReplyBox
                  placeholder="Add something for the desk"
                  onSend={async (body) => {
                    try {
                      setT(await help.reply(t.id, body));
                      setNotice("Sent.");
                    } catch (e) {
                      throw new Error(opsError(e));
                    }
                  }}
                />
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="What you asked" icon={ClipboardList} hue="blue" subtitle={stampText(t.createdAt)}>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CategoryIcon category={t.category} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{t.item ?? "Something else"}</p>
                  {t.description ? <RichTextView value={t.description} size="sm" className="text-neutral-600" /> : <p className="text-sm text-neutral-600">No details given.</p>}
                </div>
              </div>
              <Answers fields={t.fields} answers={t.answers} />
              {(t.facility || t.asset) && (
                <div className="flex flex-wrap gap-2">
                  {t.facility && (
                    <Chip hue="coral" icon={Building2}>
                      {t.facility}
                    </Chip>
                  )}
                  {t.asset && (
                    <Chip hue="blue" icon={Laptop}>
                      {[t.asset.tagNo, t.asset.name].filter(Boolean).join(" · ")}
                    </Chip>
                  )}
                </div>
              )}
            </div>
          </Panel>
          {t.linked && (
            <Panel title="What it became" icon={ExternalLink} hue="mint">
              <p className="text-sm text-neutral-800">
                <span className="font-semibold">{linkedLabel}</span>
                {t.linked.status ? <span className="text-neutral-500"> · {t.linked.status.replace(/_/g, " ")}</span> : null}
              </p>
              <p className="mt-1 text-xs text-neutral-500">The desk turned your request into this and will keep you posted.</p>
            </Panel>
          )}
          {(t.rating !== null || t.status === "closed") && (
            <Panel title="Your rating" icon={Star} hue="sun">
              <Stars value={t.rating} size={18} />
              {t.ratingComment && <p className="mt-2 text-sm text-neutral-600">“{t.ratingComment}”</p>}
            </Panel>
          )}
          <p className="px-1 text-xs text-neutral-500">
            Need something else? <Link href="/suite/operations/my/help" className="font-semibold text-primary-700 hover:underline">Ask again</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

/** The desk says it's done: rate and close, or say why it isn't and reopen. */
function CloseCard({ ticket, onDone }: { ticket: TicketFull; onDone: (t: TicketFull, msg: string) => void }) {
  const uid = useId();
  const [mode, setMode] = useState<"close" | "reopen">("close");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "reopen" && !comment.trim()) {
      setFieldError("Say what still isn't right.");
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    setError(null);
    try {
      const next = mode === "close" ? await help.close(ticket.id, { rating, comment: comment.trim() || null }) : await help.close(ticket.id, { reopen: true, comment: comment.trim() });
      onDone(next, mode === "close" ? "Closed. Thanks for the rating." : "Reopened. The desk has your note.");
    } catch (err) {
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="ws-card space-y-4 border-mint-500/30 bg-gradient-to-br from-mint-50 to-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-500 text-white">
          <CircleCheck size={20} aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-neutral-900">The desk says this is done</h2>
          <p className="text-sm text-neutral-600">{ticket.resolvedAt ? `Resolved ${stampText(ticket.resolvedAt)}. ` : ""}Rate it and close it, or reopen it if it isn&rsquo;t sorted.</p>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div role="radiogroup" aria-label="Close or reopen" className="inline-flex rounded-xl bg-white/80 p-1 ring-1 ring-neutral-200">
        {(
          [
            { key: "close", label: "It's sorted", icon: CircleCheck },
            { key: "reopen", label: "It isn't", icon: RotateCcw },
          ] as const
        ).map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={mode === o.key}
            onClick={() => setMode(o.key)}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300 ${mode === o.key ? "bg-primary-600 text-white shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
          >
            <o.icon size={14} aria-hidden />
            {o.label}
          </button>
        ))}
      </div>
      {mode === "close" && (
        <div>
          <p className="mb-1 text-sm font-medium text-neutral-700">How did the desk do?</p>
          <StarPicker value={rating} onChange={setRating} label="Rate the service" />
        </div>
      )}
      <Field id={`${uid}-c`} label={mode === "close" ? "Anything to add" : "What still isn't right"} hint={mode === "close" ? "Optional" : "Required"}>
        <textarea id={`${uid}-c`} rows={2} className={textareaClass} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} aria-invalid={fieldError ? true : undefined} />
        <FieldError message={fieldError} />
      </Field>
      <Button type="submit" variant="primary" icon={mode === "close" ? CircleCheck : RotateCcw} disabled={busy}>
        {busy ? "Saving…" : mode === "close" ? "Close the request" : "Reopen the request"}
      </Button>
    </form>
  );
}
