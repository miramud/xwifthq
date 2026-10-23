"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Ban, BookCheck, ChevronDown, CircleDashed, Link2, ListChecks, Receipt, Sparkles, Split, X } from "lucide-react";
import { Button, Chip, Empty, SearchField, Segmented, cx } from "@/components/workspace/kit";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { banking, errorText, type LineFilter, type StatementLine } from "@/lib/api/finance-banking-client";
import { accounting, amount, day } from "@/suite/finance/lib/format";
import { FLAGS, categoryMeta, sourceLabel } from "@/suite/finance/components/banking/labels";
import LineEditor from "./LineEditor";

/**
 * The review queue: a statement's lines in posting order, each with what the
 * classifier made of it, and an inline editor to confirm or change it.
 *
 * Keyboard: ↑/↓ (or k/j) move between lines, Enter opens one, Ctrl+Enter
 * saves and opens the next, Esc closes.
 */

export type QueueFilter = "needs_account" | "needs_review" | "all" | "matched" | "ignored";

const FILTERS: { key: QueueFilter; label: string }[] = [
  { key: "needs_account", label: "Needs an account" },
  { key: "needs_review", label: "Needs review" },
  { key: "all", label: "All" },
  { key: "matched", label: "Matched" },
  { key: "ignored", label: "Ignored" },
];

