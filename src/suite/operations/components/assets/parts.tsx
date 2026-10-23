"use client";

import { useEffect, useState } from "react";
import { Hourglass, Landmark, PenLine, Printer } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import type { SelectOption } from "@/components/workspace/SearchableSelect";
import { Timeline, type TimelineItem } from "@/suite/lms/components/ui/ws";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { assets, type AssetBook, type AssetMovement, type AssetPickerOptions } from "@/lib/api/operations-assets-client";
import { condition, depreciatedPercent, movement, rateText, stampOf, type Meta } from "./labels";

/* Pieces every asset screen shares: the tag, the chips, the history and Finance's book. */

/** A status word with its icon on its own wash. */
export function MetaChip({ meta }: { meta: Meta }) {
  return (
    <Chip hue={meta.hue} icon={meta.icon}>
      {meta.label}
    </Chip>
  );
}

export function ConditionChip({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const c = condition(value);
  return (
    <Chip hue={c.hue} dot>
      {c.label}
    </Chip>
  );
}

/**
 * Bars for the tag's little barcode, from the tag's own characters: the
 * same tag always draws the same stripes. Decoration only; the tag number
 * beside it is what people read.
 */
export function barsFor(text: string, count = 11): number[] {
  // FNV-1a over the whole tag, then a short xorshift run for the stripes.
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    out.push(1 + (h % 3));
  }
  return out;
}

/**
 * The asset tag, drawn like the sticker on the asset: the category code on
 * a dark tab, the tag number in mono, and a short barcode. Untagged assets
 * get a dashed outline that says so.
 */
