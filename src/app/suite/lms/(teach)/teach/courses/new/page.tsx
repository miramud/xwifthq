"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, BookText, Check, Layers, Loader2, Rocket, Save } from "lucide-react";
import { Button, Chip, PageHeader, Panel } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { BackLink, inputClass } from "@/suite/lms/components/ui/ws";
import { LEVELS } from "@/suite/lms/lib/course-data";
import { useCategoryNames } from "@/lib/api/categories-client";
import { courses as coursesApi, ApiError } from "@/lib/api/instructor-client";
import CurriculumEditor from "@/suite/lms/components/instructor/CurriculumEditor";
import ThumbnailUploader, { SWATCHES } from "@/suite/lms/components/instructor/ThumbnailUploader";
import { CourseThumb } from "@/components/shared/CourseCover";
import { emptySection, serializeSections, type Section } from "@/suite/lms/lib/curriculum";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ */
/*  shared field styles                                                */
/* ------------------------------------------------------------------ */

const INPUT = inputClass;

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-sm font-medium text-neutral-700">{children}</span>
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  thumbnail swatches                                                 */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  stepper                                                            */
/* ------------------------------------------------------------------ */

const STEPS = ["Basics", "Curriculum", "Completion", "Review & publish"] as const;

function Stepper({
  step,
  onStep,
}: {
  step: number;
  onStep: (i: number) => void;
}) {
  return (
    <ol className="flex items-center" aria-label="Course set-up steps">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        const active = done || current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => onStep(i)}
              disabled={i > step}
              aria-current={current ? "step" : undefined}
              className="group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-default"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors tabular-nums ${
                  current
                    ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30"
                    : done
                      ? "bg-mint-50 text-mint-700"
                      : "ws-hatch text-neutral-500"
                }`}
              >
                {done ? <Check size={16} aria-hidden /> : i + 1}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Step {i + 1}
                </span>
                <span className={`block text-sm font-semibold ${active ? "text-neutral-900" : "text-neutral-500"}`}>
                  {label}
                </span>
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-3 h-1 flex-1 rounded-full transition-colors ${done ? "bg-mint-500" : "ws-hatch"}`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  switch                                                             */
/* ------------------------------------------------------------------ */

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary-600" : "bg-neutral-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

export default function NewCoursePage() {
  const router = useRouter();
  // Category taxonomy comes from the database, not a hardcoded list.
  const categoryNames = useCategoryNames();
  // …and neither is the revenue split. An admin sets it in /admin/settings.
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // basics
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>(LEVELS[0]);
  const [language, setLanguage] = useState("English");
  const [cover, setCover] = useState({
    gradient: SWATCHES[0] as string,
    thumbnailUrl: null as string | null,
    thumbnailPublicId: null as string | null,
  });

  // curriculum
  const [sections, setSections] = useState<Section[]>([emptySection()]);

  // pricing
  const [certificate, setCertificate] = useState(true);

  const totalLectures = sections.reduce((n, s) => n + s.lectures.length, 0);

  /* ---------- nav ---------- */

  const isLast = step === STEPS.length - 1;
  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  /* ---------- review rows ---------- */

  const summaryRows: { label: string; value: string }[] = [
    { label: "Title", value: title || "Untitled course" },
    { label: "Category", value: category },
    { label: "Level", value: level },
    { label: "Sections", value: `${sections.length}` },
    { label: "Lectures", value: `${totalLectures}` },
  ];

  async function handleSubmit(status: "draft" | "review") {
    setError(null);
    if (!title.trim() || !subtitle.trim() || !description.trim()) {
      setError("Please fill in the title, subtitle and description on the Basics step.");
      setStep(0);
      return;
    }
    setSubmitting(true);
    try {
      await coursesApi.create({
        title: title.trim(),
        shortDescription: subtitle.trim(),
        description: description.trim(),
        categorySlug: slugify(category),
        level,
        language,
        gradient: cover.gradient,
        thumbnailUrl: cover.thumbnailUrl,
        thumbnailPublicId: cover.thumbnailPublicId,
        hasCertificate: certificate,
        status,
        sections: serializeSections(sections),
      });
      router.push("/suite/lms/teach/courses");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the course.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/suite/lms/teach/courses" label="Back to courses" />
        <PageHeader
          eyebrow="New course"
          title="Create a new course"
          subtitle="Set up your course in a few steps."
        />
      </div>

      {/* stepper */}
      <div className="ws-card px-5 py-4">
        <Stepper step={step} onStep={setStep} />
      </div>

      {/* ---------------- step content ---------------- */}

      {step === 0 && (
        <Panel
          title="Course basics"
          subtitle="The essentials students see first."
          icon={BookText}
          bodyClassName="space-y-5 p-5"
        >
          <div>
            <FieldLabel hint="Be specific and clear">Course title</FieldLabel>
            <input
              className={INPUT}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advanced Web Development with React & Next.js"
            />
          </div>

          <div>
            <FieldLabel hint="One sentence">Subtitle</FieldLabel>
            <input
              className={INPUT}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="What will students be able to do?"
            />
          </div>

          <div>
            <FieldLabel hint="Headings, lists and links keep their shape">Description</FieldLabel>
            <RichTextEditor variant="full" label="Description" value={description} onChange={setDescription} placeholder="Describe what this course covers, who it's for, and the outcomes…" />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <FieldLabel>Category</FieldLabel>
              <SearchableSelect
                aria-label="Category"
                value={category}
                onChange={setCategory}
                placeholder="Choose a category"
                options={categoryNames.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <FieldLabel>Level</FieldLabel>
              <SearchableSelect
                aria-label="Level"
                value={level}
                onChange={(v) => setLevel(v as (typeof LEVELS)[number])}
                options={LEVELS.map((l) => ({ value: l, label: l }))}
              />
            </div>
            <div>
              <FieldLabel>Language</FieldLabel>
              <input
                className={INPUT}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="English"
              />
            </div>
          </div>

          <div>
            <FieldLabel hint="Upload a cover image, or pick a gradient">Thumbnail</FieldLabel>
            <ThumbnailUploader value={cover} onChange={setCover} />
          </div>
        </Panel>
      )}

      {step === 1 && (
        <Panel
          title="Curriculum"
          subtitle="Organise your content into sections and lectures."
          icon={Layers}
          hue="grape"
          actions={
            <Chip hue="grape" icon={Layers}>
              {totalLectures} {totalLectures === 1 ? "lecture" : "lectures"}
            </Chip>
          }
          bodyClassName="space-y-4 p-5"
        >
          <p className="rounded-xl bg-grape-50 px-3.5 py-2.5 text-xs text-grape-700">
            Add sections and lectures, then click <span className="font-semibold">Content</span> on
            a lecture to add a video (link or upload), a rich-text article, or a quiz.
          </p>
          <CurriculumEditor sections={sections} onChange={setSections} />
        </Panel>
      )}

      {step === 2 && (
        <Panel
          title="Completion"
          subtitle="What students get for finishing, and what they can preview."
          icon={Award}
          hue="mint"
          bodyClassName="space-y-5 p-5"
        >
          <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-neutral-800">
                Completion certificate
              </p>
              <p className="text-xs text-neutral-500">
                Award a certificate when students finish.
              </p>
            </div>
            <Switch
              checked={certificate}
              onChange={setCertificate}
              label="Toggle completion certificate"
            />
          </div>

        </Panel>
      )}

      {step === 3 && (
        <Panel
          title="Review & publish"
          subtitle="Check everything before submitting."
          icon={Rocket}
          hue="sky"
          bodyClassName="space-y-5 p-5"
        >
          <div className="flex items-center gap-4">
            <CourseThumb
              title={title || "New course"}
              gradient={cover.gradient}
              thumbnailUrl={cover.thumbnailUrl}
              size={64}
              rounded="rounded-xl"
            />
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-neutral-900">
                {title || "Untitled course"}
              </h3>
              <p className="truncate text-sm text-neutral-500">
                {subtitle || "No subtitle yet."}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {category && <Chip hue="blue">{category}</Chip>}
                <Chip hue="sky">{level}</Chip>
                {certificate && <Chip hue="mint" icon={Award}>Certificate</Chip>}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2">
            {summaryRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 bg-white px-4 py-3"
              >
                <dt className="text-sm text-neutral-500">{row.label}</dt>
                <dd className="truncate text-sm font-semibold text-neutral-900 tabular-nums">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rounded-xl bg-sun-50 px-4 py-3 text-sm text-sun-700">
            Your course will be submitted for review. Our team typically responds
            within 2 business days before it goes live.
          </div>
        </Panel>
      )}

      {/* ---------------- footer nav ---------------- */}

      {error && (
        <div role="alert" className="rounded-xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <div className="ws-card flex items-center justify-between gap-3 px-4 py-3">
        <Button onClick={goBack} disabled={step === 0 || submitting} icon={ArrowLeft}>
          Back
        </Button>

        <span className="text-xs text-neutral-500 tabular-nums">
          Step {step + 1} of {STEPS.length}
        </span>

        {isLast ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => handleSubmit("draft")} disabled={submitting} icon={Save}>
              Save as draft
            </Button>
            <Button variant="primary" onClick={() => handleSubmit("review")} disabled={submitting}>
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
              {submitting ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={goNext}>
            Continue
            <ArrowRight size={16} aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
