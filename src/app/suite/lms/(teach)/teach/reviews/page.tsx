"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Star, MessageSquare, ThumbsUp, Reply, BookOpen } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { StatusBars } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { hueFor } from "@/components/workspace/modules";
import { Stars } from "@/components/dashboard/ui";
import { ErrorNote, FaceAvatar, StatCard, textareaClass } from "@/suite/lms/components/ui/ws";
import { formatCompact } from "@/suite/lms/lib/instructor-data";
import {
  reviews as reviewsApi,
  ApiError,
  type InstructorReview,
} from "@/lib/api/instructor-client";

const RATING_OPTIONS = ["All", "5★", "4★", "3★", "2★", "1★"] as const;
type ReplyFilter = "All" | "Replied" | "Needs reply";

type RatingFilter = (typeof RATING_OPTIONS)[number];

export default function InstructorReviewsPage() {
  const [items, setItems] = useState<InstructorReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("All");
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>("All");
  const [courseFilter, setCourseFilter] = useState("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openComposers, setOpenComposers] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await reviewsApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Reviews didn't load. Try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const distribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        count: items.filter((r) => r.rating === stars).length,
      })),
    [items],
  );
  const avgRating = items.length ? items.reduce((s, r) => s + r.rating, 0) / items.length : 0;

  const courseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of items) {
      if (r.courseSlug && !seen.has(r.courseSlug)) seen.set(r.courseSlug, r.courseTitle ?? r.courseSlug);
    }
    return [...seen.entries()].map(([slug, title]) => ({ slug, title }));
  }, [items]);

  const filtered = items.filter((r) => {
    if (ratingFilter !== "All" && r.rating !== Number(ratingFilter[0])) return false;
    if (replyFilter === "Replied" && !r.reply) return false;
    if (replyFilter === "Needs reply" && r.reply) return false;
    if (courseFilter !== "all" && r.courseSlug !== courseFilter) return false;
    return true;
  });

  const repliedCount = items.filter((r) => r.reply).length;
  const needsReplyCount = items.length - repliedCount;

  const toggleComposer = (id: string) => {
    setOpenComposers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const postReply = useCallback(
    async (id: string) => {
      const text = (drafts[id] ?? "").trim();
      if (!text || posting) return;
      setPosting(id);
      try {
        await reviewsApi.reply(id, text);
        setDrafts((prev) => ({ ...prev, [id]: "" }));
        setOpenComposers((prev) => ({ ...prev, [id]: false }));
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Your reply wasn't posted. Try again.");
      } finally {
        setPosting(null);
      }
    },
    [drafts, posting, load],
  );

  const reviewCard = (r: InstructorReview) => {
    const composerOpen = openComposers[r.id] ?? false;
    return (
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <FaceAvatar name={r.student} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-neutral-900">{r.student}</span>
              <Stars rating={r.rating} />
              <span className="text-xs text-neutral-500">{new Date(r.date).toLocaleDateString()}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip hue={r.courseTitle ? hueFor(r.courseTitle) : "slate"} icon={BookOpen}>
                {r.courseTitle ?? "-"}
              </Chip>
              {!r.reply && <Chip hue="coral">Needs reply</Chip>}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-neutral-600">{r.body}</p>

        {/* reply or composer */}
        {r.reply ? (
          <div className="mt-3 rounded-2xl bg-primary-50 px-4 py-3">
            <p className="text-xs font-semibold text-primary-700">
              You replied{r.replyDate ? ` · ${new Date(r.replyDate).toLocaleDateString()}` : ""}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">{r.reply}</p>
          </div>
        ) : (
          <div className="mt-3">
            {composerOpen ? (
              <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-3">
                <label className="sr-only" htmlFor={`reply-${r.id}`}>
                  Reply to {r.student}
                </label>
                <textarea
                  id={`reply-${r.id}`}
                  value={drafts[r.id] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  rows={3}
                  placeholder={`Reply to ${r.student}…`}
                  className={`${textareaClass} resize-y`}
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleComposer(r.id)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Reply}
                    onClick={() => postReply(r.id)}
                    disabled={posting === r.id || !(drafts[r.id] ?? "").trim()}
                  >
                    {posting === r.id ? "Posting…" : "Post reply"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" icon={Reply} onClick={() => toggleComposer(r.id)}>
                Reply
              </Button>
            )}
          </div>
        )}

        {/* helpful */}
        <div className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-neutral-500">
          <ThumbsUp size={14} aria-hidden />
          Helpful ({r.helpful})
        </div>
      </div>
    );
  };

  const columns: Column<InstructorReview>[] = [
    {
      key: "student",
      header: "Learner",
      primary: true,
      sortable: true,
      value: (r) => r.student,
      render: (r) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={r.student} size={32} />
          <span className="font-medium text-neutral-900">{r.student}</span>
        </span>
      ),
    },
    {
      key: "course",
      header: "Course",
      sortable: true,
      value: (r) => r.courseTitle,
      render: (r) => <span className="block max-w-[200px] truncate">{r.courseTitle ?? "-"}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      value: (r) => r.rating,
      render: (r) => <Stars rating={r.rating} size={13} />,
    },
    {
      key: "body",
      header: "Review",
      value: (r) => r.body,
      hideOnMobile: true,
      render: (r) => <span className="line-clamp-2 max-w-sm text-neutral-600">{r.body}</span>,
    },
    {
      key: "replied",
      header: "Reply",
      sortable: true,
      value: (r) => (r.reply ? "Replied" : "Needs reply"),
      render: (r) =>
        r.reply ? <Chip hue="mint" dot>Replied</Chip> : <Chip hue="coral" dot>Needs reply</Chip>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.date,
      render: (r) => <span className="text-neutral-500">{new Date(r.date).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        subtitle="What learners say about your courses. Reply to show you are listening."
        tabs={[
          { key: "All", label: "All", count: items.length },
          { key: "Needs reply", label: "Needs reply", count: needsReplyCount },
          { key: "Replied", label: "Replied", count: repliedCount },
        ]}
        activeTab={replyFilter}
        onTab={(k) => setReplyFilter(k as ReplyFilter)}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <StatGrid cols={3}>
        <StatCard featured featuredHue="grape" icon={Star} label="Average rating" value={avgRating.toFixed(1)} unit="/ 5" />
        <StatCard icon={MessageSquare} hue="sky" label="Reviews" value={formatCompact(items.length)} />
        <StatCard icon={Reply} hue="coral" label="Waiting for a reply" value={needsReplyCount} hint={`${repliedCount} replied`} />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <DataView
            rows={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey="teach.reviews"
            defaultView="list"
            gridCols={2}
            caption="Reviews of your courses"
            searchPlaceholder="Search reviews…"
            matches={(r, q) => r.student.toLowerCase().includes(q) || r.body.toLowerCase().includes(q)}
            toolbar={
              <>
                <SearchableSelect
                  size="sm"
                  className="w-40"
                  aria-label="Filter by rating"
                  value={ratingFilter}
                  onChange={(v) => setRatingFilter(v as RatingFilter)}
                  options={RATING_OPTIONS.map((o) => ({ value: o, label: o === "All" ? "All ratings" : o }))}
                />
                <SearchableSelect
                  size="sm"
                  className="w-56"
                  aria-label="Filter by course"
                  value={courseFilter}
                  onChange={setCourseFilter}
                  searchPlaceholder="Search courses"
                  options={[
                    { value: "all", label: "All courses" },
                    ...courseOptions.map((c) => ({ value: c.slug, label: c.title })),
                  ]}
                />
              </>
            }
            empty={
              <Empty
                icon={MessageSquare}
                title="No reviews match these filters"
                hint="Clear the search, or pick another rating or course."
              />
            }
            renderCard={reviewCard}
            renderListItem={reviewCard}
          />
        </div>

        {/* summary */}
        <Panel title="Rating breakdown" icon={Star} hue="sun" className="xl:sticky xl:top-6 xl:self-start">
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-sun-50 px-4 py-3">
            <span className="text-3xl font-bold tracking-tight tabular-nums text-neutral-900">{avgRating.toFixed(1)}</span>
            <span className="min-w-0">
              <Stars rating={avgRating} size={14} />
              <span className="mt-0.5 block text-xs text-neutral-600">
                {items.length.toLocaleString()} {items.length === 1 ? "review" : "reviews"}
              </span>
            </span>
          </div>
          <StatusBars
            data={distribution.map((d) => ({
              label: `${d.stars} star${d.stars === 1 ? "" : "s"}`,
              value: d.count,
              hue: d.stars >= 4 ? "mint" : d.stars === 3 ? "sun" : "coral",
            }))}
            caption="Number of reviews at each star rating"
          />
        </Panel>
      </div>
    </div>
  );
}
