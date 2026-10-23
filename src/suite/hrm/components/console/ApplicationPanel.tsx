"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  FileText,
  History,
  MessageSquare,
  X,
} from "lucide-react";
import { Empty, buttonClass, cx } from "@/components/workspace/kit";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { InitialsAvatar, ToneChip } from "../ui/recordKit";
import { INPUT } from "./Dialog";
import {
  ApiError,
  hrm,
  type Employee,
  type Interview,
  type InterviewKind,
  type InterviewScorecard,
  type JobApplication,
  type JobOffer,
  type PipelineStage,
  type StageEvent,
} from "@/lib/api/hrm-client";
import {
  applicationTone,
  formatDate,
  nairaFromKobo,
  offerTone,
  verdictTone,
} from "@/suite/hrm/lib/format";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

/**
 * One candidacy, and everything anybody does to it.
 *
 * A drawer rather than a page because a recruiter works a board: they open
 * somebody, move them, and go back to the column. A full navigation for each
 * card would make working twenty candidates twenty round trips.
 *
 * The actions here are the ones that were built in tranche 5 and had no way to
 * be reached — moving stage, rejecting, scheduling an interview, reading the
 * panel, and the whole offer lifecycle.
 */
export default function ApplicationPanel({
  applicationId,
  stages,
  colleagues,
  onClose,
  onChanged,
}: {
  applicationId: string;
  stages: PipelineStage[];
  colleagues: Employee[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [history, setHistory] = useState<StageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [offering, setOffering] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(
    () =>
      hrm.recruitment
        .application(applicationId)
        .then((res) => {
          setApplication(res.data);
          setHistory(res.meta.history);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [applicationId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (stageId: string) => {
    setBusy(true);

    try {
      await hrm.recruitment.moveApplication(applicationId, {
        action: "move",
        stageId,
      });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);

    try {
      await hrm.recruitment.moveApplication(applicationId, { action: "withdraw" });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Candidate"
        className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl shadow-neutral-900/20 sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-[1.25rem]"
      >
        <header className="flex items-start gap-3 border-b border-neutral-100 bg-gradient-to-br from-primary-50 via-white to-grape-50 px-5 py-5">
          {application !== null && (
            <InitialsAvatar name={application.candidate?.name ?? "Candidate"} size={48} />
          )}
          <div className="min-w-0 flex-1">
            {application === null ? (
              <div className="h-5 w-40 animate-pulse rounded bg-neutral-100" />
            ) : (
              <>
                <Link
                  href={`/suite/hrm/recruitment/candidates/${application.candidateId}`}
                  className="block truncate text-lg font-bold tracking-tight text-neutral-900 hover:text-primary-700"
                >
                  {application.candidate?.name ?? "Candidate"}
                </Link>
                <p className="truncate text-xs text-neutral-500">
                  {application.candidate?.currentTitle ?? "—"}
                  {" · "}
                  {application.sourceLabel}
                  {" · applied "}
                  {formatDate(application.appliedAt)}
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-white hover:text-neutral-800"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        {error !== null && (
          <p role="alert" className="m-5 rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
            {error}
          </p>
        )}

        {application === null ? (
          <div className="m-5 h-64 animate-pulse rounded-xl bg-neutral-50" />
        ) : (
          <div className="flex-1 space-y-5 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <ToneChip tone={applicationTone(application.status)}>
                {application.statusLabel}
              </ToneChip>
              {application.stage !== null && application.stage !== undefined && (
                <ToneChip tone="primary">{application.stage.name}</ToneChip>
              )}
              {application.isStale && (
                <ToneChip tone="warning">
                  {application.daysInStage} days here
                </ToneChip>
              )}
            </div>

            {application.coverNote !== null && (
              <p className="whitespace-pre-line rounded-2xl bg-sky-50/70 px-4 py-3 text-sm text-neutral-700">
                {application.coverNote}
              </p>
            )}

            {/* Moving on, or stopping. Both are one click from the same place. */}
            {application.isOpen && (
              <section>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Move to
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {stages
                    .filter(
                      (stage) =>
                        !stage.isTerminal && stage.id !== application.stageId,
                    )
                    .map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => void move(stage.id)}
                        disabled={busy}
                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50"
                      >
                        <ArrowRight size={13} aria-hidden />
                        {stage.name}
                      </button>
                    ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduling(true)}
                    className={buttonClass("secondary", "sm")}
                  >
                    <CalendarPlus size={15} aria-hidden />
                    Arrange interview
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffering(true)}
                    className={buttonClass("primary", "sm")}
                  >
                    <FileText size={15} aria-hidden />
                    Make an offer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    className={cx(buttonClass("secondary", "sm"), "text-error-700 hover:border-error-500/40 hover:bg-error-500/10")}
                  >
                    Turn down
                  </button>
                  {/*
                    Withdrawing is what the candidate did, not what we decided.
                    It takes no reason from us and is not counted as a
                    rejection anywhere in the reporting.
                  */}
                  <button
                    type="button"
                    onClick={() => void withdraw()}
                    disabled={busy}
                    className={buttonClass("ghost", "sm")}
                  >
                    They withdrew
                  </button>
                </div>
              </section>
            )}

            {application.rejectionReason !== null && (
              <RichTextView value={application.rejectionReason} size="sm" className="rounded-xl bg-neutral-100 px-3 py-2.5 text-neutral-600" />
            )}

            <Interviews
              interviews={application.interviews ?? []}
              onChanged={() => {
                void load();
                onChanged();
              }}
            />

            <Offers
              offers={application.offers ?? []}
              onChanged={() => {
                void load();
                onChanged();
              }}
            />

            <HistoryList events={history} />
          </div>
        )}
      </aside>

      {scheduling && (
        <ScheduleDialog
          applicationId={applicationId}
          colleagues={colleagues}
          onClose={() => setScheduling(false)}
          onScheduled={() => {
            setScheduling(false);
            void load();
            onChanged();
          }}
        />
      )}

      {offering && application !== null && (
        <OfferDialog
          applicationId={applicationId}
          defaultTitle={application.requisition?.jobTitle ?? ""}
          onClose={() => setOffering(false)}
          onDrafted={() => {
            setOffering(false);
            void load();
            onChanged();
          }}
        />
      )}

      {rejecting && (
        <RejectDialog
          applicationId={applicationId}
          onClose={() => setRejecting(false)}
          onRejected={() => {
            setRejecting(false);
            void load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Interviews({
  interviews,
  onChanged,
}: {
  interviews: Interview[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);

  if (interviews.length === 0) return null;

  const act = async (
    id: string,
    action: "complete" | "cancel" | "no_show",
  ) => {
    setBusy(id);

    try {
      await hrm.recruitment.updateInterview(
        id,
        action,
        action === "cancel" ? "Rearranged." : undefined,
      );
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Interviews
      </h3>

      <ul className="space-y-2">
        {interviews.map((interview) => (
          <li
            key={interview.id}
            className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 truncate text-sm font-medium text-neutral-900">
                {interview.kindLabel} · {formatDate(interview.scheduledAt)}
              </span>
              <ToneChip tone={interview.isOpen ? "primary" : "neutral"}>
                {interview.statusLabel}
              </ToneChip>
            </div>

            {interview.panel !== undefined && interview.panel.length > 0 && (
              <p className="mt-1 truncate text-xs text-neutral-500">
                {interview.panel.map((m) => m.name ?? "Unnamed").join(", ")}
              </p>
            )}

            {/*
              The number the hiring decision actually waits on, rather than
              somebody chasing four people individually.
            */}
            {interview.scorecardsOutstanding > 0 &&
              interview.status === "completed" && (
                <p className="mt-1 text-xs text-sun-700">
                  {interview.scorecardsOutstanding} scorecards outstanding
                </p>
              )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {interview.isOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => void act(interview.id, "complete")}
                    disabled={busy === interview.id}
                    className="h-8 cursor-pointer rounded-lg bg-primary-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                  >
                    It happened
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(interview.id, "no_show")}
                    disabled={busy === interview.id}
                    className="h-8 cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Did not attend
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(interview.id, "cancel")}
                    disabled={busy === interview.id}
                    className="h-8 cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}

              {interview.status === "completed" && (
                <button
                  type="button"
                  onClick={() =>
                    setPanel(panel === interview.id ? null : interview.id)
                  }
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <MessageSquare size={11} />
                  {panel === interview.id ? "Hide" : "What they said"}
                </button>
              )}
            </div>

            {panel === interview.id && <Scorecards interviewId={interview.id} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What the panel said.
 *
 * A recruiter reading this is not being assessed and cannot anchor themselves,
 * so unlike an interviewer they see everything submitted. The rule that stops
 * an interviewer reading their colleagues' verdicts before writing their own
 * lives on `/hrm/me/interviews`.
 */
function Scorecards({ interviewId }: { interviewId: string }) {
  const [cards, setCards] = useState<InterviewScorecard[] | null>(null);
  const [meta, setMeta] = useState<{ outstanding: number; weight: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    hrm.recruitment
      .scorecards(interviewId)
      .then((res) => {
        if (cancelled) return;
        setCards(res.data);
        setMeta(res.meta);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });

    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  if (cards === null) {
    return <div className="mt-2 h-16 animate-pulse rounded-lg bg-neutral-50" />;
  }

  if (cards.length === 0) {
    return (
      <p className="mt-2 text-xs text-neutral-500">
        Nobody has written theirs up yet.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-white p-3">
      {cards.map((card) => (
        <div key={card.id}>
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-xs font-medium text-neutral-900">
              {card.interviewer?.name ?? "An interviewer"}
            </span>
            <ToneChip tone={verdictTone(card.verdict)}>{card.verdictLabel}</ToneChip>
          </div>
          {card.concerns !== null && (
            <p className="text-xs text-neutral-600">{richExcerpt(card.concerns, 200)}</p>
          )}
        </div>
      ))}

      {meta !== null && (
        <p className="border-t border-neutral-200 pt-1.5 text-xs text-neutral-500">
          {/* Strong verdicts count double, so one firm objection is not
              quietly outvoted by two lukewarm yeses. */}
          Panel weight {meta.weight > 0 ? `+${meta.weight}` : meta.weight}
          {meta.outstanding > 0 ? ` · ${meta.outstanding} still to come` : ""}
        </p>
      )}
    </div>
  );
}

function Offers({
  offers,
  onChanged,
}: {
  offers: JobOffer[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (offers.length === 0) return null;

  const act = async (
    offer: JobOffer,
    action: "submit" | "approve" | "send" | "accept" | "decline" | "withdraw",
  ) => {
    setBusy(offer.id);
    setError(null);

    try {
      await hrm.recruitment.updateOffer(
        offer.id,
        action,
        action === "withdraw" ? { reason: "Withdrawn." } : {},
      );
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Offers
      </h3>

      {error !== null && (
        <p className="mb-2 rounded-xl bg-error-500/10 px-3 py-2 text-xs text-error-700">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {offers.map((offer) => (
          <li key={offer.id} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 truncate text-sm font-medium text-neutral-900">
                {nairaFromKobo(offer.salaryKobo)} · {offer.jobTitle}
              </span>
              <ToneChip tone={offerTone(offer.status)}>{offer.statusLabel}</ToneChip>
            </div>

            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {offer.startsOn !== null ? `Starts ${formatDate(offer.startsOn)}` : ""}
              {offer.expiresOn !== null
                ? ` · expires ${formatDate(offer.expiresOn)}`
                : ""}
              {offer.responseNote !== null ? ` · ${offer.responseNote}` : ""}
            </p>

            {/*
              An offer past its date that nobody has acted on. The status still
              reads "with the candidate" until somebody tries, so the screen has
              to say it rather than wait.
            */}
            {offer.hasLapsed && (
              <p className="mt-1 text-xs text-error-700">
                This lapsed on {formatDate(offer.expiresOn)}.
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {offer.status === "draft" && (
                <Action label="Send for approval" onClick={() => void act(offer, "submit")} busy={busy === offer.id} />
              )}
              {offer.status === "pending_approval" && (
                <Action label="Approve" primary onClick={() => void act(offer, "approve")} busy={busy === offer.id} />
              )}
              {offer.status === "approved" && (
                <Action label="Send to candidate" primary onClick={() => void act(offer, "send")} busy={busy === offer.id} />
              )}
              {offer.isWithCandidate && (
                <>
                  <Action label="They accepted" primary onClick={() => void act(offer, "accept")} busy={busy === offer.id} />
                  <Action label="They declined" onClick={() => void act(offer, "decline")} busy={busy === offer.id} />
                </>
              )}
              {offer.isOpen && (
                <Action label="Withdraw" onClick={() => void act(offer, "withdraw")} busy={busy === offer.id} />
              )}
            </div>

            {offer.isAccepted && offer.employeeId !== null && (
              <Link
                href={`/suite/hrm/people/${offer.employeeId}`}
                className="mt-2 inline-block text-xs font-medium text-primary-700 hover:underline"
              >
                They are now on the payroll — open their record
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Action({
  label,
  onClick,
  busy,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cx(
        "h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-50",
        primary
          ? "bg-primary-600 text-white hover:bg-primary-700"
          : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Every move, with how long each leg took.
 *
 * The log the funnel is built from, shown to the person working the candidate
 * — because "they have been at screening since the 4th" is the answer to most
 * questions about a stalled pipeline.
 */
function HistoryList({ events }: { events: StageEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <History size={12} />
        History
      </h3>

      <ol className="space-y-2.5 border-l-2 border-primary-100 pl-4">
        {events.map((event) => (
          <li key={event.id} className="relative text-xs before:absolute before:-left-[21px] before:top-1 before:h-2.5 before:w-2.5 before:rounded-full before:bg-primary-500 before:ring-4 before:ring-white">
            <span className="font-medium text-neutral-900">{event.stage}</span>
            <span className="text-neutral-500">
              {" · "}
              {formatDate(event.at)}
              {event.daysInPrevious !== null
                ? ` · ${event.daysInPrevious}d in the previous stage`
                : ""}
              {event.movedBy !== null ? ` · ${event.movedBy}` : ""}
            </span>
            {event.note !== null && (
              <p className="text-neutral-600">{richExcerpt(event.note, 200)}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Dialogs                                                            */
/* ------------------------------------------------------------------ */

const KINDS: { value: InterviewKind; label: string }[] = [
  { value: "phone", label: "Phone screen" },
  { value: "video", label: "Video call" },
  { value: "in_person", label: "In person" },
  { value: "technical", label: "Technical" },
  { value: "panel", label: "Panel" },
  { value: "final", label: "Final" },
];

function ScheduleDialog({
  applicationId,
  colleagues,
  onClose,
  onScheduled,
}: {
  applicationId: string;
  colleagues: Employee[];
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [kind, setKind] = useState<InterviewKind>("video");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [panel, setPanel] = useState<string[]>([]);
  const [agenda, setAgenda] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.recruitment.scheduleInterview(applicationId, {
        scheduledAt,
        kind,
        durationMinutes: Number(durationMinutes || 60),
        agenda: agenda.trim() === "" ? undefined : agenda.trim(),
        panel: panel.map((employeeId, index) => ({
          employeeId,
          isLead: index === 0,
        })),
      });

      onScheduled();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label="Arrange interview" onClose={onClose} onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="When">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
            className={INPUT}
          />
        </Field>
        <Field label="Minutes">
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            min={5}
            max={600}
            className={INPUT}
          />
        </Field>
      </div>

      <Field label="Kind">
        <SearchableSelect
          value={kind}
          onChange={(v) => setKind(v as InterviewKind)}
          options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
        />
      </Field>

      <div>
        <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
          Who is on it
        </span>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
          {colleagues.map((person) => (
            <label
              key={person.id}
              className="flex items-center gap-2 text-sm text-neutral-700"
            >
              <input
                type="checkbox"
                checked={panel.includes(person.id)}
                onChange={(e) =>
                  setPanel(
                    e.target.checked
                      ? [...panel, person.id]
                      : panel.filter((id) => id !== person.id),
                  )
                }
                className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
              />
              {person.person.name ?? "Unnamed"}
            </label>
          ))}
        </div>
        {/*
          The first person picked leads. Said out loud because a panel with no
          lead is one where nobody opens the conversation.
        */}
        <p className="mt-1 text-xs text-neutral-500">
          The first person you pick leads it.
        </p>
      </div>

      <Field label="What to cover (optional)">
        <RichTextEditor minHeight={76} value={agenda} onChange={setAgenda} />
      </Field>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Actions busy={busy} onClose={onClose} label="Arrange" />
    </Dialog>
  );
}

function OfferDialog({
  applicationId,
  defaultTitle,
  onClose,
  onDrafted,
}: {
  applicationId: string;
  defaultTitle: string;
  onClose: () => void;
  onDrafted: () => void;
}) {
  const [jobTitle, setJobTitle] = useState(defaultTitle);
  const [salary, setSalary] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.recruitment.draftOffer(applicationId, {
        jobTitle: jobTitle.trim() === "" ? undefined : jobTitle.trim(),
        // Typed in naira because that is what an offer letter says; stored in
        // kobo so nothing rounds twice.
        salaryKobo: Math.round(Number(salary) * 100),
        startsOn: startsOn === "" ? null : startsOn,
        expiresOn: expiresOn === "" ? null : expiresOn,
      });

      onDrafted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label="Make an offer" onClose={onClose} onSubmit={submit}>
      <Field label="Job title">
        <JobTitlePicker mode="name" value={jobTitle} onChange={(name) => setJobTitle(name)} clearable />
      </Field>

      <Field label="Salary (₦ a year)">
        <input
          type="number"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          min={0}
          required
          className={INPUT}
        />
        {/*
          The band was what got approved. An offer outside it is refused by the
          API rather than quietly made, and saying so here saves a round trip.
        */}
        <p className="mt-1 text-xs text-neutral-500">
          Must fall inside the band the role was approved for.
        </p>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts on">
          <input
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Expires on">
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Actions busy={busy} onClose={onClose} label="Draft offer" />
    </Dialog>
  );
}

function RejectDialog({
  applicationId,
  onClose,
  onRejected,
}: {
  applicationId: string;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.recruitment.moveApplication(applicationId, {
        action: "reject",
        reason: reason.trim(),
      });

      onRejected();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label="Turn down" onClose={onClose} onSubmit={submit}>
      <Field label="Why? They are owed a reason.">
        <RichTextEditor minHeight={102} value={reason} onChange={setReason} />
      </Field>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Actions busy={busy} onClose={onClose} label="Turn down" />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function Dialog({
  label,
  onClose,
  onSubmit,
  children,
}: {
  label: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm"
      />
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative z-10 w-full max-w-md space-y-4 rounded-[1.25rem] bg-white p-6 shadow-2xl shadow-neutral-900/10"
      >
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">{label}</h2>
        {children}
      </form>
    </div>
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
    <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
      <button
        type="button"
        onClick={onClose}
        className={buttonClass("secondary")}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className={buttonClass("primary")}
      >
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
      {children}
    </p>
  );
}

/** Shown when a board has no candidates at all. */
export function NoCandidates() {
  return (
    <Empty
      icon={FileText}
      title="Nobody has applied yet"
      hint="Record an application, or advertise the role."
    />
  );
}
