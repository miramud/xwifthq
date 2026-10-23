"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react";
import { cx } from "./kit";

/**
 * The one dropdown in the suite: a native `<select>` you can search, and —
 * where the list is the organisation's own (job titles, departments) — add to.
 *
 * The owner's rule (27 Sep 2026): every dropdown is searchable. This is built
 * to be a near drop-in for the `<select>` it replaces: `value` / `onChange`
 * take the option's value string, `id` goes on the trigger so an existing
 * `<label htmlFor>` still names it, and `name` renders a hidden input so a
 * form read through `FormData` still sees the value.
 *
 * Shape (ARIA 1.2): the trigger is a `role="combobox"` button showing the
 * chosen label. Opening it moves focus to a search box that drives a listbox
 * through `aria-activedescendant`, so typing and arrowing happen in one place
 * and a screen reader hears the highlighted option. Focus returns to the
 * trigger when the list closes by choice or Escape.
 *
 * The list is portalled to `<body>` and positioned `fixed` against the
 * trigger, because half our modal sheets clip with `overflow-hidden` and the
 * rest scroll; it follows the trigger as they scroll and opens upward when
 * there's more room above. It also carries `.ws` when the trigger sits inside
 * the workspace, so it wears the suite palette there and the marketing
 * palette everywhere else.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** A second, quieter line: an email beside a name, a count beside a team. Searched too. */
  hint?: string;
  disabled?: boolean;
  /** Options sharing a group are listed under its heading (the `<optgroup>` equivalent). */
  group?: string;
}

export type CreateResult = { value: string; label: string } | void;

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown when nothing is chosen and no option has the value "". */
  placeholder?: string;
  /** Goes on the trigger, so `<label htmlFor={id}>` names it. */
  id?: string;
  /** Renders a hidden input so native form posts and `FormData` see the value. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  /** Layout only (width, margin). The control draws its own border and height. */
  className?: string;
  /** `md` is the 44px form control; `sm` the 36px toolbar one. */
  size?: "sm" | "md";
  /** Adds a first option that clears the value (to ""). */
  clearable?: boolean;
  /** The clear option's label. Defaults to "None". */
  clearLabel?: string;
  /** Said when the search matches nothing. */
  emptyText?: string;
  /** Said when there are no options at all (still loading, say, or none made yet). */
  noOptionsText?: string;
  searchPlaceholder?: string;
  /**
   * Lets somebody add what they typed when nothing matches it exactly.
   * Resolve with the new option to select it; throw to show the reason inline
   * (the thrown Error's message is shown as written).
   */
  onCreate?: (text: string) => Promise<CreateResult> | CreateResult;
  /** The add option's wording. Defaults to `Add “text”`. */
  createLabel?: (text: string) => string;
  /** Told when the list opens and closes (to refresh a list that failed, say). */
  onOpenChange?: (open: boolean) => void;
}

/** Case- and accent-insensitive: "jose" finds "José", "ACC" finds "Staff accountant". */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Item =
  | { kind: "option"; option: SelectOption; group: string | undefined }
  | { kind: "clear" }
  | { kind: "create"; text: string };

