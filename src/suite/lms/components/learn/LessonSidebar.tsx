"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Play,
  FileText,
  HelpCircle,
  CheckCircle2,
  X,
  Paperclip,
} from "lucide-react";
/**
 * Structural subset of the learner course payload. Kept narrow so the sidebar
 * works with the API's course shape as well as the bundled sample data.
 */
export interface SidebarCourse {
  title: string;
  sections: {
    title: string;
    lectures: {
      id: string;
      title: string;
      duration: string | null;
      type: "video" | "article" | "document" | "quiz";
    }[];
  }[];
}

interface LessonSidebarProps {
  course: SidebarCourse;
  currentSection: number;
  currentLesson: number;
  /** Lecture ids the learner has completed. */
  completedLessons: Set<string>;
  onSelectLesson: (sectionIdx: number, lessonIdx: number) => void;
  isOpen: boolean;
  onClose: () => void;
  progressPercent: number;
  progressCompleted: number;
  progressTotal: number;
}

const typeIcon = {
  video: Play,
  article: FileText,
  document: Paperclip,
  quiz: HelpCircle,
};

export default function LessonSidebar({
  course,
  currentSection,
  currentLesson,
  completedLessons,
  onSelectLesson,
  isOpen,
  onClose,
  progressPercent,
  progressCompleted,
  progressTotal,
}: LessonSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => {
    const s = new Set<number>();
    course.sections.forEach((_, i) => s.add(i));
    return s;
  });

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-neutral-900 text-sm leading-tight line-clamp-2">
            {course.title}
          </h3>
          <button
            onClick={onClose}
            className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-neutral-500" aria-hidden="true" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{progressCompleted} of {progressTotal} lessons done</span>
            <span className="font-semibold text-primary-700">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-primary-50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto">
        {course.sections.map((section, sIdx) => {
          const isExpanded = expandedSections.has(sIdx);
          const sectionCompletedCount = section.lectures.filter((lecture) =>
            completedLessons.has(lecture.id)
          ).length;

          return (
            <div key={sIdx} className="border-b border-neutral-100 last:border-b-0">
              {/* Section header */}
              <button
                onClick={() => toggleSection(sIdx)}
                aria-expanded={isExpanded}
                className="w-full flex min-h-11 items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-neutral-800 truncate">
                    {section.title}
                  </span>
                </div>
                <span className="ml-2 shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-600">
                  {sectionCompletedCount}/{section.lectures.length}
                </span>
              </button>

              {/* Lectures */}
              {isExpanded && (
                <div className="pb-1">
                  {section.lectures.map((lecture, lIdx) => {
                    const isCompleted = completedLessons.has(lecture.id);
                    const isCurrent =
                      sIdx === currentSection && lIdx === currentLesson;
                    const Icon = typeIcon[lecture.type];

                    return (
                      <button
                        key={lIdx}
                        onClick={() => onSelectLesson(sIdx, lIdx)}
                        aria-current={isCurrent ? "true" : undefined}
                        className={`w-full flex items-start gap-3 px-4 pl-10 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                          isCurrent
                            ? "bg-primary-50 border-l-[3px] border-primary-600"
                            : "hover:bg-neutral-50 border-l-[3px] border-transparent"
                        }`}
                      >
                        {/* Status indicator */}
                        <div className="shrink-0 mt-0.5">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-mint-600" aria-label="Done" />
                          ) : isCurrent ? (
                            <div className="w-4 h-4 rounded-full bg-primary-600 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-white rounded-full" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-neutral-300" />
                          )}
                        </div>

                        {/* Lesson info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm leading-snug ${
                              isCurrent
                                ? "text-primary-700 font-medium"
                                : isCompleted
                                ? "text-neutral-700"
                                : "text-neutral-600"
                            }`}
                          >
                            {lecture.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Icon className="w-3 h-3 text-neutral-400" aria-hidden="true" />
                            <span className="text-xs text-neutral-500">
                              {lecture.duration}
                            </span>
                            {isCurrent && (
                              <span className="rounded-full bg-primary-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-white">
                                Now
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-l border-neutral-200 bg-white transition-all duration-300 ${
          isOpen ? "w-80 xl:w-96" : "w-0 overflow-hidden"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-neutral-900/40"
            onClick={onClose}
          />
          <aside className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] shadow-2xl animate-slide-in-right">
            {sidebarContent}
          </aside>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
