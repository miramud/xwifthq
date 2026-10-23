"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Star,
  Clock,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import type { Course } from "@/suite/lms/lib/course-data";
import type { FilterState } from "./CourseFilters";
import { CoverImage } from "@/components/shared/CourseCover";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SortOption =
  | "popular"
  | "newest"
  | "rating";

interface CourseGridProps {
  courses: Course[];
  filters: FilterState;
  onCourseCountChange?: (count: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Star Rating                                                        */
/* ------------------------------------------------------------------ */

function StarRating({
  rating,
  count,
  size = 14,
}: {
  rating: number;
  count?: number;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold text-amber-600">{rating.toFixed(1)}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.min(1, Math.max(0, rating - i + 1));
          return (
            <span key={i} className="relative" style={{ width: size, height: size }}>
              <Star
                size={size}
                className="text-neutral-200 fill-neutral-200 absolute inset-0"
              />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star size={size} className="text-amber-400 fill-amber-400" />
              </span>
            </span>
          );
        })}
      </div>
      {count !== undefined && (
        <span className="text-xs text-neutral-500">({count.toLocaleString()})</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Course Card (Grid view)                                            */
/* ------------------------------------------------------------------ */

function CourseCard({ course }: { course: Course }) {

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col bg-white rounded-xl border border-neutral-200 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary-200"
    >
      {/* Image placeholder */}
      <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${course.gradient} flex items-center justify-center`}>
        <CoverImage src={course.thumbnailUrl} alt={course.title} />
        <span className="text-white/30 text-6xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          {course.title.charAt(0)}
        </span>
        {/* Every course is free, so the badge says that rather than a discount. */}
        <span className="absolute top-3 left-3 rounded-md bg-accent-500 px-2 py-1 text-xs font-bold text-neutral-900">
          Free
        </span>
        {/* Category badge */}
        <span className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm text-neutral-700 text-xs font-medium rounded-md">
          {course.category}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-sm font-semibold text-neutral-900 line-clamp-2 mb-1.5 group-hover:text-primary-700 transition-colors" style={{ fontFamily: "var(--font-heading)" }}>
          {course.title}
        </h3>
        <p className="text-xs text-neutral-500 mb-2">{course.instructor.name}</p>

        {/* Rating */}
        <StarRating rating={course.rating} count={course.reviewCount} />

        {/* Meta */}
        <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {course.duration}
          </span>
          <span className="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-medium text-neutral-600">
            {course.level}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-auto mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-xs text-neutral-500">
            {course.totalLectures} lectures · {course.totalHours}h
          </span>
          <span className="text-xs font-semibold text-primary-600 transition-colors group-hover:text-primary-700">
            Start course
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Course Row (List view)                                             */
/* ------------------------------------------------------------------ */

function CourseRow({ course }: { course: Course }) {

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col sm:flex-row bg-white rounded-xl border border-neutral-200 overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary-200"
    >
      {/* Image */}
      <div className={`relative w-full sm:w-64 h-44 sm:h-auto shrink-0 overflow-hidden bg-gradient-to-br ${course.gradient} flex items-center justify-center`}>
        <CoverImage src={course.thumbnailUrl} alt={course.title} />
        <span className="text-white/30 text-6xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          {course.title.charAt(0)}
        </span>
        <span className="absolute top-3 left-3 rounded-md bg-accent-500 px-2 py-1 text-xs font-bold text-neutral-900">
          Free
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col sm:flex-row p-4 gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-primary-600 mb-1 inline-block">
            {course.category}
          </span>
          <h3 className="text-base font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors mb-1" style={{ fontFamily: "var(--font-heading)" }}>
            {course.title}
          </h3>
          <p className="text-sm text-neutral-500 line-clamp-2 mb-2">
            {course.shortDescription}
          </p>
          <p className="text-xs text-neutral-500 mb-2">{course.instructor.name}</p>
          <StarRating rating={course.rating} count={course.reviewCount} />
          <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {course.duration}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} />
              {course.studentsEnrolled.toLocaleString()} students
            </span>
            <span className="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-medium text-neutral-600">
              {course.level}
            </span>
          </div>
        </div>

        {/* Action column */}
        <div className="flex items-center justify-between gap-2 sm:min-w-[140px] sm:flex-col sm:items-end sm:justify-start">
          <div className="text-right">
            <p className="text-lg font-bold text-neutral-900">Free</p>
            <p className="text-xs text-neutral-500">
              {course.totalLectures} lectures
            </p>
          </div>
          <span className="btn-primary px-4 py-2 text-xs">Start course</span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                         */
/* ------------------------------------------------------------------ */

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1 mt-8" aria-label="Pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center justify-center h-10 w-10 rounded-lg border border-neutral-200 text-neutral-500 hover:border-primary-300 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Previous page"
      >
        <ChevronLeft size={18} />
      </button>
      {pages.map((page, idx) =>
        page === "..." ? (
          <span key={`dots-${idx}`} className="px-2 text-neutral-400">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`flex items-center justify-center h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
              page === currentPage
                ? "bg-primary-600 text-white shadow-md shadow-primary-600/25"
                : "border border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-600"
            }`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center justify-center h-10 w-10 rounded-lg border border-neutral-200 text-neutral-500 hover:border-primary-300 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Next page"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Most Popular", value: "popular" },
  { label: "Newest", value: "newest" },
  { label: "Highest Rated", value: "rating" },
];

const PER_PAGE = 6;

export default function CourseGrid({
  courses,
  filters,
  onCourseCountChange,
}: CourseGridProps) {
  const [sort, setSort] = useState<SortOption>("popular");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  /* ---- Filter ---- */
  const filtered = useMemo(() => {
    let result = [...courses];

    if (filters.categories.length > 0) {
      result = result.filter((c) => filters.categories.includes(c.category));
    }
    if (filters.levels.length > 0) {
      result = result.filter((c) => filters.levels.includes(c.level));
    }
    if (filters.ratings.length > 0) {
      const minRating = Math.min(...filters.ratings.map(Number));
      result = result.filter((c) => c.rating >= minRating);
    }
    if (filters.durations.length > 0) {
      result = result.filter((c) => {
        return filters.durations.some((d) => {
          const [min, max] = d.split("-").map(Number);
          if (max) return c.durationMonths >= min && c.durationMonths <= max;
          return c.durationMonths >= min;
        });
      });
    }

    return result;
  }, [courses, filters]);

  /* ---- Sort ---- */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "popular":
        return arr.sort((a, b) => b.studentsEnrolled - a.studentsEnrolled);
      case "newest":
        return arr; // already in order
      case "rating":
        return arr.sort((a, b) => b.rating - a.rating);
      default:
        return arr;
    }
  }, [filtered, sort]);

  /* ---- Pagination ---- */
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Notify parent of count
  if (onCourseCountChange) {
    // Use a timeout to avoid setState during render
    setTimeout(() => onCourseCountChange(sorted.length), 0);
  }

  return (
    <div className="flex-1 min-w-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-sm text-neutral-500">
          Showing{" "}
          <span className="font-medium text-neutral-700">
            {(page - 1) * PER_PAGE + 1}-{Math.min(page * PER_PAGE, sorted.length)}
          </span>{" "}
          of{" "}
          <span className="font-medium text-neutral-700">{sorted.length}</span>{" "}
          courses
        </p>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <SearchableSelect
            value={sort}
            onChange={(v) => {
              setSort(v as SortOption);
              setPage(1);
            }}
            options={SORT_OPTIONS}
            size="sm"
            className="w-48"
            aria-label="Sort courses"
          />

          {/* View toggle */}
          <div className="hidden sm:flex items-center rounded-lg border border-neutral-200 overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center justify-center h-10 w-10 transition-colors ${
                view === "grid"
                  ? "bg-primary-600 text-white"
                  : "bg-white text-neutral-500 hover:text-primary-600"
              }`}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center justify-center h-10 w-10 transition-colors ${
                view === "list"
                  ? "bg-primary-600 text-white"
                  : "bg-white text-neutral-500 hover:text-primary-600"
              }`}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Course cards */}
      {paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <LayoutGrid size={24} className="text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-800 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
            No courses found
          </h3>
          <p className="text-sm text-neutral-500 max-w-sm">
            Try adjusting your filters to find what you are looking for.
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {paginated.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {paginated.map((course) => (
            <CourseRow key={course.slug} course={course} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
