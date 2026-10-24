"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  FileText,
  Download,
  Award,
  Clock,
  Share2,
  Gift,
  ShieldCheck,
  Heart,
  Shield,
  Smartphone,
  Infinity,
  BookOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Course } from "@/suite/lms/lib/course-data";
import { useStore } from "@/lib/store";
import { CoverImage } from "@/components/shared/CourseCover";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CourseSidebarProps {
  course: Course;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CourseSidebar({ course }: CourseSidebarProps) {
  const router = useRouter();
  const { isEnrolled } = useStore();
  const [wishlisted, setWishlisted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const enrolled = isEnrolled(course.slug);

  /**
   * Start the course.
   *
   * Courses are free, so this replaced the cart-and-checkout hop entirely.
   * The API creates the enrollment and answers 200 for a course the learner
   * already holds, so a double-click is harmless, and it is the API that
   * decides, never this component optimistically.
   */
  const handleEnroll = useCallback(async () => {
    if (enrolled) {
      router.push(`/learn/${course.slug}`);
      return;
    }

    setStarting(true);
    setStartError(null);

    try {
      const res = await fetch(`/api/me/courses/${encodeURIComponent(course.slug)}/enrol`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (res.status === 401) {
        // Signed out. Come back here afterwards rather than dumping them on a
        // dashboard, so the click they made is the thing that happens.
        router.push(`/login?redirect=/courses/${course.slug}`);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStartError(body.message ?? "Could not start this course.");
        return;
      }

      router.push(`/learn/${course.slug}`);
    } catch {
      setStartError("Could not reach the server. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }, [enrolled, course.slug, router]);

  const includes = [
    {
      icon: Clock,
      label: `${course.totalHours} hours on-demand video`,
      show: true,
    },
    {
      icon: FileText,
      label: `${course.articles} articles`,
      show: course.articles > 0,
    },
    {
      icon: Download,
      label: `${course.downloadableResources} downloadable resources`,
      show: course.downloadableResources > 0,
    },
    { icon: Smartphone, label: "Access on mobile and TV", show: true },
    { icon: Infinity, label: "Full lifetime access", show: true },
    {
      icon: Award,
      label: "Certificate of completion",
      show: course.hasCertificate,
    },
  ];

  return (
    <aside className="lg:sticky lg:top-28" aria-label="Course purchase options">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl shadow-neutral-200/50 overflow-hidden">
        {/* ---- Preview Image Area ---- */}
        <div
          className={`relative h-52 bg-gradient-to-br ${course.gradient} flex items-center justify-center cursor-pointer group overflow-hidden`}
          role="button"
          tabIndex={0}
          aria-label="Preview this course"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
        >
          <CoverImage src={course.thumbnailUrl} alt={course.title} />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />

          {/* Play button */}
          <div className="relative z-10 h-18 w-18 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-white transition-all duration-300">
            <Play
              size={30}
              className="text-neutral-900 ml-1 group-hover:text-primary-600 transition-colors duration-300"
              fill="currentColor"
            />
          </div>

          {/* Preview text */}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm font-medium text-white bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Preview this course
          </span>
        </div>

        <div className="p-6">
          {/*
            Every course under the LMS is free. Stated plainly and once, a
            struck-through price and a countdown would be inventing a discount
            that does not exist.
          */}
          <div className="mb-5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-neutral-900">Free</span>
            <span className="text-sm text-neutral-500">for everyone at your organisation</span>
          </div>

          {/* ---- CTA ---- */}
          <button
            onClick={handleEnroll}
            disabled={starting}
            aria-busy={starting}
            className="btn-primary w-full text-base py-3.5 mb-3 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-wait"
          >
            {enrolled ? "Go to course" : starting ? "Starting…" : "Start this course"}
          </button>

          {startError !== null && (
            <p role="alert" className="mb-3 text-xs font-medium text-error-700">
              {startError}
            </p>
          )}

          {enrolled && (
            <Link
              href="/my-courses"
              className="btn-outline w-full py-3 mb-4 gap-2 text-center inline-flex items-center justify-center"
            >
              <BookOpen size={16} />
              My courses
            </Link>
          )}

          <div className="flex items-center justify-center gap-2 mb-6">
            <Shield size={16} className="text-neutral-400" />
            <span className="text-xs text-neutral-500 font-medium">
              Lifetime access · no payment required
            </span>
          </div>

          {/* ---- Course Includes ---- */}
          <div className="border-t border-neutral-100 pt-5">
            <h4 className="text-sm font-bold text-neutral-800 mb-3.5 tracking-wide uppercase">
              This course includes:
            </h4>
            <ul className="space-y-3" aria-label="Course features">
              {includes
                .filter((item) => item.show)
                .map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-3 text-sm text-neutral-600"
                  >
                    <item.icon
                      size={16}
                      className="text-primary-500 shrink-0"
                    />
                    <span>{item.label}</span>
                  </li>
                ))}
            </ul>
          </div>

          {/* ---- Share / Gift / Wishlist ---- */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-neutral-100">
            <button
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-primary-600 transition-colors duration-200 py-1"
              aria-label="Share this course"
            >
              <Share2 size={15} />
              Share
            </button>
            <button
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-primary-600 transition-colors duration-200 py-1"
              aria-label="Gift this course"
            >
              <Gift size={15} />
              Gift
            </button>
            <button
              onClick={() => setWishlisted((prev) => !prev)}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors duration-200 py-1 ${
                wishlisted
                  ? "text-error-500"
                  : "text-neutral-500 hover:text-error-500"
              }`}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={wishlisted}
            >
              <Heart
                size={15}
                className={`transition-all duration-300 ${
                  wishlisted ? "fill-error-500 scale-110" : ""
                }`}
              />
              {wishlisted ? "Saved" : "Wishlist"}
            </button>
          </div>

          {/* ---- Business / Team Access ---- */}
          <div className="mt-5 pt-5 border-t border-neutral-100">
            <h4 className="text-sm font-semibold text-neutral-800 mb-1">
              Training 5 or more people?
            </h4>
            <p className="text-xs text-neutral-500 mb-2">
              Get your team access to top courses anytime, anywhere.
            </p>
            <a
              href="#"
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors duration-200"
            >
              Get your team access &rarr;
            </a>
          </div>
        </div>

        {/* ---- Trust Badge Footer ---- */}
        <div className="bg-neutral-50 px-6 py-3.5 border-t border-neutral-100">
          <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
            <ShieldCheck size={15} className="text-success-500 shrink-0" />
            <span className="font-medium">
              Secure checkout &bull; Instant access
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
