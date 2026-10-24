"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Star,
  Send,
  ArrowLeft,
  MessageSquare,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { Button, Chip, Empty, PageHeader, SearchField } from "@/components/workspace/kit";
import { hueFor } from "@/components/workspace/modules";
import { ErrorNote, FaceAvatar } from "@/suite/lms/components/ui/ws";
import { timeAgo } from "@/lib/console-data";
import {
  questions,
  ApiError,
  type Question,
  type QuestionFilter,
} from "@/lib/api/instructor-client";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

const FILTERS = ["All", "Unread", "Starred", "Resolved"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_MAP: Record<Filter, QuestionFilter> = {
  All: "all",
  Unread: "unread",
  Starred: "starred",
  Resolved: "resolved",
};

export default function InstructorMessagesPage() {
  const [threads, setThreads] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unanswered, setUnanswered] = useState(0);

  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Question | null>(null);
  const [convoLoading, setConvoLoading] = useState(false);
  const [convoError, setConvoError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  /* ---------- load thread list on filter change ---------- */
  useEffect(() => {
    let alive = true;
    questions
      .list(FILTER_MAP[filter])
      .then((d: Question[]) => {
        if (alive) {
          setThreads(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Questions didn't load. Try again.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filter]);

  /* ---------- unanswered count for the heading ---------- */
  useEffect(() => {
    let alive = true;
    questions
      .unansweredCount()
      .then((n: number) => {
        if (alive) setUnanswered(n);
      })
      .catch(() => {})
      .finally(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t: Question) =>
        (t.student ?? "").toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q) ||
        (t.courseTitle ?? "").toLowerCase().includes(q),
    );
  }, [query, threads]);

  /* ---------- open a thread (marks it read server-side) ---------- */
  const openThread = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setConvoLoading(true);
      setConvoError(null);
      setSendError(null);
      setDraft("");
      // optimistically clear the unread state
      const wasAwaiting = threads.find((t: Question) => t.id === id)?.awaitingReply ?? false;
      setThreads((prev: Question[]) =>
        prev.map((t: Question) => (t.id === id ? { ...t, awaitingReply: false } : t)),
      );
      if (wasAwaiting) setUnanswered((n: number) => Math.max(0, n - 1));
      try {
        const q = await questions.get(id);
        setSelected(q);
      } catch (e: unknown) {
        setConvoError(e instanceof ApiError ? e.message : "The conversation didn't load. Try again.");
      } finally {
        setConvoLoading(false);
      }
    },
    [threads],
  );

  /* ---------- star toggle (optimistic w/ rollback) ---------- */
  const toggleStar = useCallback(async (q: Question) => {
    const next = !q.starred;
    setThreads((prev: Question[]) =>
      prev.map((t: Question) => (t.id === q.id ? { ...t, starred: next } : t)),
    );
    setSelected((s: Question | null) => (s && s.id === q.id ? { ...s, starred: next } : s));
    try {
      await questions.update(q.id, { starred: next });
    } catch (e: unknown) {
      setThreads((prev: Question[]) =>
        prev.map((t: Question) => (t.id === q.id ? { ...t, starred: q.starred } : t)),
      );
      setSelected((s: Question | null) => (s && s.id === q.id ? { ...s, starred: q.starred } : s));
      setError(e instanceof ApiError ? e.message : "The question wasn't updated. Try again.");
    }
  }, []);

  /* ---------- resolve / reopen (optimistic w/ rollback) ---------- */
  const toggleResolved = useCallback(async (q: Question) => {
    const next = !q.resolved;
    setThreads((prev: Question[]) =>
      prev.map((t: Question) => (t.id === q.id ? { ...t, resolved: next } : t)),
    );
    setSelected((s: Question | null) => (s && s.id === q.id ? { ...s, resolved: next } : s));
    try {
      await questions.update(q.id, { resolved: next });
    } catch (e: unknown) {
      setThreads((prev: Question[]) =>
        prev.map((t: Question) => (t.id === q.id ? { ...t, resolved: q.resolved } : t)),
      );
      setSelected((s: Question | null) => (s && s.id === q.id ? { ...s, resolved: q.resolved } : s));
      setError(e instanceof ApiError ? e.message : "The question wasn't updated. Try again.");
    }
  }, []);

  /* ---------- send a reply ---------- */
  const send = useCallback(async () => {
    if (!selected) return;
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const updated = await questions.reply(selected.id, body);
      setSelected(updated);
      setDraft("");
      setThreads((prev: Question[]) =>
        prev.map((t: Question) => (t.id === updated.id ? updated : t)),
      );
    } catch (e: unknown) {
      setSendError(e instanceof ApiError ? e.message : "Your reply wasn't sent. Try again.");
    } finally {
      setSending(false);
    }
  }, [selected, draft, sending]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Q&A inbox"
        subtitle={`${unanswered} unanswered ${unanswered === 1 ? "question" : "questions"} from your learners.`}
        actions={
          unanswered > 0 ? (
            <Chip hue="coral" dot>
              {unanswered} waiting for a reply
            </Chip>
          ) : (
            <Chip hue="mint" icon={CheckCircle2}>
              All caught up
            </Chip>
          )
        }
        tabs={FILTERS.map((f) => ({ key: f, label: f }))}
        activeTab={filter}
        onTab={(k) => {
          setFilter(k as Filter);
          setLoading(true);
        }}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="ws-card flex h-[calc(100vh-280px)] min-h-[560px] overflow-hidden">
        {/* ---------- left pane: thread list ---------- */}
        <div
          className={`w-full flex-col border-r border-neutral-100 md:flex md:w-[360px] ${
            selectedId ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="border-b border-neutral-100 p-4">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search questions…"
              label="Search questions"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3" role="status" aria-busy="true">
                <span className="sr-only">Loading questions…</span>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-100 motion-reduce:animate-none" aria-hidden />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Empty
                icon={MessageSquare}
                hue="sky"
                title={query ? "No questions match" : "No questions yet"}
                hint={
                  query
                    ? "Try another search or filter."
                    : "Questions from your learners show here."
                }
              />
            ) : (
              <ul className="space-y-1 p-2">
                {filtered.map((t: Question) => {
                  const isActive = t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => openThread(t.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={`flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 ${
                          isActive ? "bg-primary-50 ring-1 ring-primary-100" : "hover:bg-neutral-50"
                        }`}
                      >
                        <FaceAvatar name={t.student ?? t.initials} size={38} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-sm ${
                                t.awaitingReply
                                  ? "font-semibold text-neutral-900"
                                  : "font-medium text-neutral-700"
                              }`}
                            >
                              {t.student ?? "Unknown learner"}
                            </span>
                            <span className="shrink-0 text-[11px] text-neutral-500">
                              {timeAgo(t.lastReplyAt)}
                            </span>
                          </div>
                          <p className="truncate text-sm font-medium text-neutral-800">
                            {t.subject}
                          </p>
                          <p className="truncate text-xs text-neutral-500">
                            {t.preview}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="truncate text-[11px] font-medium text-neutral-500">
                              {t.courseTitle ?? "-"}
                            </span>
                            {t.resolved && (
                              <Chip hue="mint" className="!px-1.5 !py-0 text-[10px]">
                                Resolved
                              </Chip>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-1.5">
                          {t.awaitingReply && (
                            <span className="h-2.5 w-2.5 rounded-full bg-primary-600" aria-label="Awaiting reply" />
                          )}
                          {t.starred && (
                            <Star
                              size={14}
                              className="fill-sun-400 text-sun-400"
                              aria-label="Starred"
                            />
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ---------- right pane: conversation ---------- */}
        <div
          className={`flex-1 flex-col ${selectedId ? "flex" : "hidden md:flex"}`}
        >
          {selectedId ? (
            convoLoading && !selected ? (
              <div className="flex flex-1 items-center justify-center text-sm text-neutral-500" role="status">
                Loading conversation…
              </div>
            ) : convoError && !selected ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-sm text-error-700">{convoError}</p>
                <Button size="sm" icon={RotateCcw} onClick={() => void openThread(selectedId)}>
                  Try again
                </Button>
              </div>
            ) : selected ? (
              <>
                {/* conversation header */}
                <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setSelected(null);
                    }}
                    aria-label="Back to inbox"
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300 md:hidden"
                  >
                    <ArrowLeft size={18} aria-hidden />
                  </button>
                  <FaceAvatar name={selected.student ?? selected.initials} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {selected.student ?? "Unknown learner"}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {selected.courseTitle ?? "-"}
                      {selected.lesson ? ` · ${selected.lesson}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleStar(selected)}
                      aria-label={selected.starred ? "Unstar" : "Star"}
                      aria-pressed={selected.starred}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <Star
                        size={18}
                        aria-hidden
                        className={
                          selected.starred ? "fill-sun-400 text-sun-400" : ""
                        }
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleResolved(selected)}
                      className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 ${
                        selected.resolved
                          ? "text-neutral-600 hover:bg-neutral-100"
                          : "bg-mint-50 text-mint-700 hover:bg-mint-100"
                      }`}
                    >
                      {selected.resolved ? (
                        <>
                          <RotateCcw size={15} aria-hidden />
                          <span className="hidden sm:inline">Reopen</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} aria-hidden />
                          <span className="hidden sm:inline">Mark resolved</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* subject line */}
                <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
                  <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-neutral-900">
                    {selected.subject}
                  </h3>
                  {selected.resolved ? (
                    <Chip hue="mint" dot>
                      Resolved
                    </Chip>
                  ) : (
                    <Chip hue={selected.courseTitle ? hueFor(selected.courseTitle) : "slate"}>{selected.reference}</Chip>
                  )}
                </div>

                {/* messages */}
                <div className="flex-1 space-y-4 overflow-y-auto bg-canvas/60 px-5 py-5">
                  {(selected.messages ?? []).map((m) => {
                    const mine = m.from === "instructor";
                    const roleLabel =
                      m.authorRole === "admin" ? "Admin" : m.author ?? (mine ? "You" : "Learner");
                    return (
                      <div
                        key={m.id}
                        className={`flex items-end gap-2 ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!mine && <FaceAvatar name={selected.student ?? selected.initials} size={30} />}
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                            mine
                              ? "rounded-br-md bg-gradient-to-br from-primary-500 to-primary-700 text-white"
                              : "rounded-bl-md border border-neutral-200/80 bg-white text-neutral-800"
                          }`}
                        >
                          <p
                            className={`mb-1 text-[11px] font-semibold ${
                              mine ? "text-primary-100" : "text-neutral-500"
                            }`}
                          >
                            {roleLabel}
                          </p>
                          <RichTextView value={m.body} size="sm" inverse={mine} />
                          <p
                            className={`mt-1 text-[10px] ${
                              mine ? "text-primary-100" : "text-neutral-500"
                            }`}
                          >
                            {timeAgo(m.createdAt)}
                          </p>
                        </div>
                        {mine && <FaceAvatar name={m.author ?? "You"} size={30} />}
                      </div>
                    );
                  })}
                </div>

                {/* composer */}
                <div className="border-t border-neutral-100 p-4">
                  {sendError && (
                    <p role="alert" className="mb-2 px-1 text-xs text-error-700">{sendError}</p>
                  )}
                  <div className="flex items-end gap-2">
                    <label htmlFor="qa-reply" className="sr-only">
                      Reply to {selected.student ?? "student"}
                    </label>
                    <RichTextEditor
                      id="qa-reply"
                      value={draft}
                      onChange={setDraft}
                      minHeight={64}
                      disabled={sending}
                      placeholder={`Reply to ${(selected.student ?? "student").split(" ")[0]}…`}
                      className="min-w-0 flex-1"
                    />
                    <Button
                      variant="primary"
                      disabled={!draft.trim() || sending}
                      onClick={() => void send()}
                      aria-label={sending ? "Sending…" : "Send"}
                    >
                      <Send size={16} aria-hidden />
                      <span className="hidden sm:inline">
                        {sending ? "Sending…" : "Send"}
                      </span>
                    </Button>
                  </div>
                </div>
              </>
            ) : null
          ) : (
            <Empty
              icon={MessageSquare}
              hue="sky"
              title="Pick a conversation"
              hint="Choose a question from the list to read it and reply."
            />
          )}
        </div>
      </div>
    </div>
  );
}
