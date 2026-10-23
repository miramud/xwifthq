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
          <h3 className="font-heading font-semibold text-neutral-800 text-sm leading-tight line-clamp-2">
            {course.title}
          </h3>
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-neutral-100 rounded-md transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{progressCompleted} of {progressTotal} complete</span>
            <span className="font-medium text-primary-600">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
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
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-neutral-700 truncate">
                    {section.title}
                  </span>
                </div>
                <span className="text-xs text-neutral-400 shrink-0 ml-2">
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
                        className={`w-full flex items-start gap-3 px-4 pl-10 py-2.5 text-left transition-colors ${
                          isCurrent
                            ? "bg-primary-50 border-l-2 border-primary-500"
                            : "hover:bg-neutral-50 border-l-2 border-transparent"
                        }`}
                      >
                        {/* Status indicator */}
                        <div className="shrink-0 mt-0.5">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-success-500" />
                          ) : isCurrent ? (
                            <div className="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center">
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
                                ? "text-success-700"
                                : "text-neutral-600"
                            }`}
                          >
                            {lecture.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Icon className="w-3 h-3 text-neutral-400" />
                            <span className="text-xs text-neutral-400">
                              {lecture.duration}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-medium text-primary-500 uppercase tracking-wider">
                                Now playing
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
            className="absolute inset-0 bg-black/40"
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
