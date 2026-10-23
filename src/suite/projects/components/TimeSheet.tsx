"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Clock,
  Coins,
  PieChart,
  Pencil,
  Plus,
  Receipt,
  Timer,
  Trash2,
  Users,
} from "lucide-react";
import { Button, Card, Chip, Empty, Panel, Segmented, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ColumnChart, Donut } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  time as timeApi,
  workItems as itemsApi,
  type BoardSetup,
  type Project,
  type Sprint,
  type TimeLog,
  type TimeLogWarning,
  type WorkItem,
} from "@/lib/api/projects-client";
import RepriceHours from "./RepriceHours";
import { duration, hours, money } from "./money";
import { today } from "./dates";
import {
  ItemRef,
  Modal,
  Notice,
  TabSkeleton,
  fmtDate,
  hintCls,
  inputCls,
  labelCls,
  smallInputCls,
} from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * The hours worked on a project.
 *
 * **Logging is deliberately the easiest thing on this screen.** A timesheet
 * that takes four fields and a dropdown is a timesheet filled in on the last
 * Friday of the month from memory, and every cost figure built on that is
 * fiction. So the form defaults to today, to the whole team's view, and to
 * billable, and asks for one number.
 *
 * **Hours in, minutes stored.** The API keeps minutes because a project's total
 * is a sum of thousands of rows; the form asks for hours because that is how
 * people think about an afternoon.
 *
 * **The money is absent for most readers, not zero.** An engineer reading their
 * own timesheet is not shown their charge-out rate — see
 * `ProjectPolicy::viewCost` — and `meta.canSeeCost` is the server's answer,
 * never inferred here.
 */
