"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LifeBuoy, MessageSquarePlus, ChevronLeft, Send, CheckCircle2, Globe } from "lucide-react";
import { tickets, ApiError, type SupportTicket } from "@/lib/api/support-client";
import { useAuth } from "@/lib/auth-store";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richToPlain } from "@/lib/richText";

/**
 * Where a learner or instructor actually asks for help.
 *
 * The ticket system existed only behind `role:admin`, so the single person who
 * could raise a ticket was an admin typing on somebody else's behalf. This is
 * the requester's half of it.
 *
 * One screen, two panes: the list of your tickets and the thread you have open.
 * A support conversation is short and linear, so a separate detail route would
 * cost a navigation for no gain.
 */
export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportDesk />
    </Suspense>
  );
}

function SupportDesk() {
  const { user, loading: authLoading } = useAuth();

  const [list, setList] = useState<SupportTicket[] | null>(null);
  const [open, setOpen] = useState<SupportTicket | null>(null);
  // `?subject=` opens a prefilled ticket — the module preview pages use it to
  // ask the platform owner to switch a module on.
  const params = useSearchParams();
  const draftSubject = (params.get("subject") ?? "").slice(0, 200);
  // `?to=platform` (O7): the platform-facing links - "Contact your platform
  // administrator", "Ask the platform owner" - address the ticket to the
  // platform owner. Without it, it would go to this organisation's admins,
  // who are usually the ones asking.
  const toPlatform = params.get("to") === "platform";
  const [composing, setComposing] = useState(() => draftSubject !== "");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    tickets
      .list()
      .then(setList)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load your tickets."),
      );
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) {
    return <PageFrame><ListSkeleton /></PageFrame>;
  }

  if (!user) {
    return (
      <PageFrame>
        <div className="rounded-2xl border border-neutral-200 p-10 text-center">
          <p className="text-neutral-600">Sign in to open a support ticket.</p>
          <Link href="/login?redirect=/support" className="btn-primary mt-5">
            Sign in
          </Link>
        </div>
      </PageFrame>
    );
  }

  if (composing) {
    return (
      <PageFrame>
        <NewTicket
          initialSubject={draftSubject}
          toPlatform={toPlatform}
          onCancel={() => setComposing(false)}
          onCreated={(ticket) => {
            setComposing(false);
            setOpen(ticket);
            load();
          }}
        />
      </PageFrame>
    );
  }

  if (open) {
    return (
      <PageFrame>
        <Thread
          ticket={open}
          onBack={() => {
            setOpen(null);
            load();
          }}
          onChanged={setOpen}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-500">
          {list?.length ? `${list.length} ticket${list.length === 1 ? "" : "s"}` : " "}
        </p>
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          New ticket
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-500/10 px-4 py-3 text-sm text-error-600">
          {error}
        </p>
      )}

      {list === null && !error && <ListSkeleton />}

      {list?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center">
          <LifeBuoy className="mx-auto mb-3 h-7 w-7 text-neutral-300" aria-hidden="true" />
          <h2 className="font-heading text-lg font-semibold text-neutral-800">No tickets yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">
            Stuck on a lesson, a payment or your account? Open a ticket and the team will pick it
            up.
          </p>
          <button type="button" onClick={() => setComposing(true)} className="btn-primary mt-6">
            Open your first ticket
          </button>
        </div>
      )}

      {list && list.length > 0 && (
        <ul className="space-y-3">
          {list.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                onClick={() => tickets.get(ticket.id).then(setOpen).catch(() => setOpen(ticket))}
                className="w-full rounded-xl border border-neutral-200 p-5 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-neutral-800">{ticket.subject}</h3>
                    <p className="mt-1 font-mono text-xs text-neutral-400">{ticket.reference}</p>
                  </div>
                  <StatusPill status={ticket.status} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ */

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-container py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="heading-3 text-neutral-800">Support</h1>
        <p className="mt-2 mb-8 text-neutral-500">
          Ask the team anything about your account, a course or a payment.
        </p>
        {children}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  // Colour alone never carries the meaning — the label is always present.
  const tone: Record<string, string> = {
    Open: "bg-info-500/10 text-info-600",
    Pending: "bg-warning-500/10 text-warning-600",
    Resolved: "bg-success-500/10 text-success-600",
    Closed: "bg-neutral-100 text-neutral-500",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${tone[status] ?? tone.Closed}`}
    >
      {status}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-busy="true">
      <span className="sr-only">Loading your tickets</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[86px] animate-pulse rounded-xl bg-neutral-100 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NewTicket({
  initialSubject = "",
  toPlatform = false,
  onCancel,
  onCreated,
}: {
  initialSubject?: string;
  toPlatform?: boolean;
  onCancel: () => void;
  onCreated: (ticket: SupportTicket) => void;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Counted in words written, not in the editor's markup. */
  const canSubmit = subject.trim().length > 3 && richToPlain(body).trim().length > 10 && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    try {
      onCreated(
        await tickets.open({ subject: subject.trim(), body: body.trim(), priority, ...(toPlatform ? { toPlatform: true } : {}) }),
      );
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Couldn't open your ticket.");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-neutral-200 p-6">
      <button
        type="button"
        onClick={onCancel}
        className="mb-5 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to tickets
      </button>

      {toPlatform && (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
          <Globe className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This goes to the platform owner, not to your organisation&apos;s admins.
        </p>
      )}

      <div className="space-y-5">
        <div>
          <label htmlFor="ticket-subject" className="mb-2 block text-sm font-medium text-neutral-700">
            What&apos;s it about? <span className="text-error-500">*</span>
          </label>
          <input
            id="ticket-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={255}
            className="w-full rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            placeholder="Video won't play on lesson 4"
          />
        </div>

        <div>
          <label htmlFor="ticket-body" className="mb-2 block text-sm font-medium text-neutral-700">
            Tell us what happened <span className="text-error-500">*</span>
          </label>
          <RichTextEditor id="ticket-body" minHeight={180} value={body} onChange={setBody} describedBy="ticket-body-help" placeholder="What you were doing, what you expected, and what happened instead." />
          <p id="ticket-body-help" className="mt-1.5 text-xs text-neutral-400">
            The more specific you are, the faster this gets solved.
          </p>
        </div>

        <div>
          <label htmlFor="ticket-priority" className="mb-2 block text-sm font-medium text-neutral-700">
            How urgent is it?
          </label>
          <SearchableSelect
            id="ticket-priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "low", label: "Low — whenever you get to it" },
              { value: "normal", label: "Normal — blocking me a little" },
              { value: "high", label: "High — I can’t use the platform" },
            ]}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-600">
          {error}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} className="btn-primary mt-6 disabled:opacity-50">
        {saving ? "Opening…" : "Open ticket"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function Thread({
  ticket,
  onBack,
  onChanged,
}: {
  ticket: SupportTicket;
  onBack: () => void;
  onChanged: (ticket: SupportTicket) => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = ticket.status === "Closed";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      onChanged(await tickets.reply(ticket.id, reply.trim()));
      setReply("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to tickets
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-neutral-800">{ticket.subject}</h2>
          <p className="mt-1 font-mono text-xs text-neutral-400">{ticket.reference}</p>
        </div>
        <StatusPill status={ticket.status} />
      </div>

      <ul className="space-y-4">
        {(ticket.messages ?? []).map((message, i) => (
          <li
            key={i}
            className={`rounded-xl p-4 ${
              message.from === "support"
                ? "bg-primary-50 border border-primary-100"
                : "bg-neutral-50 border border-neutral-200"
            }`}
          >
            <p className="mb-1.5 text-xs font-medium text-neutral-500">
              {message.from === "support" ? "Elevate support" : message.author}
              {" · "}
              <time dateTime={message.time}>
                {new Date(message.time).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </p>
            <RichTextView value={message.body} size="sm" className="text-neutral-700" />
          </li>
        ))}
      </ul>

      {closed ? (
        <p className="mt-6 flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          This ticket is closed. Open a new one if you need anything else.
        </p>
      ) : (
        <form onSubmit={send} className="mt-6">
          <label htmlFor="ticket-reply" className="mb-2 block text-sm font-medium text-neutral-700">
            Add a reply
          </label>
          <RichTextEditor id="ticket-reply" minHeight={102} value={reply} onChange={setReply} placeholder="Anything else that would help?" />

          {error && (
            <p role="alert" className="mt-3 text-sm text-error-600">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!reply.trim() || sending}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {sending ? "Sending…" : "Send reply"}
            </button>

            <button
              type="button"
              onClick={() => tickets.close(ticket.id).then(onChanged).catch(() => null)}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              Close this ticket
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
