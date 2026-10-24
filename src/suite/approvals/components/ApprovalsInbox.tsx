"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, CornerUpLeft, Inbox, NotebookPen, ShieldCheck, Stamp, TriangleAlert, UserCheck, X } from "lucide-react";
import { ButtonLink, Chip, Empty, PageHeader, Panel, Segmented, StatGrid, cx, type PageTab } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { AgendaList, ComplianceCalendar, EventStatusChip, todayYmd, type CalendarEvent } from "@/components/workspace/Calendar";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { hueFor } from "@/components/workspace/modules";
import { ErrorNote, IconTile, Skeleton, StatCard, Switch } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  approvals,
  formatMoney,
  type InboxCounts,
  type InboxRow,
  type InboxTab,
  type ProcessInfo,
} from "@/lib/api/approvals-client";
import { dueStatus, flagLabel, formatDate, instanceStatus, localYmd, relativeTo } from "../lib/labels";
import { setApprovalCounts, useApprovalCounts } from "../lib/useApprovalCounts";
import { processTile } from "../lib/tiles";
import { DecisionView } from "./DecisionView";

/*
  The approvals inbox every module shares. Requests from Finance, HR,
  Projects and memos all land here; the tabs split them by what they ask of
  you, the strip says how much is waiting and how much is late, and the
  due-date view lays your open tasks out by the day they fall due.

  Opening a request keeps you on the list: the decision view slides in from
  the right, and `?open={id}` in the address (what every notification links
  to) opens it straight away.
*/

export const INBOX_TABS: { key: InboxTab; label: string; countKey?: keyof InboxCounts }[] = [
  { key: "to_approve", label: "To approve", countKey: "to_approve" },
  { key: "delegated", label: "Delegated to me", countKey: "delegated" },
  { key: "returned", label: "Returned to me", countKey: "returned" },
  { key: "mine", label: "My requests", countKey: "mine" },
  { key: "watching", label: "Watching", countKey: "watching" },
  { key: "done", label: "Decided", countKey: "done" },
];

const TASK_TABS: InboxTab[] = ["to_approve", "delegated", "done"];

const EMPTY: Record<InboxTab, { title: string; hint: string }> = {
  to_approve: { title: "Nothing is waiting on you", hint: "When a request reaches you, it shows up here and in your notifications." },
  delegated: { title: "Nobody has asked you to cover", hint: "When a colleague sets you as their cover, their requests appear here." },
  returned: { title: "Nothing has come back to you", hint: "A request an approver returns for changes lands here for you to fix and resend." },
  mine: { title: "You have no requests in progress", hint: "Raise a memo, a purchase or a leave request and follow it here." },
  watching: { title: "You aren't watching anything", hint: "Open a request and choose Watch to be told when it moves." },
  done: { title: "You haven't decided anything yet", hint: "Requests you approve, return or reject are kept here." },
};

/** The inbox's address for a tab and an open request. */
export function inboxHref(tab: InboxTab, openId: string | null): string {
  const qs = new URLSearchParams();
  if (tab !== "to_approve") qs.set("tab", tab);
  if (openId) qs.set("open", openId);
  const s = qs.toString();
  return `/suite/approvals${s ? `?${s}` : ""}`;
}

function isTab(v: string | null | undefined): v is InboxTab {
  return INBOX_TABS.some((t) => t.key === v);
}

const tileFor = processTile;

/** An amount as a soft pill, the way the references set values in a list. */
function AmountPill({ amount, currency }: { amount: number | null; currency: string | null }) {
  if (amount == null) return <span className="text-neutral-400">-</span>;
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-neutral-800">
      {formatMoney(amount, currency)}
    </span>
  );
}

/** Approving this row needs the approver's authenticator code (an open task at or above the step-up amount). */
const STEP_UP_LABEL = "Needs verification code";
const needsCode = (r: InboxRow): boolean => Boolean(r.task?.stepUp) && r.task?.status !== "done" && r.task?.status !== "cancelled";

