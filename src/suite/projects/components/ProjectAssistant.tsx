"use client";

import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { IconTile } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  assistant as assistantApi,
  type AssistantMessage,
  type AssistantReply,
  type Project,
} from "@/lib/api/projects-client";
import { Notice, TYPE_META } from "./ui/pkit";

/*
  The project assistant: ask a question, get an answer drawn from this
  project's live data.

  **The conversation lives in the browser.** The API is stateless, every
  question carries the last twenty turns, so the history is kept here, per
  project, in sessionStorage: it survives a reload and a tab switch, and dies
  with the tab, which is the right lifetime for a chat about work that keeps
  moving under it.

  **Nothing the model writes is trusted as markup.** Answers are parsed into a
  handful of React elements (bold, code, lists, line breaks) and React escapes
  every string it renders; there is no `dangerouslySetInnerHTML` anywhere, so a
  model that answers in `<script>` answers in visible text.

  The floating launcher opens it. The header button that used to open it
  too became "Generate With AI" on 13 Oct 2026 (see `ProjectWorkspace`).
*/

const KEEP = 20;

const SUGGESTIONS = [
  "What's at risk in this sprint?",
  "Who has the most open tasks?",
  "Summarise progress on each story",
  "Which items are blocked and why?",
];

const PROVIDER_NAME: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
};

type ChatMessage = AssistantMessage & {
  references?: AssistantReply["references"];
};

type Stored = { messages: ChatMessage[]; via: { provider: string; model: string } | null };

type Failure = { kind: "provider"; message: string } | { kind: "error"; message: string };

function storageKey(slug: string) {
  return `projects.assistant.${slug}`;
}

function readStored(slug: string): Stored {
  try {
    const raw = window.sessionStorage.getItem(storageKey(slug));
    if (!raw) return { messages: [], via: null };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(
          (m): m is ChatMessage =>
            m != null && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
        )
      : [];
    return { messages: messages.slice(-KEEP), via: parsed.via ?? null };
  } catch {
    return { messages: [], via: null };
  }
}

function writeStored(slug: string, value: Stored) {
  try {
    if (value.messages.length === 0) window.sessionStorage.removeItem(storageKey(slug));
    else window.sessionStorage.setItem(storageKey(slug), JSON.stringify(value));
  } catch {
    /* Private mode or a full quota: the chat still works, it just won't survive a reload. */
  }
}

/* ------------------------------------------------------------------ */
/*  Panel                                                              */
/* ------------------------------------------------------------------ */

