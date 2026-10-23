"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import type { Course } from "@/suite/lms/lib/course-data";
import CourseFilters, { type FilterState } from "@/suite/lms/components/courses/CourseFilters";
import CourseGrid from "@/suite/lms/components/courses/CourseGrid";
import { LearnerHeader } from "@/components/learner/LearnerHeader";

const INITIAL_FILTERS: FilterState = {
  categories: [],
  levels: [],
  ratings: [],
  durations: [],
};

/**
 * The public course catalogue in the XwiftHQ look: a centred heading on the
 * lilac sky with the live course count as a chip, then the same filter rail
 * and grid the LMS ships, unchanged, on white below.
 */
export default function CourseCatalogView({ courses }: { courses: Course[] }) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [courseCount, setCourseCount] = useState(courses.length);

  const handleCourseCountChange = useCallback((count: number) => {
    setCourseCount(count);
  }, []);

  return (
    <>
      <LearnerHeader
        align="center"
        above={
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
              <li>
                <Link
                  href="/"
                  className="rounded transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li className="font-medium text-neutral-800" aria-current="page">
                Courses
              </li>
            </ol>
          </nav>
        }
        eyebrow={
          <>
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            Learning on XwiftHQ
          </>
        }
        title="All courses"
        intro="Practical, instructor-led courses for the skills your team uses every day. Pick one, learn at your own pace and earn a certificate when you finish."
        actions={
          <span className="xw-chip" role="status">
            <span className="h-2 w-2 rounded-full bg-primary-600" aria-hidden="true" />
            <span className="tnum">
              {courseCount} {courseCount === 1 ? "course" : "courses"} available
            </span>
          </span>
        }
      />

      <section className="section-container pb-16 pt-2 sm:pb-20">
        <div className="flex flex-col gap-8 lg:flex-row">
          <CourseFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearAll={() => setFilters(INITIAL_FILTERS)}
            courseCount={courseCount}
          />

          <CourseGrid courses={courses} filters={filters} onCourseCountChange={handleCourseCountChange} />
        </div>
      </section>
    </>
  );
}
