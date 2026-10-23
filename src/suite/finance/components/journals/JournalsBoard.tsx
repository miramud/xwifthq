"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, NotebookPen, Plus, Repeat, X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { errorText, ledger, type JournalStatus, type JournalSummary } from "@/lib/api/finance-ledger-client";
import { Button, ButtonLink, Chip, Empty, PageHeader, SearchField, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, day } from "@/suite/finance/lib/format";
import { csvAmount, downloadCsv } from "../reports/shared";
import { JOURNAL_STATUS, JOURNAL_TYPES, RECURRING_SOURCE, journalSource, journalTypeLabel } from "./meta";
import { JournalsSections } from "./JournalsSections";

/**
 * Every journal, keyed or made by the software: status tabs, a date range,
 * a type and a search, with the total of what is listed.
 */

type Tab = "all" | JournalStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "pending_approval", label: "Awaiting approval" },
  { key: "posted", label: "Posted" },
  { key: "reversed", label: "Reversed" },
  { key: "rejected", label: "Rejected" },
];

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);

/** Short names other pages link with (`?tab=pending`). */
const TAB_ALIASES: Record<string, Tab> = { pending: "pending_approval", drafts: "draft" };

function tabFrom(v: string | null): Tab {
  if (v && TAB_ALIASES[v]) return TAB_ALIASES[v];
  return isTab(v) ? v : "all";
}

