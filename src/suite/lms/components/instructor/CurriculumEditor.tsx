"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Video,
  FileText,
  HelpCircle,
  ChevronDown,
  Clock,
  type LucideIcon,
  Paperclip,
} from "lucide-react";
import LectureContentEditor from "./LectureContentEditor";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  contentForType,
  emptyLecture,
  emptySection,
  type Lecture,
  type LectureType,
  type Section,
} from "@/suite/lms/lib/curriculum";

const INPUT =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";

const LECTURE_TYPES: { key: LectureType; label: string; icon: LucideIcon }[] = [
  { key: "video", label: "Video", icon: Video },
  { key: "article", label: "Article", icon: FileText },
  // Attaching a PDF used to mean pasting a Drive link into article HTML,
  // which put the file outside the library and outside the platform-only rule.
  { key: "document", label: "Document", icon: Paperclip },
  { key: "quiz", label: "Quiz", icon: HelpCircle },
];

const LECTURE_ICON: Record<LectureType, LucideIcon> = {
  video: Video,
  article: FileText,
  document: Paperclip,
  quiz: HelpCircle,
};

export default function CurriculumEditor({
  sections,
  onChange,
}: {
  sections: Section[];
  onChange: (sections: Section[]) => void;
}) {
  // Track which lecture's content panel is open, keyed by "si:li".
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  /* ---------- mutators ---------- */

  const setSections = (next: Section[]) => onChange(next);

  const addSection = () => setSections([...sections, emptySection()]);
  const removeSection = (si: number) => setSections(sections.filter((_, i) => i !== si));
  const setSectionTitle = (si: number, title: string) =>
    setSections(sections.map((s, i) => (i === si ? { ...s, title } : s)));

  const addLecture = (si: number) =>
    setSections(
      sections.map((s, i) =>
        i === si ? { ...s, lectures: [...s.lectures, emptyLecture("video")] } : s,
      ),
    );

  const removeLecture = (si: number, li: number) =>
    setSections(
      sections.map((s, i) =>
        i === si ? { ...s, lectures: s.lectures.filter((_, j) => j !== li) } : s,
      ),
    );

  const patchLecture = (si: number, li: number, patch: Partial<Lecture>) =>
    setSections(
      sections.map((s, i) =>
        i === si
          ? { ...s, lectures: s.lectures.map((l, j) => (j === li ? { ...l, ...patch } : l)) }
          : s,
      ),
    );

  const changeType = (si: number, li: number, type: LectureType) => {
    const current = sections[si].lectures[li];
    // Reshape the content bag to match the new type, preserving compatible data.
    patchLecture(si, li, { type, content: contentForType(type, current.content) });
  };

  return (
    <div className="space-y-4">
      {sections.map((section, si) => (
        <div key={si} className="rounded-2xl border border-neutral-200/80 bg-neutral-50/60">
          {/* section header */}
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-3">
            <GripVertical size={16} className="shrink-0 text-neutral-300" aria-hidden />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-grape-50 text-xs font-bold text-grape-700 tnum">
              {String(si + 1).padStart(2, "0")}
            </span>
            <input
              className={`${INPUT} bg-white`}
              value={section.title}
              onChange={(e) => setSectionTitle(si, e.target.value)}
              placeholder={`Section ${si + 1} title`}
            />
            <button
              type="button"
              onClick={() => removeSection(si)}
              disabled={sections.length === 1}
              aria-label={`Remove section ${si + 1}`}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-error-500/10 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>

          {/* lectures */}
          <div className="space-y-2 p-3">
            {section.lectures.length === 0 && (
              <p className="px-1 py-2 text-xs text-neutral-500">
                No lectures yet. Add the first one below.
              </p>
            )}

            {section.lectures.map((lecture, li) => {
              const key = `${si}:${li}`;
              const isOpen = !!open[key];
              const Icon = LECTURE_ICON[lecture.type];
              return (
                <div key={li} className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(16_18_31/0.03)]">
                  {/* row */}
                  <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                      <Icon size={16} aria-hidden />
                    </span>
                    <input
                      className="h-11 min-w-[10rem] flex-1 rounded-xl border border-transparent bg-transparent px-1 text-sm text-neutral-700 outline-none transition-colors focus:border-primary-400 focus:bg-white focus:px-3 focus:ring-2 focus:ring-primary-100"
                      value={lecture.title}
                      onChange={(e) => patchLecture(si, li, { title: e.target.value })}
                      placeholder={`Lecture ${li + 1} title`}
                    />
                    <div className="hidden items-center gap-1 sm:flex">
                      <Clock size={13} className="text-neutral-400" aria-hidden />
                      <input
                        className="h-11 w-16 rounded-xl border border-neutral-200 bg-white px-2 text-center text-xs text-neutral-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                        value={lecture.duration ?? ""}
                        onChange={(e) => patchLecture(si, li, { duration: e.target.value })}
                        placeholder="12:30"
                        aria-label="Lecture duration"
                      />
                    </div>
                    <SearchableSelect
                      className="w-32 shrink-0"
                      size="sm"
                      value={lecture.type}
                      onChange={(v) => changeType(si, li, v as LectureType)}
                      options={LECTURE_TYPES.map((t) => ({ value: t.key, label: t.label }))}
                      aria-label="Lecture type"
                    />
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-expanded={isOpen}
                      aria-label="Edit content"
                      className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                        isOpen ? "bg-primary-50 text-primary-700" : "text-primary-600 hover:bg-primary-50"
                      }`}
                    >
                      Content
                      <ChevronDown
                        size={14}
                        aria-hidden
                        className={`transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLecture(si, li)}
                      aria-label={`Remove lecture ${li + 1}`}
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-error-500/10 hover:text-error-600 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>

                  {/* content panel */}
                  {isOpen && (
                    <div className="rounded-b-xl border-t border-neutral-100 bg-neutral-50/50 p-3">
                      <LectureContentEditor
                        type={lecture.type}
                        content={contentForType(lecture.type, lecture.content)}
                        onChange={(content) => patchLecture(si, li, { content })}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => addLecture(si)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <Plus size={14} aria-hidden />
              Add lecture
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-primary-200 bg-white px-4 py-3 text-sm font-semibold text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <Plus size={16} aria-hidden />
        Add section
      </button>
    </div>
  );
}
