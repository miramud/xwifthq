"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightLeft,
  Award,
  Bell,
  BadgeCheck,
  Banknote,
  BellOff,
  BookOpenCheck,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  CircleCheckBig,
  ClipboardCheck,
  ClipboardPen,
  DoorOpen,
  FlagTriangleRight,
  FolderKanban,
  GraduationCap,
  LifeBuoy,
  Loader2,
  Mail,
  PackageCheck,
  Plane,
  Rocket,
  RotateCcw,
  Route,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Signature,
  UserRoundCheck,
  UserRoundMinus,
  Undo2,
  UserRoundPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  useNotifications,
  timeAgo,
  type AppNotification,
  type NotificationKind,
} from "@/lib/api/notifications-client";

/**
 * The real, API-backed notification menu used by both the admin and instructor
 * shells. Purchases, failed payments and refunds land here through Laravel's
 * database notification channel.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { items, unread, loading, error, markRead, markAllRead } = useNotifications();

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-88 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl animate-fade-in">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">Notifications</p>

              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-600">
                    {unread} new
                  </span>
                )}
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 transition-colors hover:text-primary-700"
                  >
                    <RotateCcw size={11} />
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-neutral-400">
                <Loader2 size={16} className="animate-spin" />
                Loading…
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-neutral-500">
                <CircleAlert size={16} className="shrink-0 text-error-500" />
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellOff size={20} className="text-neutral-300" />
                <p className="text-sm text-neutral-500">You&apos;re all caught up.</p>
                <p className="text-xs text-neutral-400">
                  Assignments, project updates and reviews will show up here.
                </p>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onOpen={() => {
                      if (n.unread) void markRead(n.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  purchase: BadgeCheck,
  sale: ShoppingCart,
  enrollment: Users,
  payment_failed: CircleAlert,
  refund: RotateCcw,
  info: Bell,
};

const KIND_TONE: Record<NotificationKind, string> = {
  purchase: "bg-success-50 text-success-600",
  sale: "bg-success-50 text-success-600",
  enrollment: "bg-primary-50 text-primary-600",
  payment_failed: "bg-error-500/10 text-error-600",
  refund: "bg-accent-50 text-accent-600",
  info: "bg-neutral-100 text-neutral-500",
};

/**
 * Projects notifications (`projects.assigned`, `projects.overdue`, …).
 *
 * Matched on words in the kind rather than an exact list, so a new projects
 * event gets a sensible icon before anybody remembers to add it here — and an
 * unknown one still reads as a project, not as a generic bell.
 */
const PROJECT_VISUALS: { test: RegExp; icon: typeof Bell; tone: string }[] = [
  // Before /assign/: being added to a team is not being handed a task.
  { test: /member|joined|added_to/, icon: Users, tone: "bg-primary-50 text-primary-700" },
  { test: /overdue/, icon: Siren, tone: "bg-rose-50 text-rose-700" },
  { test: /due/, icon: CalendarClock, tone: "bg-sun-50 text-sun-700" },
  { test: /unassign/, icon: UserRoundMinus, tone: "bg-neutral-100 text-neutral-600" },
  { test: /assign/, icon: UserRoundPlus, tone: "bg-primary-50 text-primary-700" },
  { test: /sprint.*(start|open)/, icon: Rocket, tone: "bg-grape-50 text-grape-700" },
  { test: /sprint/, icon: FlagTriangleRight, tone: "bg-grape-50 text-grape-700" },
  { test: /(complete|done)/, icon: CircleCheckBig, tone: "bg-mint-50 text-mint-700" },
  { test: /status|moved/, icon: ArrowRightLeft, tone: "bg-sky-50 text-sky-700" },
];

/**
 * Learning notifications — `course_assigned`, `learning_path_assigned`,
 * certificates. Matched on words for the same reason as the projects list: the
 * LMS kinds carry no module prefix, and a new one should still read as learning.
 */
const LEARNING_VISUALS: { test: RegExp; icon: typeof Bell; tone: string }[] = [
  { test: /path/, icon: Route, tone: "bg-grape-50 text-grape-700" },
  { test: /certificate/, icon: Award, tone: "bg-sun-50 text-sun-700" },
  { test: /course.*(complete|finish)/, icon: BookOpenCheck, tone: "bg-mint-50 text-mint-700" },
  { test: /course|lesson|assign/, icon: GraduationCap, tone: "bg-grape-50 text-grape-700" },
];

/**
 * HR notifications (`hrm.*`), appraisals first: a cycle launching, a
 * self-assessment due, a review to acknowledge, a sign-off, a calibration
 * outcome. Each step names what the person has to do next.
 */
const HRM_VISUALS: { test: RegExp; icon: typeof Bell; tone: string }[] = [
  { test: /calibrat/, icon: Scale, tone: "bg-grape-50 text-grape-700" },
  { test: /(acknowledg|sign)/, icon: Signature, tone: "bg-mint-50 text-mint-700" },
  { test: /self_?assess/, icon: ClipboardPen, tone: "bg-sun-50 text-sun-700" },
  { test: /(apprais|review)/, icon: ClipboardCheck, tone: "bg-primary-50 text-primary-700" },
  { test: /leave/, icon: CalendarDays, tone: "bg-sky-50 text-sky-700" },
  { test: /(payslip|pay)/, icon: Wallet, tone: "bg-mint-50 text-mint-700" },
  { test: /(interview|hire|offer)/, icon: UserRoundCheck, tone: "bg-primary-50 text-primary-700" },
];

