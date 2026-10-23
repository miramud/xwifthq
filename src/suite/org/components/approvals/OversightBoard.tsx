"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlarmClock, ArrowRightLeft, ClipboardList, Route as RouteIcon, UserRoundX } from "lucide-react";
import { ApiError, orgFoundations, type OversightRow } from "@/lib/api/org-foundations-client";
import { formatMoney } from "@/lib/api/approvals-client";
import { Button, Chip, Empty, Panel, Segmented } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Heatmap, StackedColumns, type CategoryDatum, type HeatCell, type SeriesDef } from "@/components/workspace/charts";
import { ErrorNote, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { ApprovalsHeader, FieldError, LookupSelect, shortDateTime, smallLabel } from "./parts";
import { labelFor, useLookup } from "./lookups";

/*
  Oversight: every request in flight across the organisation. What is late,
  what found nobody to route to, and who each one is waiting on — with the
  two levers an administrator has: route a stuck request again (after
  fixing the role or holder that was missing), and hand a waiting task to
  somebody else, always with a reason that goes on the record.
*/

export type OversightStatus = "open" | "overdue" | "needs_routing" | "approved" | "rejected" | "returned" | "recalled";

export const OVERSIGHT_TABS: { key: OversightStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "needs_routing", label: "Waiting for an approver" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "returned", label: "Returned" },
  { key: "recalled", label: "Withdrawn" },
];

const STATUS_CHIP: Record<string, { label: string; hue: "blue" | "mint" | "rose" | "sun" | "slate" | "coral" }> = {
  in_progress: { label: "In progress", hue: "blue" },
  needs_routing: { label: "No approver found", hue: "coral" },
  approved: { label: "Approved", hue: "mint" },
  rejected: { label: "Rejected", hue: "rose" },
  returned: { label: "Returned", hue: "sun" },
  recalled: { label: "Withdrawn", hue: "slate" },
  cancelled: { label: "Cancelled", hue: "slate" },
};

export const AGE_BUCKETS = ["Under a day", "1 to 3 days", "3 to 7 days", "1 to 2 weeks", "Over 2 weeks"];

export function ageBucket(submittedAt: string, now: number = Date.now()): string {
  const days = (now - new Date(submittedAt).getTime()) / 86_400_000;
  if (days < 1) return AGE_BUCKETS[0];
  if (days < 3) return AGE_BUCKETS[1];
  if (days < 7) return AGE_BUCKETS[2];
  if (days < 14) return AGE_BUCKETS[3];
  return AGE_BUCKETS[4];
}

export const isOverdue = (r: OversightRow) => r.stages.some((s) => s.overdue);

/** Requests per process, split into on time / overdue / no approver found. */
export function byProcess(rows: OversightRow[]): CategoryDatum[] {
  const map = new Map<string, CategoryDatum>();
  for (const r of rows) {
    const d = map.get(r.processName) ?? { label: r.processName, values: { onTime: 0, overdue: 0, unrouted: 0 } };
    const key = r.status === "needs_routing" ? "unrouted" : isOverdue(r) ? "overdue" : "onTime";
    d.values[key] += 1;
    map.set(r.processName, d);
  }
  return [...map.values()].sort((a, b) => sum(b) - sum(a));
}

const sum = (d: CategoryDatum) => Object.values(d.values).reduce((a, b) => a + b, 0);