export function AssetTag({ tagNo, code, size = "md", className }: { tagNo: string | null | undefined; code?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  if (!tagNo) {
    return (
      <span className={cx("inline-flex items-center gap-1.5 rounded-lg border border-dashed border-sun-500 bg-sun-50 px-2 py-1 text-xs font-semibold text-sun-700", className)}>
        Not tagged
      </span>
    );
  }
  const widths = barsFor(tagNo);
  const h = size === "lg" ? 22 : size === "sm" ? 12 : 16;
  const bars = widths.map((w, i) => ({ w, x: widths.slice(0, i).reduce((s, b) => s + b + 1, 0) }));
  const total = widths.reduce((s, b) => s + b + 1, 0);
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-stretch overflow-hidden rounded-lg bg-white font-mono ring-1 ring-neutral-300",
        size === "lg" ? "text-base" : size === "sm" ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      {code && (
        <span className={cx("flex items-center bg-neutral-900 font-bold uppercase tracking-wider text-white", size === "lg" ? "px-2.5" : "px-1.5", size === "sm" && "text-[10px]")}>
          {code}
        </span>
      )}
      <span className={cx("flex min-w-0 items-center truncate font-semibold tabular-nums text-neutral-900", size === "lg" ? "px-3 py-1.5" : size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1")}>{tagNo}</span>
      <span className={cx("flex items-center border-l border-dashed border-neutral-300 text-neutral-700", size === "sm" ? "hidden" : size === "lg" ? "px-2.5" : "px-1.5")} aria-hidden>
        <svg width={total} height={h} viewBox={`0 0 ${total} ${h}`}>
          {bars.map((b, i) => (
            <rect key={i} x={b.x} y={0} width={b.w} height={h} fill="currentColor" />
          ))}
        </svg>
      </span>
    </span>
  );
}

/** Tag, name and category in one line: how an asset is named in lists. */
export function AssetName({ tagNo, code, name, category, className }: { tagNo: string | null; code?: string | null; name: string; category?: string | null; className?: string }) {
  return (
    <span className={cx("flex min-w-0 flex-col gap-1", className)}>
      <span className="truncate font-semibold text-neutral-900">{name}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <AssetTag tagNo={tagNo} code={code} size="sm" />
        {category && <span className="truncate text-xs text-neutral-500">{category}</span>}
      </span>
    </span>
  );
}

/* ------------------------------ pickers ------------------------------ */

let pickerCache: Promise<AssetPickerOptions> | null = null;

/** Staff and projects for the pickers, loaded once per page visit. Null while loading. */
export function usePickerOptions(): { staff: SelectOption[] | null; projects: SelectOption[] | null; failed: boolean } {
  const [data, setData] = useState<AssetPickerOptions | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    pickerCache ??= assets.options();
    pickerCache.then(
      (o) => alive && setData(o),
      () => {
        pickerCache = null;
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return {
    staff: data ? data.staff.map((p) => ({ value: p.id, label: p.name })) : null,
    projects: data ? data.projects.map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })) : null,
    failed,
  };
}

/** For tests: forget the cached options. */
export function resetPickerOptions() {
  pickerCache = null;
}

/* ------------------------------ history ------------------------------ */

function movementText(m: AssetMovement): React.ReactNode {
  const parts: string[] = [];
  if (m.from && m.to && m.from !== m.to) parts.push(`from ${m.from} to ${m.to}`);
  else if (m.to && m.kind !== "return") parts.push(`to ${m.to}`);
  if (m.toLocation && m.toLocation !== m.fromLocation) parts.push(`at ${m.toLocation}`);
  if (m.project) parts.push(`for ${m.project.name}`);
  const cond = m.condition ? condition(m.condition).label.toLowerCase() : null;
  return (
    <>
      <span className="font-semibold text-neutral-900">{movement(m.kind).label}</span>
      {m.handoverNo && <span className="ml-1.5 font-mono text-xs text-neutral-500">{m.handoverNo}</span>}
      {parts.length > 0 && <span> {parts.join(", ")}</span>}
      {(cond || m.accessories) && (
        <span className="block text-xs text-neutral-500">
          {cond && `Condition ${cond}`}
          {cond && m.accessories && " · "}
          {m.accessories && `With ${m.accessories}`}
        </span>
      )}
      {m.note && <span className="mt-1 block rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">{m.note}</span>}
    </>
  );
}

function signedText(m: AssetMovement): string {
  const when = stampOf(m.at);
  const by = m.by ? `By ${m.by} · ${when}` : when;
  if (!m.toUserId || m.kind === "return") return by;
  if (m.acknowledgedAt) return `${by} · signed by ${m.acknowledgedBy ?? m.to ?? "the receiver"} ${stampOf(m.acknowledgedAt)}`;
  return `${by} · waiting for ${m.to ?? "the receiver"} to sign`;
}

/**
 * An asset's movements, newest first: handover numbers, who signed and
 * when. With `noteHref`, each handover links to its printable note.
 */
export function MovementTimeline({ history, noteHref }: { history: AssetMovement[]; noteHref?: (m: AssetMovement) => string }) {
  if (history.length === 0) return <p className="py-4 text-sm text-neutral-500">Nothing has happened to this asset yet.</p>;
  const items: TimelineItem[] = history.map((m) => {
    const meta = movement(m.kind);
    const waiting = Boolean(m.toUserId && !m.acknowledgedAt && m.kind !== "return");
    return {
      id: m.id,
      icon: waiting ? Hourglass : meta.icon,
      hue: waiting ? "sun" : meta.hue,
      text: movementText(m),
      when: (
        <span className="inline-flex items-center gap-1">
          {m.acknowledgedAt && m.toUserId && m.kind !== "return" && <PenLine size={12} aria-hidden />}
          {signedText(m)}
          {noteHref && m.handoverNo && m.toUserId && m.kind !== "return" && (
            <a
              href={noteHref(m)}
              target="_blank"
              rel="noreferrer"
              className="ml-2 inline-flex min-h-6 items-center gap-1 rounded font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
              aria-label={`Handover note ${m.handoverNo} (PDF)`}
            >
              <Printer size={12} aria-hidden />
              Handover note
            </a>
          )}
        </span>
      ),
    };
  });
  return <Timeline items={items} />;
}

/* ------------------------------ Finance ------------------------------ */

/**
 * Finance's book of an asset, read-only: cost, depreciation to date and
 * what it is worth on the books now, with a bar of how far it has
 * depreciated.
 */
export function BookFigures({ book, compact = false }: { book: AssetBook | null; compact?: boolean }) {
  if (!book) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-neutral-50 px-4 py-3.5 text-sm text-neutral-600">
        <Landmark size={18} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
        <p>
          <span className="block font-semibold text-neutral-800">Not on Finance&rsquo;s books</span>
          Controlled items, and assets in a category with no Finance class, are kept here only. Capital assets go on Finance&rsquo;s books when they are tagged.
        </p>
      </div>
    );
  }
  const pct = depreciatedPercent(book);
  return (
    <div className="space-y-4">
      <dl className={cx("grid gap-3", compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
        <div>
          <dt className="text-xs font-medium text-neutral-500">Cost</dt>
          <dd className="mt-0.5 text-[15px] font-bold text-neutral-900">
            <Money value={book.cost} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500">Depreciated</dt>
          <dd className="mt-0.5 text-[15px] font-bold text-coral-700">
            <Money value={book.accumulated} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500">Net book value</dt>
          <dd className="mt-0.5 text-[15px] font-bold text-mint-700">
            <Money value={book.nbv} />
          </dd>
        </div>
      </dl>
      <div>
        <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={`${pct}% of the cost depreciated; ${100 - pct}% left on the books`}>
          <span className="h-full bg-coral-500" style={{ width: `${pct}%` }} />
          <span className="ws-hatch h-full flex-1" />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-neutral-500">
          <span>{pct}% depreciated</span>
          <span>{rateText(book.rateBp)}</span>
        </div>
      </div>
      {!compact && (
        <p className="text-xs text-neutral-500">
          {book.class ?? "Fixed asset"}
          {book.capitalisedOn && ` · on the books since ${day(book.capitalisedOn)}`}
          {book.status && ` · ${book.status.replace(/_/g, " ")}`}. Finance keeps these figures; they change only in Finance.
        </p>
      )}
    </div>
  );
}
