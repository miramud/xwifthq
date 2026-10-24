import type {
  ApplicationStatus,
  AttendanceState,
  ContractStatus,
  ConversionOutcome,
  EmploymentStatus,
  LeaveStatus,
  OfferStatus,
  PayRunStatus,
  PlacementStatus,
  ProbationOutcome,
  RequisitionStatus,
  ScorecardVerdict,
  SwapStatus,
} from "@/lib/api/hrm-client";
import type { Tone } from "@/components/dashboard/ui";

/**
 * How HR states are coloured, and how HR dates read.
 *
 * The tones live here rather than inline in each page for one reason: the same
 * status appears on the dashboard, the directory and the person's own record,
 * and a status that is amber in one place and red in another teaches the reader
 * that the colour means nothing.
 *
 * Colour never carries the meaning on its own, every pill in this module also
 * shows the label the API sent.
 */

export function employmentTone(status: EmploymentStatus): Tone {
  switch (status) {
    case "active":
      return "success";
    case "on_probation":
      return "info";
    case "onboarding":
      return "primary";
    case "suspended":
      return "warning";
    case "terminated":
      return "error";
    // Ended and resigned are neutral on purpose. Somebody whose fixed term
    // finished has not gone wrong, and colouring a leaver red reads as a
    // judgement on them.
    case "ended":
    case "resigned":
      return "neutral";
  }
}

export function contractTone(status: ContractStatus): Tone {
  switch (status) {
    case "active":
      return "success";
    case "draft":
      return "neutral";
    case "renewed":
      return "info";
    case "expired":
      return "warning";
    case "terminated":
      return "error";
  }
}

export function probationTone(outcome: ProbationOutcome): Tone {
  switch (outcome) {
    case "confirmed":
      return "success";
    case "pending":
      return "info";
    case "extended":
      return "warning";
    case "exited":
      return "error";
  }
}

export function placementTone(status: PlacementStatus): Tone {
  switch (status) {
    case "placed":
      return "primary";
    case "completed":
      return "success";
    case "withdrawn":
      return "neutral";
  }
}

export function conversionTone(outcome: ConversionOutcome): Tone {
  switch (outcome) {
    case "converted":
      return "success";
    case "offered":
      return "info";
    case "declined":
      return "warning";
    case "not_converted":
      return "neutral";
    case "pending":
      return "neutral";
  }
}

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

/**
 * How a leave request reads at a glance.
 *
 * Cancelled and recalled are deliberately different colours. One is the
 * employee withdrawing and is unremarkable; the other is the employer taking
 * back leave it had already granted, which somebody may have to justify later
 * and should never be mistaken for the first.
 */
export function leaveTone(status: LeaveStatus): Tone {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "declined":
      return "error";
    case "recalled":
      return "accent";
    case "cancelled":
      return "neutral";
  }
}

/**
 * Days, with the half shown and the trailing zero dropped.
 *
 * "2.5 days" and "2 days" both have to be sayable, because half days are real
 * and "2.0 days" on a balance reads like a rounding artefact rather than a
 * figure somebody can act on.
 */
export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined || Number.isNaN(days)) return "-";

  const text = Number.isInteger(days) ? String(days) : days.toFixed(1);

  return `${text} day${days === 1 ? "" : "s"}`;
}

/**
 * How a day's attendance reads at a glance.
 *
 * `on_leave` is informational and `absent` is a problem, and those two must
 * never look alike, the entire point of reconciling attendance against the
 * leave calendar is that an authorised absence stops being anybody's business.
 * Only `absent` is red.
 */
export function attendanceTone(state: AttendanceState): Tone {
  switch (state) {
    case "worked":
      return "success";
    case "late":
      return "warning";
    case "absent":
      return "error";
    case "on_leave":
      return "info";
    case "holiday":
      return "neutral";
    case "open":
      return "primary";
    case "scheduled":
      return "neutral";
  }
}

/** Where a swap has got to. */
export function swapTone(status: SwapStatus): Tone {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "neutral";
    case "accepted":
      return "warning";
    case "declined":
      return "error";
    case "cancelled":
      return "neutral";
  }
}

/**
 * Minutes as hours and minutes: "7h 30m".
 *
 * Never a decimal. "7.5 hours" is fine in a total and wrong on a shift, where
 * somebody has to match it against a clock, and 7.25 hours is a quarter past
 * nothing anybody recognises.
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return "-";
  }

  const sign = minutes < 0 ? "-" : "";
  const total = Math.abs(Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (hours === 0) return `${sign}${rest}m`;
  if (rest === 0) return `${sign}${hours}h`;

  return `${sign}${hours}h ${rest}m`;
}

/**
 * A variance, with the sign kept.
 *
 * "-45m" and "+45m" are different findings and the sign is the whole of the
 * information. Zero reads as "on time" rather than "0m", because a column of
 * zeroes is noise and the one number that matters is the one that is not.
 */
export function formatVariance(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return "-";
  }

  if (minutes === 0) return "On time";

  return `${minutes > 0 ? "+" : ""}${formatMinutes(minutes)}`;
}

/**
 * A shift's hours: "09:00 to 17:00", or "22:00 to 06:00 +1" overnight.
 *
 * The +1 is not decoration. Without it a night shift reads as going backwards,
 * and the reader has to know which shifts cross midnight to make sense of the
 * grid at all.
 */
export function formatShiftTimes(
  startsAt: string,
  endsAt: string,
  crossesMidnight = false,
): string {
  return `${startsAt} to ${endsAt}${crossesMidnight ? " +1" : ""}`;
}

