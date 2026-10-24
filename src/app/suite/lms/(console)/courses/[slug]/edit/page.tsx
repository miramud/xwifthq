"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, Eye, EyeOff, Image as ImageIcon, Layers, Save, Trash2 } from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  BackLink,
  ErrorNote,
  Field as WsField,
  FormActions,
  SettingRow,
  StatusChip,
  Switch as Toggle,
  inputClass as INPUT,
} from "@/suite/lms/components/ui/ws";
import CurriculumEditor from "@/suite/lms/components/instructor/CurriculumEditor";
import ThumbnailUploader from "@/suite/lms/components/instructor/ThumbnailUploader";
import { type CourseStatus } from "@/lib/console-data";
import { LEVELS } from "@/suite/lms/lib/course-data";
import { useCategoryNames } from "@/lib/api/categories-client";
import { courses as coursesApi, ApiError } from "@/lib/api/admin-client";
import { apiSectionsToCurriculum, serializeSections, type Section } from "@/suite/lms/lib/curriculum";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

const STATUS_LABEL: Record<string, CourseStatus> = {
  published: "Published",
  draft: "Draft",
  review: "Review",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


/** The page's field: the workspace Field, keeping this page's htmlFor/hint call shape. */
function Field({
  label,
  htmlFor,
  hint,
  className = "",
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <WsField id={htmlFor} label={label} className={className}>
      {children}
      {hint && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
    </WsField>
  );
}

/* ------------------------------------------------------------------ */
/*  static maps                                                        */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS: { value: CourseStatus; label: string; hint: string }[] = [
  {
    value: "Published",
    label: "Published",
    hint: "Live in the catalogue, where learners can find it.",
  },
  {
    value: "Draft",
    label: "Draft",
    hint: "Hidden from learners while the instructor works on it.",
  },
  {
    value: "Review",
    label: "Review",
    hint: "Waiting for an admin to approve it before it goes live.",
  },
];

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminCourseEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  // Category taxonomy comes from the database, not a hardcoded list.
  const categoryNames = useCategoryNames();

  /* ---- controlled form ------------------------------------------- */
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    category: "",
    level: "Beginner" as (typeof LEVELS)[number],
    language: "English",
    status: "Draft" as CourseStatus,
    gradient: "from-primary-400 to-primary-600",
    thumbnailUrl: null as string | null,
    thumbnailPublicId: null as string | null,
  });
  const setField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const [featured, setFeatured] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    coursesApi
      .get(slug)
      .then((c) => {
        if (!alive) return;
        setCourseTitle(c.title);
        setForm({
          title: c.title,
          subtitle: c.shortDescription,
          description: c.description,
          category: c.category ?? "",
          level: c.level as (typeof LEVELS)[number],
          language: c.language,
          status: STATUS_LABEL[c.status] ?? "Draft",
          gradient: c.gradient ?? "from-primary-400 to-primary-600",
          thumbnailUrl: c.thumbnailUrl,
          thumbnailPublicId: c.thumbnailPublicId,
        });
        setFeatured(c.status === "published");
        setSections(apiSectionsToCurriculum(c.sections));
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof ApiError ? e.message : "We could not load this course.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await coursesApi.update(slug, {
        title: form.title,
        shortDescription: form.subtitle,
        description: form.description,
        categorySlug: slugify(form.category),
        level: form.level,
        language: form.language,
        status: form.status.toLowerCase(),
        gradient: form.gradient,
        thumbnailUrl: form.thumbnailUrl,
        thumbnailPublicId: form.thumbnailPublicId,
        // serializeSections preserves each lecture's duration and type-specific
        // content, so an admin edit no longer wipes the instructor's media.
        sections: serializeSections(sections),
      });
      router.push(`/suite/lms/courses/${slug}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the course.");
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    try {
      await coursesApi.setStatus(slug, "draft");
      setField("status", "Draft");
      setFeatured(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not unpublish the course.");
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: form.title ? `Delete “${form.title}”?` : "Delete this course?",
      body: "",
      confirmLabel: "Delete course",
      recoverable: true,
    });
    if (!ok) return;
    try {
      await coursesApi.remove(slug);
      router.push("/suite/lms/courses");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete the course.");
    }
  }

  /* ---- not found (after all hooks, per rules-of-hooks) ----------- */
  if (notFound) {
    return (
      <div>
        <BackLink href="/suite/lms/courses" label="Back to courses" />
        <Card>
          <Empty
            icon={BookOpen}
            hue="grape"
            title="Course not found"
            hint="It may have been deleted, or the link is wrong."
            action={<ButtonLink href="/suite/lms/courses">See all courses</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

  const totalLectures = sections.reduce((n, s) => n + s.lectures.length, 0);

  const saveButton = (
    <Button variant="primary" icon={Save} onClick={handleSave} disabled={saving || loading}>
      {saving ? "Saving…" : "Save changes"}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={`/suite/lms/courses/${slug}`} label="Back to course" />
        <PageHeader
          eyebrow="Edit course"
          title={
            <span className="flex flex-wrap items-center gap-3">
              {courseTitle || (loading ? "Loading…" : slug)}
              {!loading && <StatusChip status={form.status} />}
            </span>
          }
          subtitle="Change what learners see, how the course is arranged and whether it is live."
          actions={
            <>
              <ButtonLink href={`/suite/lms/courses/${slug}`}>Cancel</ButtonLink>
              {saveButton}
            </>
          }
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {/* ---- course details ---------------------------------------- */}
          <Panel
            title="Course details"
            subtitle="What learners see first."
            icon={BookOpen}
            hue="grape"
            bodyClassName="space-y-5 p-5"
          >
            <Field label="Title" htmlFor="title">
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label="Subtitle" htmlFor="subtitle" hint="A one sentence summary.">
              <input
                id="subtitle"
                type="text"
                value={form.subtitle}
                onChange={(e) => setField("subtitle", e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label="Description" htmlFor="description">
              <RichTextEditor id="description" variant="full" value={form.description} onChange={(html) => setField("description", html)} />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field label="Category" htmlFor="category">
                <SearchableSelect
                  id="category"
                  value={form.category}
                  onChange={(v) => setField("category", v)}
                  options={categoryNames.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Level" htmlFor="level">
                <SearchableSelect
                  id="level"
                  value={form.level}
                  onChange={(v) => setField("level", v as (typeof LEVELS)[number])}
                  options={LEVELS.map((l) => ({ value: l, label: l }))}
                />
              </Field>
              <Field label="Language" htmlFor="language">
                <input
                  id="language"
                  type="text"
                  value={form.language}
                  onChange={(e) => setField("language", e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>
          </Panel>

          {/* ---- curriculum -------------------------------------------- */}
          <Panel
            title="Curriculum"
            subtitle="Arrange sections and lectures, and write the lesson content."
            icon={Layers}
            hue="sky"
            actions={
              <Chip hue="sky" icon={Layers}>
                {totalLectures} {totalLectures === 1 ? "lecture" : "lectures"}
              </Chip>
            }
            bodyClassName="space-y-4 p-5"
          >
            {/*
              The shared editor the instructor studio uses. The old inline editor here
              only knew about {title, type}, so every admin save silently discarded the
              lecture's uploaded video, article HTML, quiz questions and duration.
            */}
            <CurriculumEditor sections={sections} onChange={setSections} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          {/* ---- visibility & status ----------------------------------- */}
          <Panel
            title="Visibility and status"
            subtitle="Choose where this course appears."
            icon={Eye}
            hue="mint"
            bodyClassName="space-y-5 p-5"
          >
            <Field label="Status" htmlFor="status">
              <SearchableSelect
                id="status"
                value={form.status}
                onChange={(v) => setField("status", v as CourseStatus)}
                options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                {STATUS_OPTIONS.find((o) => o.value === form.status)?.hint}
              </p>
            </Field>

            <SettingRow title="Feature on homepage" hint="Show this course in the featured carousel.">
              <Toggle checked={featured} onChange={setFeatured} label="Feature on homepage" />
            </SettingRow>
          </Panel>

          {/* ---- media ------------------------------------------------- */}
          <Panel
            title="Media"
            subtitle="Upload a cover image or pick a gradient."
            icon={ImageIcon}
            hue="coral"
            bodyClassName="space-y-4 p-5"
          >
            {/* Real cover image (Cloudinary) with the gradient as its fallback. */}
            <ThumbnailUploader
              value={{
                gradient: form.gradient,
                thumbnailUrl: form.thumbnailUrl,
                thumbnailPublicId: form.thumbnailPublicId,
              }}
              onChange={(next) =>
                setForm((f) => ({
                  ...f,
                  gradient: next.gradient,
                  thumbnailUrl: next.thumbnailUrl,
                  thumbnailPublicId: next.thumbnailPublicId,
                }))
              }
              disabled={loading}
            />
          </Panel>

          {/* ---- danger zone ------------------------------------------- */}
          <section
            aria-labelledby="danger-zone"
            className="overflow-hidden rounded-[1.25rem] border border-error-500/25 bg-white shadow-[0_1px_2px_rgb(16_18_31/0.03),0_10px_28px_-14px_rgb(150_56_205/0.22)]"
          >
            <div className="flex items-center gap-3 bg-error-500/5 px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-error-500/10 text-error-700">
                <AlertTriangle size={18} aria-hidden />
              </span>
              <h3 id="danger-zone" className="text-[15px] font-semibold text-error-700">
                Danger zone
              </h3>
            </div>
            <div className="divide-y divide-error-500/10">
              <div className="flex flex-col gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">Unpublish course</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Take this course out of the catalogue. Enrolled learners keep access, and new enrolments stop.
                  </p>
                </div>
                <Button
                  icon={EyeOff}
                  onClick={handleUnpublish}
                  className="self-start !border-error-500/30 !text-error-700 hover:!bg-error-500/5"
                >
                  Unpublish course
                </Button>
              </div>
              <div className="flex flex-col gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">Delete course</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Delete this course and all its content. It goes to your organisation&apos;s recycle bin, where an admin can restore it.
                  </p>
                </div>
                <Button variant="danger" icon={Trash2} onClick={handleDelete} className="self-start">
                  Delete course
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ---- footer actions ---------------------------------------- */}
      <FormActions>
        <ButtonLink href={`/suite/lms/courses/${slug}`}>Cancel</ButtonLink>
        {saveButton}
      </FormActions>
    </div>
  );
}
