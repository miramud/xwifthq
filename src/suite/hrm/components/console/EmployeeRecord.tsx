"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  Check,
  ClipboardList,
  Clock,
  DoorOpen,
  FileSignature,
  GraduationCap,
  Hash,
  Mail,
  MapPin,
  PenLine,
  Timer,
  UserRound,
  Users,
} from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PersonAvatar,
  Progress,
  cx,
} from "@/components/workspace/kit";
import { hueFor } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import {
  ApiError,
  hrm,
  type Employee,
  type OnboardingStep,
  type ProbationReview,
} from "@/lib/api/hrm-client";
import EndEmploymentDialog from "./EndEmploymentDialog";
import { ReportsToDialog } from "./ReportsTo";
import {
  contractTone,
  countdownTone,
  employmentTone,
  formatCountdown,
  formatDate,
  probationTone,
  salary,
} from "@/suite/hrm/lib/format";
import EmployeeDossierPanel from "./EmployeeDossierPanel";
import PersonalPanel from "./PersonalPanel";
import ReviewHistoryPanel from "./ReviewHistoryPanel";
import WarningsPanel from "./WarningsPanel";
import { IconTile, InfoRow, LoadError, ToneChip } from "../ui/recordKit";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * One person's whole employment, on one page.
 *
 * Laid out in the order somebody actually asks about it: who they are and where
 * they stand, then the checklist that is holding their start up, then the
 * probation decision that is due, then the agreements behind all of it.
 *
 * The rest of the record — leave, time and pay; the person as opposed to the
 * post; the written reviews; the disciplinary register — sits behind tabs. The
 * tabs stay mounted when hidden, so each section loads once, as it always did,
 * and switching between them loses nothing.
 *
 * Nothing here lets an HR manager type a status directly. Confirming a
 * probation, renewing an agreement and recording an exit each move several
 * records together, and every one of them is an action with its own button.
 */

type Tab = "overview" | "dossier" | "personal" | "reviews" | "disciplinary";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "dossier", label: "Leave, time & pay" },
  { key: "personal", label: "Personal" },
  { key: "reviews", label: "Reviews" },
  { key: "disciplinary", label: "Disciplinary" },
];

