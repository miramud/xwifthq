"use client";

import { useId, useState } from "react";
import { AlarmClock, CircleCheck, EyeOff, Lock, MessageSquare, Send, Timer } from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { FaceAvatar, Switch } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import type { CatalogueField, Ticket, TicketComment } from "@/lib/api/operations-desk-client";
import { categoryLook, sla, stampText, statusMeta } from "./labels";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

export function TicketStatusChip({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <Chip hue={m.hue} dot>
      {m.label}
    </Chip>
  );
}

/** The SLA clock, live: red once breached, amber in its last two hours. */
export function SlaPill({ ticket, now }: { ticket: Pick<Ticket, "slaDueAt" | "status" | "resolvedAt">; now: number }) {
  const s = sla(ticket, now);
  if (s.state === "none") return <span className="text-xs text-neutral-500">{s.text}</span>;
  const look =
    s.state === "breached"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : s.state === "soon"
        ? "bg-sun-50 text-sun-700 ring-sun-200"
        : s.state === "met"
          ? "bg-mint-50 text-mint-700 ring-mint-100"
          : "bg-neutral-50 text-neutral-700 ring-neutral-200";
  const Icon = s.state === "breached" ? AlarmClock : s.state === "met" ? CircleCheck : Timer;
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ring-1 ring-inset", look)}>
      <Icon size={12} aria-hidden />
      {s.text}
    </span>
  );
}

export function CategoryIcon({ category, size = 40 }: { category: string | null | undefined; size?: number }) {
  const { icon: Icon, hue } = categoryLook(category);
  return (
    <span className={cx("flex shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)} style={{ width: size, height: size }} aria-hidden>
      <Icon size={Math.round(size * 0.45)} />
    </span>
  );
}

/**
 * The conversation on a ticket. A reply from the requester sits on the
 * left; the desk's on the right; an internal note is hatched amber with a
 * lock and says plainly that only the desk sees it.
 */
export function Thread({ comments, requesterId, empty = "No messages yet." }: { comments: TicketComment[]; requesterId: string; empty?: string }) {
  if (comments.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-sm text-neutral-500">
        <MessageSquare size={16} aria-hidden /> {empty}
      </p>
    );
  }
  return (
    <ol className="space-y-4" aria-label="Conversation">
      {comments.map((c) => {
        const mine = c.byId === requesterId;
        return (
          <li key={c.id} className={cx("flex gap-3", !mine && "flex-row-reverse")}>
            <FaceAvatar name={c.by} size={32} />
            <div className={cx("min-w-0 max-w-[85%] sm:max-w-[75%]", !mine && "text-right")}>
              <p className="mb-1 text-xs text-neutral-500">
                <span className="font-semibold text-neutral-800">{c.by ?? "Someone"}</span> · {stampText(c.at)}
              </p>
              <div
                className={cx(
                  "whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-sm leading-relaxed",
                  c.internal ? "ws-hatch border border-dashed border-sun-400 bg-sun-50/80 text-neutral-900" : mine ? "rounded-tl-md bg-neutral-100 text-neutral-900" : "rounded-tr-md bg-primary-600 text-white",
                )}
              >
                {c.internal && (
                  <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sun-700">
                    <Lock size={11} aria-hidden /> Internal note · only the desk sees this
                  </span>
                )}
                <RichTextView value={c.body} size="sm" inverse={!c.internal && !mine} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Write a reply; on the desk, optionally as an internal note. */
export function ReplyBox({
  onSend,
  allowInternal = false,
  placeholder = "Write a reply",
  disabled,
}: {
  onSend: (body: string, internal: boolean) => Promise<void>;
  allowInternal?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const uid = useId();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError("Write something first.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onSend(body.trim(), internal);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "It didn't send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className={cx("rounded-2xl border p-3 transition", internal ? "border-dashed border-sun-400 bg-sun-50/50" : "border-neutral-200 bg-white")}>
      <label htmlFor={`${uid}-b`} className="sr-only">
        {internal ? "Internal note" : "Reply"}
      </label>
      <RichTextEditor id={`${uid}-b`} minHeight={102} value={body} onChange={setBody} placeholder={internal ? "A note for the desk; the requester won't see it" : placeholder} disabled={disabled} invalid={Boolean(error ? true : undefined)} />
      <FieldError message={error} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {allowInternal ? (
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <Switch checked={internal} onChange={setInternal} label="Internal note" />
            <span className="inline-flex items-center gap-1">
              <EyeOff size={14} aria-hidden /> Internal note
            </span>
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" variant="primary" icon={Send} disabled={busy || disabled}>
          {busy ? "Sending…" : internal ? "Add the note" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}

/** The answers to the catalogue item's form, in the form's order. */
export function Answers({ fields, answers }: { fields: CatalogueField[]; answers: Record<string, string | number | null> }) {
  const known = new Set(fields.map((f) => f.key));
  const rows: [string, string][] = [
    ...fields.map((f) => [f.label, fmt(answers[f.key], f.type)] as [string, string]),
    ...Object.entries(answers)
      .filter(([k]) => !known.has(k))
      .map(([k, v]) => [k.replace(/_/g, " "), fmt(v)] as [string, string]),
  ].filter(([, v]) => v !== "");
  if (rows.length === 0) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium text-neutral-500">{k.charAt(0).toUpperCase() + k.slice(1)}</dt>
          <dd className="whitespace-pre-wrap break-words text-sm text-neutral-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function fmt(v: string | number | null | undefined, type?: string): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return type === "date" && /^\d{4}-\d{2}-\d{2}/.test(s) ? day(s) : s;
}
