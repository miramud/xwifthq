"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Hourglass,
  MessagesSquare,
  PenLine,
  Plus,
  UserRound,
} from "lucide-react";
import {
  ApiError,
  hrm,
  type PerformanceReview,
  type ReviewCycle,
} from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  UnderlineTabs,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import {
  ModalFrame,
  Notice,
  PersonCell,
  SoftButton,
  StackBar,
  inputCls,
  labelCls,
  hintCls,
} from "../ui2/kit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * Appraisal rounds, and whose turn each review is.
 *
 * The whole screen is organised around that last question, because it is the
 * one that decides who gets chased. A round that is "60% done" tells nobody
 * anything; eleven waiting on the employee and two waiting on you are two
 * different mornings.
 */

type Filter = "all" | "manager" | "meeting" | "employee";

const WAITING_HUE: Record<string, Hue> = { manager: "sun", meeting: "mint", employee: "sky" };

const smallBtn =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-3 text-[13px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary = cx(smallBtn, "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50");
const btnDanger = cx(smallBtn, "text-error-700 hover:bg-error-500/10");

export default function ReviewsBoard() {
  const [cycles, setCycles] = useState<ReviewCycle[] | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    awaitingSelf: 0,
    awaitingManager: 0,
    awaitingMeeting: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [writing, setWriting] = useState<PerformanceReview | null>(null);
  const [cancelling, setCancelling] = useState<PerformanceReview | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(
    () =>
      Promise.all([hrm.reviews.cycles(), hrm.reviews.list()])
        .then(([cycleList, reviewList]) => {
          setCycles(cycleList);
          setReviews(reviewList.data);
          setCounts(reviewList.meta);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
      await load();
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const sorted = useMemo(() => [...reviews].sort((a, b) => order(a) - order(b)), [reviews]);
  const shown = filter === "all" ? sorted : sorted.filter((r) => r.waitingOn === filter);

  /* ------------------------------ rounds ------------------------------ */

  const cycleActions = (cycle: ReviewCycle) => (
    <div className="flex shrink-0 gap-1.5">
      {cycle.status !== "closed" && (
        <button
          type="button"
          disabled={busy === cycle.id}
          onClick={() => run(cycle.id, () => hrm.reviews.openCycle(cycle.id))}
          className={btnSecondary}
        >
          {cycle.status === "planned" ? "Open" : "Top up"}
        </button>
      )}
      {cycle.status === "open" && (
        <button
          type="button"
          disabled={busy === cycle.id}
          onClick={() => run(cycle.id, () => hrm.reviews.closeCycle(cycle.id))}
          className={btnSecondary}
        >
          Close
        </button>
      )}
    </div>
  );

  const cycleStatus = (cycle: ReviewCycle) => (
    <span className="flex flex-wrap items-center gap-1.5">
      {cycle.isOverdue && <Chip hue="rose">Paperwork overdue</Chip>}
      <Chip dot hue={cycle.status === "open" ? "mint" : cycle.status === "planned" ? "slate" : "sky"}>
        {cycle.statusLabel}
      </Chip>
    </span>
  );

  const cycleProgress = (cycle: ReviewCycle) =>
    cycle.progress ? (
      <StackBar
        label={`${cycle.name} progress`}
        total={cycle.progress.total}
        parts={[
          { label: "Complete", value: cycle.progress.complete, hue: "mint" },
          { label: "To discuss", value: cycle.progress.awaitingMeeting, hue: "grape" },
          { label: "On you", value: cycle.progress.awaitingManager, hue: "sun" },
          { label: "On them", value: cycle.progress.awaitingSelf, hue: "sky" },
        ]}
      />
    ) : (
      <p className="text-xs text-neutral-500">Not opened yet</p>
    );

  const cycleColumns: Column<ReviewCycle>[] = [
    {
      key: "name",
      header: "Round",
      primary: true,
      sortable: true,
      value: (c) => c.name,
      render: (c) => (
        <span className="flex items-center gap-3">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[hueFor(c.name)].soft)}>
            <CalendarRange size={16} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{c.name}</span>
            <span className="block truncate text-xs text-neutral-500">
              {formatDate(c.periodStart)} to {formatDate(c.periodEnd)}
            </span>
          </span>
        </span>
      ),
    },
    { key: "due", header: "Due", sortable: true, value: (c) => c.dueOn, render: (c) => (c.dueOn ? formatDate(c.dueOn) : "-") },
    {
      key: "progress",
      header: "Complete",
      sortable: true,
      value: (c) => (c.progress && c.progress.total > 0 ? c.progress.complete / c.progress.total : null),
      render: (c) =>
        c.progress ? (
          <span className="tabular-nums">
            {c.progress.complete} of {c.progress.total} complete
          </span>
        ) : (
          "-"
        ),
      hideOnMobile: true,
    },
    { key: "status", header: "Status", value: (c) => c.statusLabel, render: cycleStatus },
    { key: "actions", header: "", align: "right", tableOnly: true, render: cycleActions },
  ];

  /* ------------------------------ reviews ----------------------------- */

  const reviewActions = (review: PerformanceReview) => (
    <div className="flex shrink-0 flex-nowrap justify-end gap-1.5">
      {review.waitingOn === "manager" && (
        <SoftButton hue="blue" icon={PenLine} onClick={() => setWriting(review)}>
          Write it
        </SoftButton>
      )}
      {review.waitingOn === "meeting" && (
        <SoftButton
          hue="mint"
          disabled={busy === review.id}
          onClick={() => run(review.id, () => hrm.reviews.complete(review.id))}
        >
          Sign off
        </SoftButton>
      )}
      {review.waitingOn !== "employee" && (
        <button
          type="button"
          disabled={busy === review.id}
          onClick={() => run(review.id, () => hrm.reviews.reopen(review.id))}
          className={btnSecondary}
        >
          Send back
        </button>
      )}
      {/*
        Only on an open review. The API refuses to cancel a
        completed one — its score has been discussed — and
        offering a button that will be refused is how somebody
        learns the rule from an error message.
      */}
      {review.isOpen && (
        <button
          type="button"
          disabled={busy === review.id}
          onClick={() => setCancelling(review)}
          className={btnDanger}
        >
          Abandon
        </button>
      )}
    </div>
  );

  const reviewStatus = (review: PerformanceReview) => (
    <span className="flex flex-wrap items-center gap-1.5">
      {review.gap !== null && Math.abs(review.gap) >= 2 && (
        <Chip hue="coral">
          {review.gap > 0 ? "+" : ""}
          {review.gap} gap
        </Chip>
      )}
      <Chip dot hue={WAITING_HUE[review.waitingOn ?? ""] ?? "slate"}>{review.statusLabel}</Chip>
    </span>
  );

  const person = (review: PerformanceReview) => (
    <PersonCell
      name={review.employee?.name ?? "Unnamed"}
      sub={review.employee?.jobTitle}
      href={`/suite/hrm/people/${review.employeeId}`}
    />
  );

  const rating = (label: string, value: number | null) => (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900">{value === null ? "-" : `${value}/5`}</p>
    </div>
  );

  const reviewColumns: Column<PerformanceReview>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.employee?.name ?? "",
      render: person,
    },
    {
      key: "round",
      header: "Round",
      sortable: true,
      value: (r) => r.cycle?.name ?? "-",
      render: (r) => <span className="block max-w-[180px] truncate">{r.cycle?.name ?? "-"}</span>,
      hideOnMobile: true,
    },
    { key: "department", header: "Department", sortable: true, value: (r) => r.employee?.department ?? null, hideOnMobile: true },
    {
      key: "ratings",
      header: "Self · manager",
      value: (r) => r.managerRating ?? r.selfRating ?? null,
      render: (r) => (
        <span className="tabular-nums">
          {r.selfRating ?? "-"} · {r.managerRating ?? "-"}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "status", header: "Whose turn", sortable: true, value: (r) => order(r), render: reviewStatus },
    { key: "actions", header: "", align: "right", tableOnly: true, render: reviewActions },
  ];

  const tabs = [
    { key: "all", label: "All outstanding", count: reviews.length },
    { key: "manager", label: "Waiting on you", count: counts.awaitingManager },
    { key: "meeting", label: "Ready to discuss", count: counts.awaitingMeeting },
    { key: "employee", label: "Waiting on them", count: counts.awaitingSelf },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        subtitle="Appraisal rounds, and whose turn each review is."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New round
          </Button>
        }
      />

      {error !== null && <Notice tone="error" role="alert">{error}</Notice>}

      <StatGrid>
        <StatCard
          featured
          icon={ClipboardList}
          label="Outstanding"
          value={String(reviews.length)}
          hint="Across every open round"
        />
        <StatCard
          icon={UserRound}
          hue="sky"
          label="Waiting on them"
          value={String(counts.awaitingSelf)}
          hint="Self-assessment outstanding"
        />
        <StatCard
          icon={PenLine}
          hue="sun"
          label="Waiting on you"
          value={String(counts.awaitingManager)}
          hint="Manager's half outstanding"
        />
        <StatCard
          icon={MessagesSquare}
          hue="mint"
          label="Ready to discuss"
          value={String(counts.awaitingMeeting)}
          hint="Both halves in"
        />
      </StatGrid>

      {/* ----------------------------- cycles ------------------------ */}

      <Panel
        title="Rounds"
        subtitle="The period being reviewed, not the window the paperwork is written in"
        icon={CalendarRange}
        hue="grape"
      >
        {cycles === null ? (
          <div className="h-32 animate-pulse rounded-xl bg-neutral-50" />
        ) : (
          <DataView
            rows={cycles}
            columns={cycleColumns}
            rowKey={(c) => c.id}
            storageKey="hrm.reviews.rounds"
            caption="Review rounds"
            searchPlaceholder="Search rounds"
            empty={
              <Empty
                icon={ClipboardCheck}
                title="No rounds yet"
                hint="A round raises one review per person and tracks whose turn each is."
              />
            }
            renderCard={(c) => (
              <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[hueFor(c.name)].soft)}>
                    <CalendarRange size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-neutral-900">{c.name}</p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(c.periodStart)} to {formatDate(c.periodEnd)}
                    </p>
                  </div>
                </div>
                {cycleStatus(c)}
                {cycleProgress(c)}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                    <Hourglass size={13} aria-hidden />
                    {c.dueOn ? `Due ${formatDate(c.dueOn)}` : "No due date"}
                  </span>
                  {cycleActions(c)}
                </div>
              </div>
            )}
            renderListItem={(c) => (
              <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{c.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {formatDate(c.periodStart)} to {formatDate(c.periodEnd)}
                    {c.dueOn ? ` · due ${formatDate(c.dueOn)}` : ""}
                    {c.progress ? ` · ${c.progress.complete} of ${c.progress.total} complete` : ""}
                  </p>
                </div>
                {cycleStatus(c)}
                {cycleActions(c)}
              </div>
            )}
          />
        )}
      </Panel>

      {/* ---------------------------- reviews ------------------------ */}

      <section>
        <div className="mb-1">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">{reviews.length} outstanding</h2>
          <p className="text-sm text-neutral-500">Waiting on you first: those are the ones you can act on</p>
        </div>
        <UnderlineTabs tabs={tabs} active={filter} onChange={(k) => setFilter(k as Filter)} className="mb-5" />
        <DataView
          rows={shown}
          columns={reviewColumns}
          rowKey={(r) => r.id}
          storageKey="hrm.reviews.outstanding"
          caption="Outstanding reviews"
          searchPlaceholder="Search people or rounds"
          empty={
            <Empty
              icon={ClipboardCheck}
              title="Nothing outstanding"
              hint="Open a round to raise reviews for everybody."
            />
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                {person(r)}
              </div>
              {reviewStatus(r)}
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-neutral-50 p-3">
                {rating("Self", r.selfRating)}
                {rating("Manager", r.managerRating)}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">KPIs</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900">
                    {r.kpiAttainment === null ? "-" : `${r.kpiAttainment}%`}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-col gap-3 border-t border-neutral-100 pt-3">
                <p className="truncate text-xs text-neutral-500">{r.cycle?.name ?? "-"}</p>
                {reviewActions(r)}
              </div>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">{person(r)}</div>
              <span className="hidden truncate text-xs text-neutral-500 md:inline">{r.cycle?.name ?? "-"}</span>
              {reviewStatus(r)}
              {reviewActions(r)}
            </div>
          )}
        />
      </section>

      {creating && (
        <CycleDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {writing !== null && (
        <ManagerReviewDialog
          review={writing}
          onClose={() => setWriting(null)}
          onSaved={() => {
            setWriting(null);
            void load();
          }}
        />
      )}

      {cancelling !== null && (
        <CancelReviewDialog
          review={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => {
            setCancelling(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/** Waiting on you first, then ready to discuss, then waiting on them. */
function order(review: PerformanceReview): number {
  switch (review.waitingOn) {
    case "manager":
      return 0;
    case "meeting":
      return 1;
    default:
      return 2;
  }
}

/* ------------------------------------------------------------------ */

function CycleDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.reviews.createCycle({
        name: name.trim(),
        periodStart,
        periodEnd,
        dueOn: dueOn === "" ? undefined : dueOn,
        status: "planned",
      });

      onCreated();
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
      title="New round"
      icon={CalendarRange}
      hue="grape"
      footer={<Actions busy={busy} onClose={onClose} label="Create round" />}
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      <label className="block">
        <span className={labelCls}>Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Q3 review"
          className={inputCls}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Period from</span>
          <input
            type="date"
            required
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Period to</span>
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Paperwork due</span>
          <input
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <p className="text-xs text-neutral-500">
        The period is what is being reviewed. A Q3 round held in October covers
        July to September, and the KPIs pulled into each review are the ones that
        overlap it.
      </p>
    </ModalFrame>
  );
}

/** What the manager half sends. HR's call by default; My team (S9) passes its own. */
export type SubmitManagerHalf = (
  id: string,
  input: {
    managerRating?: number;
    managerComments?: string;
    strengths?: string;
    development?: string;
    objectives?: string;
  },
) => Promise<unknown>;

export function ManagerReviewDialog({
  review,
  onClose,
  onSaved,
  submitHalf = (id, input) => hrm.reviews.submitManager(id, input),
}: {
  review: PerformanceReview;
  onClose: () => void;
  onSaved: () => void;
  submitHalf?: SubmitManagerHalf;
}) {
  const [rating, setRating] = useState("");
  const [comments, setComments] = useState("");
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");
  const [objectives, setObjectives] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await submitHalf(review.id, {
        managerRating: rating === "" ? undefined : Number(rating),
        managerComments: comments.trim() === "" ? undefined : comments.trim(),
        strengths: strengths.trim() === "" ? undefined : strengths.trim(),
        development: development.trim() === "" ? undefined : development.trim(),
        objectives: objectives.trim() === "" ? undefined : objectives.trim(),
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
      title={review.employee?.name ?? "Review"}
      subtitle={review.cycle?.name}
      icon={PenLine}
      hue="sun"
      wide
      footer={<Actions busy={busy} onClose={onClose} label="Save my half" />}
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      {/*
        Their words first, above the form. A manager writing without the
        self-assessment in front of them is the situation the whole sequence
        exists to prevent.
      */}
      <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
        <p className="text-xs font-semibold text-sky-700">
          What they said
          {review.selfRating !== null && (
            <span className="ml-2 font-normal text-neutral-600">
              rated themselves {review.selfRating}/5
            </span>
          )}
        </p>
        {review.selfAssessment ? (
          <RichTextView value={review.selfAssessment} size="sm" className="mt-1.5 text-neutral-700" />
        ) : (
          <p className="mt-1.5 text-sm text-neutral-700">They left the assessment blank.</p>
        )}
      </div>

      <label className="block">
        <span className={labelCls}>Your rating</span>
        <SearchableSelect
          value={rating}
          onChange={setRating}
          className="max-w-[10rem]"
          options={[
            { value: "", label: "Not rated" },
            ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` })),
          ]}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Your comments</span>
        <RichTextEditor minHeight={102} value={comments} onChange={setComments} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Strengths</span>
          <RichTextEditor minHeight={76} value={strengths} onChange={setStrengths} />
        </label>

        <label className="block">
          <span className={labelCls}>Where to develop</span>
          <RichTextEditor minHeight={76} value={development} onChange={setDevelopment} />
        </label>
      </div>

      <label className="block">
        <span className={labelCls}>Objectives for next period</span>
        <RichTextEditor minHeight={76} value={objectives} onChange={setObjectives} />
      </label>

      <p className="text-xs text-neutral-500">
        This does not close the review. It moves to &ldquo;ready to
        discuss&rdquo;, and you sign it off after the conversation, which is
        when the scores are frozen.
      </p>
    </ModalFrame>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Abandoning a review.
 *
 * `POST /hrm/reviews/{review}/cancel` had no caller, which left a manager with
 * an appraisal for somebody who resigned in week two sitting in the round
 * forever, counted as outstanding and chased every time the list is read.
 *
 * Two things it insists on.
 *
 * **It is not "delete".** The review stays; it stops counting and stops being
 * chased. The wording says so, because a manager who thinks this erases a
 * half-written self-assessment will not use it and will leave the row there.
 *
 * **The reason is asked for and kept.** It goes to the audit log, and it is
 * the only thing that distinguishes "she left" from "I did not get round to
 * it" when the round is looked at a year later.
 */
function CancelReviewDialog({
  review,
  onClose,
  onCancelled,
}: {
  review: PerformanceReview;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await hrm.reviews.cancel(review.id, reason.trim() === "" ? undefined : reason.trim());
      onCancelled();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="Abandon this review"
      subtitle={`${review.employee?.name ?? "This person"} · ${review.cycle?.name ?? "this round"}`}
      icon={ClipboardCheck}
      hue="rose"
      onClose={onClose}
      onSubmit={submit}
      footer={<Actions busy={busy} onClose={onClose} label="Abandon it" />}
    >
      <Notice tone="info">
        Nothing already written is deleted. The review stops counting towards
        this round and stops appearing as outstanding. Use it for somebody who has
        left, or a round that was dropped.
      </Notice>

      {error !== null && <Notice tone="error">{error}</Notice>}

      <div>
        <label htmlFor="cancel-reason" className={labelCls}>
          Why
        </label>
        <RichTextEditor id="cancel-reason" minHeight={102} value={reason} onChange={setReason} placeholder="e.g. Resigned in October, last day before the meeting" describedBy="cancel-reason-hint" />
        <p id="cancel-reason-hint" className={hintCls}>
          Kept in the audit log. A year from now this is the only thing that
          separates &ldquo;she left&rdquo; from &ldquo;nobody got round to it&rdquo;.
        </p>
      </div>
    </ModalFrame>
  );
}

function Actions({
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
