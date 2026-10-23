"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { LEVELS } from "@/suite/lms/lib/course-data";
import { useCategoryNames } from "@/lib/api/categories-client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FilterState {
  categories: string[];
  levels: string[];
  ratings: string[];
  durations: string[];
}

interface CourseFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClearAll: () => void;
  courseCount: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const RATINGS = [
  { label: "4.5 & up", value: "4.5" },
  { label: "4.0 & up", value: "4.0" },
  { label: "3.5 & up", value: "3.5" },
];

const DURATIONS = [
  { label: "0 - 3 months", value: "0-3" },
  { label: "3 - 6 months", value: "3-6" },
  { label: "6 - 12 months", value: "6-12" },
];

/* ------------------------------------------------------------------ */
/*  Filter Section                                                     */
/* ------------------------------------------------------------------ */

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-neutral-200 pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-sm font-semibold text-neutral-800 mb-3 hover:text-primary-700 transition-colors"
        aria-expanded={open}
      >
        {title}
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Checkbox Item                                                      */
/* ------------------------------------------------------------------ */

function CheckboxItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
      />
      <span className="text-sm text-neutral-600 group-hover:text-neutral-900 transition-colors">
        {label}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function CourseFilters({
  filters,
  onFiltersChange,
  onClearAll,
  courseCount,
}: CourseFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Category taxonomy comes from the database, not a hardcoded list.
  const categoryNames = useCategoryNames();

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.levels.length > 0 ||
    filters.ratings.length > 0 ||
    filters.durations.length > 0;

  const activeFilterCount =
    filters.categories.length +
    filters.levels.length +
    filters.ratings.length +
    filters.durations.length;

  function toggleFilter(
    key: keyof FilterState,
    value: string
  ) {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  }

  const filterContent = (
    <>
      {/* Category */}
      <FilterSection title="Category">
        {categoryNames.map((cat) => (
          <CheckboxItem
            key={cat}
            label={cat}
            checked={filters.categories.includes(cat)}
            onChange={() => toggleFilter("categories", cat)}
          />
        ))}
      </FilterSection>

      {/* Level */}
      <FilterSection title="Level">
        {LEVELS.map((level) => (
          <CheckboxItem
            key={level}
            label={level}
            checked={filters.levels.includes(level)}
            onChange={() => toggleFilter("levels", level)}
          />
        ))}
      </FilterSection>

      {/* Rating */}
      <FilterSection title="Rating" defaultOpen={false}>
        {RATINGS.map((rating) => (
          <CheckboxItem
            key={rating.value}
            label={rating.label}
            checked={filters.ratings.includes(rating.value)}
            onChange={() => toggleFilter("ratings", rating.value)}
          />
        ))}
      </FilterSection>

      {/* Duration */}
      <FilterSection title="Duration" defaultOpen={false}>
        {DURATIONS.map((dur) => (
          <CheckboxItem
            key={dur.value}
            label={dur.label}
            checked={filters.durations.includes(dur.value)}
            onChange={() => toggleFilter("durations", dur.value)}
          />
        ))}
      </FilterSection>

      {/* Actions */}
      <div className="pt-4 space-y-2">
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="w-full text-sm text-neutral-500 hover:text-error-600 transition-colors py-2"
          >
            Clear All Filters
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile filter toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-primary-300 hover:text-primary-700 transition-colors"
      >
        <SlidersHorizontal size={16} />
        Filters
        {activeFilterCount > 0 && (
          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary-600 text-[10px] font-bold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0" aria-label="Course filters">
        <div className="sticky top-24 bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900" style={{ fontFamily: "var(--font-heading)" }}>
              Filters
            </h2>
            <span className="text-xs text-neutral-500">
              {courseCount} course{courseCount !== 1 ? "s" : ""}
            </span>
          </div>
          {filterContent}
        </div>
      </aside>

      {/* Mobile filter drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-[85vw] max-w-sm bg-white shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h2 className="text-base font-semibold text-neutral-900" style={{ fontFamily: "var(--font-heading)" }}>
                Filters
              </h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="Close filters"
              >
                <X size={20} className="text-neutral-600" />
              </button>
            </div>
            <div className="p-5">{filterContent}</div>
            <div className="sticky bottom-0 px-5 py-4 bg-white border-t border-neutral-100">
              <button
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full"
              >
                Show {courseCount} Results
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