/** Overdue requests by process × how long ago they were sent. */
export function overdueHeat(rows: OversightRow[], now: number = Date.now()): { rows: string[]; cells: HeatCell[] } {
  const counts = new Map<string, number>();
  const processes = new Set<string>();
  for (const r of rows.filter(isOverdue)) {
    processes.add(r.processName);
    const k = `${r.processName}\u0000${ageBucket(r.submittedAt, now)}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const names = [...processes].sort();
  return {
    rows: names,
    cells: names.flatMap((p) => AGE_BUCKETS.map((b) => ({ row: p, col: b, value: counts.get(`${p}\u0000${b}`) ?? 0 }))),
  };
}

const SERIES: SeriesDef[] = [
  { key: "onTime", label: "On time", hue: "blue" },
  { key: "overdue", label: "Overdue", hue: "coral" },
  { key: "unrouted", label: "No approver found", hue: "sun" },
];

type Waiting = { taskId: string; name: string | null; stage: string; dueAt: string | null; overdue: boolean };

const waitingOf = (r: OversightRow): Waiting[] => r.stages.flatMap((s) => s.waitingOn.map((w) => ({ ...w, stage: s.name, dueAt: s.dueAt, overdue: s.overdue })));

export default function OversightBoard() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<OversightStatus>("open");
  const [process, setProcess] = useState("");
  const [rows, setRows] = useState<OversightRow[] | null>(null);
  const [processes, setProcesses] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reassign, setReassign] = useState<{ row: OversightRow; task: Waiting } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    orgFoundations.approvals
      .processes()
      .then((p) => setProcesses(p.data.map((x) => ({ value: x.code, label: x.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setRows(null);
    orgFoundations.approvals
      .oversight({ status, process: process || undefined })
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && setError(e instanceof ApiError ? e.message : "Requests didn't load."));
    return () => {
      alive = false;
    };
  }, [status, process, reload]);

  const reroute = async (r: OversightRow) => {
      setBusy(r.id);
      setError(null);
      try {
        const res = await orgFoundations.approvals.reroute(r.id);
        setNotice(res.status === "needs_routing" ? `“${r.title}” still finds nobody. Check the approval roles it needs.` : `“${r.title}” was routed again.`);
        setReload((n) => n + 1);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "It wasn't routed again.");
      } finally {
        setBusy(null);
      }
  };

  const chart = useMemo(() => byProcess(rows ?? []), [rows]);
  const heat = useMemo(() => overdueHeat(rows ?? []), [rows]);
  const inFlight = status === "open" || status === "overdue" || status === "needs_routing";
  const series = inFlight ? SERIES : [{ key: "total", label: OVERSIGHT_TABS.find((t) => t.key === status)!.label, hue: "blue" as const }];
  const chartData = inFlight ? chart : chart.map((d) => ({ label: d.label, values: { total: sum(d) } }));

  const columns: Column<OversightRow>[] = [
    {
      key: "title",
      header: "Request",
      primary: true,
      sortable: true,
      value: (r) => `${r.title} ${r.ref ?? ""}`,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-neutral-900">{r.title}</span>
          <span className="text-xs text-neutral-500">
            {r.ref ? `${r.ref} · ` : ""}
            {r.processName}
          </span>
        </span>
      ),
    },
    { key: "requester", header: "Asked by", sortable: true, value: (r) => r.requester ?? "", hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right", sortable: true, value: (r) => r.amount ?? -1, render: (r) => (r.amount != null ? formatMoney(r.amount, r.currency) : "-"), hideOnMobile: true },
    {
      key: "waiting",
      header: "Waiting on",
      value: (r) => waitingOf(r).map((w) => w.name).join(", "),
      render: (r) => {
        if (r.status === "needs_routing")
          return (
            <Chip hue="coral" icon={UserRoundX}>
              Nobody found
            </Chip>
          );
        const w = waitingOf(r);
        if (w.length === 0) return <span className="text-neutral-500">{STATUS_CHIP[r.status]?.label ?? r.status}</span>;
        return (
          <span className="block text-sm">
            {w.map((x) => x.name ?? "Unassigned").join(", ")}
            <span className="block text-xs text-neutral-500">{w[0].stage}</span>
          </span>
        );
      },
    },
    {
      key: "due",
      header: "Due",
      sortable: true,
      value: (r) => waitingOf(r).map((w) => w.dueAt).filter(Boolean).sort()[0] ?? "",
      render: (r) => {
        const w = waitingOf(r);
        const due = w.map((x) => x.dueAt).filter(Boolean).sort()[0];
        if (!due) return <span className="text-neutral-500">-</span>;
        return isOverdue(r) ? (
          <Chip hue="rose" icon={AlarmClock}>
            Overdue · {shortDateTime(due)}
          </Chip>
        ) : (
          <span className="tabular-nums">{shortDateTime(due)}</span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (r) => (
        <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {r.status === "needs_routing" && (
            <Button size="sm" icon={RouteIcon} onClick={() => void reroute(r)} disabled={busy === r.id}>
              {busy === r.id ? "Routing…" : "Route again"}
            </Button>
          )}
          {waitingOf(r).map((w) => (
            <Button key={w.taskId} size="sm" variant="ghost" icon={ArrowRightLeft} onClick={() => setReassign({ row: r, task: w })} aria-label={`Reassign ${w.name ?? "this task"}'s task on ${r.title}`}>
              Reassign{waitingOf(r).length > 1 ? ` ${w.name?.split(" ")[0] ?? ""}` : ""}
            </Button>
          ))}
        </span>
      ),
    },
  ];

  return (
    <div>
      <ApprovalsHeader active="oversight" />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Segmented label="Show requests" value={status} onChange={setStatus} options={OVERSIGHT_TABS} />
        </div>
        <SearchableSelect value={process} onChange={setProcess} options={processes} clearable clearLabel="All processes" placeholder="All processes" aria-label="Process" className="w-full lg:w-64" />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && <p className="mb-5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{notice}</p>}
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      {rows === null ? (
        <Skeleton className="h-[420px]" />
      ) : (
        <>
          {rows.length > 0 && (
            <div className="mb-6 grid gap-6 xl:grid-cols-2">
              <Panel title="By process" subtitle={inFlight ? "On time, overdue, and with nobody to approve" : "Requests in this view"} icon={ClipboardList}>
                <StackedColumns data={chartData} series={series} caption="Requests by process" />
              </Panel>
              {inFlight && (
                <Panel title="Overdue by age" subtitle="How long overdue requests have been waiting since they were sent" icon={AlarmClock} hue="coral">
                  {heat.rows.length > 0 ? (
                    <Heatmap rows={heat.rows} cols={AGE_BUCKETS} cells={heat.cells} hue="coral" caption="Overdue requests by process and age" />
                  ) : (
                    <p className="py-10 text-center text-sm text-neutral-500">Nothing is overdue.</p>
                  )}
                </Panel>
              )}
            </div>
          )}

          <DataView
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey="org.approvals.oversight"
            views={["table", "list"]}
            caption="Requests"
            searchPlaceholder="Search title, reference or person"
            rowHref={(r) => `/suite/approvals?open=${r.id}`}
            empty={
              <Empty
                icon={ClipboardList}
                title={status === "overdue" ? "Nothing is overdue" : status === "needs_routing" ? "Every request has an approver" : "No requests here"}
                hint={status === "open" ? "Requests appear here while they wait for a decision." : undefined}
                hue="mint"
              />
            }
          />
        </>
      )}

      {reassign && (
        <ReassignDialog
          row={reassign.row}
          task={reassign.task}
          onClose={() => setReassign(null)}
          onDone={(name) => {
            setNotice(`“${reassign.row.title}” now waits on ${name}.`);
            setReassign(null);
            setReload((n) => n + 1);
          }}
          confirm={confirm}
        />
      )}
    </div>
  );
}