export default function ProjectAssistant({
  project,
  onOpenItem,
}: {
  project: Pick<Project, "slug" | "name">;
  onOpenItem: (id: string) => void;
}) {
  const slug = project.slug;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [via, setVia] = useState<Stored["via"]>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const titleId = useId();
  const inputId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  /* Restore this project's conversation, on mount and when the slug changes. */
  if (typeof window !== "undefined" && loadedFor !== slug) {
    const stored = readStored(slug);
    setLoadedFor(slug);
    setMessages(stored.messages);
    setVia(stored.via);
    setFailure(null);
  }

  useEffect(() => {
    if (loadedFor === slug) writeStored(slug, { messages, via });
  }, [slug, loadedFor, messages, via]);

  const show = useCallback(() => {
    openerRef.current = document.activeElement;
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    /* Back to whatever opened it, or the launcher, so keyboard users are not dropped at the top. */
    const opener = openerRef.current;
    window.setTimeout(() => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      else launcherRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hide]);

  /* Keep the newest turn in view. */
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView?.({ block: "end" });
  }, [open, messages, sending, failure]);

  /* The textarea grows with what is typed, up to a limit, then scrolls. */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft, open]);

  const ask = async (history: ChatMessage[]) => {
    setSending(true);
    setFailure(null);

    try {
      const payload: AssistantMessage[] = history.slice(-KEEP).map(({ role, content }) => ({ role, content }));
      const reply = await assistantApi.ask(slug, payload);

      setMessages((prev) =>
        [...prev, { role: "assistant" as const, content: reply.answer, references: reply.references ?? [] }].slice(-KEEP),
      );
      if (reply.model) setVia({ provider: reply.provider, model: reply.model });
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.errors?.provider) {
        setFailure({ kind: "provider", message: e.message });
      } else {
        setFailure({
          kind: "error",
          message: e instanceof ApiError ? e.message : "The assistant could not be reached.",
        });
      }
    } finally {
      setSending(false);
    }
  };

  const send = (text: string) => {
    const content = text.trim();
    if (content === "" || sending) return;

    /*
      A question the last attempt never answered is dropped rather than sent
      twice in a row: the conversation has to alternate, and the new question
      is what the person now wants answered.
    */
    const base = messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages;
    const next = [...base, { role: "user" as const, content: content.slice(0, 4000) }].slice(-KEEP);

    setMessages(next);
    setDraft("");
    void ask(next);
  };

  const retry = () => {
    if (messages.at(-1)?.role === "user") void ask(messages);
  };

  const clear = () => {
    setMessages([]);
    setVia(null);
    setFailure(null);
    inputRef.current?.focus();
  };

  const empty = messages.length === 0;

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={show}
          aria-label="Ask about this project"
          title="Ask about this project"
          className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 outline-none transition hover:bg-primary-700 focus-visible:ring-4 focus-visible:ring-primary-300 sm:bottom-6 sm:right-6"
        >
          <MessageSquare size={22} aria-hidden />
          <Sparkles size={13} aria-hidden className="absolute right-3 top-3" />
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="fixed inset-0 z-[70] flex flex-col bg-white shadow-2xl ring-1 ring-neutral-200/80 sm:inset-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[420px] sm:rounded-[1.5rem]"
        >
          {/* ------------------------------ header ------------------------------ */}
          <header className="flex items-start gap-3 border-b border-neutral-100 px-5 pb-4 pt-5">
            <span aria-hidden>
              <IconTile icon={Sparkles} hue="grape" size={40} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-base font-bold tracking-tight text-neutral-900">
                {project.name}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">Answers from this project&apos;s live data</p>
              {via !== null && (
                <p className="mt-1 truncate text-[11px] text-neutral-500">
                  {PROVIDER_NAME[via.provider] ?? via.provider} · {via.model}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!empty && (
                <button
                  type="button"
                  onClick={clear}
                  disabled={sending}
                  aria-label="Clear conversation"
                  title="Clear conversation"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={17} aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={hide}
                aria-label="Close assistant"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </header>

          {/* ----------------------------- messages ----------------------------- */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-canvas/60 px-4 py-5">
            {empty && !sending && (
              <div className="flex flex-col items-center px-2 pt-6 text-center">
                <span
                  className={cx("flex h-14 w-14 items-center justify-center rounded-2xl", HUE.grape.soft)}
                  aria-hidden
                >
                  <MessageSquare size={26} />
                </span>
                <p className="mt-4 text-[15px] font-semibold text-neutral-900">Ask anything about {project.name}</p>
                <p className="mt-1 max-w-[18rem] text-sm text-neutral-500">
                  Sprints, stories, who is working on what, what is stuck. Try one of these:
                </p>
                <ul className="mt-5 flex w-full flex-col gap-2" aria-label="Suggested questions">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => send(s)}
                        className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-neutral-700 outline-none transition hover:border-primary-200 hover:bg-primary-50/60 hover:text-primary-800 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <Sparkles size={14} aria-hidden className="shrink-0 text-grape-500" />
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ol role="log" aria-live="polite" aria-label="Conversation" className="space-y-4">
              {messages.map((m, i) => (
                <li key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
                      <span className="sr-only">You: </span>
                      {m.content}
                    </div>
                  ) : (
                    /* A table needs every pixel of a 420px panel; prose reads better narrower. */
                    <div className={cx("min-w-0", hasTable(m.content) ? "w-full" : "max-w-[92%]")}>
                      <div className="break-words rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-neutral-800 shadow-sm ring-1 ring-neutral-200/70">
                        <span className="sr-only">Assistant: </span>
                        <Markdown text={m.content} />
                      </div>
                      {m.references && m.references.length > 0 && (
                        <div className="mt-2">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                            Mentioned items
                          </p>
                          <ul className="flex flex-wrap gap-1.5">
                            {m.references.map((r) => {
                              const meta = TYPE_META[r.type] ?? TYPE_META.task;
                              const Icon = meta.icon;
                              return (
                                <li key={r.id} className="max-w-full">
                                  <button
                                    type="button"
                                    onClick={() => onOpenItem(r.id)}
                                    title={`Open ${meta.label.toLowerCase()}: ${r.title}`}
                                    className={cx(
                                      "inline-flex min-h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary-300",
                                      HUE[meta.hue].soft,
                                    )}
                                  >
                                    <Icon size={12} aria-hidden className="shrink-0" />
                                    <span className="sr-only">{meta.label}: </span>
                                    <span className="truncate">{r.title}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>

            {sending && (
              <div className="mt-4 flex justify-start" role="status">
                <span className="sr-only">The assistant is reading the project…</span>
                <span
                  aria-hidden
                  className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3.5 shadow-sm ring-1 ring-neutral-200/70"
                >
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}

            {failure?.kind === "provider" && (
              <Notice tone="info" title="The assistant isn't set up yet" className="mt-4">
                It needs an AI provider for your organisation. An administrator can add one under{" "}
                <Link href="/suite/projects/ai" className="font-semibold underline underline-offset-2">
                  Projects → AI settings
                </Link>
                ; if that isn&apos;t you, ask whoever looks after this workspace.
              </Notice>
            )}

            {failure?.kind === "error" && (
              <Notice
                tone="error"
                title="No answer this time"
                className="mt-4"
                action={
                  <Button size="sm" icon={RotateCcw} onClick={retry} disabled={sending}>
                    Retry
                  </Button>
                }
              >
                {failure.message}
              </Notice>
            )}

            <div ref={endRef} />
          </div>

          {/* ------------------------------ composer ----------------------------- */}
          <form
            className="border-t border-neutral-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:rounded-b-[1.5rem]"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Your question
            </label>
            <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-1.5 pl-3.5 transition focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-100">
              <textarea
                id={inputId}
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={4000}
                disabled={sending}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                placeholder="Ask about sprints, stories, people…"
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent py-2 text-base text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-500 sm:text-sm"
              />
              <button
                type="submit"
                disabled={sending || draft.trim() === ""}
                aria-label="Send question"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary-600 text-white outline-none transition hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SendHorizontal size={17} aria-hidden />
              </button>
            </div>
            <p className="mt-1.5 hidden text-[11px] text-neutral-500 sm:block">
              Enter to send · Shift + Enter for a new line · Answers can be wrong; check the board before acting.
            </p>
          </form>
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  A small, safe markdown                                             */
/* ------------------------------------------------------------------ */

type Align = "left" | "center" | "right" | null;

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; text: string }
  | { kind: "table"; header: string[]; align: Align[]; rows: string[][] };

/** `| --- | :--: | --: |`, the line that turns the row above it into a header. */
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** A pipe row's cells, with `\|` kept as a literal pipe inside a cell. */
function cells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");

  return inner.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

export function hasTable(text: string): boolean {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  return lines.some((l, i) => l.includes("|") && TABLE_RULE.test(lines[i + 1] ?? ""));
}

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const last = () => blocks.at(-1);
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);

    /*
      A table is a pipe row followed by a rule row. Without the rule it is
      just a sentence that happens to contain a pipe, and stays a paragraph.
    */
    if (line.includes("|") && TABLE_RULE.test(lines[i + 1] ?? "")) {
      const header = cells(line);
      const align: Align[] = cells(lines[i + 1]).map((c) =>
        c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : null,
      );
      const rows: string[][] = [];

      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        const row = cells(lines[i]);
        /* Ragged rows are padded or clipped to the header, as GitHub does. */
        rows.push(header.map((_, c) => row[c] ?? ""));
        i++;
      }
      i--;

      blocks.push({ kind: "table", header, align, rows });
      continue;
    }

    if (line.trim() === "") {
      blocks.push({ kind: "p", lines: [] });
    } else if (heading) {
      blocks.push({ kind: "h", text: heading[1] });
    } else if (bullet) {
      const b = last();
      if (b?.kind === "ul") b.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else if (numbered) {
      const b = last();
      if (b?.kind === "ol") b.items.push(numbered[1]);
      else blocks.push({ kind: "ol", items: [numbered[1]] });
    } else {
      const b = last();
      if (b?.kind === "p") b.lines.push(line);
      else blocks.push({ kind: "p", lines: [line] });
    }
  }

  return blocks.filter((b) => b.kind !== "p" || b.lines.length > 0);
}

/** `**bold**`, `__bold__`, `` `code` `` and `*italic*`, as elements, never as HTML. */
function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let at = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > at) parts.push(text.slice(at, m.index));
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) {
      parts.push(
        <strong key={k++} className="font-semibold text-neutral-900">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("`")) {
      parts.push(
        <code key={k++} className="rounded-md bg-neutral-100 px-1 py-0.5 font-mono text-[12.5px] text-neutral-800">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    }
    at = m.index + tok.length;
  }
  if (at < text.length) parts.push(text.slice(at));

  return <>{parts}</>;
}

/*
  Words the assistant uses to rate something, drawn as a chip rather than as a
  word in a column. Three bands only. "High" and "low" are left out on
  purpose: high velocity is good and high risk is not, and a chip that guessed
  would be wrong half the time. The icon carries the meaning as well as the
  colour, so the rating survives colour blindness and greyscale printing.
*/
const RATING: { hue: "mint" | "sun" | "coral"; icon: typeof CheckCircle2; words: string[] }[] = [
  {
    hue: "mint",
    icon: CheckCircle2,
    words: ["good", "on track", "healthy", "done", "complete", "completed", "yes", "pass", "passed", "green", "fine"],
  },
  {
    hue: "sun",
    icon: AlertTriangle,
    words: ["watch", "warning", "at risk", "amber", "partial", "partially done", "caution", "needs attention", "in progress"],
  },
  {
    hue: "coral",
    icon: XCircle,
    words: ["bad", "poor", "blocked", "overdue", "off track", "fail", "failed", "red", "critical", "no", "missing"],
  },
];

function ratingFor(cell: string) {
  const word = cell.replace(/[*_`]/g, "").trim().toLowerCase();

  return RATING.find((r) => r.words.includes(word)) ?? null;
}

/** A figure, a percentage, hours or money: right-aligned so the digits line up. */
const NUMERIC = /^[-+]?(?:[A-Z]{3}\s?|[₦$€£]\s?)?[\d.,]+(?:\s?(?:%|h|hrs?|days?|pts?))?$/i;

function RatingChip({ cell, rating }: { cell: string; rating: NonNullable<ReturnType<typeof ratingFor>> }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold",
        HUE[rating.hue].soft,
      )}
    >
      <rating.icon size={12} aria-hidden className="shrink-0" />
      {cell.replace(/[*_`]/g, "").trim()}
    </span>
  );
}

/**
 * The column that is prose rather than a value, if there is one.
 *
 * In a 420px panel a table of *label · rating · a sentence* gives the sentence
 * about 140px and every row becomes a tall ribbon of three-word lines. When
 * one column clearly carries the prose, the rows are drawn stacked instead , 
 * label and verdict on a line, the sentence underneath at full width.
 */
function proseColumn(block: Extract<Block, { kind: "table" }>): number | null {
  if (block.header.length < 2 || block.header.length > 4 || block.rows.length === 0) return null;

  const mean = block.header.map(
    (_, c) => block.rows.reduce((sum, row) => sum + row[c].length, 0) / block.rows.length,
  );
  const widest = mean.indexOf(Math.max(...mean));
  const othersShort = mean.every((m, c) => c === widest || m <= 24);

  return widest > 0 && mean[widest] >= 36 && othersShort ? widest : null;
}

function StackedTable({ block, prose }: { block: Extract<Block, { kind: "table" }>; prose: number }) {
  return (
    <ul className="-mx-1 divide-y divide-neutral-100 rounded-xl ring-1 ring-neutral-200/80" aria-label="Table">
      {block.rows.map((row, r) => (
        <li key={r} className="px-3.5 py-3 transition-colors hover:bg-primary-50/40">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span className="font-semibold text-neutral-900">
              <span className="sr-only">{block.header[0]}: </span>
              <Inline text={row[0]} />
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {row.map((cell, c) => {
                if (c === 0 || c === prose || cell.trim() === "") return null;
                const rating = ratingFor(cell);

                return rating === null ? (
                  /* A short value that is not a verdict keeps its column name, or it means nothing. */
                  <span key={c} className="text-[12px] text-neutral-500">
                    {block.header[c]}:{" "}
                    <span className="font-semibold tabular-nums text-neutral-800">
                      <Inline text={cell} />
                    </span>
                  </span>
                ) : (
                  <span key={c}>
                    <span className="sr-only">{block.header[c]}: </span>
                    <RatingChip cell={cell} rating={rating} />
                  </span>
                );
              })}
            </span>
          </div>
          {row[prose].trim() !== "" && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
              <span className="sr-only">{block.header[prose]}: </span>
              <Inline text={row[prose]} />
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Table({ block }: { block: Extract<Block, { kind: "table" }> }) {
  const prose = proseColumn(block);

  if (prose !== null) return <StackedTable block={block} prose={prose} />;

  const alignOf = (c: number, value: string): string => {
    const set = block.align[c];
    if (set === "center") return "text-center";
    if (set === "right") return "text-right";
    if (set === "left") return "text-left";

    return NUMERIC.test(value.replace(/[*_`]/g, "").trim()) ? "text-right tabular-nums" : "text-left";
  };

  return (
    /*
      Scrolls sideways on its own when a table has more columns than the
      panel has room for, never the panel, and never the page.
    */
    <div className="-mx-1 overflow-x-auto rounded-xl ring-1 ring-neutral-200/80" role="region" aria-label="Table" tabIndex={0}>
      <table className="w-full min-w-[18rem] border-collapse text-left text-[13px] leading-snug">
        <thead>
          <tr className="bg-neutral-50">
            {block.header.map((h, c) => (
              <th
                key={c}
                scope="col"
                className={cx(
                  "whitespace-nowrap border-b border-neutral-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500",
                  alignOf(c, ""),
                )}
              >
                <Inline text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {block.rows.map((row, r) => (
            <tr key={r} className="align-top transition-colors hover:bg-primary-50/40">
              {row.map((cell, c) => {
                /* The first column names the row. "Blocked" there is a label, not a verdict. */
                const rating = c === 0 ? null : ratingFor(cell);
                const Tag = c === 0 ? "th" : "td";

                return (
                  <Tag
                    key={c}
                    {...(c === 0 ? { scope: "row" } : {})}
                    className={cx(
                      "px-3 py-2.5",
                      c === 0 ? "min-w-[6rem] font-semibold text-neutral-900" : "text-neutral-700",
                      rating === null ? alignOf(c, cell) : "whitespace-nowrap",
                    )}
                  >
                    {rating === null ? <Inline text={cell} /> : <RatingChip cell={cell} rating={rating} />}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks = toBlocks(text);

  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "table":
            return <Table key={i} block={b} />;
          case "h":
            return (
              <p key={i} className="font-semibold text-neutral-900">
                <Inline text={b.text} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-neutral-400">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-neutral-500">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={i}>
                {b.lines.map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    <Inline text={l} />
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
