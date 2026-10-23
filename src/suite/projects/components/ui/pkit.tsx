"use client";

import { useEffect, useId, useRef } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  CircleDotDashed,
  FlaskConical,
  Info,
  Layers,
  ListChecks,
  Loader,
  Microscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { Chip, cx, initialsOf } from "@/components/workspace/kit";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import type { WorkItemStatus, WorkItemType } from "@/lib/api/projects-client";

/*
  The Projects module's own pieces, built on the workspace kit.

  Everything here is generic enough that the kit could take it one day (form
  fields, notices, a modal and a drawer frame, info rows), plus the module's
  vocabulary drawn one way everywhere: a work-item type is the same icon and
  hue on the board, the backlog, the schedule and the calendar, and a column's
  colour comes from what it *means* (its key and `countsAsComplete`), never
  from where it happens to sit.
*/

/* ------------------------------------------------------------------ */
/*  Form controls                                                      */
/* ------------------------------------------------------------------ */

export const inputCls =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500";
export const selectCls = `${inputCls} cursor-pointer pr-8`;
export const textareaCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";
/** A dense control for toolbars and table cells. */
export const smallInputCls =
  "h-9 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100";
export const labelCls = "mb-1.5 block text-[13px] font-semibold text-neutral-700";
export const hintCls = "mt-1.5 block text-xs text-neutral-500";
export const invalidCls = "!border-error-400 focus:!ring-error-100";

