"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck, CalendarClock, Gavel, UserRound, UserX } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Empty,
  PageHeader,
  PersonAvatar,
  StatCard,
  StatGrid,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  hrm,
  type ProbationOutcome,
  type ProbationReview,
} from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";
import { PersonCell, ToneChip } from "../ui/recordKit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Probation reviews that are outstanding, and the decision.
 *
 * The overdue ones are listed first and labelled as overdue rather than mixed
 * into a date-sorted list — a review missed last quarter is a different problem
 * from one due next week, and the whole reason this screen exists is that the
 * first kind is easy to stop noticing.
 *
 * `Pending` is not offered as an outcome. It is where a review starts, not a
 * decision anybody can make.
 */

type Decision = Exclude<ProbationOutcome, "pending">;

const DECISIONS: { value: Decision; label: string; hint: string }[] = [
  {
    value: "confirmed",
    label: "Confirm",
    hint: "Passed. They become active and probation ends.",
  },
  {
    value: "extended",
    label: "Extend",
    hint: "Not decided either way. Needs a new date; the next review is raised automatically.",
  },
  {
    value: "exited",
    label: "Exit",
    hint: "Failed. Employment and the agreement both end.",
  },
];

export default function ProbationBoard() {
  const [reviews, setReviews] = useState<ProbationReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<ProbationReview | null>(null);
  // When the list was fetched, so "due within 14 days" is measured from a
  // fixed moment rather than from whenever React happens to re-render.
  const [asAt, setAsAt] = useState(0);

  const load = useCallback(
    () =>
      hrm.probation
        .due(60)
        .then((res) => {
          setReviews(res.data);
          setAsAt(Date.now());
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const overdue = (reviews ?? []).filter((r) => r.isOverdue);
  const upcoming = (reviews ?? []).filter((r) => !r.isOverdue);
  const within14 = upcoming.filter((r) => {
    if (!r.dueOn) return false;
    const days = (new Date(r.dueOn).getTime() - asAt) / 86_400_000;
    return days <= 14;
  }).length;
  const noReviewer = (reviews ?? []).filter((r) => !r.reviewer).length;

  return (
    <div>
      <PageHeader
        title="Probation"
        subtitle="Reviews that are outstanding, overdue first, and the decision on each."
      />

      {error !== null && (
        <p role="alert" className="mb-4 rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
          {error}
        </p>
      )}

      {reviews === null ? (
        <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
      ) : reviews.length === 0 ? (
        <Card>
          <Empty
            icon={CalendarClock}
            hue="mint"
            title="Nothing due in the next 60 days"
            hint="No probation review falls due, or is overdue, in the next 60 days. Reviews due later are on each person's record."
          />
        </Card>
      ) : (
        <div className="space-y-8">
          <StatGrid>
            <StatCard icon={CalendarClock} hue="blue" label="Outstanding" value={reviews.length} hint="Raised and not decided" />
            <StatCard
              icon={AlertTriangle}
              hue={overdue.length > 0 ? "coral" : "mint"}
              label="Overdue"
              value={overdue.length}
              hint="Past the date they were due"
            />
            <StatCard icon={CalendarCheck} hue="sun" label="Due within 14 days" value={within14} hint="Worth diarising now" />
            <StatCard icon={UserX} hue="grape" label="No reviewer set" value={noReviewer} hint="Nobody named to hold it" />
          </StatGrid>

          {overdue.length > 0 && (
            <section aria-labelledby="probation-overdue">
              <SectionHeading
                id="probation-overdue"
                title="Overdue"
                subtitle={`${overdue.length} review${overdue.length === 1 ? "" : "s"} past the date they were due`}
                tone="error"
              />
              <ReviewList rows={overdue} onDecide={setDeciding} storageKey="hrm.probation.overdue" />
            </section>
          )}

          <section aria-labelledby="probation-upcoming">
            <SectionHeading id="probation-upcoming" title="Coming up" subtitle="Next 60 days" />
            <ReviewList
              rows={upcoming}
              onDecide={setDeciding}
              storageKey="hrm.probation.upcoming"
              empty={
                <Empty
                  icon={CalendarClock}
                  hue="sky"
                  title="Nothing in the next 60 days"
                  hint="Anything overdue is listed above."
                />
              }
            />
          </section>
        </div>
      )}

      {deciding !== null && (
        <DecideDialog
          review={deciding}
          onClose={() => setDeciding(null)}
          onDecided={() => {
            setDeciding(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionHeading({
  id,
  title,
  subtitle,
  tone,
}: {
  id: string;
  title: string;
  subtitle: string;
  tone?: "error";
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span
        className={
          tone === "error"
            ? "flex h-9 w-9 items-center justify-center rounded-xl bg-coral-50 text-coral-700"
            : "flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700"
        }
      >
        {tone === "error" ? <AlertTriangle size={18} aria-hidden /> : <CalendarClock size={18} aria-hidden />}
      </span>
      <div>
        <h2 id={id} className="text-lg font-bold tracking-tight text-neutral-900">
          {title}
        </h2>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>
    </div>
  );
}

function ReviewList({
  rows,
  onDecide,
  storageKey,
  empty,
}: {
  rows: ProbationReview[];
  onDecide: (review: ProbationReview) => void;
  storageKey: string;
  empty?: React.ReactNode;
}) {
  const decide = (review: ProbationReview) => (
    <Button variant="primary" size="sm" icon={Gavel} onClick={() => onDecide(review)}>
      Decide
    </Button>
  );

  const late = (review: ProbationReview) =>
    review.isOverdue ? (
      <ToneChip tone="error">
        {review.daysLate} day{review.daysLate === 1 ? "" : "s"} overdue
      </ToneChip>
    ) : (
      <ToneChip tone="info">Due {formatDate(review.dueOn)}</ToneChip>
    );

  const sub = (review: ProbationReview) =>
    `${review.employee?.jobTitle ?? "-"}${review.employee?.department ? ` · ${review.employee.department}` : ""}`;

  const columns: Column<ProbationReview>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.employee?.name ?? "",
      render: (r) => (
        <PersonCell name={r.employee?.name ?? "Unnamed"} sub={sub(r)} href={`/suite/hrm/people/${r.employeeId}`} />
      ),
    },
    {
      key: "due",
      header: "Due",
      sortable: true,
      value: (r) => r.dueOn ?? "",
      render: (r) => <span className="whitespace-nowrap tabular-nums">{formatDate(r.dueOn)}</span>,
    },
    { key: "state", header: "Status", render: (r) => late(r) },
    {
      key: "reviewer",
      header: "Reviewer",
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.reviewer?.name ?? "",
      render: (r) =>
        r.reviewer ? (
          <span className="flex items-center gap-2">
            <PersonAvatar name={r.reviewer.name} size={26} />
            <span className="truncate">{r.reviewer.name}</span>
          </span>
        ) : (
          <span className="text-neutral-500">No reviewer set</span>
        ),
    },
    { key: "decide", header: "", tableOnly: true, align: "right", render: (r) => decide(r) },
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      storageKey={storageKey}
      caption="Probation reviews"
      searchPlaceholder="Search people"
      empty={empty}
      renderCard={(r) => (
        <div className="flex h-full flex-col gap-4 p-5">
          <PersonCell
            name={r.employee?.name ?? "Unnamed"}
            sub={sub(r)}
            href={`/suite/hrm/people/${r.employeeId}`}
            size={44}
          />
          <div className="flex flex-wrap gap-1.5">
            {late(r)}
            <Chip hue="slate" icon={UserRound}>
              {r.reviewer?.name ?? "No reviewer set"}
            </Chip>
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="text-xs text-neutral-500">Due {formatDate(r.dueOn)}</span>
            {decide(r)}
          </div>
        </div>
      )}
      renderListItem={(r) => (
        <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <PersonCell name={r.employee?.name ?? "Unnamed"} sub={`${sub(r)} · due ${formatDate(r.dueOn)}`} href={`/suite/hrm/people/${r.employeeId}`} />
          </div>
          {late(r)}
          <span className="hidden text-xs text-neutral-500 sm:block">{r.reviewer?.name ?? "No reviewer set"}</span>
          {decide(r)}
        </div>
      )}
    />
  );
}

function DecideDialog({
  review,
  onClose,
  onDecided,
}: {
  review: ProbationReview;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [outcome, setOutcome] = useState<Decision>("confirmed");
  const [extendedTo, setExtendedTo] = useState("");
  const [rating, setRating] = useState("");
  const [summary, setSummary] = useState("");
  const [objectives, setObjectives] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.probation.decide(review.id, {
        outcome,
        extendedTo: outcome === "extended" ? extendedTo : undefined,
        // Left out rather than sent as a default. An absent rating has to read
        // as absent, never as an invented three.
        rating: rating === "" ? undefined : Number(rating),
        summary: summary.trim() === "" ? undefined : summary.trim(),
        objectives: objectives.trim() === "" ? undefined : objectives.trim(),
      });

      onDecided();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm"
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-[1.25rem] bg-white p-5 shadow-2xl shadow-neutral-900/10 sm:p-6"
      >
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">
          {review.employee?.name ?? "Probation review"}
        </h2>
        <p className="text-xs text-neutral-500">
          Due {formatDate(review.dueOn)}
          {review.isOverdue ? ` · ${review.daysLate} days overdue` : ""}
        </p>

        {error !== null && (
          <p role="alert" className="mt-4 rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
            {error}
          </p>
        )}

        <fieldset className="mt-5 space-y-2">
          <legend className="mb-1.5 text-xs font-semibold text-neutral-700">
            Outcome
          </legend>
          {DECISIONS.map((decision) => (
            <label
              key={decision.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                outcome === decision.value
                  ? "border-primary-400 bg-primary-50 ring-4 ring-primary-100"
                  : "border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <input
                type="radio"
                name="outcome"
                value={decision.value}
                checked={outcome === decision.value}
                onChange={() => setOutcome(decision.value)}
                className="mt-0.5 accent-primary-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-900">
                  {decision.label}
                </span>
                <span className="block text-xs text-neutral-500">
                  {decision.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {outcome === "extended" && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              Extended to
            </span>
            <input
              type="date"
              required
              value={extendedTo}
              onChange={(e) => setExtendedTo(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Has to be later than {formatDate(review.dueOn)}. The next review is
              raised against this date automatically.
            </span>
          </label>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Rating (optional)
          </span>
          <SearchableSelect
            value={rating}
            onChange={setRating}
            options={[
              { value: "", label: "Not rated" },
              ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` })),
            ]}
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            What was said
          </span>
          <RichTextEditor minHeight={102} value={summary} onChange={setSummary} />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            What happens next
          </span>
          <RichTextEditor minHeight={76} value={objectives} onChange={setObjectives} />
        </label>

        <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Recording…" : "Record the decision"}
          </button>
        </div>
      </form>
    </div>
  );
}
