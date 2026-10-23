"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlarmClock,
  CalendarClock,
  Check,
  ClipboardList,
  Flag,
  Gauge,
  PauseCircle,
  PenLine,
  Play,
  Star,
  Target,
  Unlock,
} from "lucide-react";
import {
  KpiSeriesChart,
  RatingHistory,
} from "@/suite/hrm/components/console/PerformanceCharts";
import {
  ApiError,
  hrm,
  type EmployeePerformance,
  type PerformanceReview,
  type Task,
  type TaskSummary,
} from "@/lib/api/hrm-client";
import {
  Button,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PriorityChip,
  Progress,
  StatCard,
  StatGrid,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { SegmentedGauge } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";
import {
  DateLeaf,
  ModalFrame,
  Notice,
  PageSkeleton,
  SoftButton,
  ToneChip,
  hintCls,
  labelCls,
  textareaCls,
} from "@/suite/hrm/components/ui2/kit";
import { SectionHead } from "@/suite/hrm/components/ui2/me-kit";
import { formatDate } from "@/suite/hrm/lib/format";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { richExcerpt } from "@/lib/richText";

/**
 * A person's own work: what is assigned to them, how their targets are going,
 * and any review waiting on them.
 *
 * They see the same figures their manager does. A performance system whose
 * numbers only appear at the review produces surprises rather than
 * improvement — and somebody measured against a target should be able to check
 * where they stand against it.
 */
export default function MyWork() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [performance, setPerformance] = useState<EmployeePerformance | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [writing, setWriting] = useState<PerformanceReview | null>(null);
  const [blocking, setBlocking] = useState<Task | null>(null);

  const load = useCallback(
    () =>
      Promise.all([hrm.me.tasks(), hrm.me.performance(), hrm.me.reviews()])
        .then(([taskList, perf, reviewList]) => {
          setTasks(taskList.data);
          setSummary(taskList.meta);
          setPerformance(perf);
          setReviews(reviewList);
          setError(null);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoaded(true)),
    [],
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
      await hrm.me.moveTask(task.id, action);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) {
    return <PageSkeleton />;
  }

  const mine = reviews.filter((r) => r.waitingOn === "employee");
  const attainment = performance?.summary.kpiAttainment ?? null;

  const taskActions = (task: Task) => (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {task.status === "todo" && (
        <Button size="sm" icon={Play} disabled={busy === task.id} onClick={() => void move(task, "start")}>
          Start
        </Button>
      )}
      {task.isBlocked ? (
        <Button size="sm" icon={Unlock} disabled={busy === task.id} onClick={() => void move(task, "unblock")}>
          Unblock
        </Button>
      ) : (
        task.isOpen && (
          <Button size="sm" icon={PauseCircle} disabled={busy === task.id} onClick={() => setBlocking(task)}>
            Stuck
          </Button>
        )
      )}
      {task.isOpen && (
        <SoftButton hue="mint" icon={Check} disabled={busy === task.id} onClick={() => void move(task, "complete")}>
          Done
        </SoftButton>
      )}
    </span>
  );

  const taskFlags = (task: Task) => (
    <span className="flex flex-wrap gap-1.5">
      {task.priority !== "normal" && <PriorityChip priority={task.priorityLabel} />}
      {task.isOverdue && <ToneChip tone="error">{task.daysLate}d late</ToneChip>}
    </span>
  );

  const taskStatus = (task: Task) => (
    <Chip hue={task.isBlocked ? "sun" : task.status === "done" ? "mint" : task.status === "in_progress" ? "blue" : "slate"} dot>
      {task.statusLabel}
    </Chip>
  );

  const columns: Column<Task>[] = [
    {
      key: "title",
      header: "Task",
      primary: true,
      sortable: true,
      value: (t) => t.title,
      render: (t) => (
        <span className="block min-w-[12rem]">
          <span className="block font-semibold text-neutral-900">{t.title}</span>
          {t.blockedReason !== null && (
            <span className="mt-0.5 block text-xs text-sun-700">Blocked: {t.blockedReason}</span>
          )}
        </span>
      ),
    },
    {
      key: "due",
      header: "Due",
      sortable: true,
      value: (t) => t.dueOn ?? "",
      render: (t) => (t.dueOn ? formatDate(t.dueOn) : <span className="text-neutral-400">No date</span>),
    },
    { key: "from", header: "From", sortable: true, value: (t) => t.assignedBy ?? null, hideOnMobile: true },
    { key: "flags", header: "Priority", value: (t) => t.priorityLabel, render: taskFlags },
    { key: "status", header: "Status", sortable: true, value: (t) => t.statusLabel, render: taskStatus },
    { key: "actions", header: "", align: "right", tableOnly: true, render: taskActions },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My employment"
        title="My work"
        subtitle="What is on your plate, how your targets are going, and any review waiting on you"
      />

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      {/* ------------------------ a review waiting ------------------- */}

      {mine.map((review) => (
        <div
          key={review.id}
          className="flex flex-wrap items-center gap-4 rounded-[1.125rem] border border-primary-100 bg-primary-50 p-5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 shadow-sm">
            <PenLine size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-neutral-900">
              {review.cycle?.name ?? "A review"} is waiting on you
            </p>
            <p className="text-sm text-neutral-600">
              You write first, then your manager.
              {review.cycle?.dueOn
                ? ` Due ${formatDate(review.cycle.dueOn)}.`
                : ""}
            </p>
          </div>
          <Button variant="primary" icon={PenLine} onClick={() => setWriting(review)}>
            Write it
          </Button>
        </div>
      ))}

      {/* ----------------------------- my work ---------------------- */}

      {summary !== null && (
        <StatGrid>
          <StatCard featured icon={ClipboardList} label="Open" value={String(summary.open)} hint={`${summary.inProgress} in progress`} />
          <StatCard icon={AlarmClock} hue="rose" label="Overdue" value={String(summary.overdue)} />
          <StatCard icon={CalendarClock} hue="sun" label="Due this week" value={String(summary.dueThisWeek)} />
          <StatCard
            icon={Target}
            hue="sky"
            label="Target attainment"
            value={attainment == null ? "—" : `${attainment}%`}
            hint={
              performance === null
                ? undefined
                : `${performance.summary.kpisMeasured} of ${performance.summary.kpisTotal} measured`
            }
          />
        </StatGrid>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Where you stand" subtitle="Against the targets you are measured on" icon={Gauge} hue="sky">
          {attainment === null ? (
            <Empty icon={Target} hue="sky" title="Nothing measured yet" hint="Once a reading is recorded against one of your targets, it shows here." />
          ) : (
            <SegmentedGauge
              value={Math.min(attainment, 100)}
              display={`${attainment}%`}
              hue={attainment >= 100 ? "mint" : attainment >= 80 ? "sky" : "sun"}
              label="Target attainment"
              caption={
                performance
                  ? `${performance.summary.kpisMeasured} of ${performance.summary.kpisTotal} targets measured`
                  : undefined
              }
            />
          )}

          {/* ------------------------------ progress --------------------- */}
          {summary !== null && summary.completionRate !== null && (
            <div className="mt-6 border-t border-neutral-100 pt-4">
              <Progress value={summary.completionRate} hue="mint" label="Your completion rate" showValue />
              <p className="mt-2 text-xs text-neutral-500">
                {summary.done} finished out of the {summary.done + summary.open} that
                count. Cancelled work is in neither half — dropping something nobody
                wanted any more is not a failure to deliver it.
              </p>
            </div>
          )}
        </Panel>

        <Panel className="xl:col-span-2" title="Your targets" subtitle="Attainment on each, this period" icon={Target} hue="mint">
          {performance === null || performance.kpis.length === 0 ? (
            <Empty icon={Target} hue="mint" title="No targets set" hint="Targets your manager sets for you appear here, with your readings against them." />
          ) : (
            <ul className="space-y-4">
              {performance.kpis.map((kpi) => {
                const hue: Hue =
                  kpi.attainment === null ? "slate" : kpi.attainment >= 100 ? "mint" : kpi.attainment >= 80 ? "sky" : "sun";
                return (
                  <li key={kpi.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{kpi.title}</span>
                        <span className="block truncate text-xs text-neutral-500">
                          {formatDate(kpi.periodStart)} – {formatDate(kpi.periodEnd)} · {kpi.directionLabel}
                        </span>
                      </span>
                      <Chip hue={hue}>{kpi.attainment === null ? "Not measured" : `${kpi.attainment}%`}</Chip>
                    </div>
                    <Progress value={kpi.attainment ?? 0} hue={hue} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <section aria-labelledby="plate-heading">
        <SectionHead id="plate-heading" title="On your plate" subtitle="Most urgent first" />
        {tasks.length === 0 ? (
          <Card>
            <Empty
              icon={ClipboardList}
              title="Nothing assigned"
              hint="Work assigned to you appears here."
            />
          </Card>
        ) : (
          <DataView<Task>
            rows={tasks}
            rowKey={(t) => t.id}
            columns={columns}
            storageKey="hrm.me.work"
            caption="Your tasks"
            searchPlaceholder="Search your tasks"
            renderCard={(t) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  {taskFlags(t)}
                  {taskStatus(t)}
                </div>
                <p className="text-[15px] font-semibold text-neutral-900">{t.title}</p>
                {t.description && <p className="line-clamp-2 text-xs text-neutral-500">{richExcerpt(t.description, 200)}</p>}
                {t.blockedReason !== null && (
                  <p className="rounded-xl bg-sun-50 px-3 py-2 text-xs text-sun-700">Blocked: {t.blockedReason}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <CalendarClock size={13} aria-hidden />
                    {t.dueOn ? `Due ${formatDate(t.dueOn)}` : "No date"}
                    {t.assignedBy ? ` · from ${t.assignedBy}` : ""}
                  </span>
                  {taskActions(t)}
                </div>
              </div>
            )}
            renderListItem={(t) => (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{t.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {t.dueOn ? `Due ${formatDate(t.dueOn)}` : "No date"}
                    {t.assignedBy ? ` · from ${t.assignedBy}` : ""}
                    {t.blockedReason !== null ? ` · Blocked: ${t.blockedReason}` : ""}
                  </p>
                </div>
                {taskFlags(t)}
                {taskStatus(t)}
                {taskActions(t)}
              </div>
            )}
          />
        )}
      </section>

      {/* ---------------------------- my targets --------------------- */}

      {performance !== null && performance.kpis.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {performance.kpis.map((kpi) => (
            <Panel
              key={kpi.id}
              title={kpi.title}
              subtitle={`${formatDate(kpi.periodStart)} – ${formatDate(kpi.periodEnd)} · ${kpi.directionLabel}`}
              icon={Target}
              hue="sky"
              actions={
                <ToneChip
                  tone={
                    kpi.attainment === null
                      ? "neutral"
                      : kpi.attainment >= 100
                        ? "success"
                        : kpi.attainment >= 80
                          ? "info"
                          : "warning"
                  }
                >
                  {kpi.attainment === null ? "Not measured" : `${kpi.attainment}%`}
                </ToneChip>
              }
            >
              <KpiSeriesChart
                data={kpi.series}
                direction={kpi.direction}
                unit={kpi.unit}
                height={160}
                ariaLabel={`${kpi.title}: your readings against the target`}
              />
            </Panel>
          ))}
        </div>
      )}

      {performance !== null && performance.milestones.items.length > 0 && (
        <section aria-labelledby="milestones-heading">
          <SectionHead id="milestones-heading" title="Your milestones" subtitle="What you are working towards, and by when" />
          <DataView
            rows={performance.milestones.items}
            rowKey={(m) => m.id}
            storageKey="hrm.me.milestones"
            caption="Your milestones"
            searchable={false}
            columns={[
              {
                key: "title",
                header: "Milestone",
                primary: true,
                sortable: true,
                value: (m) => m.title,
                render: (m) => (
                  <span className="flex items-center gap-2.5">
                    <Flag size={15} className={m.status === "achieved" ? "text-mint-600" : "text-neutral-400"} aria-hidden />
                    <span className="font-semibold text-neutral-900">{m.title}</span>
                  </span>
                ),
              },
              { key: "due", header: "Due", sortable: true, value: (m) => m.dueOn, render: (m) => `Due ${formatDate(m.dueOn)}` },
              {
                key: "status",
                header: "Status",
                value: (m) => m.statusLabel,
                render: (m) => (
                  <span className="flex flex-wrap gap-1.5">
                    {m.isOverdue && <ToneChip tone="error">Overdue</ToneChip>}
                    <ToneChip tone={m.status === "achieved" ? "success" : "neutral"} dot>
                      {m.statusLabel}
                    </ToneChip>
                  </span>
                ),
              },
            ]}
            renderCard={(m) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <DateLeaf date={m.dueOn} hue={m.status === "achieved" ? "mint" : m.isOverdue ? "rose" : "grape"} />
                  <ToneChip tone={m.status === "achieved" ? "success" : "neutral"} dot>
                    {m.statusLabel}
                  </ToneChip>
                </div>
                <p className="text-[15px] font-semibold text-neutral-900">{m.title}</p>
                <p className="mt-auto text-xs text-neutral-500">Due {formatDate(m.dueOn)}</p>
                {m.isOverdue && <ToneChip tone="error">Overdue</ToneChip>}
              </div>
            )}
          />
        </section>
      )}

      {performance !== null && performance.reviews.length > 0 && (
        <Panel
          title="Your ratings"
          subtitle="What you said, and what your manager said"
          icon={Star}
          hue="grape"
        >
          <RatingHistory reviews={performance.reviews} />
        </Panel>
      )}

      {writing !== null && (
        <SelfReviewDialog
          review={writing}
          onClose={() => setWriting(null)}
          onSaved={() => {
            setWriting(null);
            void load();
          }}
        />
      )}

      {blocking !== null && (
        <BlockDialog
          task={blocking}
          onClose={() => setBlocking(null)}
          onSaved={() => {
            setBlocking(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SelfReviewDialog({
  review,
  onClose,
  onSaved,
}: {
  review: PerformanceReview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState("");
  const [assessment, setAssessment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.me.submitSelf(review.id, {
        selfRating: rating === "" ? undefined : Number(rating),
        selfAssessment: assessment.trim() === "" ? undefined : assessment.trim(),
      });

      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      onClose={onClose}
      onSubmit={submit}
      title="Your own assessment"
      subtitle={review.cycle?.name ?? undefined}
      icon={PenLine}
      footer={<DialogActions busy={busy} onClose={onClose} label="Send to my manager" />}
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      <Notice tone="info">
        You write first. Your manager writes theirs afterwards, and the two are
        kept separate — the difference between them is the part worth talking
        about at the meeting.
      </Notice>

      <label className="block">
        <span className={labelCls}>How you would rate the period</span>
        <SearchableSelect
          value={rating}
          onChange={setRating}
          className="max-w-[12rem]"
          options={[
            { value: "", label: "Rather not say" },
            ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` })),
          ]}
        />
      </label>

      <label className="block">
        <span className={labelCls}>In your own words</span>
        <RichTextEditor minHeight={154} value={assessment} onChange={setAssessment} placeholder="What went well, what did not, and what you would change." />
      </label>
    </ModalFrame>
  );
}

function BlockDialog({
  task,
  onClose,
  onSaved,
}: {
  task: Task;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.me.moveTask(task.id, "block", reason.trim());
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      onClose={onClose}
      onSubmit={submit}
      title="What is holding this up?"
      subtitle={task.title}
      icon={PauseCircle}
      hue="sun"
      footer={<DialogActions busy={busy} onClose={onClose} label="Mark it stuck" />}
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      <label className="block">
        <span className={labelCls}>Blocked on</span>
        {/* Plain text on purpose: kept in a short field and shown as one line on the manager's list. */}
        <textarea
          rows={3}
          required
          maxLength={255}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Waiting on legal to come back on the wording."
          className={textareaCls}
        />
        <span className={hintCls}>
          Required, and it shows on your manager&rsquo;s list — &ldquo;blocked&rdquo;
          with no reason is something nobody can unblock.
        </span>
      </label>
    </ModalFrame>
  );
}

function DialogActions({
  busy,
  onClose,
  label,
}: {
  busy: boolean;
  onClose: () => void;
  label: string;
}) {
  return (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : label}
      </Button>
    </>
  );
}
