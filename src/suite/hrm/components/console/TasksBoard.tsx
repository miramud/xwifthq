"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  ClipboardList,
  ListTodo,
  Play,
  Plus,
  RotateCcw,
  Unlock,
} from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PersonAvatar,
  PriorityChip,
  SearchField,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { SegmentedGauge, StatusBars } from "@/components/workspace/charts";
import {
  ApiError,
  hrm,
  type Employee,
  type Task,
  type TaskPriority,
  type TaskSummary,
} from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";
import type { Hue } from "@/components/workspace/modules";
import {
  ModalFrame,
  Notice,
  PersonCell,
  Skeleton,
  SoftButton,
  hintCls,
  inputCls,
  labelCls,
} from "@/suite/hrm/components/ui2/kit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { richExcerpt } from "@/lib/richText";

/**
 * Assigning work and seeing what happened to it.
 *
 * Ordered by urgency rather than date: an urgent task due next week outranks a
 * low one due tomorrow, and sorting by date alone is how the urgent thing ends
 * up below the fold.
 *
 * Blocked is shown as its own state with its reason on the row, because "what
 * is stuck and on what" is the question a manager reads a task list to answer.
 */
const FILTERS = ["Everything open", "Overdue", "Blocked", "Done"] as const;

type Filter = (typeof FILTERS)[number];

const QUERY: Record<
  Filter,
  { overdue?: boolean; status?: "blocked" | "done"; includeClosed?: boolean }
> = {
  "Everything open": {},
  Overdue: { overdue: true },
  Blocked: { status: "blocked" },
  Done: { status: "done", includeClosed: true },
};

function statusHue(task: Task): Hue {
  if (task.status === "done") return "mint";
  if (task.isBlocked) return "sun";
  if (task.status === "in_progress") return "sky";
  if (task.status === "cancelled") return "slate";
  return "grape";
}

