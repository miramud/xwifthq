"use client";

import { useRef } from "react";
import Link from "next/link";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { CoverImage } from "@/components/shared/CourseCover";

interface RelatedCoursesProps {
  courses: {
    slug: string;
    title: string;
    gradient: string;
    /** Uploaded cover image; falls back to the gradient when absent. */
    thumbnailUrl?: string | null;
    instructor: { name: string };
    rating: number;
    reviewCount: number;
    studentsEnrolled: number;
  }[];
}

export default function RelatedCourses({ courses }: RelatedCoursesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (courses.length === 0) return null;

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div className="relative">
      {/* Scroll controls */}
      <div className="hidden sm:flex items-center gap-2 absolute -top-12 right-0">
        <button
          onClick={() => scroll("left")}
          className="h-9 w-9 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 flex items-center justify-center transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} className="text-neutral-600" />
        </button>
        <button
          onClick={() => scroll("right")}
          className="h-9 w-9 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 flex items-center justify-center transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} className="text-neutral-600" />
        </button>
      </div>

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 -mx-1 px-1 snap-x snap-mandatory"
      >
        {courses.map((course) => (
          <Link
            key={course.slug}
            href={`/courses/${course.slug}`}
            className="group min-w-[280px] max-w-[300px] flex-shrink-0 snap-start"
          >
            <article className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300">
              {/* Gradient image area */}
              <div
                className={`h-36 bg-gradient-to-br ${course.gradient} relative overflow-hidden`}
              >
                <CoverImage src={course.thumbnailUrl} alt={course.title} />
                <div className="absolute inset-0 bg-black/5 group-hover:bg-black/10 transition-colors" />
              </div>

              <div className="p-4">
                <h3
                  className="text-sm font-semibold text-neutral-900 line-clamp-2 mb-1 group-hover:text-primary-700 transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {course.title}
                </h3>
                <p className="text-xs text-neutral-500 mb-2">
                  {course.instructor.name}
                </p>

                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm font-bold text-amber-700">
                    {course.rating.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={12}
                        className={
                          i <= Math.round(course.rating)
                            ? "text-amber-400 fill-amber-400"
                            : "text-neutral-300 fill-neutral-300"
                        }
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-400">
                    ({course.reviewCount.toLocaleString()})
                  </span>
                </div>

                <span className="text-base font-bold text-neutral-900">Free</span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
