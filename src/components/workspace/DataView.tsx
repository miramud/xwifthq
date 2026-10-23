"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, LayoutGrid, List, Rows3, SearchX } from "lucide-react";
import { Button, Card, Empty, SearchField, cx } from "./kit";

/*
  Every collection in the suite can be read three ways.

  A **table** for comparing across rows, a **grid** of cards for scanning
  things that have a face (people, projects, courses), and a **list** for
  reading down one column on a narrow screen. Which one somebody prefers for a
  given page is remembered per page, in their browser only — a convenience,
  never state anybody else depends on.

  A page describes its columns once. If it does not supply its own card or
  list row, both are built from those columns, so no page ships with a view
  that renders nothing.
*/

export type ViewMode = "table" | "grid" | "list";

export interface Column<T> {
  key: string;
  header: string;
  /** What the cell shows. Defaults to `value`. */
  render?: (row: T) => React.ReactNode;
  /** What it sorts and searches by. */
  value?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  /** Leave out of the table on small screens (still shown in cards). */
  hideOnMobile?: boolean;
  /** The column that names the row — the title of its card and list row. */
  primary?: boolean;
  /** Leave out of the generated card and list row. */
  tableOnly?: boolean;
}

const VIEW_META: Record<ViewMode, { label: string; icon: typeof Rows3 }> = {
  table: { label: "Table", icon: Rows3 },
  grid: { label: "Grid", icon: LayoutGrid },
  list: { label: "List", icon: List },
};

