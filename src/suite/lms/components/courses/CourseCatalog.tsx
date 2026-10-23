"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import type { Course } from "@/suite/lms/lib/course-data";
import CourseFilters, { type FilterState } from "./CourseFilters";
import CourseGrid from "./CourseGrid";

/* ------------------------------------------------------------------ */
/*  Initial filter state                                               */
/* ------------------------------------------------------------------ */

const INITIAL_FILTERS: FilterState = {
  categories: [],
  levels: [],
  ratings: [],
  durations: [],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CourseCatalog({ courses }: { courses: Course[] }) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [courseCount, setCourseCount] = useState(courses.length);

  const handleCourseCountChange = useCallback((count: number) => {
    setCourseCount(count);
  }, []);

  return (
    <>
      {/* ---- Breadcrumb + Header ---- */}
      <section className="bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 text-white">
        <div className="section-container py-10 sm:py-14">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center gap-1.5 text-sm text-primary-200">
              <li>
                <Link
                  href="/"
                  className="hover:text-white transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <ChevronRight size={14} />
              </li>
              <li className="text-white font-medium" aria-current="page">
                Courses
              </li>
            </ol>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1
                className="heading-2 text-white mb-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                All Courses
              </h1>
              <p className="text-primary-200 text-sm sm:text-base max-w-xl">
                Explore our catalog of expert-led courses designed to help you
                build in-demand tech skills and advance your career.
              </p>
            </div>
            <div className="flex items-center gap-2 text-primary-200 shrink-0">
              <GraduationCap size={20} />
              <span className="text-sm font-medium">
                {courseCount} Course{courseCount !== 1 ? "s" : ""} Available
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Main content ---- */}
      <section className="section-container py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filter sidebar */}
          <CourseFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearAll={() => setFilters(INITIAL_FILTERS)}
            courseCount={courseCount}
          />

          {/* Course grid */}
          <CourseGrid
            courses={courses}
            filters={filters}
            onCourseCountChange={handleCourseCountChange}
          />
        </div>
      </section>
    </>
  );
}