/** Where a request to hire has got to. */
export function requisitionTone(status: RequisitionStatus): Tone {
  switch (status) {
    case "approved":
      return "success";
    case "pending_approval":
      return "warning";
    case "declined":
    case "cancelled":
      return "error";
    case "on_hold":
      return "accent";
    case "filled":
      return "info";
    case "draft":
      return "neutral";
  }
}

/**
 * Whether a candidacy is still live.
 *
 * Withdrawn is neutral rather than red. Somebody taking another job is not a
 * rejection and should not read like one, the funnel excludes it from
 * conversion for the same reason.
 */
export function applicationTone(status: ApplicationStatus): Tone {
  switch (status) {
    case "active":
      return "primary";
    case "hired":
      return "success";
    case "rejected":
      return "error";
    case "withdrawn":
      return "neutral";
  }
}

export function offerTone(status: OfferStatus): Tone {
  switch (status) {
    case "accepted":
      return "success";
    case "sent":
      return "primary";
    case "approved":
      return "info";
    case "pending_approval":
      return "warning";
    case "declined":
    case "withdrawn":
      return "error";
    case "expired":
      return "accent";
    case "draft":
      return "neutral";
  }
}

/**
 * One interviewer's verdict.
 *
 * The strong variants are not just emphasis, they outweigh the plain ones in
 * the panel's total, so they are coloured to match rather than shaded.
 */
export function verdictTone(verdict: ScorecardVerdict): Tone {
  switch (verdict) {
    case "strong_yes":
      return "success";
    case "yes":
      return "info";
    case "no":
      return "warning";
    case "strong_no":
      return "error";
  }
}

/**
 * Naira from kobo: "₦4,500,000".
 *
 * Whole naira only. Kobo on a salary is noise, and a band rendered to two
 * decimal places is unreadable at the width a table gives it.
 */
export function nairaFromKobo(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined || Number.isNaN(kobo)) return "-";

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Math.round(kobo / 100));
}

/**
 * A salary band: "₦4,000,000 to ₦6,000,000".
 *
 * An open-ended band is a real answer and reads as one. "Up to ₦6,000,000"
 * says something; a dash beside a number does not.
 */
export function salaryBand(
  minKobo: number | null | undefined,
  maxKobo: number | null | undefined,
): string {
  if (!minKobo && !maxKobo) return "Not set";
  if (minKobo && !maxKobo) return `From ${nairaFromKobo(minKobo)}`;
  if (!minKobo && maxKobo) return `Up to ${nairaFromKobo(maxKobo)}`;

  return `${nairaFromKobo(minKobo)} to ${nairaFromKobo(maxKobo)}`;
}

/**
 * Where a payroll run stands.
 *
 * `approved` is deliberately not the same colour as `paid`. Approving fixes
 * every figure and is irreversible; paying is the money actually leaving. A
 * screen that shows them alike invites somebody to think the second happened
 * because the first did.
 */
export function payRunTone(status: PayRunStatus): Tone {
  switch (status) {
    case "paid":
      return "success";
    case "approved":
      return "primary";
    case "calculated":
      return "warning";
    case "cancelled":
      return "error";
    case "draft":
      return "neutral";
  }
}

/**
 * A date, short and unambiguous: "18 Sep 2026".
 *
 * Never a relative phrase on a record. "3 months ago" is unreadable in an
 * export, ages badly in a screenshot, and is exactly wrong on the two things
 * this module is full of, a contract end date and a probation date, both of
 * which somebody has to diarise.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The same date without the year, for a list already scoped to one. */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "-";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * A countdown that stays honest about the past.
 *
 * "14 days overdue" rather than "-14 days": a negative number beside a date is
 * the single most misread thing on an expiry report, and the sign is the whole
 * finding.
 */
export function formatCountdown(days: number | null | undefined): string {
  if (days === null || days === undefined) return "-";
  if (days === 0) return "Today";
  if (days < 0) {
    const overdue = Math.abs(days);
    return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Warmer as a deadline approaches, red once it has passed. */
export function countdownTone(days: number | null | undefined): Tone {
  if (days === null || days === undefined) return "neutral";
  if (days < 0) return "error";
  if (days <= 14) return "warning";
  if (days <= 45) return "info";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/*  Money                                                              */
/* ------------------------------------------------------------------ */

/**
 * Kobo to naira.
 *
 * The API stores an integer number of kobo, like every other amount in the
 * suite, because a float cannot hold a salary and be trusted to still hold it
 * after arithmetic. The division happens here and only here.
 */
export function naira(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "-";

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

/** "₦450,000 / month", or just the amount when the period is unknown. */
export function salary(
  kobo: number | null | undefined,
  period: string | null | undefined,
): string {
  if (kobo === null || kobo === undefined) return "-";

  return period ? `${naira(kobo)} / ${period}` : naira(kobo);
}

/** Initials for an avatar, from a name that may be missing. */
export function initials(name: string | null | undefined): string {
  if (!name) return "??";

  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "??"
  );
}

/**
 * A funnel stage as a share of every application: "40% of applications".
 *
 * Not "% of the previous stage" (U4): candidates skip stages, an internal
 * referral goes straight to interview, so a stage can be reached by more
 * people than the one before it, and the old figure read 150%. A share of the
 * whole never passes 100%.
 */
export function funnelShare(reached: number, total: number): string {
  if (total <= 0) return "";

  return `${Math.round((Math.min(reached, total) / total) * 100)}% of applications`;
}
