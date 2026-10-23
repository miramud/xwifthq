"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  MessageSquare,
  Clock,
  Flag,
  AlertTriangle,
  ArrowUpRight,
  Check,
  Trash2,
  EyeOff,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Stars } from "@/components/dashboard/ui";
import { Chip, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import type { Hue } from "@/components/workspace/modules";
import { ErrorNote, FaceAvatar, StatCard, StatusChip } from "@/suite/lms/components/ui/ws";
import { formatCompact } from "@/lib/console-data";
import {
  reviews as reviewsApi,
  ApiError,
  type AdminReview,
} from "@/lib/api/admin-client";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/* ------------------------------------------------------------------ */
/*  Status helpers (backend stores lowercase enum values)              */
/* ------------------------------------------------------------------ */

const STATUS_LABEL: Record<string, string> = {
  published: "Published",
  pending: "Pending",
  flagged: "Flagged",
  removed: "Removed",
};

const STATUS_HUE: Record<string, Hue> = {
  published: "mint",
  pending: "sun",
  flagged: "rose",
  removed: "slate",
};

const STATUS_FILTERS = ["All", "Flagged", "Pending", "Published", "Removed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function label(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/* ------------------------------------------------------------------ */
/*  Action button                                                      */
/* ------------------------------------------------------------------ */

function ActionButton({
  icon: Icon,
  label,
  tone = "outline",
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "success" | "error" | "outline";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles =
    tone === "success"
      ? "border-mint-500/25 bg-mint-50 text-mint-700 hover:bg-mint-100"
      : tone === "error"
        ? "border-error-500/20 bg-error-500/5 text-error-700 hover:bg-error-500/10"
        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */

export default function AdminReviewsPage() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<StatusFilter>("Flagged");
  const [items, setItems] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await reviewsApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moderate = useCallback(
    async (id: string, next: string) => {
      setBusyId(id);
      setError(null);
      try {
        await reviewsApi.setStatus(id, next);
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not update the review.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: "Delete this review?",
        body: "",
        confirmLabel: "Delete review",
        recoverable: true,
      });
      if (!ok) return;
      setBusyId(id);
      setError(null);
      try {
        await reviewsApi.remove(id);
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not delete the review.");
      } finally {
        setBusyId(null);
      }
    },
    [load, confirm],
  );

  const counts = useMemo(() => {
    const c = { flagged: 0, pending: 0, published: 0, removed: 0, reports: 0 };
    for (const r of items) {
      if (r.status === "flagged") c.flagged++;
      else if (r.status === "pending") c.pending++;
      else if (r.status === "published") c.published++;
      else if (r.status === "removed") c.removed++;
      c.reports += r.reports;
    }
    return c;
  }, [items]);

  const rows = useMemo(
    () => items.filter((r) => status === "All" || label(r.status) === status),
    [status, items],
  );

  const actions = (r: AdminReview) => {
    const needsAction = r.status === "flagged" || r.status === "pending";
    const busy = busyId === r.id;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {needsAction && (
          <>
            <ActionButton icon={Check} label="Approve" tone="success" disabled={busy} onClick={() => moderate(r.id, "published")} />
            <ActionButton icon={Trash2} label="Remove" tone="error" disabled={busy} onClick={() => moderate(r.id, "removed")} />
          </>
        )}
        {r.status === "published" && (
          <>
            <ActionButton icon={EyeOff} label="Hide" tone="outline" disabled={busy} onClick={() => moderate(r.id, "flagged")} />
            <ActionButton icon={Trash2} label="Delete" tone="error" disabled={busy} onClick={() => remove(r.id)} />
          </>
        )}
        {r.status === "removed" && (
          <ActionButton icon={RotateCcw} label="Restore" tone="success" disabled={busy} onClick={() => moderate(r.id, "published")} />
        )}
      </div>
    );
  };

  /*
    The queue shows enough to triage. Deciding needs the author, whether they
    took the course, and the instructor's reply — none of which fit on a card.
  */
  const openLink = (r: AdminReview) => (
    <Link
      href={`/suite/lms/reviews/${r.id}`}
      className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary-700 hover:bg-primary-50"
    >
      Open
      <ArrowUpRight size={13} aria-hidden />
    </Link>
  );

  const author = (r: AdminReview, size = 36) => (
    <div className="flex min-w-0 items-center gap-3">
      <FaceAvatar name={r.student} size={size} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-neutral-900">{r.student}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <Stars rating={r.rating} />
          <span className="text-xs tabular-nums text-neutral-500">{new Date(r.date).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );

  const context = (r: AdminReview) => (
    <p className="text-xs text-neutral-500">
      on <span className="font-medium text-neutral-700">{r.courseTitle ?? "—"}</span> · by{" "}
      <span className="font-medium text-neutral-700">{r.instructor ?? "—"}</span>
    </p>
  );

  const reports = (r: AdminReview) =>
    r.reports > 0 ? (
      <Chip hue="rose" icon={Flag}>
        {r.reports} {r.reports === 1 ? "report" : "reports"}
      </Chip>
    ) : null;

  const columns: Column<AdminReview>[] = [
    {
      key: "student",
      header: "Review",
      primary: true,
      sortable: true,
      value: (r) => r.student,
      render: (r) => (
        <div className="min-w-[260px] space-y-1.5">
          {author(r, 32)}
          <p className="line-clamp-2 max-w-md text-sm text-neutral-600">{r.body}</p>
        </div>
      ),
    },
    {
      key: "course",
      header: "Course",
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.courseTitle ?? "",
      render: (r) => (
        <div className="min-w-0">
          <p className="max-w-[200px] truncate font-medium text-neutral-800">{r.courseTitle ?? "—"}</p>
          <p className="max-w-[200px] truncate text-xs text-neutral-500">{r.instructor ?? "—"}</p>
        </div>
      ),
    },
    { key: "rating", header: "Rating", sortable: true, tableOnly: true, value: (r) => r.rating, render: (r) => r.rating },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => label(r.status),
      render: (r) => (
        <span className="flex flex-col items-start gap-1">
          <StatusChip status={r.status} label={label(r.status)} hue={STATUS_HUE[r.status]} />
          {reports(r)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      tableOnly: true,
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {actions(r)}
          {openLink(r)}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review moderation"
        subtitle={`${counts.flagged} flagged · ${counts.pending} pending · ${counts.published} published`}
        tabs={STATUS_FILTERS.map((s) => ({
          key: s,
          label: s,
          count:
            s === "All"
              ? items.length
              : s === "Flagged"
                ? counts.flagged
                : s === "Pending"
                  ? counts.pending
                  : s === "Published"
                    ? counts.published
                    : counts.removed,
        }))}
        activeTab={status}
        onTab={(k) => setStatus(k as StatusFilter)}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* mini stats */}
      <StatGrid>
        <StatCard featured featuredHue="grape" icon={MessageSquare} label="Total reviews" value={formatCompact(items.length)} />
        <StatCard icon={Clock} label="Pending review" value={formatCompact(counts.pending)} hue="sun" />
        <StatCard icon={Flag} label="Flagged" value={formatCompact(counts.flagged)} hue="rose" />
        <StatCard icon={AlertTriangle} label="Total reports" value={formatCompact(counts.reports)} hue="coral" />
      </StatGrid>

      {/* queue */}
      <DataView
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        storageKey="lms.reviews"
        defaultView="list"
        caption="Reviews in the moderation queue"
        searchPlaceholder="Search reviews by student, course, body…"
        matches={(r, q) =>
          r.student.toLowerCase().includes(q) ||
          (r.courseTitle ?? "").toLowerCase().includes(q) ||
          r.body.toLowerCase().includes(q) ||
          (r.instructor ?? "").toLowerCase().includes(q)
        }
        renderCard={(r) => (
          <div className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-2">
              {author(r)}
              <StatusChip status={r.status} label={label(r.status)} hue={STATUS_HUE[r.status]} />
            </div>
            {context(r)}
            <blockquote className="line-clamp-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-700">
              {r.body}
            </blockquote>
            {reports(r) && <div>{reports(r)}</div>}
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
              {actions(r)}
              {openLink(r)}
            </div>
          </div>
        )}
        renderListItem={(r) => (
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              {author(r, 40)}
              <div className="ml-auto flex items-center gap-2">
                {reports(r)}
                <StatusChip status={r.status} label={label(r.status)} hue={STATUS_HUE[r.status]} />
                {openLink(r)}
              </div>
            </div>
            <div className="mt-2.5 pl-[52px]">
              {context(r)}
              <blockquote className="mt-2 rounded-xl border-l-[3px] border-grape-500/40 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-700">
                {r.body}
              </blockquote>
              <div className="mt-3 flex items-center justify-between gap-2">
                {actions(r)}
                <span className="text-[11px] tabular-nums text-neutral-500">{r.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        )}
        empty={
          <Empty
            icon={ShieldCheck}
            hue="mint"
            title={loading ? "Loading reviews…" : "No reviews need attention"}
            hint={
              loading
                ? "Fetching the moderation queue from the server."
                : "Nothing matches the current filters. Try a different status or clear your search."
            }
          />
        }
      />
    </div>
  );
}