export default function EmployeeRecord({ employeeId }: { employeeId: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reviews, setReviews] = useState<ProbationReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    try {
      const [record, probation] = await Promise.all([
        hrm.employees.get(employeeId),
        hrm.probation.forEmployee(employeeId),
      ]);

      setEmployee(record);
      setReviews(probation);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not load.");
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const [ending, setEnding] = useState(false);
  // "Reports to" (S9): the line My team and the Supervisor role follow.
  const [changingLine, setChangingLine] = useState(false);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const back = (
    <Link
      href="/suite/hrm/people"
      className="inline-flex items-center gap-1.5 normal-case tracking-normal hover:text-primary-700"
    >
      <ArrowLeft size={14} aria-hidden />
      Directory
    </Link>
  );

  if (error !== null && employee === null) {
    return (
      <div>
        <PageHeader eyebrow={back} title="Employee record" />
        <LoadError message={error} />
      </div>
    );
  }

  if (employee === null) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <div className="ws-card h-28 animate-pulse bg-neutral-50" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="ws-card h-64 animate-pulse bg-neutral-50 lg:col-span-2" />
          <div className="ws-card h-64 animate-pulse bg-neutral-50" />
        </div>
      </div>
    );
  }

  const journey = employee.onboarding?.find((j) => j.isOpen) ?? employee.onboarding?.[0];
  const openReview = reviews.find((r) => r.isOpen);
  const inForce = employee.contract?.find((c) => c.isInForce);
  const placement = employee.placements?.[0];
  const name = employee.person.name ?? "Unnamed";

  const service =
    employee.monthsOfService === null
      ? "-"
      : `${employee.monthsOfService} month${employee.monthsOfService === 1 ? "" : "s"}`;

  const keyDates: { label: string; date: string | null; icon: typeof Clock }[] = [
    { label: "Offer accepted", date: employee.hiredOn, icon: FileSignature },
    { label: "First day", date: employee.startedOn, icon: CalendarCheck },
    { label: "Probation ends", date: employee.probationEndsOn, icon: CalendarClock },
    ...(employee.confirmedOn ? [{ label: "Confirmed", date: employee.confirmedOn, icon: Check }] : []),
    ...(employee.endedOn ? [{ label: "Left", date: employee.endedOn, icon: DoorOpen }] : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow={back}
        title={name}
        subtitle={`${employee.jobTitle}${employee.department ? ` · ${employee.department}` : ""}`}
        actions={
          /*
            Last resort, and deliberately plain. The proper route out is the
            Leavers board, which raises a clearance list and keeps the access
            review honest. This is for the records that never had one — a
            historic leaver being tidied up, or somebody whose departure was
            recorded outside the system.
          */
          employee.isCurrent ? (
            <>
              <Link
                href="/suite/hrm/leavers"
                className="hidden text-sm font-semibold text-primary-700 hover:underline sm:inline"
              >
                Leavers board
              </Link>
              <Button variant="ghost" size="sm" icon={DoorOpen} onClick={() => setEnding(true)}>
                End employment
              </Button>
            </>
          ) : undefined
        }
        tabs={TABS}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {error !== null && (
        <p role="alert" className="mb-4 rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
          {error}
        </p>
      )}

      {/* ------------------------------ overview ------------------------ */}

      <div hidden={tab !== "overview"}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* ------------------------ who they are ------------------- */}

            <Card className="overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-primary-100 via-sky-50 to-grape-50" aria-hidden />
              <div className="-mt-10 px-6 pb-6">
                <div className="flex flex-wrap items-end gap-4">
                  <span className="rounded-full bg-white p-1 shadow-sm">
                    <PersonAvatar name={name} src={employee.person.avatar} size={72} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pb-1">
                    <ToneChip tone={employmentTone(employee.status)}>{employee.statusLabel}</ToneChip>
                    <Chip hue="slate" icon={Briefcase}>{employee.employmentTypeLabel}</Chip>
                    {employee.probationOverdue && <ToneChip tone="error">Probation overdue</ToneChip>}
                    {employee.isCurrent && employee.daysUntilEnd !== null && (
                      <ToneChip tone={countdownTone(employee.daysUntilEnd)}>
                        Term ends {formatCountdown(employee.daysUntilEnd)}
                      </ToneChip>
                    )}
                    {!employee.canRecordTime && employee.isCurrent && (
                      <Chip hue="slate">Not yet on the timesheet</Chip>
                    )}
                  </div>
                </div>

                <dl className="mt-5 grid gap-x-6 sm:grid-cols-2">
                  <InfoRow icon={Mail} hue="blue" label="Work email">
                    {employee.person.email ?? "-"}
                  </InfoRow>
                  <InfoRow icon={Hash} hue="grape" label="Employee number">
                    {employee.employeeNumber ?? "-"}
                  </InfoRow>
                  <InfoRow icon={Building2} hue={hueFor(employee.department)} label="Department">
                    {employee.department ?? "-"}
                  </InfoRow>
                  <InfoRow icon={MapPin} hue="coral" label="Location">
                    {employee.workLocation ?? "-"}
                  </InfoRow>
                  <InfoRow icon={Timer} hue="sky" label="Weekly hours">
                    {employee.weeklyHours === null ? "-" : String(employee.weeklyHours)}
                  </InfoRow>
                  <InfoRow icon={Clock} hue="mint" label="Service">
                    {service}
                  </InfoRow>
                </dl>

                {!employee.isCurrent && employee.exitReason && (
                  <div className="mt-4 rounded-xl bg-neutral-50 p-4">
                    <p className="text-xs font-semibold text-neutral-700">
                      Left {formatDate(employee.endedOn)}
                    </p>
                    <RichTextView value={employee.exitReason} size="sm" className="mt-1 text-neutral-600" />
                  </div>
                )}
              </div>
            </Card>

            {/* ------------------------- onboarding ------------------------ */}

            <Panel
              title="Onboarding"
              icon={ClipboardList}
              hue="sky"
              subtitle={
                journey
                  ? `${journey.programmeName} · ${journey.progress ?? 0}% of the required steps`
                  : "No checklist started"
              }
              actions={
                journey?.isOpen && journey.requiredComplete ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Check}
                    disabled={busy === "complete-journey"}
                    onClick={() => run("complete-journey", () => hrm.onboarding.complete(journey.id))}
                  >
                    Mark onboarded
                  </Button>
                ) : undefined
              }
            >
              {!journey ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
                  <p className="text-sm text-neutral-600">Nothing started for this person.</p>
                  <Button
                    size="sm"
                    disabled={busy === "start-journey"}
                    onClick={() => run("start-journey", () => hrm.onboarding.start(employee.id))}
                  >
                    Start a checklist
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex-1">
                      <Progress value={journey.progress ?? 0} hue="sky" />
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
                      {journey.progress ?? 0}%
                    </span>
                    <ToneChip tone={journey.isOpen ? "info" : "success"}>{journey.statusLabel}</ToneChip>
                  </div>

                  <ul className="divide-y divide-neutral-100">
                    {(journey.steps ?? []).map((step) => (
                      <StepRow
                        key={step.id}
                        step={step}
                        busy={busy === `step-${step.id}`}
                        onToggle={() =>
                          run(`step-${step.id}`, () =>
                            step.isComplete
                              ? hrm.onboarding.reopenStep(step.id)
                              : hrm.onboarding.completeStep(step.id),
                          )
                        }
                      />
                    ))}
                  </ul>
                </>
              )}
            </Panel>

            {/* -------------------------- agreements ----------------------- */}

            <Panel
              title="Agreements"
              icon={FileSignature}
              hue="grape"
              subtitle={inForce ? `In force since ${formatDate(inForce.startsOn)}` : "Nothing in force"}
            >
              {(employee.contract ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500">No agreement recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {(employee.contract ?? []).map((contract) => (
                    <li
                      key={contract.id}
                      className={cx(
                        "rounded-2xl border p-4",
                        contract.isInForce ? "border-grape-100 bg-grape-50/40" : "border-neutral-100 bg-neutral-50/60",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <IconTile icon={FileSignature} hue={contract.isInForce ? "grape" : "slate"} size={34} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-900">
                              {contract.jobTitle}
                              {contract.reference ? ` · ${contract.reference}` : ""}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {formatDate(contract.startsOn)} to{" "}
                              {contract.isOpenEnded ? "open-ended" : formatDate(contract.endsOn)}
                              {contract.grossSalary !== null
                                ? ` · ${salary(contract.grossSalary, contract.salaryPeriod)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {contract.isOverrunning && <ToneChip tone="error">Past its end date</ToneChip>}
                          <ToneChip tone={contractTone(contract.status)}>{contract.statusLabel}</ToneChip>
                        </div>
                      </div>
                      {contract.renewedFromId !== null && (
                        <p className="mt-2 text-xs text-neutral-500">
                          Renewed from an earlier agreement. The terms it replaced are still on this record.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            {/* ------------------------- reporting line -------------------- */}

            <Panel
              title="Reporting line"
              icon={Users}
              hue="blue"
              actions={
                employee.isCurrent ? (
                  <Button variant="ghost" size="sm" icon={PenLine} onClick={() => setChangingLine(true)}>
                    Change
                  </Button>
                ) : undefined
              }
            >
              <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-3">
                {employee.manager ? (
                  <PersonAvatar name={employee.manager.name ?? "Unnamed"} size={40} />
                ) : (
                  <IconTile icon={UserRound} hue="slate" size={40} />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-500">Reports to</p>
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {employee.manager?.name ?? "Nobody"}
                  </p>
                  {employee.manager?.jobTitle && (
                    <p className="truncate text-xs text-neutral-500">{employee.manager.jobTitle}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2.5">
                <span className="text-sm font-medium text-primary-700">Direct reports</span>
                <span className="text-lg font-bold tabular-nums text-primary-700">
                  {String(employee.directReports ?? 0)}
                </span>
              </div>
            </Panel>

            {/* -------------------------- probation ------------------------ */}

            <Panel
              title="Probation"
              icon={CalendarClock}
              hue="sun"
              subtitle={
                openReview
                  ? `Due ${formatDate(openReview.dueOn)}`
                  : employee.confirmedOn
                    ? `Confirmed ${formatDate(employee.confirmedOn)}`
                    : "Nothing outstanding"
              }
              actions={
                !openReview && employee.status === "on_probation" ? (
                  <Button
                    size="sm"
                    disabled={busy === "raise"}
                    onClick={async () => {
                      /*
                        Confirmed (H10): a review is raised automatically on
                        the first day, so pressing this is for one that was
                        decided or never raised, and it puts a date in front
                        of their reviewer.
                      */
                      const ok = await confirm({
                        title: "Raise a probation review?",
                        body: `It is due on ${formatDate(employee.probationEndsOn)}, when their probation ends, and appears on the probation board for their reviewer.`,
                        confirmLabel: "Raise review",
                        tone: "primary",
                      });
                      if (ok) void run("raise", () => hrm.probation.raise(employee.id));
                    }}
                  >
                    Raise review
                  </Button>
                ) : undefined
              }
            >
              {reviews.length === 0 ? (
                <Empty
                  icon={CalendarClock}
                  hue="sun"
                  title="No reviews"
                  hint={
                    employee.status === "on_probation"
                      ? "Raise one so the date is diarised rather than remembered."
                      : "This engagement does not serve probation."
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {reviews.map((review) => (
                    <li key={review.id} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-neutral-900">Due {formatDate(review.dueOn)}</p>
                        <ToneChip tone={probationTone(review.outcome)}>{review.outcomeLabel}</ToneChip>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {review.isOverdue
                          ? `${review.daysLate} day${review.daysLate === 1 ? "" : "s"} overdue`
                          : review.heldOn
                            ? `Held ${formatDate(review.heldOn)}${review.wasHeldLate ? ", after it was due" : ""}`
                            : "Outstanding"}
                        {review.rating !== null ? ` · rated ${review.rating}/5` : ""}
                      </p>
                      {review.extendedTo && (
                        <p className="mt-1 text-xs font-medium text-sun-700">
                          Extended to {formatDate(review.extendedTo)}
                        </p>
                      )}
                      {review.summary && <RichTextView value={review.summary} size="sm" className="mt-2 text-neutral-600" />}
                    </li>
                  ))}
                </ul>
              )}

              {openReview && (
                <p className="mt-3 text-xs text-neutral-500">
                  Decide it from{" "}
                  <Link href="/suite/hrm/probation" className="font-semibold text-primary-600 hover:text-primary-700">
                    Probation
                  </Link>
                  , where the outcome is recorded with its reasons.
                </p>
              )}
            </Panel>

            {/* ------------------------- internship ------------------------ */}

            {placement && (
              <Panel title="Internship" icon={GraduationCap} hue="grape" subtitle={placement.cohort?.name}>
                <dl>
                  <InfoRow icon={UserRound} hue="grape" label="Mentor">
                    {placement.mentor?.name ?? "Not assigned"}
                  </InfoRow>
                  <InfoRow icon={Building2} hue="sky" label="From">
                    {placement.institution ?? "-"}
                  </InfoRow>
                  <InfoRow icon={Briefcase} hue="mint" label="Focus">
                    {placement.focusArea ?? "-"}
                  </InfoRow>
                  <InfoRow icon={CalendarCheck} hue="sun" label="Placement">
                    {`${formatDate(placement.startsOn)} to ${formatDate(placement.endsOn)}`}
                  </InfoRow>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip hue="slate">{placement.statusLabel}</Chip>
                  <ToneChip tone={placement.decisionIsDue ? "warning" : "neutral"}>
                    {placement.conversionLabel}
                  </ToneChip>
                </div>
              </Panel>
            )}

            {/* -------------------------- key dates ------------------------ */}

            <Panel title="Key dates" icon={CalendarCheck} hue="mint">
              <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-neutral-200">
                {keyDates.map((d) => (
                  <li key={d.label} className="relative flex items-center gap-3">
                    <IconTile icon={d.icon} hue={d.date ? "mint" : "slate"} size={30} className="ring-4 ring-white" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-neutral-500">{d.label}</p>
                      <p className="text-sm font-semibold tabular-nums text-neutral-900">{formatDate(d.date)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>
      </div>

      {/*
        Leave, attendance, the rota, pay and how they were hired. Behind a tab
        rather than above the employment record: the agreements and the
        probation decision are what this page is for, and the rest is context.
      */}
      <div hidden={tab !== "dossier"}>
        <EmployeeDossierPanel employeeId={employee.id} />
      </div>

      {/*
        The person, as opposed to the post — including the emergency contact,
        which sits first in its tab because somebody looking it up is not
        browsing.
      */}
      <div hidden={tab !== "personal"}>
        <PersonalPanel employeeId={employee.id} />
      </div>

      {/*
        The written record. The performance screen already charts the ratings;
        this is the paragraphs underneath them — what she said about her own
        year and what was said back — which is what somebody actually reads
        before a promotion conversation.
      */}
      <div hidden={tab !== "reviews"}>
        <ReviewHistoryPanel employeeId={employee.id} />
      </div>

      {/*
        The live warnings register, on its own tab. It is the section a manager
        opens deliberately before a decision rather than one they read in
        passing, and putting a disciplinary summary at the top of somebody's
        record would make it the first thing said about them every time the
        page is opened for any reason at all.
      */}
      <div hidden={tab !== "disciplinary"}>
        <WarningsPanel employeeId={employee.id} />
      </div>

      {changingLine && (
        <ReportsToDialog
          employee={employee}
          onClose={() => setChangingLine(false)}
          onSaved={() => {
            setChangingLine(false);
            void load();
          }}
        />
      )}

      {ending && (
        <EndEmploymentDialog
          employee={employee}
          onClose={() => setEnding(false)}
          onEnded={() => {
            setEnding(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StepRow({
  step,
  busy,
  onToggle,
}: {
  step: OnboardingStep;
  busy: boolean;
  onToggle: () => void;
}) {
  const Icon =
    step.category === "equipment"
      ? FileSignature
      : step.ownerRole === "employee"
        ? GraduationCap
        : ClipboardList;

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={step.isComplete}
        aria-label={step.isComplete ? `Reopen ${step.title}` : `Complete ${step.title}`}
        className={cx(
          "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-60",
          step.isComplete
            ? "border-mint-500 bg-mint-500 text-white"
            : "border-neutral-300 text-transparent hover:border-primary-400",
        )}
      >
        <Check size={15} strokeWidth={3} aria-hidden />
      </button>

      <IconTile icon={Icon} hue={step.isComplete ? "slate" : "sky"} size={30} className="hidden sm:flex" />

      <span className="min-w-0 flex-1">
        <span
          className={cx(
            "block truncate text-sm",
            step.isComplete ? "text-neutral-500 line-through" : "font-semibold text-neutral-900",
          )}
        >
          {step.title}
        </span>
        <span className="block truncate text-xs text-neutral-500">
          {step.ownerRoleLabel}
          {step.dueOn ? ` · due ${formatDate(step.dueOn)}` : ""}
          {step.isRequired ? "" : " · optional"}
          {step.courseTitle != null && ` · ${step.courseTitle}`}
        </span>
      </span>

      {/*
        "We asked" is not "they have it". A step can name a course and fail to
        grant it — no LMS seat, an unpublished course — and without saying so
        an HR officer chases somebody for training they were never given.

        The step stays tickable either way: somebody who did the training at
        their last employer should not be stuck behind a course they do not
        need.
      */}
      {step.courseId != null && step.courseAssigned === false && !step.isComplete && (
        <ToneChip tone="warning">Course not granted</ToneChip>
      )}

      {step.isOverdue && <ToneChip tone="error">{step.daysLate}d late</ToneChip>}
    </li>
  );
}