/**
 * Operations notifications (`operations.*`): one desk per type, so the icon
 * says which desk is asking — equipment overdue, a trip report, a client to
 * chase, a handover or voucher to confirm, a count variance.
 */
const OPERATIONS_VISUALS: Record<string, { icon: typeof Bell; tone: string }> = {
  gate_pass: { icon: DoorOpen, tone: "bg-rose-50 text-rose-700" },
  travel: { icon: Plane, tone: "bg-sky-50 text-sky-700" },
  client_payments: { icon: Banknote, tone: "bg-mint-50 text-mint-700" },
  assets: { icon: PackageCheck, tone: "bg-primary-50 text-primary-700" },
  stores: { icon: Boxes, tone: "bg-sun-50 text-sun-700" },
  compliance: { icon: ShieldCheck, tone: "bg-grape-50 text-grape-700" },
  facilities: { icon: Building2, tone: "bg-sky-50 text-sky-700" },
  service_desk: { icon: LifeBuoy, tone: "bg-primary-50 text-primary-700" },
  correspondence: { icon: Mail, tone: "bg-mint-50 text-mint-700" },
  /* A visitor you registered has checked in (or reception cancelled the visit). */
  visitors: { icon: UserRoundCheck, tone: "bg-grape-50 text-grape-700" },
};

const LEARNING_KIND = /^(course|learning_path|path|lesson|certificate|enrolment)/;

export function notificationVisual(
  kind: string,
  data: Record<string, unknown> = {},
): { icon: typeof Bell; tone: string } {
  if (kind === "projects.status_changed") {
    /* The API says which way it moved; "sent back" is the one to notice. */
    if (data.direction === "back") return { icon: Undo2, tone: "bg-sun-50 text-sun-700" };
    if (data.direction === "done") return { icon: CircleCheckBig, tone: "bg-mint-50 text-mint-700" };
  }
  if (kind.startsWith("projects.")) {
    const rest = kind.slice("projects.".length);
    return (
      PROJECT_VISUALS.find((v) => v.test.test(rest)) ?? {
        icon: FolderKanban,
        tone: "bg-primary-50 text-primary-700",
      }
    );
  }
  if (kind.startsWith("hrm.")) {
    const rest = kind.slice("hrm.".length);
    return (
      HRM_VISUALS.find((v) => v.test.test(rest)) ?? {
        icon: Users,
        tone: "bg-sky-50 text-sky-700",
      }
    );
  }
  if (kind.startsWith("operations.")) {
    return (
      OPERATIONS_VISUALS[kind.slice("operations.".length)] ?? {
        icon: Briefcase,
        tone: "bg-neutral-100 text-neutral-600",
      }
    );
  }
  if (kind.startsWith("lms.") || LEARNING_KIND.test(kind)) {
    const rest = kind.replace(/^lms\./, "");
    return (
      LEARNING_VISUALS.find((v) => v.test.test(rest)) ?? {
        icon: GraduationCap,
        tone: "bg-grape-50 text-grape-700",
      }
    );
  }
  const k = kind as NotificationKind;
  return { icon: KIND_ICON[k] ?? Bell, tone: KIND_TONE[k] ?? KIND_TONE.info };
}

/**
 * Where a notification opens.
 *
 * The server's `url` wins. When it is an absolute address on this same site
 * (an email-style link), it is made relative so the click stays in the app
 * rather than reloading it. When there is no `url`, a link is derived from the
 * payload — a course, a project item, a project, a review — so a notification
 * about something is never a dead end.
 */
export function notificationHref(n: Pick<AppNotification, "url" | "data">, origin?: string): string | null {
  const url = typeof n.url === "string" && n.url.trim() !== "" ? n.url.trim() : null;

  if (url !== null) {
    if (url.startsWith("/")) return url;
    try {
      const here = origin ?? (typeof window !== "undefined" ? window.location.origin : undefined);
      const parsed = new URL(url);
      if (here !== undefined && parsed.origin === here) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
    return url;
  }

  const d = n.data ?? {};
  const str = (key: string) => (typeof d[key] === "string" && d[key] !== "" ? (d[key] as string) : null);

  const course = str("courseSlug");
  if (course !== null) return `/learn/${encodeURIComponent(course)}`;

  const project = str("projectSlug");
  const item = str("workItemId") ?? str("itemId");
  if (project !== null && item !== null) {
    return `/suite/projects/${encodeURIComponent(project)}?item=${encodeURIComponent(item)}`;
  }
  if (project !== null) return `/suite/projects/${encodeURIComponent(project)}`;

  if (str("reviewId") !== null || str("cycleId") !== null || str("appraisalId") !== null) {
    return "/suite/hrm/reviews";
  }

  return null;
}

function NotificationRow({
  notification: n,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: () => void;
}) {
  const { icon: Icon, tone } = notificationVisual(String(n.kind ?? "info"), n.data ?? {});
  const href = notificationHref(n);

  const body = (
    <div className="flex gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={15} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-800">{n.title}</p>
        <p className="text-xs text-neutral-500">{n.message}</p>
        <p className="mt-0.5 text-[11px] text-neutral-400">{timeAgo(n.createdAt)}</p>
      </div>
      {n.unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />}
    </div>
  );

  const className = `block w-full border-b border-neutral-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-neutral-50 ${
    n.unread ? "bg-primary-50/40" : ""
  }`;

  return (
    <li>
      {href !== null ? (
        <Link href={href} onClick={onOpen} className={className}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={className}>
          {body}
        </button>
      )}
    </li>
  );
}
