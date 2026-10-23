"use client";

import { useCallback, useEffect, useState } from "react";
import { Bug, CalendarClock, CheckCircle2, Inbox, Plus, ShieldAlert } from "lucide-react";
import { Button, Card, Chip, PersonAvatar, Segmented, StatCard, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  findings as findingsApi,
  type FindingSeverity,
  type FindingsSummary,
  type Project,
  type WorkItem,
} from "@/lib/api/projects-client";
import { Notice, StatusChip, TabSkeleton, fmtDate, plural } from "../ui/pkit";
import FindingDialog from "./FindingDialog";
import { SEVERITY_META, SEVERITY_ORDER, SeverityChip, SeverityTiles } from "./testingUi";

type State = "unscheduled" | "scheduled" | "resolved" | "all";

/**
 * The test backlog: every bug on the project, most severe first.
 *
 * A finding is a work item, so opening one opens the ordinary item panel -
 * where the project manager assigns it, dates it, weights it and puts it in
 * a sprint, exactly like a task. Opens on **Unscheduled**: the queue nobody
 * has triaged yet is the part that needs a decision.
 */
export default function TestBacklog({
  project,
  refreshKey,
  onOpenItem,
}: {
  project: Project;
  refreshKey: number;
  onOpenItem: (item: WorkItem) => void;
}) {
  const [state, setState] = useState<State>("unscheduled");
  const [severity, setSeverity] = useState<FindingSeverity | "">("");
  const [rows, setRows] = useState<WorkItem[] | null>(null);
  const [summary, setSummary] = useState<FindingsSummary | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  const fetchPage = useCallback(
    () =>
      findingsApi.list(project.slug, {
        state: state === "all" ? "all" : state,
        severity: severity === "" ? undefined : severity,
      }),
    [project.slug, state, severity],
  );

  const apply = (res: Awaited<ReturnType<typeof findingsApi.list>>) => {
    setRows(res.data);
    setSummary(res.meta.summary);
    setCanManage(res.meta.canManage);
    setError(null);
  };

  const failed = (e: unknown) => setError(e instanceof ApiError ? e.message : "The test backlog did not load.");

  const load = () => fetchPage().then(apply).catch(failed);

  useEffect(() => {
    let live = true;
    fetchPage()
      .then((res) => live && apply(res))
      .catch((e) => live && failed(e));
    return () => {
      live = false;
    };
  }, [fetchPage, refreshKey]);

  if (rows === null || summary === null) {
    return error ? <Notice tone="error">{error}</Notice> : <TabSkeleton stats={4} />;
  }

  const severe = summary.openBySeverity.critical + summary.openBySeverity.high;

  const columns: Column<WorkItem>[] = [
    {
      key: "severity",
      header: "Severity",
      render: (r) => <SeverityChip severity={r.severity} />,
      value: (r) => (r.severity ? SEVERITY_ORDER.indexOf(r.severity) : 9),
      sortable: true,
    },
    {
      key: "title",
      header: "Finding",
      primary: true,
      value: (r) => r.title,
      render: (r) => (
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">{r.title}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {[
              r.findingCategoryLabel,
              r.testCase ? r.testCase.reference : null,
              r.foundIn ? `in ${r.foundIn.title}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Raised from the board"}
          </p>
        </div>
      ),
      sortable: true,
    },
    {
      key: "assignee",
      header: "Assigned to",
      value: (r) => r.assignee?.name ?? "",
      render: (r) =>
        r.assignee ? (
          <span className="flex items-center gap-2">
            <PersonAvatar name={r.assignee.name} size={26} />
            <span className="truncate">{r.assignee.name}</span>
          </span>
        ) : (
          <span className="text-neutral-500">Nobody yet</span>
        ),
      sortable: true,
      hideOnMobile: true,
    },
    {
      key: "weight",
      header: "Weight",
      value: (r) => r.estimatePoints ?? r.estimateHours ?? -1,
      render: (r) =>
        r.estimatePoints === null && r.estimateHours === null ? (
          <span className="text-neutral-500">Not estimated</span>
        ) : (
          <span className="tabular-nums">
            {[r.estimatePoints !== null ? `${r.estimatePoints} pts` : null, r.estimateHours !== null ? `${r.estimateHours}h` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ),
      sortable: true,
      hideOnMobile: true,
    },
    {
      key: "due",
      header: "Due",
      value: (r) => r.dueOn ?? "",
      render: (r) => (r.dueOn ? fmtDate(r.dueOn) : <span className="text-neutral-500">No date</span>),
      sortable: true,
      hideOnMobile: true,
    },
    {
      key: "sprint",
      header: "Sprint",
      value: (r) => r.sprint?.sequence ?? 0,
      render: (r) =>
        r.sprint ? <Chip hue="blue">S{r.sprint.sequence}</Chip> : <Chip hue="slate">Not scheduled</Chip>,
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status?.label ?? "",
      render: (r) => (r.status ? <StatusChip status={r.status} /> : null),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <StatGrid cols={4}>
        <StatCard
          featured
          label="Open findings"
          value={summary.open}
          icon={Bug}
          hint={`${plural(summary.unscheduled, "waits", "wait")} for a sprint`}
        />
        <StatCard
          label="Critical and high"
          value={severe}
          icon={ShieldAlert}
          hue="rose"
          hint={severe === 0 ? "Nothing severe is open" : "Fix before release"}
        />
        <StatCard label="Not scheduled" value={summary.unscheduled} icon={Inbox} hue="sun" hint="Needs an owner and a sprint" />
        <StatCard label="Resolved" value={summary.resolved} icon={CheckCircle2} hue="mint" hint="Done on the board" />
      </StatGrid>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="lg:w-56">
            <p className="text-[15px] font-semibold text-neutral-900">Open by severity</p>
            <p className="text-xs text-neutral-500">Everything not yet done, scheduled or not.</p>
          </div>
          <SeverityTiles
            className="flex-1"
            counts={Object.fromEntries(SEVERITY_ORDER.map((s) => [s, summary.openBySeverity[s]]))}
          />
        </div>
        {summary.openBySeverity.unclassified > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            {plural(summary.openBySeverity.unclassified, "open bug has", "open bugs have")} no severity yet. Open it to
            classify it.
          </p>
        )}
      </Card>

      {error !== null && <Notice tone="error">{error}</Notice>}

      <DataView
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        storageKey="projects-test-backlog"
        views={["table", "list"]}
        onRowClick={onOpenItem}
        caption="Findings in the test backlog"
        searchPlaceholder="Search findings"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<State>
              label="Which findings"
              value={state}
              onChange={setState}
              options={[
                { key: "unscheduled", label: "Unscheduled" },
                { key: "scheduled", label: "In a sprint" },
                { key: "resolved", label: "Resolved" },
                { key: "all", label: "All" },
              ]}
            />
            <SearchableSelect
              aria-label="Severity"
              size="sm"
              className="w-44"
              value={severity}
              onChange={(v) => setSeverity(v as FindingSeverity | "")}
              options={[
                { value: "", label: "Any severity" },
                ...SEVERITY_ORDER.map((s) => ({ value: s, label: SEVERITY_META[s].label })),
              ]}
            />
            {canManage && (
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setReporting(true)}>
                Report a finding
              </Button>
            )}
          </div>
        }
        empty={
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <CalendarClock size={22} className="text-neutral-400" aria-hidden />
            <p className="text-[15px] font-semibold text-neutral-900">
              {state === "unscheduled" ? "Nothing waiting for a sprint" : "No findings here"}
            </p>
            <p className="max-w-sm text-sm text-neutral-500">
              Findings come from failed test runs and from testers reporting what they find. Open one to assign it,
              date it, weight it and put it in a sprint.
            </p>
          </div>
        }
      />

      {reporting && (
        <FindingDialog
          project={project}
          onClose={() => setReporting(false)}
          onRaised={() => {
            setReporting(false);
            setState("unscheduled");
            void load();
          }}
        />
      )}
    </div>
  );
}
