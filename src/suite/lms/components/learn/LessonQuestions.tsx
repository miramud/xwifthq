"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageSquarePlus, Send } from "lucide-react";
import {
  getMyQuestions,
  askQuestion,
  replyToQuestion,
  ApiError,
  type LearnerQuestionThread,
} from "@/lib/api/learn-client";
import { timeAgo } from "@/lib/api/notifications-client";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * The learner's Q&A for a course: ask the instructor a question, and follow the
 * threads they've already opened. Questions asked from a lecture are tagged with
 * it, so the instructor sees which lesson prompted them.
 */
export default function LessonQuestions({
  courseSlug,
  lectureId,
  lectureTitle,
}: {
  courseSlug: string;
  lectureId: string;
  lectureTitle: string;
}) {
  const [threads, setThreads] = useState<LearnerQuestionThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  useEffect(() => {
    let alive = true;

    getMyQuestions(courseSlug)
      .then((data) => {
        if (alive) setThreads(data);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof ApiError ? err.message : "Could not load your questions.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [courseSlug]);

  const submit = useCallback(async () => {
    if (!subject.trim() || !body.trim()) return;

    setSending(true);
    setError(null);
    try {
      const created = await askQuestion(courseSlug, {
        subject: subject.trim(),
        body: body.trim(),
        lectureId,
      });
      setThreads((prev) => [created, ...prev]);
      setSubject("");
      setBody("");
      setComposing(false);
      setOpenId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post your question.");
    } finally {
      setSending(false);
    }
  }, [courseSlug, lectureId, subject, body]);

  const sendReply = useCallback(
    async (id: string) => {
      if (!reply.trim()) return;

      setSending(true);
      setError(null);
      try {
        const updated = await replyToQuestion(id, reply.trim());
        setThreads((prev) => prev.map((t) => (t.id === id ? updated : t)));
        setReply("");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not post your reply.");
      } finally {
        setSending(false);
      }
    },
    [reply],
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-700">Questions for your instructor</p>
          <p className="text-xs text-neutral-400">
            Asked from &ldquo;{lectureTitle}&rdquo;, so they&apos;ll see which lesson you meant.
          </p>
        </div>
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <MessageSquarePlus size={14} />
            Ask a question
          </button>
        )}
      </div>

      {composing && (
        <div className="mb-5 space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
          <input
            className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Summarise your question"
            maxLength={255}
          />
          <RichTextEditor label="Your question" value={body} onChange={setBody} placeholder="Describe what you're stuck on…" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={sending || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Post question
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-600">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-neutral-400">
          <Loader2 size={15} className="animate-spin" />
          Loading your questions…
        </div>
      ) : threads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
          You haven&apos;t asked anything yet. Your instructor usually replies within a day.
        </p>
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => {
            const open = openId === thread.id;
            return (
              <li key={thread.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : thread.id)}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800">{thread.subject}</p>
                    <p className="truncate text-xs text-neutral-500">{thread.preview}</p>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {thread.lesson ? `${thread.lesson} · ` : ""}
                      {timeAgo(thread.lastReplyAt)}
                    </p>
                  </div>
                  {thread.resolved ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[11px] font-medium text-success-700">
                      <CheckCircle2 size={11} /> Resolved
                    </span>
                  ) : thread.awaitingReply ? (
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                      Awaiting reply
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                      Answered
                    </span>
                  )}
                </button>

                {open && (
                  <div className="border-t border-neutral-100 bg-neutral-50/60 p-4">
                    <div className="space-y-3">
                      {(thread.messages ?? []).map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.from === "student" ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                              m.from === "student"
                                ? "bg-white text-neutral-700 ring-1 ring-neutral-200"
                                : "bg-primary-600 text-white"
                            }`}
                          >
                            <RichTextView value={m.body} size="sm" />
                            <p
                              className={`mt-1 text-[10px] ${
                                m.from === "student" ? "text-neutral-400" : "text-white/70"
                              }`}
                            >
                              {m.authorRole === "admin" ? "Admin" : (m.author ?? "You")} ·{" "}
                              {timeAgo(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-end gap-2">
                      <RichTextEditor minHeight={64} label="Your follow-up" value={reply} onChange={setReply} placeholder="Add a follow-up…" />
                      <button
                        type="button"
                        onClick={() => void sendReply(thread.id)}
                        disabled={sending || !reply.trim()}
                        aria-label="Send reply"
                        className="rounded-lg bg-primary-600 p-2.5 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
                      >
                        {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