export default function TasksBoard() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [filter, setFilter] = useState<Filter>("Everything open");
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      hrm.tasks
        .list({ ...QUERY[filter], q: term === "" ? undefined : term })
        .then((res) => {
          setTasks(res.data);
          setSummary(res.meta);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [filter, term],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (
    task: Task,
    action: "start" | "complete" | "unblock" | "reopen",
  ) => {
    setBusy(task.id);
    try {
      await hrm.tasks.transition(task.id, action);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const actions = (task: Task) => (
    <div className="flex shrink-0 items-center justify-end gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      {task.status === "todo" && (
        <Button size="sm" variant="ghost" icon={Play} disabled={busy === task.id} onClick={() => void move(task, "start")}>
          Start
        </Button>
      )}
      {task.isBlocked && (
        <Button size="sm" icon={Unlock} disabled={busy === task.id} onClick={() => void move(task, "unblock")}>
          Unblock
        </Button>
      )}
      {task.isOpen ? (
        <SoftButton
          icon={CheckCircle2}
          disabled={busy === task.id}
          onClick={() => void move(task, "complete")}
        >
          Done
        </SoftButton>
      ) : (
        <Button size="sm" icon={RotateCcw} disabled={busy === task.id} onClick={() => void move(task, "reopen")}>
          Reopen
        </Button>
      )}
    </div>
  );

  const late = (task: Task) =>
    task.isOverdue ? (
      <Chip hue="rose" icon={AlertTriangle}>
        {task.daysLate} day{task.daysLate === 1 ? "" : "s"} late
      </Chip>
    ) : null;

  const status = (task: Task) => (
    <Chip hue={statusHue(task)} dot>
      {task.statusLabel}
    </Chip>
  );

  /*
    The reason sits on the row rather than behind a click. A blocked list
    where you have to open each one to find out what is blocking it is a list
    nobody works through.
  */
  const blocked = (task: Task) =>
    task.blockedReason !== null ? (
      <p className="flex items-start gap-1.5 text-xs font-medium text-sun-700">
        <CircleSlash size={13} className="mt-0.5 shrink-0" aria-hidden />
        Blocked: {task.blockedReason}
      </p>
    ) : null;

  const columns: Column<Task>[] = [
      {
        key: "title",
        header: "Task",
        primary: true,
        sortable: true,
        value: (t) => t.title,
        render: (t) => (
          <div className="min-w-[200px] max-w-md">
            <p className="font-semibold text-neutral-900">{t.title}</p>
            {blocked(t)}
          </div>
        ),
      },
      {
        key: "assignee",
        header: "Assigned to",
        sortable: true,
        value: (t) => t.assignee?.name ?? "Unassigned",
        render: (t) =>
          t.assignee ? (
            <PersonCell
              name={t.assignee.name}
              sub={t.assignee.jobTitle}
              href={`/suite/hrm/people/${t.assignee.id}`}
              size={30}
            />
          ) : (
            <span className="text-neutral-500">Unassigned</span>
          ),
      },
      {
        key: "priority",
        header: "Priority",
        sortable: true,
        value: (t) => ({ urgent: 0, high: 1, normal: 2, low: 3 })[t.priority],
        render: (t) => <PriorityChip priority={t.priorityLabel} />,
      },
      {
        key: "due",
        header: "Due",
        sortable: true,
        value: (t) => t.dueOn ?? "",
        render: (t) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="tabular-nums">{t.dueOn ? formatDate(t.dueOn) : "No date"}</span>
            {late(t)}
          </span>
        ),
      },
      { key: "status", header: "Status", sortable: true, value: (t) => t.statusLabel, render: status },
      { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
  ];

  const tabs = FILTERS.map((f) => ({
    key: f,
    label: f,
    count:
      summary === null
        ? undefined
        : f === "Everything open"
          ? summary.open
          : f === "Overdue"
            ? summary.overdue
            : f === "Blocked"
              ? summary.blocked
              : summary.done,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Work"
        title="Tasks"
        subtitle="Work you have handed out, most urgent first."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setAssigning(true)}>
            <span className="hidden sm:inline">Assign work</span>
            <span className="sm:hidden">Assign</span>
          </Button>
        }
        tabs={tabs}
        activeTab={filter}
        onTab={(k) => setFilter(k as Filter)}
      />

      <div className="space-y-6">
        {error !== null && <Notice tone="error" role="alert">{error}</Notice>}

        {summary !== null && (
          <>
            <StatGrid>
              <StatCard featured icon={ListTodo} label="Open" value={summary.open} hint={`${summary.dueThisWeek} due this week`} />
              <StatCard icon={AlertTriangle} hue="rose" label="Overdue" value={summary.overdue} hint="Past their due date" />
              <StatCard icon={CircleSlash} hue="sun" label="Blocked" value={summary.blocked} hint="Waiting on something" />
              <StatCard
                icon={CheckCircle2}
                hue="mint"
                label="Completed"
                value={summary.completionRate === null ? "-" : `${summary.completionRate}%`}
                /* Cancelled tasks are in neither half — dropping something nobody
                   wanted is not a failure to deliver it. */
                hint={`${summary.done} of ${summary.done + summary.open} that count`}
              />
            </StatGrid>

            <div className="grid gap-6 lg:grid-cols-3">
              <Panel
                className="lg:col-span-2"
                title="Where the work stands"
                subtitle="Every task you have assigned, by state"
                icon={ClipboardList}
              >
                <StatusBars
                  caption="Tasks by state"
                  data={[
                    { label: "To do", value: Math.max(0, summary.open - summary.inProgress - summary.blocked), hue: "grape" },
                    { label: "In progress", value: summary.inProgress, hue: "sky" },
                    { label: "Blocked", value: summary.blocked, hue: "sun" },
                    { label: "Done", value: summary.done, hue: "mint" },
                    { label: "Cancelled", value: summary.cancelled, hue: "slate" },
                  ]}
                />
              </Panel>
              <Panel title="Completion" subtitle="Done over done and open" icon={CheckCircle2} hue="mint">
                <div className="flex flex-col items-center pt-4">
                  <SegmentedGauge
                    value={summary.completionRate ?? 0}
                    hue="mint"
                    label="completed"
                    display={summary.completionRate === null ? "-" : `${summary.completionRate}%`}
                  />
                  <div className="mt-6 flex w-full items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                    <span className="flex items-center gap-2 text-neutral-600">
                      <CalendarClock size={16} className="text-primary-600" aria-hidden />
                      Due this week
                    </span>
                    <span className="font-bold tabular-nums text-neutral-900">{summary.dueThisWeek}</span>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        )}

        {tasks === null ? (
          <Skeleton className="h-72" />
        ) : (
          <DataView
            rows={tasks}
            columns={columns}
            rowKey={(t) => t.id}
            storageKey="hrm.tasks"
            searchable={false}
            gridCols={3}
            caption={`${tasks.length} tasks: ${filter.toLowerCase()}`}
            toolbar={
              <SearchField
                value={term}
                onChange={setTerm}
                placeholder="Search tasks…"
                label="Search tasks"
                className="w-full sm:w-72"
              />
            }
            empty={
              <Empty
                icon={ClipboardList}
                title="Nothing here"
                hint={
                  term === ""
                    ? "Assign work and it appears on the person's own list too."
                    : "Nothing matched that."
                }
              />
            }
            renderCard={(t) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <PriorityChip priority={t.priorityLabel} />
                  {t.assignee && <PersonAvatar name={t.assignee.name} size={30} />}
                </div>
                <div>
                  <p className="text-[15px] font-semibold leading-snug text-neutral-900">{t.title}</p>
                  {t.description && (
                    <p className="mt-1 line-clamp-2 text-[13px] text-neutral-500">{richExcerpt(t.description, 200)}</p>
                  )}
                </div>
                {blocked(t)}
                <div className="flex flex-wrap items-center gap-1.5">
                  {status(t)}
                  {late(t)}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <CalendarClock size={14} aria-hidden />
                    {t.dueOn ? formatDate(t.dueOn) : "No date"}
                    {t.assignee && <span className="truncate">· {t.assignee.name ?? "Unnamed"}</span>}
                  </span>
                  {actions(t)}
                </div>
              </div>
            )}
            renderListItem={(t) => (
              <div className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <PersonAvatar name={t.assignee?.name ?? "Unassigned"} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{t.title}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {t.assignee?.name ?? "Unassigned"}
                      {t.dueOn ? ` · due ${formatDate(t.dueOn)}` : " · no date"}
                    </p>
                  </div>
                  {t.priority !== "normal" && <PriorityChip priority={t.priorityLabel} />}
                  {late(t)}
                  {status(t)}
                  {actions(t)}
                </div>
                {t.blockedReason !== null && <div className="mt-1.5 pl-11">{blocked(t)}</div>}
              </div>
            )}
          />
        )}
      </div>

      {assigning && (
        <AssignDialog
          onClose={() => setAssigning(false)}
          onAssigned={() => {
            setAssigning(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AssignDialog({
  onClose,
  onAssigned,
}: {
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [people, setPeople] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hrm.employees
      .list({ perPage: 100 })
      .then((res) => setPeople(res.data))
      .catch(() => setPeople([]));
  }, []);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.tasks.assign({
        assigneeIds: selected,
        title: title.trim(),
        description: description.trim() === "" ? undefined : description.trim(),
        dueOn: dueOn === "" ? undefined : dueOn,
        priority,
      });

      onAssigned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="Assign work"
      subtitle="Several people means one task each, so they finish independently."
      icon={ClipboardList}
      onClose={onClose}
      onSubmit={submit}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || selected.length === 0 || title.trim() === ""}
          >
            {busy
              ? "Assigning…"
              : `Assign to ${selected.length} ${selected.length === 1 ? "person" : "people"}`}
          </Button>
        </>
      }
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      <label className="block">
        <span className={labelCls}>What</span>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Write up the incident report"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Detail (optional)</span>
        <RichTextEditor minHeight={76} value={description} onChange={setDescription} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Due</span>
          <input
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            className={inputCls}
          />
          <span className={hintCls}>
            Leave blank for a standing job; it will never show as overdue.
          </span>
        </label>

        <label className="block">
          <span className={labelCls}>Priority</span>
          <SearchableSelect
            value={priority}
            onChange={(v) => setPriority(v as TaskPriority)}
            options={[
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent" },
            ]}
          />
        </label>
      </div>

      <fieldset>
        <legend className={labelCls}>Who ({selected.length} selected)</legend>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-neutral-200">
          {people.length === 0 ? (
            <p className="px-3 py-4 text-sm text-neutral-500">Nobody on the books.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {people.map((person) => {
                const on = selected.includes(person.id);
                return (
                  <li key={person.id}>
                    <label
                      className={cx(
                        "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                        on ? "bg-primary-50/60" : "hover:bg-neutral-50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(person.id)}
                        className="h-4 w-4 accent-primary-600"
                      />
                      <PersonAvatar name={person.person.name ?? "Unnamed"} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">
                          {person.person.name ?? "Unnamed"}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {person.jobTitle}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </fieldset>
    </ModalFrame>
  );
}