function readView(key: string | undefined, fallback: ViewMode): ViewMode {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(`ws-view:${key}`);
    return v === "table" || v === "grid" || v === "list" ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Another tab changing a remembered view re-renders this one. */
function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function writeView(key: string | undefined, view: ViewMode) {
  if (!key) return;
  try {
    window.localStorage.setItem(`ws-view:${key}`, view);
  } catch {
    /* private mode or blocked storage: the choice just is not remembered */
  }
}

export function ViewToggle({
  value,
  onChange,
  views = ["table", "grid", "list"],
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  views?: ViewMode[];
}) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex rounded-xl border border-neutral-200 bg-white p-1">
      {views.map((v) => {
        const { label, icon: Icon } = VIEW_META[v];
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label} view`}
            title={`${label} view`}
            onClick={() => onChange(v)}
            className={cx(
              "flex h-8 w-9 cursor-pointer items-center justify-center rounded-lg transition",
              on ? "bg-primary-600 text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
            )}
          >
            <Icon size={16} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function cellValue<T>(col: Column<T>, row: T): React.ReactNode {
  if (col.render) return col.render(row);
  const v = col.value?.(row);
  return v == null || v === "" ? <span className="text-neutral-400">—</span> : v;
}

export function DataView<T>({
  rows,
  columns,
  rowKey,
  storageKey,
  defaultView = "table",
  views = ["table", "grid", "list"],
  renderCard,
  renderListItem,
  rowHref,
  onRowClick,
  searchable = true,
  searchPlaceholder = "Search",
  matches,
  toolbar,
  empty,
  caption,
  gridCols = 3,
  onDownload,
  downloadLabel = "Download CSV",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Remembers the chosen view for this page. */
  storageKey?: string;
  defaultView?: ViewMode;
  views?: ViewMode[];
  renderCard?: (row: T) => React.ReactNode;
  renderListItem?: (row: T) => React.ReactNode;
  rowHref?: (row: T) => string | null | undefined;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Custom search; defaults to every column's `value`. */
  matches?: (row: T, query: string) => boolean;
  /** Filters and actions, rendered beside the view toggle. */
  toolbar?: React.ReactNode;
  empty?: React.ReactNode;
  /** For screen readers: what the table lists. */
  caption?: string;
  gridCols?: 2 | 3 | 4;
  /**
   * Adds a "Download CSV" button to the toolbar; it is handed the rows as
   * listed - after the search box and the sort - so the file matches the screen.
   */
  onDownload?: (rows: T[]) => void;
  downloadLabel?: string;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<ViewMode | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  // The remembered view, read from storage on the client only — the server
  // snapshot is the default, so server and first client render agree.
  const remembered = useSyncExternalStore(
    subscribeStorage,
    () => readView(storageKey, defaultView),
    () => defaultView,
  );
  const preferred = chosen ?? remembered;
  const view: ViewMode = views.includes(preferred) ? preferred : defaultView;

  const chooseView = (v: ViewMode) => {
    setChosen(v);
    writeView(storageKey, v);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = rows.filter((row) =>
        matches
          ? matches(row, q)
          : columns.some((c) => String(c.value?.(row) ?? "").toLowerCase().includes(q)),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.value) {
        const get = col.value;
        out = [...out].sort((a, b) => {
          const x = get(a);
          const y = get(b);
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
          return sort.dir === "asc" ? r : -r;
        });
      }
    }
    return out;
  }, [rows, query, sort, columns, matches]);

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.tableOnly);

  const open = (row: T) => {
    const href = rowHref?.(row);
    if (href) router.push(href);
    else onRowClick?.(row);
  };
  const clickable = Boolean(rowHref || onRowClick);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  const noRows =
    empty ??
    (query ? (
      <Empty icon={SearchX} title="Nothing matches that search" hint="Try a shorter word, or clear the search." />
    ) : (
      <Empty icon={Rows3} title="Nothing here yet" />
    ));

  const wrap = (row: T, node: React.ReactNode, className: string) => {
    const href = rowHref?.(row);
    if (href) {
      return (
        <Link key={rowKey(row)} href={href} className={cx(className, "outline-none focus-visible:ring-2 focus-visible:ring-primary-300")}>
          {node}
        </Link>
      );
    }
    if (onRowClick) {
      return (
        <button key={rowKey(row)} type="button" onClick={() => onRowClick(row)} className={cx(className, "w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300")}>
          {node}
        </button>
      );
    }
    return (
      <div key={rowKey(row)} className={className}>
        {node}
      </div>
    );
  };

  const defaultCard = (row: T) => (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="text-[15px] font-semibold text-neutral-900">{cellValue(primary, row)}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {secondary.slice(0, 6).map((c) => (
          <div key={c.key} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{c.header}</dt>
            <dd className="mt-0.5 truncate text-sm text-neutral-800">{cellValue(c, row)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const defaultListItem = (row: T) => (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-neutral-900">{cellValue(primary, row)}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          {secondary.slice(0, 3).map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1">
              <span className="text-neutral-400">{c.header}:</span> {cellValue(c, row)}
            </span>
          ))}
        </div>
      </div>
      {secondary[3] && <div className="shrink-0">{cellValue(secondary[3], row)}</div>}
    </div>
  );

  const gridClass = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" }[gridCols];

  return (
    <div data-tour="data-view">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {searchable ? (
          <SearchField value={query} onChange={setQuery} placeholder={searchPlaceholder} className="w-full sm:max-w-xs" />
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {onDownload && (
            <Button size="sm" icon={Download} onClick={() => onDownload(filtered)} disabled={filtered.length === 0}>
              {downloadLabel}
            </Button>
          )}
          {views.length > 1 && <ViewToggle value={view} onChange={chooseView} views={views} />}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>{noRows}</Card>
      ) : view === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {caption && <caption className="sr-only">{caption}</caption>}
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/70">
                  {columns.map((c) => {
                    const sorted = sort?.key === c.key ? sort.dir : null;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                        className={cx(
                          "whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500",
                          c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                          c.hideOnMobile && "hidden md:table-cell",
                        )}
                      >
                        {c.sortable && c.value ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-neutral-800"
                          >
                            {c.header}
                            {sorted === "asc" ? (
                              <ArrowUp size={12} aria-hidden />
                            ) : sorted === "desc" ? (
                              <ArrowDown size={12} aria-hidden />
                            ) : (
                              <ChevronsUpDown size={12} className="opacity-50" aria-hidden />
                            )}
                          </button>
                        ) : (
                          c.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={clickable ? () => open(row) : undefined}
                    className={cx(
                      "border-b border-neutral-100 last:border-0 transition-colors",
                      clickable && "cursor-pointer hover:bg-primary-50/40",
                    )}
                  >
                    {columns.map((c, i) => (
                      <td
                        key={c.key}
                        className={cx(
                          "px-5 py-3.5 align-middle text-neutral-700",
                          c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "",
                          c.hideOnMobile && "hidden md:table-cell",
                          c.className,
                        )}
                      >
                        {i === 0 && rowHref?.(row) ? (
                          // The first cell is the row's link for keyboard users;
                          // the whole row is clickable for everybody else.
                          <Link
                            href={rowHref(row) as string}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
                          >
                            {cellValue(c, row)}
                          </Link>
                        ) : (
                          cellValue(c, row)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : view === "grid" ? (
        <div className={cx("grid grid-cols-1 gap-4", gridClass)}>
          {filtered.map((row) =>
            wrap(row, renderCard ? renderCard(row) : defaultCard(row), cx("ws-card block h-full transition-shadow", clickable && "hover:shadow-md")),
          )}
        </div>
      ) : (
        <Card className="divide-y divide-neutral-100 overflow-hidden">
          {filtered.map((row) =>
            wrap(row, renderListItem ? renderListItem(row) : defaultListItem(row), cx("block", clickable && "transition-colors hover:bg-primary-50/40")),
          )}
        </Card>
      )}

      <p className="mt-3 text-xs text-neutral-500" aria-live="polite">
        {filtered.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "item" : "items"}`
          : `${filtered.length} of ${rows.length}`}
      </p>
    </div>
  );
}