const isDate = (v: string | null | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function JournalStatusChip({ status }: { status: JournalStatus }) {
  const s = JOURNAL_STATUS[status] ?? JOURNAL_STATUS.draft;
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

/** The template a journal was made by, if any. */
export const recurringIdOf = (j: Pick<JournalSummary, "recurringJournalId" | "sourceType" | "sourceId">) =>
  j.recurringJournalId ?? (j.sourceType === RECURRING_SOURCE ? j.sourceId : null);

/**
 * "Recurring", opening the template that made the journal. A link-like
 * span rather than an anchor: the row it sits in is already a link.
 */
export function RecurringChip({ templateId }: { templateId: string }) {
  const router = useRouter();
  const go = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/suite/finance/journals/recurring/${templateId}`);
  };
  return (
    <span
      role="link"
      tabIndex={0}
      aria-label="Recurring: open the template that made this journal"
      onClick={go}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go(e)}
      className="inline-flex cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <Chip hue="grape" icon={Repeat}>
        Recurring
      </Chip>
    </span>
  );
}

export default function JournalsBoard() {
  const params = useSearchParams();
  const { user } = useAuth();
  // Linked from elsewhere (the periods board) with `?tab=` or `?status=`, `from` and `to`.
  const [tab, setTab] = useState<Tab>(() => tabFrom(params?.get("tab") ?? params?.get("status") ?? null));
  const [from, setFrom] = useState(() => (isDate(params?.get("from")) ? (params?.get("from") as string) : ""));
  const [to, setTo] = useState(() => (isDate(params?.get("to")) ? (params?.get("to") as string) : ""));
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ key: string; rows: JournalSummary[] | null; error: string | null }>({ key: "", rows: null, error: null });
  const [reload, setReload] = useState(0);

  const key = `${tab}|${from}|${to}|${type}|${reload}`;
  useEffect(() => {
    let alive = true;
    ledger.journals
      .list({ status: tab === "all" ? undefined : tab, from: from || undefined, to: to || undefined, type: type || undefined })
      .then((rows) => alive && setResult({ key, rows, error: null }))
      .catch((e: unknown) => alive && setResult((r) => ({ key, rows: r.rows, error: errorText(e) || "Journals didn't load." })));
    return () => {
      alive = false;
    };
    // `key` carries every filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = result.key !== key;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = result.rows ?? [];
    if (!needle) return rows;
    return rows.filter((j) => `${j.journalNo ?? ""} ${j.narration} ${j.createdBy ?? ""}`.toLowerCase().includes(needle));
  }, [result.rows, q]);
  const total = shown.reduce((s, j) => s + j.total, 0);
  const filtered = Boolean(from || to || type || q);

  const exportCsv = () => {
    const stamp = [tab === "all" ? "" : tab, from, to].filter(Boolean).join("_");
    downloadCsv(`journals${stamp ? `_${stamp}` : ""}.csv`, [
      ["Date", "Number", "Narration", "Type", "Status", "Amount", "Keyed by", "Posted at"],
      ...shown.map((j) => [
        j.journalDate,
        j.journalNo ?? "",
        j.narration,
        journalTypeLabel(j.type),
        JOURNAL_STATUS[j.status]?.label ?? j.status,
        csvAmount(j.total),
        j.createdBy ?? "The software",
        j.postedAt ?? "",
      ]),
    ]);
  };

  const columns: Column<JournalSummary>[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      value: (j) => j.journalDate,
      render: (j) => <span className="whitespace-nowrap tabular-nums text-neutral-700">{day(j.journalDate)}</span>,
    },
    {
      key: "no",
      header: "Number",
      sortable: true,
      value: (j) => j.journalNo ?? "",
      render: (j) => <span className="whitespace-nowrap font-mono text-[13px] text-neutral-700">{j.journalNo ?? "Not numbered"}</span>,
    },
    {
      key: "narration",
      header: "Narration",
      primary: true,
      value: (j) => j.narration,
      render: (j) => {
        const src = journalSource(j.sourceType, j.sourceId);
        const template = recurringIdOf(j);
        return (
          <span className="block min-w-[14rem] max-w-md">
            <span className="line-clamp-2 font-medium text-neutral-900">{j.narration}</span>
            {template ? (
              <span className="mt-1 block">
                <RecurringChip templateId={template} />
              </span>
            ) : (
              (src || j.reversesJournalId) && <span className="mt-0.5 block text-xs text-neutral-500">{j.reversesJournalId ? "Reverses an earlier journal" : src?.label}</span>
            )}
          </span>
        );
      },
    },
    { key: "type", header: "Type", sortable: true, hideOnMobile: true, value: (j) => journalTypeLabel(j.type), render: (j) => <span className="text-neutral-600">{journalTypeLabel(j.type)}</span> },
    { key: "status", header: "Status", sortable: true, value: (j) => JOURNAL_STATUS[j.status]?.label, render: (j) => <JournalStatusChip status={j.status} /> },
    {
      key: "total",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (j) => j.total,
      render: (j) => <span className="whitespace-nowrap font-semibold tabular-nums text-neutral-900">{amount(j.total)}</span>,
    },
    { key: "by", header: "Keyed by", hideOnMobile: true, tableOnly: true, value: (j) => j.createdBy ?? "", render: (j) => <span className="text-neutral-600">{j.createdBy ?? "The software"}</span> },
  ];

  return (
    <div>
      <JournalsSections current="journals" showRecurring={mayDo(user, "recurring_journals", "view")} />
      <PageHeader
        title="Journals"
        subtitle="Every entry in the ledger, keyed by hand or posted by the software."
        actions={
          mayDo(user, "journals", "create") && (
            <ButtonLink href="/suite/finance/journals/new" variant="primary" icon={Plus}>
              New journal
            </ButtonLink>
          )
        }
        tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <div className="ws-card mb-4 flex flex-wrap items-end gap-3 p-4">
        <SearchField value={q} onChange={setQ} placeholder="Search number, narration or person" label="Search journals" className="w-full sm:w-72" />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">From</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={cx(inputClass, "w-[10.5rem]")} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={cx(inputClass, "w-[10.5rem]")} />
        </label>
        <div className="w-full sm:w-48">
          <span id="journal-type-label" className="mb-1.5 block text-xs font-medium text-neutral-600">
            Type
          </span>
          <SearchableSelect
            aria-labelledby="journal-type-label"
            value={type}
            onChange={setType}
            options={[{ value: "", label: "All types" }, ...Object.entries(JOURNAL_TYPES).map(([value, label]) => ({ value, label }))]}
            searchPlaceholder="Search types"
          />
        </div>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            onClick={() => {
              setFrom("");
              setTo("");
              setType("");
              setQ("");
            }}
          >
            Clear filters
          </Button>
        )}
        <Button size="sm" icon={Download} onClick={exportCsv} disabled={shown.length === 0} className="ml-auto">
          Download CSV
        </Button>
        <p className="w-full text-right text-sm text-neutral-600 sm:w-auto" aria-live="polite">
          {result.rows && (
            <>
              <span className="font-semibold tabular-nums text-neutral-900">{shown.length}</span> {shown.length === 1 ? "journal" : "journals"} ·{" "}
              <span className="font-semibold tabular-nums text-neutral-900">{amount(total)}</span>
              {result.rows.length >= 500 && <span className="block text-xs text-neutral-500">Showing the latest 500. Narrow the dates to see more.</span>}
            </>
          )}
        </p>
      </div>

      {result.error && <LoadError text={result.error} onRetry={() => setReload((n) => n + 1)} />}

      {result.rows === null ? (
        !result.error && <Skeleton className="h-80" />
      ) : (
        <div className={cx("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <DataView
            rows={shown}
            columns={columns}
            rowKey={(j) => j.id}
            rowHref={(j) => `/suite/finance/journals/${j.id}`}
            storageKey="finance-journals"
            views={["table", "list"]}
            searchable={false}
            caption="Journals"
            empty={
              <Empty
                icon={NotebookPen}
                title={filtered || tab !== "all" ? "No journals match" : "No journals yet"}
                hint={filtered || tab !== "all" ? "Try another tab or widen the dates." : "Key the first journal to start the ledger."}
                action={
                  !filtered &&
                  tab === "all" &&
                  mayDo(user, "journals", "create") && (
                    <ButtonLink href="/suite/finance/journals/new" variant="primary" icon={Plus}>
                      New journal
                    </ButtonLink>
                  )
                }
              />
            }
          />
        </div>
      )}
    </div>
  );
}
