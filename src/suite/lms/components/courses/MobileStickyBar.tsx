"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

/**
 * The sticky bar on a course page at phone width.
 *
 * Courses are free, so this is a "start this course" bar rather than a
 * purchase bar: the price, the struck-through compare-at and the discount are
 * all gone, and enrolling is one call to the API instead of a cart-and-
 * checkout hop.
 *
 * It mirrors `CourseSidebar`'s CTA deliberately — the same button doing the
 * same thing in two places must not behave differently depending on the width
 * of the window.
 */
interface MobileStickyBarProps {
  courseSlug: string;
  courseTitle: string;
}

export default function MobileStickyBar({ courseSlug, courseTitle }: MobileStickyBarProps) {
  const [visible, setVisible] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { isEnrolled } = useStore();

  const enrolled = isEnrolled(courseSlug);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 500);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleEnroll = useCallback(async () => {
    if (enrolled) {
      router.push(`/learn/${courseSlug}`);
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const res = await fetch(`/api/me/courses/${encodeURIComponent(courseSlug)}/enrol`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (res.status === 401) {
        router.push(`/login?redirect=/courses/${courseSlug}`);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? "Could not start this course.");
        return;
      }

      router.push(`/learn/${courseSlug}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setStarting(false);
    }
  }, [enrolled, courseSlug, router]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      role="complementary"
      aria-label={`Start ${courseTitle}`}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <span className="text-lg font-bold text-neutral-900">Free</span>
          {error !== null && (
            <p role="alert" className="text-[11px] font-medium text-error-700">
              {error}
            </p>
          )}
        </div>
        <button
          onClick={handleEnroll}
          disabled={starting}
          aria-busy={starting}
          className="btn-primary whitespace-nowrap px-6 py-2.5 text-sm font-semibold disabled:opacity-70 disabled:cursor-wait"
        >
          {enrolled ? "Go to course" : starting ? "Starting…" : "Start course"}
        </button>
      </div>
    </div>
  );
}