export default function TimeSheet({
  project,
  sprints,
  setup,
}: {
  project: Project;
  sprints: Sprint[];
  setup: BoardSetup | null;
}) {
  const confirm = useConfirm();
  const [logs, setLogs] = useState<TimeLog[] | null>(null);
  const [meta, setMeta] = useState<{
    canSeeCost: boolean;
    canLogForOthers: boolean;
    hours: number;
    billableHours: number;
    costMinor: number | null;
    currency: string;
    unratedHours: number | null;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const [mine, setMine] = useState(false);
  const [sprintId, setSprintId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chartBy, setChartBy] = useState<"day" | "person">("day");

  const [logging, setLogging] = useState(false);
  /**
   * The entry being corrected.
   *
   * **Editing matters more than it looks.** Without it the only way to fix a
   * typo in yesterday's hours is delete and re-log — and re-logging re-resolves
   * the rate against *today's* card, so correcting 1h to 2h could quietly
   * re-price the afternoon. An update keeps the snapshotted rate and multiplies
   * the new duration by it, which is what actually happened.
   */
  const [editing, setEditing] = useState<string | null>(null);

  /*
    Leave and holiday notices for the hour just saved (X1). Advisory: the hour
    is already logged, so this sits above the sheet until dismissed or the
    next save, rather than blocking anything.
  */
  const [dayWarnings, setDayWarnings] = useState<TimeLogWarning[]>([]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    timeApi
      .list(project.slug, {
        mine: mine || undefined,
        sprintId: sprintId === "" ? undefined : sprintId,
        from: from === "" ? undefined : from,
        to: to === "" ? undefined : to,
      })
      .then((res) => {
        if (cancelled) return;

        setLogs(res.data);
        setMeta(res.meta);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setLogs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [project.slug, mine, sprintId, from, to, reloads]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);

    try {
      await action();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  /*
    Totalled by day, because a timesheet is read a day at a time — "what did I
    do on Tuesday" — and the chart answers that before the table is read. The
    table itself is newest first for the same reason.
  */
  const byDay = useMemo(() => {
    const map = new Map<string, number>();

    for (const log of logs ?? []) {
      map.set(log.workedOn, (map.get(log.workedOn) ?? 0) + log.minutes);
    }

    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [logs]);

  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number }>();

    for (const log of logs ?? []) {
      const prev = map.get(log.userId);
      map.set(log.userId, { name: log.user ?? "Somebody", minutes: (prev?.minutes ?? 0) + log.minutes });
    }

    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  }, [logs]);

  const sorted = useMemo(
    () => [...(logs ?? [])].sort((a, b) => b.workedOn.localeCompare(a.workedOn)),
    [logs],
  );

  if (logs === null || meta === null) {
    return <TabSkeleton />;
  }

  const editingLog = editing === null ? null : (logs.find((l) => l.id === editing) ?? null);
  const showCost = meta.canSeeCost;

  const titleOf = (log: TimeLog) => log.workItem?.title ?? log.note ?? "Project time";
  const detailOf = (log: TimeLog) =>
    [
      log.user,
      log.discipline,
      /* A note beside a ticket, rather than instead of it. */
      log.workItem !== null && log.workItem !== undefined && log.note !== null ? log.note : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const costCell = (log: TimeLog) =>
    showCost && log.costMinor !== undefined ? (
      <span className="tabular-nums" title={log.rateSourceLabel ?? undefined}>
        {log.rateSource === "none" ? (
          /* Costed at zero, and said so rather than shown as free. */
          <Chip hue="sun" dot>
            No rate
          </Chip>
        ) : (
          money(log.costMinor, log.currency ?? meta.currency)
        )}
      </span>
    ) : null;

  const actions = (log: TimeLog) => (
    <span className="inline-flex items-center gap-1">
      <IconButton
        label={`Edit ${duration(log.minutes)} on ${log.workedOn}`}
        icon={Pencil}
        disabled={busy !== null}
        onClick={() => setEditing(editing === log.id ? null : log.id)}
      />
      <IconButton
        label={`Delete ${duration(log.minutes)} on ${log.workedOn}`}
        icon={Trash2}
        danger
        disabled={busy !== null}
        onClick={async () => {
          const ok = await confirm({
            title: `Delete ${duration(log.minutes)} logged on ${log.workedOn}?`,
            body: "It comes off the timesheet and out of the project's cost. It moves to the organisation's recycle bin, where an admin can restore it.",
            confirmLabel: "Delete time",
            recoverable: true,
          });
          if (ok) await run(`del-${log.id}`, () => timeApi.remove(project.slug, log.id));
        }}
      />
    </span>
  );

  const columns: Column<TimeLog>[] = [
    {
      key: "work",
      header: "Work",
      primary: true,
      sortable: true,
      value: (log) => titleOf(log),
      render: (log) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <ItemRef value={log.workItem?.externalRef} />
            <span className="truncate font-semibold text-neutral-900">{titleOf(log)}</span>
          </span>
          <span className="truncate text-xs text-neutral-500">{detailOf(log)}</span>
        </span>
      ),
    },
    {
      key: "date",
      header: "Worked on",
      sortable: true,
      value: (log) => log.workedOn,
      render: (log) => <span className="whitespace-nowrap">{fmtDate(log.workedOn)}</span>,
    },
    {
      key: "time",
      header: "Time",
      align: "right",
      sortable: true,
      value: (log) => log.minutes,
      render: (log) => <span className="font-semibold text-neutral-900">{duration(log.minutes)}</span>,
    },
    ...(project.isBillable
      ? [
          {
            key: "billable",
            header: "Billing",
            hideOnMobile: true,
            value: (log: TimeLog) => (log.isBillable ? "Billable" : "Not billable"),
            render: (log: TimeLog) =>
              /* Rework absorbed, an estimate got wrong. Both were asked for. */
              log.isBillable ? <span className="text-xs text-neutral-500">Billable</span> : <Chip hue="slate">Not billable</Chip>,
          },
        ]
      : []),
    ...(showCost
      ? [
          {
            key: "cost",
            header: "Cost",
            align: "right" as const,
            sortable: true,
            value: (log: TimeLog) => log.costMinor ?? null,
            render: costCell,
          },
        ]
      : []),
    { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
  ];

  const chartData =
    chartBy === "day"
      ? byDay.slice(-14).map(([day, minutes]) => ({ label: fmtDate(day, false), value: minutes / 60 }))
      : byPerson.slice(0, 10).map((p) => ({ label: p.name.split(" ")[0], value: p.minutes / 60, hue: hueFor(p.name) }));

  const nonBillable = Math.max(0, meta.hours - meta.billableHours);

  return (
    <div className="space-y-6">
      {error !== null && <Notice tone="error">{error}</Notice>}

      <div role="status" aria-live="polite">
        {dayWarnings.length > 0 && (
          <Notice
            tone="warn"
            title="Logged, but worth a second look"
            action={
              <Button size="sm" onClick={() => setDayWarnings([])}>
                Dismiss
              </Button>
            }
          >
            {dayWarnings.map((w) => (
              <p key={w.code}>{w.message}</p>
            ))}
          </Notice>
        )}
      </div>

      {/*
        Unrated hours, said out loud. They cost zero, and a total that quietly
        includes eighteen free hours is wrong by however much they should have
        been. Only shown to somebody who can see the money it affects.
      */}
      {meta.canSeeCost && (meta.unratedHours ?? 0) > 0 && (
        <Notice tone="warn">
          {hours(meta.unratedHours ?? 0)} were logged before a rate was set, so they
          cost nothing in the total below. Once a rate is set they can be repriced;
          until then the figure is short by whatever they were worth.
          {project.can.manageRates && (
            <span className="mt-2 block">
              <RepriceHours slug={project.slug} onRepriced={reload} />
            </span>
          )}
        </Notice>
      )}

      {/* ----------------------------- stat row ---------------------------- */}

      <StatGrid>
        <StatCard featured icon={Clock} label="Hours logged" value={hours(meta.hours)} />
        <StatCard
          icon={Receipt}
          hue="mint"
          label={project.isBillable ? "Billable" : "Billable (internal project)"}
          value={project.isBillable ? hours(meta.billableHours) : "-"}
          hint={project.isBillable ? undefined : "An internal project has a cost and no price"}
        />
        {meta.canSeeCost && meta.costMinor !== null ? (
          <StatCard icon={Coins} hue="sun" label="Cost" value={money(meta.costMinor, meta.currency)} />
        ) : (
          <StatCard icon={Users} hue="sky" label="People" value={String(new Set(logs.map((l) => l.userId)).size)} />
        )}
        <StatCard icon={CalendarDays} hue="grape" label="Days worked" value={byDay.length} hint="In the entries shown" />
      </StatGrid>

      {/* ------------------------- hero + supporting ----------------------- */}

      {logs.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel
            className={project.isBillable ? "xl:col-span-2" : "xl:col-span-3"}
            title={chartBy === "day" ? "Hours by day" : "Hours by person"}
            subtitle={chartBy === "day" ? "The last fourteen days with time on them" : "Who the hours shown were logged by"}
            icon={BarChart3}
            actions={
              <Segmented<"day" | "person">
                label="Chart hours by"
                value={chartBy}
                onChange={setChartBy}
                options={[
                  { key: "day", label: "By day" },
                  { key: "person", label: "By person" },
                ]}
              />
            }
          >
            <div className="pt-8">
              <ColumnChart
                data={chartData}
                height={190}
                hue="blue"
                highlight={chartBy === "day" ? "last" : "max"}
                format={hours}
                caption={chartBy === "day" ? "Hours logged per day" : "Hours logged per person"}
              />
            </div>
          </Panel>

          {project.isBillable && (
            <Panel title="Kind of hours" subtitle="Billed to the client, or absorbed" icon={PieChart} hue="mint">
              <div className="flex h-full items-center justify-center">
                <Donut
                  size={160}
                  legend="below"
                  centerLabel="logged"
                  total={hours(meta.hours)}
                  caption="Hours by kind"
                  data={[
                    { label: "To the client", value: meta.billableHours, hue: "mint" },
                    { label: "Absorbed", value: nonBillable, hue: "slate" },
                  ]}
                />
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ------------------------------ entries ---------------------------- */}

      <Panel
        title="Time"
        subtitle="Hours as they were worked. Logged by whoever worked them."
        icon={Timer}
        hue="sky"
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setLogging((v) => !v)}>
            Log time
          </Button>
        }
        bodyClassName="p-5 pt-4"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl bg-neutral-50 p-2.5">
          <label
            className={cx(
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
              mine ? "border-primary-200 bg-primary-50 text-primary-700" : "border-neutral-200 bg-white text-neutral-700",
            )}
          >
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
            />
            Only mine
          </label>

          {sprints.length > 0 && (
            <SearchableSelect
              value={sprintId}
              onChange={setSprintId}
              aria-label="Filter by sprint"
              size="sm"
              className="w-40"
              searchPlaceholder="Search sprints"
              options={[
                { value: "", label: "Any sprint" },
                ...sprints.map((s) => ({ value: s.id, label: `Sprint ${s.sequence}` })),
              ]}
            />
          )}

          <label className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-600">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Worked from"
              className={smallInputCls}
            />
          </label>

          <label className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-600">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Worked to"
              className={smallInputCls}
            />
          </label>

          <span className="ml-auto pr-1 text-xs font-medium text-neutral-500">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {logs.length === 0 ? (
          <Card>
            <Empty
              icon={Clock}
              hue="sky"
              title="No hours logged yet"
              hint="Cost and velocity are both built on this, so a project with no logged time reports nothing."
            />
          </Card>
        ) : (
          <DataView
            rows={sorted}
            columns={columns}
            rowKey={(log) => log.id}
            storageKey="projects.time.entries"
            caption="Time logged on this project"
            searchPlaceholder="Search entries"
            renderCard={(log) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-2.5 py-1 text-sm font-bold tabular-nums text-sky-700">
                    <Clock size={14} aria-hidden />
                    {duration(log.minutes)}
                  </span>
                  {actions(log)}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <ItemRef value={log.workItem?.externalRef} />
                    <span className="truncate text-[15px] font-semibold text-neutral-900">{titleOf(log)}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{detailOf(log)}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                  <Chip hue={hueFor(log.user)} icon={CalendarDays}>
                    {fmtDate(log.workedOn)}
                  </Chip>
                  {!log.isBillable && project.isBillable && <Chip hue="slate">Not billable</Chip>}
                  {costCell(log)}
                </div>
              </div>
            )}
          />
        )}
      </Panel>

      {logging && (
        <LogForm
          project={project}
          setup={setup}
          canLogForOthers={meta.canLogForOthers}
          busy={busy === "log"}
          onCancel={() => setLogging(false)}
          onSubmit={async (input) => {
            setDayWarnings([]);
            await run("log", async () => setDayWarnings((await timeApi.log(project.slug, input))?.warnings ?? []));
            setLogging(false);
          }}
        />
      )}

      {editingLog !== null && (
        <EditForm
          log={editingLog}
          billableProject={project.isBillable}
          busy={busy === `edit-${editingLog.id}`}
          onCancel={() => setEditing(null)}
          onSubmit={async (input) => {
            setDayWarnings([]);
            await run(`edit-${editingLog.id}`, async () =>
              setDayWarnings((await timeApi.update(project.slug, editingLog.id, input))?.warnings ?? []),
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  danger = false,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "hover:bg-error-50 hover:text-error-600" : "hover:bg-neutral-100 hover:text-neutral-700",
      )}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}

function LogForm({
  project,
  setup,
  canLogForOthers,
  busy,
  onCancel,
  onSubmit,
}: {
  project: Project;
  setup: BoardSetup | null;
  canLogForOthers: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}) {
  /*
    The project's unfinished work, fetched here rather than passed in.
    `BoardSetup` carries columns, job titles and people - it has never carried
    items, and the first version of this form offered an empty dropdown with a
    separator in it and nothing to pick.

    Incomplete items only: today's hours did not go on something that shipped
    last month, and a dropdown holding a year of closed tickets is one nobody
    scrolls.
  */
  const [items, setItems] = useState<WorkItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    itemsApi
      .list(project.slug, { perPage: 200 })
      .then((page) => {
        if (cancelled) return;

        setItems(page.data.filter((item) => !item.isComplete));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [project.slug]);

  const [hoursWorked, setHoursWorked] = useState("");
  /* Today, because that is when almost every entry is made. */
  const [workedOn, setWorkedOn] = useState(() => today());
  const [workItemId, setWorkItemId] = useState("");
  const [userId, setUserId] = useState("");
  const [isBillable, setIsBillable] = useState(true);
  const [note, setNote] = useState("");

  const value = Number.parseFloat(hoursWorked);
  const valid = Number.isFinite(value) && value > 0 && value <= 24;

  return (
    <Modal
      title="Log time"
      subtitle={project.name}
      icon={Timer}
      hue="sky"
      width="lg"
      onClose={onCancel}
      footer={
        <>
          <Button
            variant="primary"
            onClick={() =>
              void onSubmit({
                hours: value,
                workedOn,
                workItemId: workItemId === "" ? null : workItemId,
                userId: userId === "" ? null : userId,
                isBillable,
                note: note.trim() === "" ? undefined : note.trim(),
              })
            }
            disabled={busy || !valid}
          >
            {busy ? "Logging…" : "Log it"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tl-hours" className={labelCls}>
            Hours
          </label>
          <input
            id="tl-hours"
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value)}
            placeholder="1.5"
            className={inputCls}
          />
          {/* Said here rather than discovered through a 422. */}
          <p className={hintCls}>A day at most. Split anything longer across the days it was worked.</p>
        </div>

        <div>
          <label htmlFor="tl-date" className={labelCls}>
            Worked on
          </label>
          <input
            id="tl-date"
            type="date"
            value={workedOn}
            max={today()}
            onChange={(e) => setWorkedOn(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="tl-item" className={labelCls}>
            Against
          </label>
          {/*
            The default, and not an afterthought: a stand-up, a client call and
            a day of interviewing are real project time that belongs to no
            ticket. Forcing a ticket makes people invent one.
          */}
          <SearchableSelect
            id="tl-item"
            value={workItemId}
            onChange={setWorkItemId}
            searchPlaceholder="Search tickets"
            options={[
              { value: "", label: "The project (no ticket)" },
              ...items.map((item) => ({
                value: item.id,
                label: `${item.externalRef === null ? "" : `${item.externalRef} · `}${item.title}`,
              })),
            ]}
          />
          <p className={hintCls}>
            {items.length === 0
              ? "Nothing open to log against yet."
              : "Unfinished work only. A closed ticket is not where today went."}
          </p>
        </div>

        {canLogForOthers && (
          <div>
            <label htmlFor="tl-user" className={labelCls}>
              For
            </label>
            <SearchableSelect
              id="tl-user"
              value={userId}
              onChange={setUserId}
              searchPlaceholder="Search people"
              options={[
                { value: "", label: "Me" },
                ...(setup?.assignees ?? []).map((person) => ({ value: person.id, label: person.name })),
              ]}
            />
            <p className={hintCls}>For a contractor who does not use the system.</p>
          </div>
        )}

        {project.isBillable && (
          <div className="flex items-end pb-1">
            <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 px-3.5 text-sm font-semibold text-neutral-700">
              <input
                type="checkbox"
                checked={isBillable}
                onChange={(e) => setIsBillable(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
              />
              Billable
            </label>
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="tl-note" className={labelCls}>
            Note
          </label>
          <input
            id="tl-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Stand-up and the client call about the schema"
            className={inputCls}
          />
        </div>
      </div>
    </Modal>
  );
}

/**
 * Correcting a logged hour.
 *
 * **Re-priced at the rate that applied then, not today's.** The API keeps the
 * snapshot and multiplies the new duration by it, so fixing a typo in last
 * month's hours cannot bring them up to this month's rate card. That asymmetry
 * is the whole reason editing exists rather than delete-and-relog.
 */
function EditForm({
  log,
  billableProject,
  busy,
  onCancel,
  onSubmit,
}: {
  log: TimeLog;
  billableProject: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [hoursWorked, setHoursWorked] = useState(String(log.hours));
  const [workedOn, setWorkedOn] = useState(log.workedOn);
  const [isBillable, setIsBillable] = useState(log.isBillable);
  const [note, setNote] = useState(log.note ?? "");

  const value = Number.parseFloat(hoursWorked);
  const valid = Number.isFinite(value) && value > 0 && value <= 24;

  return (
    <Modal
      title="Correct an entry"
      subtitle={`${duration(log.minutes)} on ${fmtDate(log.workedOn)}, kept at the rate that applied then`}
      icon={Pencil}
      hue="sky"
      onClose={onCancel}
      footer={
        <>
          <Button
            variant="primary"
            onClick={() =>
              void onSubmit({
                hours: value,
                workedOn,
                isBillable,
                /* Emptied means cleared, which the API tells from "not sent". */
                note: note.trim() === "" ? null : note.trim(),
              })
            }
            disabled={busy || !valid}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Hours
          <input
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value)}
            aria-label={`Hours on ${log.workedOn}`}
            className={cx(inputCls, "mt-1.5 font-normal")}
          />
        </label>

        <label className={labelCls}>
          Worked on
          <input
            type="date"
            value={workedOn}
            max={today()}
            onChange={(e) => setWorkedOn(e.target.value)}
            aria-label={`Date of the ${duration(log.minutes)} entry`}
            className={cx(inputCls, "mt-1.5 font-normal")}
          />
        </label>

        <label className={cx(labelCls, "sm:col-span-2")}>
          Note
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label={`Note on the ${duration(log.minutes)} entry`}
            className={cx(inputCls, "mt-1.5 font-normal")}
          />
        </label>

        {billableProject && (
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 px-3.5 text-sm font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
            />
            Billable
          </label>
        )}
      </div>
    </Modal>
  );
}