function ReassignDialog({
  row,
  task,
  onClose,
  onDone,
  confirm,
}: {
  row: OversightRow;
  task: Waiting;
  onClose: () => void;
  onDone: (name: string) => void;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const id = useId();
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const people = useLookup("people");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!userId || reason.trim() === "") return;
    const ok = await confirm({
      title: `Hand ${task.name ?? "this"}'s task to somebody else?`,
      body: `“${row.title}” will wait on the person you chose instead, at the ${task.stage} stage. Your reason goes on the request's record and the new approver is told.`,
      confirmLabel: "Reassign task",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await orgFoundations.approvals.reassign(task.taskId, userId, reason.trim());
      onDone(labelFor(people.options, userId));
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      setError(err instanceof ApiError ? err.message : "The task wasn't reassigned.");
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      titleId={`${id}-title`}
      title="Reassign a waiting task"
      subtitle={`${row.title} · ${task.stage} · now with ${task.name ?? "nobody"}`}
      onClose={onClose}
      as="form"
      onSubmit={submit}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={ArrowRightLeft} disabled={busy}>
            {busy ? "Reassigning…" : "Reassign"}
          </Button>
        </div>
      }
    >
      <div>
        <label htmlFor={`${id}-to`} className={smallLabel}>
          Give it to
        </label>
        <LookupSelect id={`${id}-to`} lookup="people" value={userId} onChange={setUserId} placeholder="Choose a person" invalid={(touched && !userId) || Boolean(errors.userId)} />
        <FieldError message={errors.userId?.[0] ?? (touched && !userId ? "Choose who takes it over." : undefined)} />
      </div>
      <div>
        <label htmlFor={`${id}-reason`} className={smallLabel}>
          Reason (required)
        </label>
        <textarea
          id={`${id}-reason`}
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. On sick leave until the 20th; the deputy is acting."
          aria-invalid={(touched && reason.trim() === "") || Boolean(errors.reason) || undefined}
          className={textareaClass}
        />
        <FieldError message={errors.reason?.[0] ?? (touched && reason.trim() === "" ? "Say why. It goes on the record." : undefined)} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