export default function ReviewQueue({
  importId,
  currency,
  editable,
  initialFilter,
  focusIds,
  onClearFocus,
  onChanged,
}: {
  importId: string;
  currency: string;
  /** The import is ready for review and this person may classify lines. */
  editable: boolean;
  initialFilter: QueueFilter;
  /** Only these lines (from an analysis finding). */
  focusIds?: string[] | null;
  onClearFocus?: () => void;
  /** A line changed: the header's counts are stale. */
  onChanged?: () => void;
}) {
  const [filter, setFilter] = useState<QueueFilter>(focusIds?.length ? "all" : initialFilter);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<StatementLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  // A line to focus once it is on screen (after "next", or a jump to a paired line).
  const focusWanted = useRef<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const rows = useRef(new Map<string, HTMLElement>());

  // Search on the server, a moment after typing stops.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let alive = true;
    banking.statements
      .lines(importId, { status: filter === "all" ? undefined : (filter as LineFilter), q: q || undefined })
      .then((r) => {
        if (!alive) return;
        setLines(r);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(`The lines didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [importId, filter, q, reload]);

  const shown = useMemo(() => {
    const all = lines ?? [];
    return focusIds?.length ? all.filter((l) => focusIds.includes(l.id)) : all;
  }, [lines, focusIds]);

  const setFocusNext = (id: string | null) => {
    focusWanted.current = id;
    setFocusTick((t) => t + 1);
  };

  useEffect(() => {
    const id = focusWanted.current;
    if (id === null) return;
    const el = rows.current.get(id);
    if (el) {
      el.focus();
      el.scrollIntoView?.({ block: "nearest" });
      focusWanted.current = null;
    }
  }, [focusTick, shown]);

  const indexOf = (id: string) => shown.findIndex((l) => l.id === id);

  const move = (from: string, by: number) => {
    const i = indexOf(from);
    const next = shown[Math.max(0, Math.min(shown.length - 1, i + by))];
    if (next) setFocusNext(next.id);
  };

  const [jumpNote, setJumpNote] = useState<string | null>(null);
  const jumpTo = async (id: string) => {
    setJumpNote(null);
    if (shown.some((l) => l.id === id)) {
      setFocusNext(id);
      return;
    }
    // Not in this view: if it is on this statement, show every line and focus it.
    try {
      const all = await banking.statements.lines(importId);
      if (all.some((l) => l.id === id)) {
        onClearFocus?.();
        setQuery("");
        setQ("");
        setFilter("all");
        setFocusNext(id);
      } else {
        setJumpNote("The other leg is on another account's statement. Open that account's statements to see it.");
      }
    } catch (e) {
      setJumpNote(errorText(e));
    }
  };

  const saved = (line: StatementLine, next: boolean) => {
    setLines((ls) => (ls ?? []).map((l) => (l.id === line.id ? line : l)));
    setTouched((t) => new Set(t).add(line.id));
    onChanged?.();
    if (!next) return;
    // The next line still waiting in this view, after this one.
    const i = shown.findIndex((l) => l.id === line.id);
    const after = shown.slice(i + 1).find((l) => !touched.has(l.id) && l.journalId === null);
    // Opening the next line's editor focuses its account picker; with none left, focus returns to this line.
    setOpenId(after?.id ?? null);
    if (!after) setFocusNext(line.id);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto [&_button]:whitespace-nowrap">
          <Segmented
            label="Show lines"
            value={filter}
            onChange={(f) => {
              onClearFocus?.();
              setFilter(f);
              setOpenId(null);
            }}
            options={FILTERS}
          />
        </div>
        <SearchField value={query} onChange={setQuery} placeholder="Search narrations" label="Search narrations" className="w-full lg:w-72" />
      </div>

      {focusIds?.length ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-primary-50 px-4 py-2.5 text-sm text-primary-700">
          <span>
            Showing the {focusIds.length} {focusIds.length === 1 ? "line" : "lines"} behind an analysis finding.
          </span>
          <Button size="sm" variant="ghost" icon={X} onClick={() => onClearFocus?.()}>
            Show all lines
          </Button>
        </div>
      ) : null}

      {editable && (
        <p className="mb-3 text-xs text-neutral-500">
          <kbd className="rounded border border-neutral-200 bg-white px-1">↑</kbd> <kbd className="rounded border border-neutral-200 bg-white px-1">↓</kbd> move ·{" "}
          <kbd className="rounded border border-neutral-200 bg-white px-1">Enter</kbd> classify · <kbd className="rounded border border-neutral-200 bg-white px-1">Ctrl</kbd>+<kbd className="rounded border border-neutral-200 bg-white px-1">Enter</kbd> save and next ·{" "}
          <kbd className="rounded border border-neutral-200 bg-white px-1">Esc</kbd> close
        </p>
      )}

      {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
      {jumpNote && (
        <p role="status" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-700">
          {jumpNote}
          <button type="button" aria-label="Dismiss" onClick={() => setJumpNote(null)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-sky-100 focus-visible:ring-2 focus-visible:ring-primary-300">
            <X size={14} aria-hidden />
          </button>
        </p>
      )}

      {lines === null && !error ? (
        <div aria-busy="true" className="space-y-2">
          <p className="sr-only">Loading lines…</p>
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : shown.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-neutral-200">
          {filter === "needs_account" && !q ? (
            <Empty icon={ListChecks} hue="mint" title="Every line has an account." hint="Propose the journals next, from the Journals tab." />
          ) : (
            <Empty icon={ListChecks} title="No lines here." hint={q ? "Nothing matches that search." : "Try another filter."} action={<Button size="sm" onClick={() => { setFilter("all"); setQuery(""); }}>Show all lines</Button>} />
          )}
        </div>
      ) : (
        <ol className="space-y-2" aria-label="Statement lines">
          {shown.map((l) => (
            <li key={l.id}>
              <LineRow
                line={l}
                currency={currency}
                open={openId === l.id}
                editable={editable && l.journalId === null}
                done={touched.has(l.id)}
                pairedHere={l.pairedLineId !== null}
                importId={importId}
                rowRef={(el) => {
                  if (el) rows.current.set(l.id, el);
                  else rows.current.delete(l.id);
                }}
                onToggle={() => setOpenId((o) => (o === l.id ? null : l.id))}
                onMove={(by) => move(l.id, by)}
                onJump={(id) => void jumpTo(id)}
                editor={
                  openId === l.id ? (
                    <LineEditor
                      line={l}
                      currency={currency}
                      onSaved={saved}
                      onClose={() => {
                        setOpenId(null);
                        setFocusNext(l.id);
                      }}
                    />
                  ) : null
                }
              />
            </li>
          ))}
        </ol>
      )}
      {lines !== null && (
        <p className="mt-3 text-xs text-neutral-500">
          {shown.length} {shown.length === 1 ? "line" : "lines"} in posting order.{" "}
          <button type="button" className="cursor-pointer font-semibold text-primary-700 underline-offset-2 hover:underline" onClick={() => setReload((k) => k + 1)}>
            Refresh
          </button>
        </p>
      )}
    </div>
  );
}

function LineRow({
  line: l,
  currency,
  open,
  editable,
  done,
  pairedHere,
  importId,
  rowRef,
  onToggle,
  onMove,
  onJump,
  editor,
}: {
  line: StatementLine;
  currency: string;
  open: boolean;
  editable: boolean;
  done: boolean;
  pairedHere: boolean;
  /** The statement on screen: a leg on another statement opens that statement instead. */
  importId: string;
  rowRef: (el: HTMLElement | null) => void;
  onToggle: () => void;
  onMove: (by: number) => void;
  onJump: (id: string) => void;
  editor: React.ReactNode;
}) {
  const out = l.direction === "DR";
  const cat = categoryMeta(l.category);
  const ignored = l.matchStatus === "ignored";
  const needsAccount = l.account === null && !ignored && l.journalId === null && l.category !== "transfer" && l.category !== "reversal";
  const flags = l.flags.map((f) => ({ f, meta: FLAGS[f] })).filter((x) => x.meta);
  const taxYear = l.flags.find((f) => f.startsWith("tax_year:"))?.split(":")[1];

  const keys = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      onMove(1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      onMove(-1);
    }
  };

  const body = (
    <span className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span className="block w-[4.5rem] pt-0.5">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-400 tabular-nums">#{l.postingSeq ?? l.listedIndex + 1}</span>
        <span className="block text-sm font-semibold text-neutral-900 tabular-nums">{day(l.valueDate).replace(/ \d{4}$/, "")}</span>
        {l.txnDate !== l.valueDate && <span className="block text-[11px] text-neutral-500">txn {day(l.txnDate).replace(/ \d{4}$/, "")}</span>}
      </span>
      <span className="order-last col-span-2 block min-w-0 sm:order-none sm:col-span-1">
        <span className={cx("block break-words text-sm leading-snug", ignored ? "text-neutral-400 line-through" : "text-neutral-800")}>{l.narration}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip hue={cat.hue} className="!px-2 !py-0.5 !text-[11px]">
            {cat.label}
          </Chip>
          {l.account ? (
            <Chip hue="slate" icon={BookCheck} className="!px-2 !py-0.5 !text-[11px]">
              {l.account.code} · {l.account.name}
            </Chip>
          ) : needsAccount ? (
            <Chip hue="sun" icon={CircleDashed} className="!px-2 !py-0.5 !text-[11px]">
              Needs an account
            </Chip>
          ) : null}
          {l.project && <Tag>Project: {l.project.name ?? "-"}</Tag>}
          {l.costCentre && <Tag>{l.costCentre.code} · {l.costCentre.name}</Tag>}
          {l.person && <Tag>Person: {l.person.name ?? "-"}</Tag>}
          {l.counterparty ? <Tag>{l.counterparty.name}</Tag> : l.counterpartyRaw ? <Tag muted>{l.counterpartyRaw}</Tag> : null}
          {l.purposeRaw && <Tag muted>For: {l.purposeRaw}</Tag>}
          {flags.map(({ f, meta }) => (
            <Chip key={f} hue={meta.hue} icon={meta.icon} className="!px-2 !py-0.5 !text-[11px]">
              {meta.label}
            </Chip>
          ))}
          {l.category === "transfer" && (
            <Chip hue="sky" icon={ArrowLeftRight} className="!px-2 !py-0.5 !text-[11px]">
              {l.pairedLineId ? "Paired transfer" : "Transfer, other leg not found yet"}
            </Chip>
          )}
          {taxYear && <Tag>Tax year {taxYear}</Tag>}
          {ignored && (
            <Chip hue="slate" icon={Ban} className="!px-2 !py-0.5 !text-[11px]">
              Ignored
            </Chip>
          )}
          {l.journalId && (
            <Chip hue="mint" icon={Receipt} className="!px-2 !py-0.5 !text-[11px]">
              In a journal
            </Chip>
          )}
          {done && !l.journalId && (
            <Chip hue="mint" icon={BookCheck} className="!px-2 !py-0.5 !text-[11px]">
              Saved
            </Chip>
          )}
        </span>
        {l.feeSplit && (
          <span className="mt-2 flex w-fit flex-wrap items-center gap-x-1.5 rounded-lg bg-neutral-100/80 px-2 py-1 text-[11px] text-neutral-600 tabular-nums">
            <Split size={12} aria-hidden />
            {amount(l.feeSplit.principal, currency)} paid + {amount(l.feeSplit.fee, currency)} fee + {amount(l.feeSplit.vat, currency)} VAT
          </span>
        )}
      </span>
      <span className="block text-right">
        <span className={cx("inline-flex items-center gap-1 text-[15px] font-bold tabular-nums", out ? "text-coral-700" : "text-mint-700")}>
          {out ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownLeft size={14} aria-hidden />}
          <span className="sr-only">{out ? "Out" : "In"}</span>
          {accounting(l.amount)}
        </span>
        <span className="block text-[11px] font-semibold uppercase text-neutral-400">{out ? "DR" : "CR"}</span>
        <span className="block mt-1 text-[11px] text-neutral-500 tabular-nums">Bal {accounting(l.balance)}</span>
        <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-neutral-500">
          <Sparkles size={11} aria-hidden />
          {sourceLabel(l.source)}
          {l.confidence != null && l.source && ` · ${l.confidence}%`}
        </span>
      </span>
    </span>
  );

  return (
    <article
      className={cx(
        "overflow-hidden rounded-2xl border bg-white transition-shadow",
        open ? "border-primary-300 shadow-md" : needsAccount ? "border-sun-100" : "border-neutral-200/80",
      )}
    >
      {editable ? (
        <button
          type="button"
          ref={rowRef}
          aria-expanded={open}
          onClick={onToggle}
          onKeyDown={keys}
          className="flex w-full cursor-pointer items-start gap-2 px-4 py-3.5 outline-none hover:bg-neutral-50/70 focus-visible:bg-primary-50/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300 sm:px-5"
        >
          {body}
          <ChevronDown size={16} aria-hidden className={cx("mt-1 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
          <span className="sr-only">{open ? "Close the classification" : "Classify this line"}</span>
        </button>
      ) : (
        <div ref={rowRef} tabIndex={-1} onKeyDown={keys} className="px-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300 sm:px-5">
          {body}
        </div>
      )}
      {pairedHere && l.pairedLineId && l.pairedImportId && l.pairedImportId !== importId ? (
        <div className="border-t border-neutral-100 px-4 py-1.5 sm:px-5">
          <Link
            href={`/suite/finance/banking/imports/${l.pairedImportId}`}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg text-xs font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <Link2 size={13} aria-hidden />
            {l.category === "reversal" || l.flags.includes("reversed") ? "Open the statement with the line it reverses" : "Open the other leg's statement"}
          </Link>
        </div>
      ) : pairedHere && l.pairedLineId && (
        <div className="border-t border-neutral-100 px-4 py-1.5 sm:px-5">
          <button type="button" onClick={() => onJump(l.pairedLineId as string)} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg text-xs font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
            <Link2 size={13} aria-hidden />
            {l.category === "reversal" || l.flags.includes("reversed") ? "Go to the line it reverses" : "Go to the other leg"}
          </button>
        </div>
      )}
      {editor}
    </article>
  );
}

function Tag({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={cx("inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[11px] font-medium", muted ? "border-dashed border-neutral-300 text-neutral-500" : "border-neutral-200 text-neutral-700")}>
      {children}
    </span>
  );
}
