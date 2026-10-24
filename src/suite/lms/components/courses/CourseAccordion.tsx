"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ChevronDown,
  Play,
  FileText,
  HelpCircle,
  CheckCircle2,
  Paperclip,
} from "lucide-react";
import type { Course } from "@/suite/lms/lib/course-data";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CourseAccordionProps {
  sections: Course["sections"];
}

type Lecture = Course["sections"][number]["lectures"][number];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseDuration(duration: string | null): number {
  const parts = (duration ?? "").split(":").map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 0;
}

function formatTotalTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Renders the icon for a lecture type.
 *
 * This used to be `getLectureIcon()` returning a component, assigned to a
 * capitalised local in the render body. That reads as constructing a component
 * type during render, which React's rules forbid, because a component
 * identity that changes between renders remounts its whole subtree and throws
 * away any state inside it. Returning elements instead of types avoids the
 * question entirely.
 */
function LectureTypeIcon({ type }: { type: Lecture["type"] }) {
  const className = `shrink-0 ${
    type === "video"
      ? "text-primary-400"
      : type === "quiz"
        ? "text-accent-500"
        : "text-neutral-400"
  }`;

  switch (type) {
    case "article":
      return <FileText size={14} className={className} />;
    case "document":
      return <Paperclip size={14} className={className} />;
    case "quiz":
      return <HelpCircle size={14} className={className} />;
    case "video":
    default:
      return <Play size={14} className={className} fill="currentColor" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Lecture Item                                                        */
/* ------------------------------------------------------------------ */

function LectureItem({
  lecture,
  isPreview,
}: {
  lecture: Lecture;
  isPreview: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50/80 transition-colors duration-200 group/lecture">
      {/* Decorative completion indicator */}
      <CheckCircle2
        size={16}
        className="text-neutral-200 shrink-0 group-hover/lecture:text-neutral-300 transition-colors duration-200"
      />

      {/* Type icon */}
      <LectureTypeIcon type={lecture.type} />

      {/* Title */}
      <span className="text-sm text-neutral-700 flex-1 min-w-0 leading-snug">
        {lecture.title}
      </span>

      {/* Preview badge */}
      {isPreview && (
        <span className="text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full shrink-0">
          Preview
        </span>
      )}

      {/* Duration */}
      <span className="text-xs text-neutral-400 tabular-nums shrink-0 font-medium">
        {lecture.duration}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Item                                                       */
/* ------------------------------------------------------------------ */

function SectionItem({
  section,
  sectionIndex,
  isOpen,
  onToggle,
  isFirstSection,
}: {
  section: Course["sections"][number];
  sectionIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  isFirstSection: boolean;
}) {
  const lectureCount = section.lectures.length;
  const totalSeconds = section.lectures.reduce(
    (acc, l) => acc + parseDuration(l.duration),
    0
  );
  const sectionId = `accordion-section-${sectionIndex}`;
  const panelId = `accordion-panel-${sectionIndex}`;

  return (
    <div
      className={`border border-neutral-200 overflow-hidden transition-colors duration-300 ${
        isOpen ? "border-primary-200/60" : ""
      } first:rounded-t-xl last:rounded-b-xl`}
    >
      {/* Section header */}
      <button
        id={sectionId}
        onClick={onToggle}
        className={`flex items-center justify-between w-full px-5 py-4 text-left transition-colors duration-200 ${
          isOpen
            ? "bg-primary-50/70"
            : "bg-neutral-50 hover:bg-neutral-100/80"
        }`}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ChevronDown
            size={18}
            className={`shrink-0 text-neutral-500 transition-transform duration-300 ease-out ${
              isOpen ? "rotate-180" : ""
            }`}
          />
          <span className="text-sm font-bold text-neutral-800 leading-snug">
            {section.title}
          </span>
        </div>
        <span className="text-xs text-neutral-500 shrink-0 ml-4 tabular-nums whitespace-nowrap">
          {lectureCount} lecture{lectureCount !== 1 ? "s" : ""} &bull;{" "}
          {formatTotalTime(totalSeconds)}
        </span>
      </button>

      {/* Lecture list with grid-rows animation */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={sectionId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
            {section.lectures.map((lecture, i) => (
              <LectureItem
                key={i}
                lecture={lecture}
                isPreview={isFirstSection && i === 0}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function CourseAccordion({ sections }: CourseAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<number>>(
    () => new Set([0])
  );

  const stats = useMemo(() => {
    let totalLectures = 0;
    let totalSeconds = 0;
    for (const section of sections) {
      totalLectures += section.lectures.length;
      for (const lecture of section.lectures) {
        totalSeconds += parseDuration(lecture.duration);
      }
    }
    return {
      totalLectures,
      totalTime: formatTotalTime(totalSeconds),
      sectionCount: sections.length,
    };
  }, [sections]);

  const allExpanded = openSections.size === sections.length;

  const toggleSection = useCallback((idx: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setOpenSections(new Set());
    } else {
      setOpenSections(new Set(sections.map((_, i) => i)));
    }
  }, [allExpanded, sections]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-neutral-500 font-medium">
          <span className="text-neutral-700 font-bold">{stats.sectionCount}</span>{" "}
          sections &bull;{" "}
          <span className="text-neutral-700 font-bold">{stats.totalLectures}</span>{" "}
          lectures &bull;{" "}
          <span className="text-neutral-700 font-bold">{stats.totalTime}</span>{" "}
          total length
        </p>
        <button
          onClick={toggleAll}
          className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded px-2 py-1 -mx-2 -my-1"
          aria-label={allExpanded ? "Collapse all sections" : "Expand all sections"}
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* Sections */}
      <div className="flex flex-col -space-y-px">
        {sections.map((section, idx) => (
          <SectionItem
            key={idx}
            section={section}
            sectionIndex={idx}
            isOpen={openSections.has(idx)}
            onToggle={() => toggleSection(idx)}
            isFirstSection={idx === 0}
          />
        ))}
      </div>
    </div>
  );
}