export default function ApprovalsInbox({
  initialOpen = null,
  initialTab = null,
}: {
  initialOpen?: string | null;
  initialTab?: string | null;
}) {
  const router = useRouter();
  const sharedCounts = useApprovalCounts(true);

  const [tab, setTab] = useState<InboxTab>(isTab(initialTab) ? initialTab : "to_approve");
  const [process, setProcess] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [agenda, setAgenda] = useState<InboxRow[] | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // The open request follows the address: a notification link, or a row click.
  const [openId, setOpenId] = useState<string | null>(initialOpen);
  const [seenOpen, setSeenOpen] = useState(initialOpen);
  if (seenOpen !== initialOpen) {
    setSeenOpen(initialOpen);
    setOpenId(initialOpen);
  }

  const [dueView, setDueView] = useState<"agenda" | "month">("agenda");
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });

  useEffect(() => {
    let alive = true;
    approvals
      .processes()
      .then((p) => alive && setProcesses(p))
      .catch(() => {
        /* the filter just lists codes */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    approvals
      .inbox(tab, { process: process || undefined, sla: overdueOnly && TASK_TABS.includes(tab) ? "overdue" : undefined })
      .then((r) => {
        if (!alive) return;
        setRows(r.data);
        setLoadError(null);
        if (r.counts) setApprovalCounts(r.counts);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadError(e instanceof ApiError && e.status === 403 ? "Approvals are run inside an organisation." : "Your approvals didn't load. Try again.");
      });
    return () => {
      alive = false;
    };
  }, [tab, process, overdueOnly, reloadKey]);

  // My open tasks, whatever tab is showing: the due-date view is about them.
  useEffect(() => {
    let alive = true;
    approvals
      .inbox("to_approve")
      .then((r) => alive && setAgenda(r.data))
      .catch(() => alive && setAgenda([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const processName = useCallback(
    (code: string) => processes.find((p) => p.code === code)?.name ?? code.replace(/[._]/g, " "),
    [processes],
  );

  const open = (id: string) => {
    setOpenId(id);
    router.replace(inboxHref(tab, id), { scroll: false });
  };

  const close = () => {
    setOpenId(null);
    router.replace(inboxHref(tab, null), { scroll: false });
  };

  const counts = sharedCounts;
  const tabs: PageTab[] = INBOX_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    count: t.countKey && counts ? counts[t.countKey] : undefined,
  }));

  const events = useMemo<CalendarEvent[]>(
    () =>
      (agenda ?? [])
        .filter((r) => r.task?.dueAt)
        .map((r) => ({
          id: r.task?.id ?? r.id,
          date: localYmd(r.task!.dueAt!),
          title: r.title,
          hue: hueFor(r.process),
          meta: [r.requester?.name, r.task?.stage].filter(Boolean).join(" · "),
          status: dueStatus(r.task!.dueAt) ?? "upcoming",
          onClick: () => open(r.id),
        })),
    // `open` changes every render; the events only need the rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agenda],
  );

  const agendaRange = useMemo(() => {
    const today = todayYmd();
    const dates = events.map((e) => e.date).sort();
    const from = dates[0] && dates[0] < today ? dates[0] : today;
    const last = dates[dates.length - 1];
    const plus = new Date(Date.now() + 30 * 86_400_000);
    const p = (n: number) => String(n).padStart(2, "0");
    const in30 = `${plus.getFullYear()}-${p(plus.getMonth() + 1)}-${p(plus.getDate())}`;
    return { from, to: last && last > in30 ? last : in30 };
  }, [events]);

  const undated = (agenda ?? []).filter((r) => !r.task?.dueAt).length;

  const columns: Column<InboxRow>[] = [
    {
      key: "title",
      header: "Request",
      primary: true,
      sortable: true,
      value: (r) => `${r.title} ${r.ref ?? ""}`,
      render: (r) => {
        const tile = tileFor(r.process);
        return (
          <span className="flex min-w-[12rem] items-center gap-3">
            <IconTile icon={tile.icon} hue={tile.hue} size={40} />
            <span className="min-w-0">
              <span className="block font-semibold text-neutral-900">{r.title}</span>
              <span className="block text-xs tabular-nums text-neutral-500">{r.ref ?? "No reference yet"}</span>
            </span>
          </span>
        );
      },
    },
    { key: "process", header: "Process", sortable: true, value: (r) => processName(r.process), hideOnMobile: true },
    { key: "requester", header: "Requester", sortable: true, value: (r) => r.requester?.name ?? "", hideOnMobile: true },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (r) => r.amount ?? undefined,
      render: (r) => <AmountPill amount={r.amount} currency={r.currency} />,
    },
    {
      key: "stage",
      header: "Stage",
      value: (r) => r.task?.stage ?? r.currentStage ?? instanceStatus(r.status).label,
      render: (r) =>
        TASK_TABS.includes(tab) && r.task ? (
          <span className="text-neutral-800">
            {r.task.stage ?? "-"}
            {r.task.onBehalfOf && <span className="block text-xs text-neutral-500">for {r.task.onBehalfOf}</span>}
            {r.task.status === "on_hold" && <span className="block text-xs text-sun-700">On hold</span>}
          </span>
        ) : (
          <span>
            <Chip hue={instanceStatus(r.status).hue} dot>
              {instanceStatus(r.status).label}
            </Chip>
            {r.currentStage && r.status === "in_progress" && <span className="mt-1 block text-xs text-neutral-500">at {r.currentStage}</span>}
          </span>
        ),
    },
    {
      key: "due",
      header: tab === "done" ? "Decided" : "Due",
      sortable: true,
      value: (r) => (tab === "done" ? r.task?.actedAt : r.task?.dueAt) ?? undefined,
      render: (r) => {
        if (tab === "done") return r.task?.actedAt ? formatDate(r.task.actedAt) : <span className="text-neutral-400">-</span>;
        const due = r.task?.dueAt;
        const st = r.task?.status === "open" ? dueStatus(due) : null;
        if (!due) return <span className="text-neutral-400">-</span>;
        return (
          <span className="flex flex-col items-start gap-1">
            <span className="tabular-nums" title={formatDate(due)}>
              {relativeTo(due)}
            </span>
            {st && st !== "upcoming" && <EventStatusChip status={st} />}
          </span>
        );
      },
    },
    {
      key: "flags",
      header: "Warnings",
      value: (r) => [...(needsCode(r) ? [STEP_UP_LABEL] : []), ...r.flags.map(flagLabel)].join(", "),
      render: (r) =>
        r.flags.length === 0 && !needsCode(r) ? (
          <span className="text-neutral-400">-</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {needsCode(r) && (
              <Chip hue="blue" icon={ShieldCheck}>
                {STEP_UP_LABEL}
              </Chip>
            )}
            {r.flags.map((f) => (
              <Chip key={f} hue="sun" icon={TriangleAlert}>
                {flagLabel(f)}
              </Chip>
            ))}
          </span>
        ),
    },
  ];

  /* The list view: icon tile, title and who raised it, the amount as a pill, then stage, due date and warnings. */
  const cell = (key: string, r: InboxRow) => columns.find((c) => c.key === key)?.render?.(r);
  const listItem = (r: InboxRow) => {
    const tile = tileFor(r.process);
    return (
      <span className="flex items-start gap-3 px-5 py-4">
        <IconTile icon={tile.icon} hue={tile.hue} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-neutral-900">{r.title}</span>
              <span className="mt-0.5 block truncate text-xs text-neutral-500">
                {[r.ref ?? "No reference yet", processName(r.process), r.requester?.name].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0">
              <AmountPill amount={r.amount} currency={r.currency} />
            </span>
          </span>
          <span className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-2 text-xs text-neutral-600">
            <span className="block">{cell("stage", r)}</span>
            <span className="block">{cell("due", r)}</span>
            <span className="block">{cell("flags", r)}</span>
          </span>
        </span>
      </span>
    );
  };

  const processOptions = [{ value: "", label: "All processes" }, ...processes.map((p) => ({ value: p.code, label: p.name, hint: p.module }))];

  return (
    <div>
      <PageHeader
        eyebrow="Approvals"
        title="Approvals"
        subtitle="Every request that needs you, from every module, in one inbox."
        actions={
          <>
            <ButtonLink href="/suite/approvals/cover" icon={UserCheck}>
              My cover
            </ButtonLink>
            <ButtonLink href="/suite/memos/new" variant="primary" icon={NotebookPen}>
              New memo
            </ButtonLink>
          </>
        }
        tabs={tabs}
        activeTab={tab}
        onTab={(k) => {
          if (!isTab(k)) return;
          setTab(k);
          setRows(null);
          router.replace(inboxHref(k, openId), { scroll: false });
        }}
      />

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
        <StatGrid cols={2}>
          <StatCard featured label="Waiting on me" value={counts?.to_approve ?? "-"} icon={Stamp} hint="Open tasks in your name" />
          <StatCard label="Overdue" value={counts?.overdue ?? "-"} icon={AlarmClock} hue="rose" hint={counts?.overdue ? "Past their due date" : "Nothing late"} />
          <StatCard label="Delegated to me" value={counts?.delegated ?? "-"} icon={UserCheck} hue="grape" hint="You are covering for a colleague" />
          <StatCard label="Returned to me" value={counts?.returned ?? "-"} icon={CornerUpLeft} hue="sun" hint="Waiting on your changes" />
        </StatGrid>

        <Panel
          title="What falls due"
          subtitle={undated > 0 ? `${undated} open ${undated === 1 ? "task has" : "tasks have"} no due date` : "Your open tasks by due date"}
          icon={AlarmClock}
          hue="coral"
          actions={
            <Segmented
              label="Due-date view"
              value={dueView}
              onChange={setDueView}
              options={[
                { key: "agenda", label: "Agenda" },
                { key: "month", label: "Month" },
              ]}
            />
          }
        >
          {agenda === null ? (
            <Skeleton className="h-40" />
          ) : dueView === "agenda" ? (
            <div className="max-h-[22rem] overflow-y-auto pr-1">
              <AgendaList
                events={events}
                from={agendaRange.from}
                to={agendaRange.to}
                onSelect={(e) => e.onClick?.()}
                emptyLabel="Nothing with a due date is waiting on you."
              />
            </div>
          ) : (
            <ComplianceCalendar
              year={month.y}
              month={month.m}
              events={events}
              onSelect={(e) => e.onClick?.()}
              onPrev={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
              onNext={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
            />
          )}
        </Panel>
      </div>

      {loadError && <ErrorNote className="mb-4">{loadError}</ErrorNote>}

      {rows === null && !loadError ? (
        <Skeleton className="h-64" />
      ) : (
        <DataView
          rows={rows ?? []}
          columns={columns}
          rowKey={(r) => (r.task ? `${r.id}:${r.task.id}` : r.id)}
          storageKey="approvals-inbox"
          views={["table", "list"]}
          renderListItem={listItem}
          onRowClick={(r) => open(r.id)}
          searchPlaceholder="Search by title, reference or person"
          caption={`${INBOX_TABS.find((t) => t.key === tab)?.label} requests`}
          toolbar={
            <>
              <SearchableSelect
                aria-label="Process"
                size="sm"
                className="w-48"
                value={process}
                onChange={setProcess}
                options={processOptions}
              />
              {TASK_TABS.includes(tab) && tab !== "done" && (
                <label className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700">
                  <Switch checked={overdueOnly} onChange={setOverdueOnly} label="Overdue only" />
                  <span aria-hidden>Overdue only</span>
                </label>
              )}
            </>
          }
          empty={
            <Empty
              icon={Inbox}
              hue={process || overdueOnly ? "slate" : "mint"}
              title={process || overdueOnly ? "Nothing matches these filters" : EMPTY[tab].title}
              hint={process || overdueOnly ? "Clear the process or overdue filter to see everything." : EMPTY[tab].hint}
            />
          }
        />
      )}

      {openId && <DecisionDrawer id={openId} onClose={close} onChanged={() => setReloadKey((k) => k + 1)} />}
    </div>
  );
}

/** The decision view, slid in from the right over the list. */
function DecisionDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Leave Escape to an open confirmation dialog first.
      if (e.key === "Escape" && !document.querySelector('[role="alertdialog"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[65] flex justify-end" role="dialog" aria-modal="true" aria-label="Request">
      <button type="button" aria-label="Close the request" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-neutral-900/35 backdrop-blur-[2px]" />
      <div className={cx("relative flex h-full w-full max-w-3xl flex-col bg-canvas shadow-2xl animate-fade-in")}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200/80 bg-white px-4 sm:px-6">
          <p className="flex items-center gap-2.5 text-sm font-bold text-neutral-900">
            <IconTile icon={Stamp} hue="blue" size={32} />
            Request
          </p>
          <div className="flex items-center gap-1">
            <a
              href={`/suite/approvals/${id}`}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary-700 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              Open full page
            </a>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <DecisionView id={id} variant="panel" onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}
