"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Repeat, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { errorText, recurring, type RecurringJournalSummary, type RecurringStatus } from "@/lib/api/finance-recurring-client";
import { ButtonLink, Chip, Empty, PageHeader, SearchField } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, day } from "@/suite/finance/lib/format";
import { JournalsSections } from "../JournalsSections";
import { RECURRING_STATUS, scheduleLabel } from "./schedule";

/**
 * Recurring journals: each template, when it next makes a journal, when it
 * last did, and whether anything is waiting (a locked month, a refused
 * line). Every journal a template makes still needs a second person.
 */

type Tab = "all" | RecurringStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "ended", label: "Ended" },
];

export function RecurringStatusChip({ status }: { status: RecurringStatus }) {
  const s = RECURRING_STATUS[status] ?? RECURRING_STATUS.active;
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

/** "250,000.00", or "250,000.00 (USD lines)" when some lines are in another currency. */
export const templateAmount = (t: Pick<RecurringJournalSummary, "amount" | "currencies">) =>
  `${accounting(t.amount)}${t.currencies.length ? ` (${t.currencies.join(", ")} lines)` : ""}`;

export default function RecurringJournalsBoard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<RecurringJournalSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    recurring
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(errorText(e) || "Recurring journals didn't load."));
    return () => {
      alive = false;
    };
  }, [reload]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? [])
      .filter((t) => tab === "all" || t.status === tab)
      .filter((t) => !needle || `${t.name} ${t.narration} ${t.createdBy ?? ""}`.toLowerCase().includes(needle));
  }, [rows, tab, q]);

  const waiting = (rows ?? []).filter((t) => (t.outstanding ?? 0) > 0 || t.lastError).length;
  const canCreate = mayDo(user, "recurring_journals", "create");

  const columns: Column<RecurringJournalSummary>[] = [
    {
      key: "name",
      header: "Template",
      primary: true,
      sortable: true,
      value: (t) => t.name,
      render: (t) => (
        <span className="block min-w-[13rem] max-w-md">
          <span className="block font-medium text-neutral-900">{t.name}</span>
          <span className="mt-0.5 block text-xs text-neutral-500">{scheduleLabel(t.frequency, t.dayOfMonth)}</span>
        </span>
      ),
    },
    {
      key: "next",
      header: "Next run",
      sortable: true,
      value: (t) => t.nextRunOn ?? "9999",
      render: (t) =>
        t.nextRunOn ? (
          <span className="whitespace-nowrap tabular-nums text-neutral-800">{day(t.nextRunOn)}</span>
        ) : (
          <span className="text-neutral-500">None</span>
        ),
    },
    {
      key: "last",
      header: "Last run",
      sortable: true,
      hideOnMobile: true,
      value: (t) => t.lastRunOn ?? "",
      render: (t) => <span className="whitespace-nowrap tabular-nums text-neutral-600">{t.lastRunOn ? day(t.lastRunOn) : "Not yet"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (t) => RECURRING_STATUS[t.status]?.label,
      render: (t) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <RecurringStatusChip status={t.status} />
          {((t.outstanding ?? 0) > 0 || t.lastError) && (
            <Chip hue="rose" icon={TriangleAlert}>
              {(t.outstanding ?? 0) > 0 ? `${t.outstanding} waiting` : "Needs attention"}
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (t) => t.amount,
      render: (t) => <span className="whitespace-nowrap font-semibold tabular-nums text-neutral-900">{templateAmount(t)}</span>,
    },
    { key: "made", header: "Made", align: "right", hideOnMobile: true, tableOnly: true, value: (t) => t.occurrences, render: (t) => <span className="tabular-nums text-neutral-600">{t.occurrences}</span> },
  ];

  return (
    <div>
      <JournalsSections current="recurring" />
      <PageHeader
        title="Recurring journals"
        subtitle="Templates that make a journal on a schedule - a rent prepayment released each month, say. Each one still goes to a second person to post."
        actions={
          canCreate && (
            <ButtonLink href="/suite/finance/journals/recurring/new" variant="primary" icon={Plus}>
              New recurring journal
            </ButtonLink>
          )
        }
        tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <div className="ws-card mb-4 flex flex-wrap items-center gap-3 p-4">
        <SearchField value={q} onChange={setQ} placeholder="Search name or narration" label="Search recurring journals" className="w-full sm:w-72" />
        {waiting > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-rose-700" role="status">
            <TriangleAlert size={15} aria-hidden />
            {waiting === 1 ? "1 template has" : `${waiting} templates have`} an occurrence waiting. Open it to see why.
          </p>
        )}
        <p className="ml-auto text-sm text-neutral-600" aria-live="polite">
          {rows && (
            <>
              <span className="font-semibold tabular-nums text-neutral-900">{shown.length}</span> {shown.length === 1 ? "template" : "templates"}
            </>
          )}
        </p>
      </div>

      {error && <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />}

      {rows === null ? (
        !error && <Skeleton className="h-72" />
      ) : (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(t) => t.id}
          rowHref={(t) => `/suite/finance/journals/recurring/${t.id}`}
          storageKey="finance-recurring-journals"
          views={["table", "list"]}
          searchable={false}
          caption="Recurring journals"
          empty={
            <Empty
              icon={rows.length ? CalendarClock : Repeat}
              title={rows.length ? "No templates match" : "No recurring journals yet"}
              hint={rows.length ? "Try another tab or a shorter search." : "Set one up for an entry that repeats - rent released from prepayments, a monthly accrual - and it will be made for approval on its day."}
              action={
                !rows.length &&
                canCreate && (
                  <ButtonLink href="/suite/finance/journals/recurring/new" variant="primary" icon={Plus}>
                    New recurring journal
                  </ButtonLink>
                )
              }
            />
          }
        />
      )}
    </div>
  );
}
