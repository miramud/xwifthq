"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Megaphone, Plus, Send, Users, Eye, X } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { hueFor } from "@/components/workspace/modules";
import {
  ErrorNote,
  IconTile,
  StatCard,
  inputClass,
  labelClass,
} from "@/suite/lms/components/ui/ws";
import { Meter } from "@/suite/lms/components/ui/teach";
import { formatCompact } from "@/suite/lms/lib/instructor-data";
import {
  announcements as announcementsApi,
  courses as coursesApi,
  ApiError,
  type Announcement,
  type InstructorCourse,
} from "@/lib/api/instructor-client";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

const AUDIENCES = [
  "All enrolled students",
  "Active students",
  "Completed students",
] as const;

const ALL_COURSES = "All courses";

export default function InstructorAnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [published, setPublished] = useState<InstructorCourse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [course, setCourse] = useState(ALL_COURSES);
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    try {
      const [anns, courseList] = await Promise.all([
        announcementsApi.list(),
        coursesApi.list(),
      ]);
      setList(anns);
      setPublished(courseList.filter((c) => c.status === "Published"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Announcements didn't load. Try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalSent = list.length;
  const totalReached = list.reduce((sum, a) => sum + a.recipients, 0);
  const avgOpenRate = totalSent
    ? Math.round(list.reduce((sum, a) => sum + (a.openRate ?? 0), 0) / totalSent)
    : 0;

  const baseRecipients = useMemo(
    () =>
      course === ALL_COURSES
        ? published.reduce((sum, c) => sum + c.students, 0)
        : published.find((c) => c.title === course)?.students ?? 0,
    [course, published],
  );
  const audienceFactor =
    audience === "Active students" ? 0.74 : audience === "Completed students" ? 0.21 : 1;
  const recipientEstimate = Math.round(baseRecipients * audienceFactor);

  const closeComposer = () => {
    setComposerOpen(false);
    setTitle("");
    setBody("");
  };

  const send = useCallback(async () => {
    if (!title.trim() || !body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const courseSlug =
        course === ALL_COURSES
          ? undefined
          : published.find((c) => c.title === course)?.slug;
      await announcementsApi.create({
        title: title.trim(),
        body: body.trim(),
        courseSlug,
        audience,
      });
      await load();
      closeComposer();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Your announcement wasn't sent. Try again.");
    } finally {
      setSending(false);
    }
  }, [title, body, sending, course, published, audience, load]);

  const columns: Column<Announcement>[] = [
    {
      key: "title",
      header: "Announcement",
      primary: true,
      sortable: true,
      value: (a) => a.title,
      render: (a) => (
        <span className="flex items-center gap-3">
          <IconTile icon={Megaphone} hue={hueFor(a.course)} />
          <span className="min-w-0">
            <span className="block max-w-[280px] truncate font-medium text-neutral-900">{a.title}</span>
            <span className="block max-w-[280px] truncate text-xs text-neutral-500">{richExcerpt(a.body, 160)}</span>
          </span>
        </span>
      ),
    },
    { key: "course", header: "Course", sortable: true, value: (a) => a.course, render: (a) => <Chip hue={hueFor(a.course)}>{a.course}</Chip> },
    { key: "audience", header: "Audience", hideOnMobile: true, value: (a) => a.audience, render: (a) => <Chip hue="sky">{a.audience}</Chip> },
    { key: "recipients", header: "Recipients", align: "right", sortable: true, value: (a) => a.recipients, render: (a) => formatCompact(a.recipients) },
    {
      key: "openRate",
      header: "Opened",
      sortable: true,
      value: (a) => a.openRate ?? 0,
      render: (a) => (
        <span className="flex min-w-[8rem] items-center gap-2">
          <span className="w-20">
            <Meter value={a.openRate ?? 0} size="sm" hue="mint" label={`${a.title} open rate`} />
          </span>
          <span className="text-xs tabular-nums text-neutral-600">{a.openRate ?? 0}%</span>
        </span>
      ),
    },
    {
      key: "sentOn",
      header: "Sent",
      sortable: true,
      hideOnMobile: true,
      value: (a) => a.sentOn,
      render: (a) => <span className="text-neutral-500">{new Date(a.sentOn).toLocaleDateString()}</span>,
    },
  ];

  const announcementBody = (a: Announcement) => (
    <div className="flex gap-4 p-5">
      <IconTile icon={Megaphone} hue={hueFor(a.course)} size={40} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-neutral-900">{a.title}</p>
        <RichTextView value={a.body} size="sm" className="mt-0.5 text-neutral-600" />

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Chip hue={hueFor(a.course)}>{a.course}</Chip>
          <Chip hue="sky">{a.audience}</Chip>
          <span className="text-xs text-neutral-500">{new Date(a.sentOn).toLocaleDateString()}</span>
          <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
            <Users size={12} aria-hidden />
            <span className="tabular-nums">{formatCompact(a.recipients)}</span> recipients
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="w-40">
            <Meter value={a.openRate ?? 0} size="sm" hue="mint" label={`${a.title} open rate`} />
          </span>
          <span className="text-xs font-medium tabular-nums text-neutral-600">{a.openRate ?? 0}% opened</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Send updates to the learners on your courses."
        actions={
          <Button variant="primary" icon={Megaphone} onClick={() => setComposerOpen((v) => !v)}>
            New announcement
          </Button>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <StatGrid cols={3}>
        <StatCard featured featuredHue="sky" icon={Megaphone} label="Announcements sent" value={`${totalSent}`} />
        <StatCard icon={Users} hue="grape" label="Learners reached" value={formatCompact(totalReached)} />
        <StatCard icon={Eye} hue="mint" label="Average open rate" value={`${avgOpenRate}%`} />
      </StatGrid>

      {/* composer */}
      {composerOpen ? (
        <Panel
          title="New announcement"
          subtitle="Write a message for your learners"
          icon={Megaphone}
          hue="sky"
          actions={
            <button
              type="button"
              onClick={closeComposer}
              aria-label="Close composer"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <X size={18} aria-hidden />
            </button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ann-course" className={labelClass}>
                  Course
                </label>
                <SearchableSelect
                  id="ann-course"
                  value={course}
                  onChange={setCourse}
                  searchPlaceholder="Search courses"
                  options={[
                    { value: ALL_COURSES, label: ALL_COURSES },
                    ...published.map((c) => ({ value: c.title, label: c.title })),
                  ]}
                />
              </div>
              <div>
                <label htmlFor="ann-audience" className={labelClass}>
                  Audience
                </label>
                <SearchableSelect
                  id="ann-audience"
                  value={audience}
                  onChange={setAudience}
                  options={AUDIENCES.map((a) => ({ value: a, label: a }))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="ann-title" className={labelClass}>
                Title
              </label>
              <input
                id="ann-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New module added: Real-time with WebSockets"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="ann-body" className={labelClass}>
                Message
              </label>
              <RichTextEditor id="ann-body" minHeight={128} value={body} onChange={setBody} placeholder="Write your announcement…" />
            </div>

            <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 text-sm text-neutral-500">
                <Users size={15} className="text-neutral-400" aria-hidden />
                Reaches about{" "}
                <span className="font-semibold tabular-nums text-neutral-900">{formatCompact(recipientEstimate)}</span> learners
              </p>
              <div className="flex items-center gap-2">
                <Button onClick={closeComposer}>Cancel</Button>
                <Button
                  variant="primary"
                  icon={Send}
                  onClick={send}
                  disabled={!title.trim() || !body.trim() || sending}
                >
                  {sending ? "Sending…" : "Send announcement"}
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[1.25rem] border border-dashed border-primary-200 bg-white px-5 py-4 text-left outline-none transition-colors hover:border-primary-300 hover:bg-primary-50/40 focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <IconTile icon={Plus} hue="sky" />
          <span className="text-sm text-neutral-500">Write an announcement…</span>
        </button>
      )}

      {/* sent announcements */}
      <section aria-labelledby="sent-heading">
        <div className="mb-3 flex items-center gap-3">
          <IconTile icon={Send} hue="blue" />
          <div>
            <h2 id="sent-heading" className="text-base font-bold tracking-tight text-neutral-900">
              Sent announcements
            </h2>
            <p className="text-xs text-neutral-500">Everything you have sent</p>
          </div>
        </div>
        <DataView
          rows={list}
          columns={columns}
          rowKey={(a) => a.id}
          storageKey="teach.announcements"
          defaultView="list"
          gridCols={2}
          caption="Sent announcements"
          searchPlaceholder="Search announcements"
          empty={
            <Empty
              icon={Megaphone}
              hue="sky"
              title="No announcements yet"
              hint="Send an update to keep your learners up to date with your courses."
            />
          }
          renderListItem={announcementBody}
          renderCard={announcementBody}
        />
      </section>
    </div>
  );
}
