"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Lightbulb, ListPlus, MessageCircleQuestion } from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import {
  getJobTitlesServerState,
  getJobTitlesState,
  loadJobTitles,
  subscribeJobTitles,
} from "@/lib/api/job-titles-client";

/*
  The pieces the flat preview and the delivery plan draw the same way: the
  model's questions, the Assumed mark, a job title, an estimate. One drawing
  each, so "assumed" or "not one of ours" means the same thing in both.
*/

/**
 * The brief with the model's questions appended, each followed by a line to
 * answer on. Appended rather than replacing, so nothing already written is lost.
 */
export function withQuestions(brief: string, questions: string[]): string {
  const scaffold = questions.map((q) => `${q}\nAnswer: `).join("\n\n");

  return `${brief.trimEnd()}\n\n${scaffold}`;
}

export function BriefQuestions({
  questions,
  title,
  hint,
  onAdd,
  className,
}: {
  questions: string[];
  title: string;
  hint: string;
  onAdd?: () => void;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cx("rounded-2xl border border-sun-100 bg-sun-50/60 p-4", className)}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sun-700 ring-1 ring-sun-100" aria-hidden>
          <MessageCircleQuestion size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{hint}</p>
        </div>
      </div>

      <ol className="mt-3 space-y-2 pl-12">
        {questions.map((q, i) => (
          <li key={i} className="relative text-sm leading-snug text-neutral-800">
            {/* Numbered because the scaffold they become is in this order. */}
            <span
              aria-hidden
              className="absolute -left-7 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold tabular-nums text-sun-700 ring-1 ring-sun-100"
            >
              {i + 1}
            </span>
            {q}
          </li>
        ))}
      </ol>

      {onAdd !== undefined && (
        <div className="mt-4 pl-12">
          <Button size="sm" icon={ListPlus} onClick={onAdd}>
            Add these to the brief
          </Button>
        </div>
      )}
    </section>
  );
}

/** Drafted from the kind of system, not from the brief: the first thing to question. */
export function AssumedChip({ className }: { className?: string }) {
  return (
    <span
      title="Not in your brief. A standard part of this kind of system. Keep it only if you want it."
      className={cx(
        "inline-flex translate-y-[-1px] items-center gap-1 whitespace-nowrap rounded-full bg-sun-50 px-2 py-0.5 align-middle text-[11px] font-semibold text-sun-700 ring-1 ring-sun-100",
        className,
      )}
    >
      <Lightbulb size={11} aria-hidden />
      Assumed
    </span>
  );
}

const INITIALISMS = new Set(["qa", "ui", "ux", "ml", "ai", "hr", "it", "pm", "ba", "db", "seo", "sre", "api"]);

/** "backend_engineer" → "Backend engineer": a key read as words, for when no name is known. */
export function humaniseKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (words === "") return key;

  /* The initialisms job titles are made of; "head of design" keeps its "of". */
  const cased = words
    .split(" ")
    .map((w) => (INITIALISMS.has(w.toLowerCase()) ? w.toUpperCase() : w))
    .join(" ");

  return cased[0].toUpperCase() + cased.slice(1);
}

/**
 * A planned item's job title.
 *
 * `discipline` is the key the model answered with (`backend_engineer`), not a
 * name anybody chose, and it used to be shown as it came. The name is read
 * from the organisation's job titles by `disciplineId`; a key with no match
 * (or before the list loads) is at least shown as words.
 */
export function JobTitleChip({
  item,
}: {
  item: { discipline?: string | null; disciplineId?: string | null };
}) {
  const titles = useSyncExternalStore(subscribeJobTitles, getJobTitlesState, getJobTitlesServerState);
  const wanted = item.disciplineId != null;

  useEffect(() => {
    if (wanted) loadJobTitles().catch(() => {});
  }, [wanted]);

  if (item.discipline === null || item.discipline === undefined) {
    return <span className="text-neutral-400">-</span>;
  }

  const name =
    (item.disciplineId != null ? titles.titles.find((t) => t.id === item.disciplineId)?.name : undefined) ??
    humaniseKey(item.discipline);

  return (
    <Chip hue={item.disciplineId === null ? "sun" : "slate"} className="!px-2 !py-0.5 text-[11px]">
      {name}
      {/*
        The model named a job title this organisation does not have. The
        name is kept so a reader can see what it said; the item comes in
        with no job title rather than a guess.
      */}
      {item.disciplineId === null && " · not on our job titles"}
    </Chip>
  );
}

export function Estimate({ hours }: { hours: number | null | undefined }) {
  return (
    <span className="whitespace-nowrap text-xs tabular-nums text-neutral-600">
      {hours === null || hours === undefined ? (
        /* Absent, never zero — as everywhere else in this module. */
        <span className="text-neutral-500">not estimated</span>
      ) : (
        `${hours}h`
      )}
    </span>
  );
}
