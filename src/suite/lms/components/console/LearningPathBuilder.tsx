"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, FileText, Plus, Route, Save, Search, X } from "lucide-react";
import {
  learningPaths as api,
  ApiError,
  type LearningPath,
  type PathCourse,
} from "@/lib/api/saas-client";
import { courses as coursesApi, type AdminCourse } from "@/lib/api/admin-client";
import { CourseThumb } from "@/components/shared/CourseCover";
import { Button, Chip, Empty, PageHeader, Panel, buttonClass } from "@/components/workspace/kit";
import {
  BackLink,
  ErrorNote,
  inputClass,
  labelClass,
} from "@/suite/lms/components/ui/ws";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

const ICON_BTN =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-30";

/**
 * Builds an ordered track out of the institution's courses.
 *
 * Order is the whole point of a path, so reordering is a first-class control
 * rather than drag-and-drop. Up/down buttons are keyboard-operable and work on
 * touch without a long-press: drag would need a fallback built anyway, and
 * a path is a handful of courses, not a hundred.
 *
 * `isRequired` is per course because real tracks have optional extras: only
 * required courses count towards the completion figure the learner is shown.
 */
export default function LearningPathBuilder({ existing }: { existing?: LearningPath }) {
  const router = useRouter();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState<"draft" | "published">(existing?.status ?? "draft");
  const [selected, setSelected] = useState<PathCourse[]>(existing?.courses ?? []);

  const [catalog, setCatalog] = useState<AdminCourse[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coursesApi
      .list()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  const chosenSlugs = useMemo(() => new Set(selected.map((c) => c.slug)), [selected]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog ?? [])
      .filter((c) => !chosenSlugs.has(c.slug))
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true));
  }, [catalog, chosenSlugs, query]);

  const canSave = title.trim().length > 1 && !saving;

  function add(course: AdminCourse) {
    setSelected((prev) => [
      ...prev,
      {
        slug: course.slug,
        title: course.title,
        gradient: course.gradient,
        thumbnailUrl: course.thumbnailUrl,
        totalLectures: course.lectures,
        duration: null,
        position: prev.length,
        isRequired: true,
      },
    ]);
  }

  function move(index: number, direction: -1 | 1) {
    setSelected((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);

    const body = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      courseSlugs: selected.map((c) => c.slug),
      // Omitting this entirely would mark everything required; send the real
      // subset so an optional course stays optional.
      requiredSlugs: selected.filter((c) => c.isRequired).map((c) => c.slug),
    };

    try {
      const saved = existing ? await api.update(existing.slug, body) : await api.create(body);
      router.push(`/suite/lms/learning-paths/${saved.slug}`);
      router.refresh();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "We could not save this path.");
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <BackLink href="/suite/lms/learning-paths" label="All learning paths" />

        <PageHeader
          eyebrow="Learning paths"
          title={existing ? "Edit learning path" : "New learning path"}
          subtitle="Pick the courses and put them in the order learners should take them."
          actions={
            <button type="submit" disabled={!canSave} className={buttonClass("primary")}>
              <Save size={17} aria-hidden="true" />
              {saving ? "Saving…" : existing ? "Save changes" : "Create path"}
            </button>
          }
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel
            title="Courses on this path"
            subtitle="In the order learners will take them."
            icon={Route}
            hue="grape"
            actions={
              selected.length > 0 ? (
                <Chip hue="grape">
                  {selected.length} course{selected.length === 1 ? "" : "s"} ·{" "}
                  {selected.filter((c) => c.isRequired).length} required
                </Chip>
              ) : undefined
            }
          >
            {selected.length === 0 ? (
              <Empty
                icon={Route}
                hue="grape"
                title="No courses yet"
                hint="A path needs at least one course before it can be assigned."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => setPicking(true)}>
                    Add courses
                  </Button>
                }
              />
            ) : (
              <>
                <ol className="relative space-y-2.5">
                  {selected.map((course, index) => (
                    <li
                      key={course.slug}
                      className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-[0_1px_2px_rgb(16_18_31/0.03),0_10px_28px_-14px_rgb(150_56_205/0.22)] transition-shadow hover:shadow-md"
                    >
                      {/* The number is information: it is the order the learner
                          takes these in, not decoration. */}
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-grape-400 to-grape-600 text-sm font-bold tabular-nums text-white shadow-md shadow-grape-500/25">
                        {index + 1}
                      </span>

                      <CourseThumb
                        title={course.title}
                        gradient={course.gradient}
                        thumbnailUrl={course.thumbnailUrl}
                        size={40}
                        rounded="rounded-xl"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{course.title}</p>
                        <p className="text-xs text-neutral-500">
                          {course.totalLectures} lesson{course.totalLectures === 1 ? "" : "s"}
                          {course.isRequired ? " · required" : " · optional"}
                        </p>
                      </div>

                      <label className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 sm:flex">
                        <input
                          type="checkbox"
                          checked={course.isRequired}
                          onChange={(e) =>
                            setSelected((prev) =>
                              prev.map((c) => (c.slug === course.slug ? { ...c, isRequired: e.target.checked } : c)),
                            )
                          }
                          className="h-4 w-4 rounded border-neutral-300 accent-primary-600 focus:ring-2 focus:ring-primary-500"
                        />
                        Required
                      </label>

                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${course.title} up`}
                          className={ICON_BTN}
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === selected.length - 1}
                          aria-label={`Move ${course.title} down`}
                          className={ICON_BTN}
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelected((prev) => prev.filter((c) => c.slug !== course.slug))}
                          aria-label={`Remove ${course.title} from this path`}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>

                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 text-sm font-semibold text-neutral-600 outline-none transition-colors hover:border-primary-300 hover:bg-primary-50/40 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add another course
                </button>
              </>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Details" icon={FileText} hue="sky">
            <div className="space-y-5">
              <div>
                <label htmlFor="path-title" className={labelClass}>
                  Title <span className="text-error-600">*</span>
                </label>
                <input
                  id="path-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={255}
                  placeholder="New starter onboarding"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="path-description" className={labelClass}>
                  Description
                </label>
                <RichTextEditor id="path-description" minHeight={128} value={description} onChange={setDescription} placeholder="Who it is for and what they will be able to do at the end." />
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-neutral-700">Availability</legend>

                {(
                  [
                    {
                      value: "draft",
                      label: "Draft",
                      hint: "Only you can see it. Instructors cannot assign it yet.",
                    },
                    {
                      value: "published",
                      label: "Published",
                      hint: "Instructors can assign it to their learners.",
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className="mb-2 flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 p-3.5 text-sm transition-colors hover:border-primary-200 has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50/60"
                  >
                    <input
                      type="radio"
                      name="path-status"
                      value={option.value}
                      checked={status === option.value}
                      onChange={() => setStatus(option.value)}
                      className="mt-0.5 h-4 w-4 border-neutral-300 accent-primary-600 focus:ring-2 focus:ring-primary-500"
                    />
                    <span>
                      <span className="block font-semibold text-neutral-900">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
          </Panel>
        </div>
      </div>

      {picking && (
        <CoursePicker
          courses={available}
          loading={catalog === null}
          query={query}
          onQuery={setQuery}
          onPick={(course) => {
            add(course);
            setPicking(false);
            setQuery("");
          }}
          onClose={() => {
            setPicking(false);
            setQuery("");
          }}
        />
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */

function CoursePicker({
  courses,
  loading,
  query,
  onQuery,
  onPick,
  onClose,
}: {
  courses: AdminCourse[];
  loading: boolean;
  query: string;
  onQuery: (v: string) => void;
  onPick: (course: AdminCourse) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-neutral-900/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        className="relative mt-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl sm:mb-auto sm:rounded-[1.5rem]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 p-5">
          <h2 id="picker-title" className="text-lg font-semibold text-neutral-900">
            Add a course
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-neutral-200 p-5 pb-3">
          <label htmlFor="picker-search" className="sr-only">
            Search courses
          </label>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              id="picker-search"
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search your courses"
              className="h-11 w-full rounded-xl border border-neutral-200 pl-10 pr-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-5" role="status" aria-busy="true">
              <span className="sr-only">Loading courses</span>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-neutral-100 motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-neutral-500">
              {query
                ? "No courses match that search."
                : "Every course in your organisation is already on this path."}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {courses.map((course) => (
                <li key={course.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(course)}
                    className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-primary-50/50 focus:bg-primary-50/50 focus:outline-none"
                  >
                    <CourseThumb
                      title={course.title}
                      gradient={course.gradient}
                      thumbnailUrl={course.thumbnailUrl}
                      size={36}
                      rounded="rounded-lg"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">
                        {course.title}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {course.lectures} lessons · {course.status}
                      </span>
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