const OPTION_ROW =
  "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors sm:min-h-10";

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  id,
  name,
  required = false,
  disabled = false,
  autoFocus = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  size = "md",
  clearable = false,
  clearLabel = "None",
  emptyText = "Nothing matches that.",
  noOptionsText = "No options yet.",
  searchPlaceholder = "Search",
  onCreate,
  createLabel = (text) => `Add “${text}”`,
  onOpenChange,
}: SearchableSelectProps) {
  const autoId = useId();
  const triggerId = id ?? `ss-${autoId}`;
  const listId = `${triggerId}-listbox`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Options created here that the parent hasn't passed back yet, so the
  // trigger can name the new value on the very next render.
  const [created, setCreated] = useState<SelectOption[]>([]);
  const [frame, setFrame] = useState<{ inWs: boolean; name: string } | null>(null);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    up: boolean;
  } | null>(null);

  const invalid = ariaInvalid === true || ariaInvalid === "true";

  /* ---------------- The option list ---------------- */

  // Grouped options are gathered under their heading in the order the groups
  // first appear, ungrouped ones first — the order `<optgroup>` would show.
  const prepared = useMemo(() => {
    const all = [...options, ...created.filter((c) => !options.some((o) => o.value === c.value))];
    const groups: string[] = [];
    for (const o of all) if (o.group !== undefined && !groups.includes(o.group)) groups.push(o.group);
    return [undefined, ...groups].flatMap((g) =>
      all
        .filter((o) => o.group === g)
        .map((o) => ({ option: o, folded: foldText(`${o.label} ${o.hint ?? ""}`), label: foldText(o.label.trim()) })),
    );
  }, [options, created]);

  const selected = useMemo(() => prepared.find((p) => p.option.value === value)?.option ?? null, [prepared, value]);
  const hasEmptyOption = prepared.some((p) => p.option.value === "");

  const items = useMemo<Item[]>(() => {
    const q = foldText(query.trim());
    const out: Item[] = [];
    if (clearable && !hasEmptyOption && q === "") out.push({ kind: "clear" });
    for (const p of prepared) {
      if (q === "" || p.folded.includes(q)) out.push({ kind: "option", option: p.option, group: p.option.group });
    }
    if (onCreate && q !== "" && !prepared.some((p) => p.label === q)) {
      out.push({ kind: "create", text: query.trim() });
    }
    return out;
  }, [prepared, query, clearable, hasEmptyOption, onCreate]);

  const enabled = useCallback(
    (i: number) => {
      const it = items[i];
      return it !== undefined && !(it.kind === "option" && it.option.disabled);
    },
    [items],
  );

  // The highlighted row follows the search: the chosen option when the list
  // first opens, otherwise the first one that can be picked.
  const firstActive = useCallback(
    (list: Item[], q: string) => {
      if (q.trim() === "") {
        const at = list.findIndex((it) =>
          it.kind === "option" ? it.option.value === value : it.kind === "clear" && value === "",
        );
        if (at >= 0) return at;
      }
      return list.findIndex((it) => !(it.kind === "option" && it.option.disabled));
    },
    [value],
  );

  /* ---------------- Open and close ---------------- */

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const gap = 6;
    const margin = 8;
    const below = vh - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    const want = 360;
    const up = below < Math.min(want, 260) && above > below;
    const maxHeight = Math.max(180, Math.min(want, up ? above : below));
    const width = Math.min(Math.max(r.width, 260), vw - margin * 2);
    const left = Math.max(margin, Math.min(r.left, vw - width - margin));
    setPos(up ? { bottom: vh - r.top + gap, left, width, maxHeight, up } : { top: r.bottom + gap, left, width, maxHeight, up });
  }, []);

  const openList = useCallback(
    (initialQuery = "") => {
      if (disabled || open) return;
      const t = triggerRef.current;
      const labelText =
        ariaLabel ??
        (ariaLabelledBy ? document.getElementById(ariaLabelledBy)?.textContent : null) ??
        t?.labels?.[0]?.textContent ??
        placeholder;
      setFrame({ inWs: Boolean(t?.closest(".ws")), name: (labelText ?? "").trim() });
      setQuery(initialQuery);
      setError(null);
      setOpen(true);
      onOpenChange?.(true);
    },
    [disabled, open, ariaLabel, ariaLabelledBy, placeholder, onOpenChange],
  );

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      setQuery("");
      setError(null);
      setPos(null);
      onOpenChange?.(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [onOpenChange],
  );

  // Position before paint so the list never flashes at the top-left.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Follow the trigger while anything scrolls (a modal sheet, the page) or resizes.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const onMove = (e: Event) => {
      // The list's own scrolling doesn't move the trigger.
      if (e.type === "scroll" && listRef.current && e.target === listRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.visualViewport?.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  // Outside pointer-down closes without stealing focus from whatever was clicked.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  // Focus the search box once the portal is in the document AND placed. Until
  // `place()` has run the popover is `visibility: hidden`, and a browser won't
  // focus a hidden element: focus stayed on the trigger, so typing didn't
  // search and Enter closed the list. Keyed on a boolean so repositioning on
  // scroll doesn't pull focus back from a row the mouse is on.
  const placed = open && pos !== null;
  useEffect(() => {
    if (placed) searchRef.current?.focus();
  }, [placed]);

  // A new search (or a fresh open) re-seats the highlight.
  const [seatedFor, setSeatedFor] = useState<string | null>(null);
  const seatKey = open ? `${query}\u0000${items.length}` : null;
  if (seatKey !== seatedFor) {
    setSeatedFor(seatKey);
    setActive(open ? firstActive(items, query) : -1);
  }

  // Keep the keyboard's highlight in view; the mouse's is already under the pointer.
  const byKeyboard = useRef(false);
  useEffect(() => {
    if (!open || active < 0 || !byKeyboard.current) return;
    const el = document.getElementById(`${listId}-${active}`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listId]);

  /* ---------------- Choosing ---------------- */

  const pick = useCallback(
    async (index: number) => {
      const it = items[index];
      if (!it || creating) return;
      if (it.kind === "option") {
        if (it.option.disabled) return;
        if (it.option.value !== value) onChange(it.option.value);
        close(true);
        return;
      }
      if (it.kind === "clear") {
        if (value !== "") onChange("");
        close(true);
        return;
      }
      if (!onCreate) return;
      setCreating(true);
      setError(null);
      try {
        const made = await onCreate(it.text);
        if (made) {
          setCreated((c) => [...c.filter((x) => x.value !== made.value), { value: made.value, label: made.label }]);
          if (made.value !== value) onChange(made.value);
        }
        close(true);
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : `“${it.text}” wasn't added. Try again.`);
      } finally {
        setCreating(false);
      }
    },
    [items, creating, value, onChange, close, onCreate],
  );

  // Stable handlers for the memoised rows, reading the latest state through a ref.
  const latest = useRef({ pick, enabled });
  useLayoutEffect(() => {
    latest.current = { pick, enabled };
  });
  const onRowPick = useCallback((i: number) => void latest.current.pick(i), []);
  const onRowHover = useCallback((i: number) => {
    if (!latest.current.enabled(i)) return;
    byKeyboard.current = false;
    setActive((a) => (a === i ? a : i));
  }, []);

  const move = (from: number, step: 1 | -1): number => {
    for (let i = from + step; i >= 0 && i < items.length; i += step) if (enabled(i)) return i;
    return from;
  };

  /* ---------------- Keys ---------------- */

  const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
      return;
    }
    // Type-to-open: the first letter becomes the search.
    if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openList(e.key);
    }
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const go = (i: number) => {
      e.preventDefault();
      byKeyboard.current = true;
      setActive(i);
    };
    switch (e.key) {
      case "ArrowDown":
        return go(active < 0 ? move(-1, 1) : move(active, 1));
      case "ArrowUp":
        return go(active < 0 ? move(items.length, -1) : move(active, -1));
      case "Home":
        return go(move(-1, 1));
      case "End":
        return go(move(items.length, -1));
      case "PageDown":
        return go(Array.from({ length: 10 }).reduce<number>((i) => move(i, 1), Math.max(active, 0)));
      case "PageUp":
        return go(Array.from({ length: 10 }).reduce<number>((i) => move(i, -1), Math.max(active, 0)));
      case "Enter":
        // Never let Enter here submit the surrounding form.
        e.preventDefault();
        e.stopPropagation();
        if (active >= 0) void pick(active);
        return;
      case "Escape":
        // Ours, not the modal's: Escape closes the list and leaves the dialog open.
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        close(true);
        return;
      case "Tab": {
        // The list lives at the end of <body>, so the browser's own Tab would
        // leave the form. Move on from the trigger instead, as a select would.
        e.preventDefault();
        const trigger = triggerRef.current;
        close(false);
        if (trigger) focusBeside(trigger, e.shiftKey ? -1 : 1);
        return;
      }
    }
  };

  /* ---------------- Render ---------------- */

  const shownLabel = selected?.label ?? null;
  const optionCount = items.filter((it) => it.kind === "option").length;
  const hasWidth = /(^|\s)([a-z0-9-]+:)*(w-|flex-1|basis-)/.test(className ?? "");

  let lastGroup: string | undefined;

  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popRef}
            className={frame?.inWs ? "ws" : undefined}
            style={{
              position: "fixed",
              zIndex: 1000,
              top: pos?.top,
              bottom: pos?.bottom,
              left: pos?.left ?? 0,
              width: pos?.width,
              background: "transparent",
              visibility: pos ? "visible" : "hidden",
            }}
          >
            <div
              className={cx(
                "ss-pop flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-xl shadow-neutral-900/10",
                pos?.up ? "origin-bottom" : "origin-top",
              )}
              style={{ maxHeight: pos?.maxHeight }}
            >
              <div className="border-b border-neutral-100 p-2">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      byKeyboard.current = true;
                      setQuery(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={onSearchKey}
                    placeholder={searchPlaceholder}
                    aria-label={frame?.name ? `Search ${frame.name}` : "Search options"}
                    aria-controls={listId}
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    aria-autocomplete="list"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-10 w-full rounded-lg bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-500 focus:bg-white focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              </div>

              <div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={frame?.name || undefined}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
              >
                {items.map((it, i) => {
                  const heading =
                    it.kind === "option" && it.group !== undefined && it.group !== lastGroup ? it.group : null;
                  if (it.kind === "option") lastGroup = it.group;
                  const rowId = `${listId}-${i}`;

                  if (it.kind === "create") {
                    return (
                      <div
                        key="__create"
                        id={rowId}
                        role="option"
                        aria-selected={false}
                        aria-disabled={creating || undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => onRowHover(i)}
                        onClick={() => onRowPick(i)}
                        className={cx(
                          OPTION_ROW,
                          optionCount > 0 && "mt-1 border-t border-neutral-100 pt-2.5",
                          creating ? "cursor-progress" : "cursor-pointer",
                          active === i ? "bg-primary-50 text-primary-800" : "text-primary-700",
                        )}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                          {creating ? (
                            <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />
                          ) : (
                            <Plus size={14} aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {creating ? `Adding “${it.text}”…` : createLabel(it.text)}
                        </span>
                      </div>
                    );
                  }

                  if (it.kind === "clear") {
                    return (
                      <Row
                        key="__clear"
                        id={rowId}
                        index={i}
                        label={clearLabel}
                        muted
                        selected={value === ""}
                        active={active === i}
                        query=""
                        onPick={onRowPick}
                        onHover={onRowHover}
                      />
                    );
                  }

                  const row = (
                    <Row
                      key={`o:${it.option.value}`}
                      id={rowId}
                      index={i}
                      label={it.option.label}
                      hint={it.option.hint}
                      disabled={it.option.disabled}
                      selected={it.option.value === value}
                      active={active === i}
                      query={query}
                      onPick={onRowPick}
                      onHover={onRowHover}
                    />
                  );
                  if (heading === null) return row;
                  return [
                    <div
                      key={`g:${heading}`}
                      role="presentation"
                      className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 first:pt-1"
                    >
                      {heading}
                    </div>,
                    row,
                  ];
                })}

                {optionCount === 0 && !items.some((it) => it.kind === "create") && (
                  <p role="presentation" className="px-3 py-6 text-center text-sm text-neutral-500">
                    {prepared.length === 0 && query.trim() === "" ? noOptionsText : emptyText}
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="border-t border-error-500/15 bg-error-500/5 px-3 py-2.5 text-[13px] text-error-700">
                  {error}
                </p>
              )}
              <p className="sr-only" role="status" aria-live="polite">
                {query.trim() === "" ? "" : `${optionCount} ${optionCount === 1 ? "option" : "options"}`}
              </p>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cx("relative", !hasWidth && "w-full", className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        data-value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onClick={() => (open ? close(true) : openList())}
        onKeyDown={onTriggerKey}
        className={cx(
          "flex w-full cursor-pointer items-center gap-2 rounded-xl border bg-white text-left outline-none transition",
          "focus-visible:border-primary-400 focus-visible:ring-4 focus-visible:ring-primary-100",
          "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
          size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-3.5 text-sm",
          invalid ? "border-error-400 focus-visible:ring-error-100" : "border-neutral-200 hover:border-neutral-300",
          open && !invalid && "border-primary-400 ring-4 ring-primary-100",
        )}
      >
        <span className={cx("min-w-0 flex-1 truncate", shownLabel === null ? "text-neutral-500" : "text-neutral-900")}>
          {shownLabel ?? placeholder}
        </span>
        <ChevronDown
          size={size === "sm" ? 15 : 16}
          className={cx("shrink-0 text-neutral-400 transition-transform motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {required ? (
        // Visually hidden but not `type="hidden"`, so the browser's own
        // required check still stops the form and points at this field.
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          value={value}
          required
          onChange={() => {}}
          onInvalid={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      ) : (
        name && <input type="hidden" name={name} value={value} />
      )}

      {popover}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/** Focuses the next (or previous) tabbable element after `from` in document order. */
function focusBeside(from: HTMLElement, step: 1 | -1) {
  const all = Array.from(document.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.tabIndex >= 0 && !el.closest("[inert]") && el.getAttribute("aria-hidden") !== "true",
  );
  const at = all.indexOf(from);
  const next = at < 0 ? null : all[at + step];
  (next ?? from).focus();
}

/**
 * One option. Memoised: moving the highlight through a thousand rows
 * re-renders the two that changed, not the thousand.
 *
 * The name is the label alone (hint on `aria-describedby`), so a test or a
 * screen reader finds "Ada Lovelace", not "Ada Lovelace ada@example.com".
 */
const Row = memo(function Row({
  id,
  index,
  label,
  hint,
  disabled,
  muted,
  selected,
  active,
  query,
  onPick,
  onHover,
}: {
  id: string;
  index: number;
  label: string;
  hint?: string;
  disabled?: boolean;
  muted?: boolean;
  selected: boolean;
  active: boolean;
  query: string;
  onPick: (i: number) => void;
  onHover: (i: number) => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      aria-labelledby={`${id}-l`}
      aria-describedby={hint ? `${id}-h` : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onMouseMove={() => onHover(index)}
      onClick={() => !disabled && onPick(index)}
      className={cx(
        OPTION_ROW,
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        active && !disabled ? "bg-primary-50" : "",
        selected ? "font-semibold text-primary-700" : muted ? "text-neutral-500" : "text-neutral-800",
      )}
    >
      <span className="min-w-0 flex-1">
        <span id={`${id}-l`} className="block truncate">
          <Highlight text={label} query={query} />
        </span>
        {hint && (
          <span id={`${id}-h`} className="block truncate text-xs font-normal text-neutral-500">
            {hint}
          </span>
        )}
      </span>
      {selected && <Check size={15} className="shrink-0 text-primary-600" aria-hidden />}
    </div>
  );
});

/** Marks the matched run of a label, when folding didn't change its length. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = foldText(query.trim());
  const folded = foldText(text);
  const at = q === "" || folded.length !== text.length ? -1 : folded.indexOf(q);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-sun-100 px-px text-inherit">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}
