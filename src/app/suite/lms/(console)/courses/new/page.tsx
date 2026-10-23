"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, BookOpen, Layers, Loader2, Send } from "lucide-react";
import { Button, PageHeader, Panel } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  BackLink,
  ErrorNote,
  Field,
  FormActions,
  SettingRow,
  Switch,
  inputClass as INPUT,
} from "@/suite/lms/components/ui/ws";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

import { LEVELS } from "@/suite/lms/lib/course-data";
import { useCategoryNames } from "@/lib/api/categories-client";
import {
  courses as adminCourses,
  instructors as adminInstructors,
  ApiError,
  type AdminInstructor,
} from "@/lib/api/admin-client";
import CurriculumEditor from "@/suite/lms/components/instructor/CurriculumEditor";
import ThumbnailUploader, {
  SWATCHES,
} from "@/suite/lms/components/instructor/ThumbnailUploader";
import { emptySection, serializeSections, type Section } from "@/suite/lms/lib/curriculum";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminNewCoursePage() {
  const router = useRouter();
  const categoryNames = useCategoryNames();

  // Instructor picker — an admin authors on behalf of a real instructor.
  const [instructorList, setInstructorList] = useState<AdminInstructor[]>([]);
  const [instructorId, setInstructorId] = useState("");
  const [loadingInstructors, setLoadingInstructors] = useState(true);

  // basics
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  // Empty until the user picks; falls back to the first loaded category so the
  // dropdown is never blank. Derived rather than set in an effect.
  const [category, setCategory] = useState<string>("");
  const effectiveCategory = category || categoryNames[0] || "";
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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminInstructors
      .list()
      .then((list) => {
        if (!active) return;
        setInstructorList(list);
        // Default category once the taxonomy has loaded.
      })
      .catch(() => {
        if (active) setError("Could not load the instructor list.");
      })
      .finally(() => {
        if (active) setLoadingInstructors(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(status: "draft" | "published") {
    setError(null);

    if (!instructorId) {
      setError("Choose the instructor this course belongs to.");
      return;
    }
    if (!title.trim() || !subtitle.trim() || !description.trim()) {
      setError("Fill in the title, subtitle and description.");
      return;
    }
    if (!effectiveCategory) {
      setError("Pick a category.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await adminCourses.create({
        instructorId,
        title: title.trim(),
        shortDescription: subtitle.trim(),
        description: description.trim(),
        categorySlug: slugify(effectiveCategory),
        level,
        language,
        gradient: cover.gradient,
        thumbnailUrl: cover.thumbnailUrl,
        thumbnailPublicId: cover.thumbnailPublicId,
        hasCertificate: certificate,
        status,
        sections: serializeSections(sections),
      });
      router.push(`/suite/lms/courses/${created.slug}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the course.");
      setSubmitting(false);
    }
  }

  const totalLectures = sections.reduce((n, s) => n + s.lectures.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/suite/lms/courses" label="Back to courses" />
        <PageHeader
          eyebrow="Catalogue"
          title="Create a course"
          subtitle="Author a course on behalf of an instructor."
        />
      </div>

      {/* Instructor + basics */}
      <Panel
        title="Course basics"
        subtitle="Who teaches it, and the essentials students see first."
        icon={BookOpen}
        hue="grape"
        bodyClassName="space-y-5 p-5"
      >
        <Field id="course-instructor" label="Instructor" hint="Required">
          <SearchableSelect
            id="course-instructor"
            value={instructorId}
            onChange={setInstructorId}
            disabled={loadingInstructors}
            placeholder={loadingInstructors ? "Loading instructors…" : "Select an instructor"}
            searchPlaceholder="Search instructors"
            options={instructorList.map((ins) => ({
              value: String(ins.id),
              label: ins.name,
              hint: ins.email || undefined,
            }))}
          />
        </Field>

        <Field id="course-title" label="Course title" hint="Be specific and clear">
          <input
            id="course-title"
            className={INPUT}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Advanced Web Development with React & Next.js"
          />
        </Field>

        <Field id="course-subtitle" label="Subtitle" hint="One sentence">
          <input
            id="course-subtitle"
            className={INPUT}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="What will students be able to do?"
          />
        </Field>

        <Field id="course-description" label="Description" hint="Headings, lists and links keep their shape">
          <RichTextEditor id="course-description" variant="full" value={description} onChange={setDescription} placeholder="Describe what this course covers, who it's for, and the outcomes…" />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field id="course-category" label="Category">
            <SearchableSelect
              id="course-category"
              value={effectiveCategory}
              onChange={setCategory}
              options={categoryNames.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field id="course-level" label="Level">
            <SearchableSelect
              id="course-level"
              value={level}
              onChange={(v) => setLevel(v as (typeof LEVELS)[number])}
              options={LEVELS.map((l) => ({ value: l, label: l }))}
            />
          </Field>
          <Field id="course-language" label="Language">
            <input
              id="course-language"
              className={INPUT}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="English"
            />
          </Field>
        </div>

        <Field label="Thumbnail" hint="Upload a cover image, or pick a gradient">
          <ThumbnailUploader value={cover} onChange={setCover} />
        </Field>
      </Panel>

      {/* Curriculum */}
      <Panel
        title="Curriculum"
        subtitle={`Organise content into sections and lectures (${totalLectures} ${
          totalLectures === 1 ? "lecture" : "lectures"
        } so far).`}
        icon={Layers}
        hue="sky"
        bodyClassName="space-y-4 p-5"
      >
        <CurriculumEditor sections={sections} onChange={setSections} />
      </Panel>

      {/*
        Courses are free, so what is left of the old "Pricing" step is the
        certificate switch. Retitled rather than deleted: the switch still
        needs somewhere to live.
      */}
      <Panel title="Completion" subtitle="What learners get for finishing." icon={Award} hue="mint" bodyClassName="space-y-5 p-5">
        <SettingRow title="Certificate of completion" hint="Award a certificate when learners finish.">
          <Switch checked={certificate} onChange={setCertificate} label="Certificate of completion" />
        </SettingRow>
      </Panel>

      {/* Error + actions */}
      {error && <ErrorNote>{error}</ErrorNote>}

      <FormActions note={`${sections.length} ${sections.length === 1 ? "section" : "sections"} · ${totalLectures} ${totalLectures === 1 ? "lecture" : "lectures"}`}>
        <Button onClick={() => handleSubmit("draft")} disabled={submitting}>
          {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          Save as draft
        </Button>
        <Button variant="primary" onClick={() => handleSubmit("published")} disabled={submitting}>
          {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
          Create &amp; publish
        </Button>
      </FormActions>
    </div>
  );
}