/** The message under a field the API refused. Wire its id to `aria-describedby`. */
export function FieldError({ id, message }: { id?: string; message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-error-700">
      <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** A checkbox row with a title and a sentence, the way settings read. */
export function CheckRow({
  checked,
  onChange,
  title,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
        checked ? "border-primary-200 bg-primary-50/50" : "border-neutral-200 hover:bg-neutral-50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 accent-primary-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-800">{title}</span>
        {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Notices and loading                                                */
/* ------------------------------------------------------------------ */

const NOTICE: Record<"error" | "warn" | "info" | "success", { cls: string; icon: LucideIcon }> = {
  error: { cls: "border-error-200 bg-error-50 text-error-700", icon: AlertTriangle },
  warn: { cls: "border-sun-100 bg-sun-50 text-sun-700", icon: AlertTriangle },
  info: { cls: "border-primary-100 bg-primary-50 text-primary-800", icon: Info },
  success: { cls: "border-mint-100 bg-mint-50 text-mint-700", icon: CheckCircle2 },
};

export function Notice({
  tone = "error",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof NOTICE;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { cls, icon: Icon } = NOTICE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cx("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm", cls, className)}
    >
      <Icon size={17} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title ? "mt-0.5 opacity-90" : "")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-[1.125rem] bg-white/70 ring-1 ring-neutral-200/70", className)} />;
}

/** A stat row and a big panel: the shape of most tabs while they load. */
export function TabSkeleton({ stats = 4 }: { stats?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      {stats > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <Skeleton key={i} className="h-[124px]" />
          ))}
        </div>
      )}
      <Skeleton className="h-72" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small layout pieces                                                */
/* ------------------------------------------------------------------ */

export function IconTile({ icon: Icon, hue = "blue", size = 36 }: { icon: LucideIcon; hue?: Hue; size?: number }) {
  return (
    <span
      className={cx("flex shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.5)} aria-hidden />
    </span>
  );
}

/** An information row: icon tile, label, value — the detail-page recipe. */
export function InfoRow({
  icon,
  label,
  value,
  hue = "slate",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hue?: Hue;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <IconTile icon={icon} hue={hue} size={34} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <div className="truncate text-sm font-semibold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

/** A small figure inside a card — lighter than a StatCard. */
export function MiniStat({
  label,
  value,
  hint,
  hue,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  hue?: Hue;
  className?: string;
}) {
  return (
    <div className={cx("rounded-2xl p-3.5", hue ? HUE[hue].soft : "bg-neutral-50", className)}>
      <p className={cx("text-xs font-medium", hue ? "opacity-90" : "text-neutral-500")}>{label}</p>
      <p className={cx("mt-1 text-lg font-bold tabular-nums leading-tight", hue ? "" : "text-neutral-900")}>{value}</p>
      {hint && <p className={cx("mt-0.5 text-[11px] leading-snug", hue ? "opacity-80" : "text-neutral-500")}>{hint}</p>}
    </div>
  );
}

export function SectionHeading({
  title,
  hint,
  actions,
  className,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-3 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold tracking-tight text-neutral-900">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal and drawer                                                   */
/* ------------------------------------------------------------------ */

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/**
 * The dimmed backdrop behind a modal or drawer; clicking it closes the frame.
 *
 * **Only a press that starts on the backdrop closes.** A click is fired where
 * the button comes up, so a press that began somewhere else - in a
 * `SearchableSelect` list portalled over the dialog, on that list's scrollbar,
 * or while selecting text in a field - and was released over the backdrop
 * used to throw the whole dialog away, unsaved. Long lists on short screens
 * overhang the dialog, which is exactly where that release lands. A keyboard
 * activation (`detail === 0`) still closes, for the drawer's focusable one.
 */
function Backdrop({ onClose, className, focusable }: { onClose: () => void; className: string; focusable: boolean }) {
  const pressed = useRef(false);
  return (
    <button
      type="button"
      aria-label="Close"
      {...(focusable ? {} : { tabIndex: -1 })}
      onPointerDown={(e) => {
        pressed.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const fromHere = pressed.current || e.detail === 0;
        pressed.current = false;
        if (fromHere) onClose();
      }}
      className={className}
    />
  );
}

type FrameProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  hue?: Hue;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Render the body as a form; the footer's submit button submits it. */
  onSubmit?: (e: React.FormEvent) => void;
  /** Supply to keep an existing heading id (tests and aria wiring). */
  titleId?: string;
  width?: "sm" | "md" | "lg" | "xl";
  /** Escape closes; set false while something must not be abandoned. */
  closeOnEscape?: boolean;
  bodyClassName?: string;
};

const WIDTH = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

function FrameHeader({
  title,
  subtitle,
  icon: Icon,
  hue = "blue",
  onClose,
  titleId,
}: Pick<FrameProps, "title" | "subtitle" | "icon" | "hue" | "onClose"> & { titleId: string }) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-5">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <IconTile icon={Icon} hue={hue} size={40} />}
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-neutral-900">
            {title}
          </h2>
          {subtitle && <div className="mt-0.5 truncate text-sm text-neutral-500">{subtitle}</div>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
      >
        <X size={18} aria-hidden />
      </button>
    </header>
  );
}

/** A centred dialog on a blurred backdrop. */
export function Modal({
  title,
  subtitle,
  icon,
  hue,
  onClose,
  children,
  footer,
  onSubmit,
  titleId,
  width = "md",
  closeOnEscape = true,
  bodyClassName = "px-6 py-5",
}: FrameProps) {
  const auto = useId();
  const id = titleId ?? `m-${auto.replace(/:/g, "")}`;
  useEscape(closeOnEscape ? onClose : () => undefined);
  const Body = onSubmit ? "form" : "div";
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto overscroll-contain p-0 sm:p-6">
      <Backdrop
        onClose={onClose}
        focusable={false}
        className="fixed inset-0 cursor-default bg-neutral-900/40 backdrop-blur-sm"
      />
      <Body
        {...(onSubmit ? { onSubmit } : {})}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cx(
          "relative mt-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl sm:mb-auto sm:rounded-[1.5rem]",
          WIDTH[width],
        )}
      >
        <FrameHeader title={title} subtitle={subtitle} icon={icon} hue={hue} onClose={onClose} titleId={id} />
        <div className={cx("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
            {footer}
          </footer>
        )}
      </Body>
    </div>
  );
}

/** A panel that slides in from the right, for editing one record beside the list. */
export function Drawer({
  title,
  subtitle,
  icon,
  hue,
  onClose,
  children,
  footer,
  onSubmit,
  titleId,
  width = "md",
  closeOnEscape = true,
  bodyClassName = "px-6 py-5",
}: FrameProps) {
  const auto = useId();
  const id = titleId ?? `d-${auto.replace(/:/g, "")}`;
  useEscape(closeOnEscape ? onClose : () => undefined);
  const Body = onSubmit ? "form" : "div";
  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <Backdrop
        onClose={onClose}
        focusable
        className="absolute inset-0 cursor-default bg-neutral-900/40 backdrop-blur-sm"
      />
      <Body
        {...(onSubmit ? { onSubmit } : {})}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cx("relative flex h-full w-full flex-col bg-white shadow-2xl sm:rounded-l-[1.5rem]", WIDTH[width])}
      >
        <FrameHeader title={title} subtitle={subtitle} icon={icon} hue={hue} onClose={onClose} titleId={id} />
        <div className={cx("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
            {footer}
          </footer>
        )}
      </Body>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Work-item vocabulary                                               */
/* ------------------------------------------------------------------ */

export const TYPE_META: Record<WorkItemType, { label: string; icon: LucideIcon; hue: Hue }> = {
  epic: { label: "Epic", icon: Layers, hue: "grape" },
  story: { label: "User story", icon: ListChecks, hue: "blue" },
  task: { label: "Task", icon: CircleDashed, hue: "sky" },
  bug: { label: "Bug", icon: Bug, hue: "rose" },
  spike: { label: "Spike", icon: FlaskConical, hue: "sun" },
};

export const TYPE_ORDER: WorkItemType[] = ["story", "task", "bug", "epic", "spike"];

export function TypeChip({ type, label }: { type: WorkItemType; label?: string }) {
  const meta = TYPE_META[type];
  return (
    <Chip hue={meta.hue} icon={meta.icon} className="!px-2 !py-0.5 text-[11px]">
      {label ?? meta.label}
    </Chip>
  );
}

/**
 * How a board column looks. Read from what the column *means* — its key and
 * whether it counts as complete — so a renamed or reordered column keeps its
 * colour, and an unknown one is drawn plainly rather than guessed at.
 */
export function statusVisual(status: Pick<WorkItemStatus, "key" | "countsAsComplete"> | null | undefined): {
  icon: LucideIcon;
  hue: Hue;
} {
  if (!status) return { icon: CircleDashed, hue: "slate" };
  if (status.countsAsComplete) return { icon: CheckCircle2, hue: "mint" };
  const k = status.key.toLowerCase();
  if (k.includes("partial")) return { icon: CircleDotDashed, hue: "sun" };
  if (k.includes("test") || k.includes("review") || k.includes("qa")) return { icon: Microscope, hue: "grape" };
  if (k.includes("progress") || k.includes("doing")) return { icon: Loader, hue: "blue" };
  if (k.includes("block")) return { icon: AlertTriangle, hue: "coral" };
  if (k.includes("todo") || k.includes("to_do") || k.includes("backlog")) return { icon: CircleDashed, hue: "slate" };
  return { icon: CircleDot, hue: "sky" };
}

export function StatusChip({
  status,
}: {
  status: Pick<WorkItemStatus, "key" | "label" | "countsAsComplete"> | null | undefined;
}) {
  const { icon, hue } = statusVisual(status);
  return (
    <Chip hue={hue} icon={icon} className="!px-2 !py-0.5 text-[11px]">
      {status?.label ?? "No column"}
    </Chip>
  );
}

/** Priority is 1–4 on the API, 1 the most pressing and 2 the default. */
export function priorityName(priority: number | null | undefined): string {
  switch (priority) {
    case 1:
      return "high";
    case 2:
      return "normal";
    case 3:
      return "low";
    case 4:
      return "lowest";
    default:
      return "";
  }
}

export function ItemRef({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return (
    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-neutral-600">
      {value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-07-22` → `22 Jul 2026`. Bare dates stay bare: no timezone is involved. */
export function fmtDate(value: string | null | undefined, withYear = true): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return withYear ? `${d} ${MON[m - 1]} ${y}` : `${d} ${MON[m - 1]}`;
}

/** `2026-06-15`, `2026-07-22` → `15 Jun – 22 Jul 2026`. */
export function fmtRange(from: string | null | undefined, to: string | null | undefined): string {
  if (!from && !to) return "—";
  if (!from) return `until ${fmtDate(to)}`;
  if (!to) return `from ${fmtDate(from)}`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${fmtDate(from, !sameYear)} – ${fmtDate(to)}`;
}

/** An ISO timestamp as a short local date and time. */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** Plural, the way the copy reads it: "1 item", "3 items". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Server wording in the owner's word. Since 27 Sep 2026 Projects prices and
 * plans by the organisation's job titles, not "disciplines", but labels the
 * API writes (a rate's source, an import field) may still say the old word.
 */
export function sayJobTitle(text: string): string {
  return text.replace(/disciplines?/gi, (word) => {
    const plural = word.length > "discipline".length;
    const phrase = plural ? "job titles" : "job title";
    return word[0] === "D" ? phrase[0].toUpperCase() + phrase.slice(1) : phrase;
  });
}

/* ------------------------------------------------------------------ */
/*  Agent B additions: project lifecycle                               */
/* ------------------------------------------------------------------ */

/**
 * A project's lifecycle drawn one way everywhere — the settings dialog, the
 * project header, the portfolio list. Matches the portfolio board's colours.
 */
export const LIFECYCLE_HUE: Record<import("@/lib/api/projects-client").ProjectLifecycle, Hue> = {
  planning: "sky",
  active: "mint",
  on_hold: "sun",
  complete: "blue",
  cancelled: "slate",
};

/* ------------------------------------------------------------------ */
/*  Agent D additions: people beside their printed name                */
/* ------------------------------------------------------------------ */

const NAME_AVATAR_BG: Record<Hue, string> = {
  blue: "bg-primary-100 text-primary-700",
  coral: "bg-coral-100 text-coral-700",
  mint: "bg-mint-100 text-mint-700",
  grape: "bg-grape-100 text-grape-700",
  sun: "bg-sun-100 text-sun-700",
  sky: "bg-sky-100 text-sky-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-neutral-200 text-neutral-700",
};

/**
 * Initials in the person's colour, for a row that already prints their name.
 *
 * `PersonAvatar` carries the name for screen readers, which is right when the
 * avatar stands alone and doubles the name when it sits beside it. This one is
 * decorative (`aria-hidden`), same colour from `hueFor`, so a list reads each
 * name once.
 */
export function NameAvatar({ name, size = 30 }: { name: string | null | undefined; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        NAME_AVATAR_BG[hueFor(name)],
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
