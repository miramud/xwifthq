"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  BookOpen,
  Award,
  Play,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";

/* ------------------------------------------------------------------ */
/*  CSS-only confetti dots                                             */
/* ------------------------------------------------------------------ */

function ConfettiDots() {
  /* Pre-computed positions to avoid layout shift */
  const dots = [
    { x: 8, y: 12, size: 8, color: "bg-primary-400", delay: 0, shape: "rounded-full" },
    { x: 85, y: 8, size: 10, color: "bg-accent-500", delay: 0.3, shape: "rounded-sm" },
    { x: 20, y: 70, size: 6, color: "bg-success-400", delay: 0.6, shape: "rounded-full" },
    { x: 75, y: 65, size: 9, color: "bg-primary-300", delay: 0.2, shape: "rounded-sm" },
    { x: 50, y: 5, size: 7, color: "bg-accent-400", delay: 0.5, shape: "rounded-full" },
    { x: 92, y: 40, size: 6, color: "bg-success-500", delay: 0.1, shape: "rounded-sm" },
    { x: 5, y: 45, size: 8, color: "bg-primary-500", delay: 0.4, shape: "rounded-full" },
    { x: 35, y: 85, size: 7, color: "bg-accent-500", delay: 0.7, shape: "rounded-sm" },
    { x: 65, y: 90, size: 6, color: "bg-primary-400", delay: 0.15, shape: "rounded-full" },
    { x: 45, y: 30, size: 5, color: "bg-success-400", delay: 0.45, shape: "rounded-sm" },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {dots.map((dot, i) => (
        <span
          key={i}
          className={`absolute ${dot.color} ${dot.shape} opacity-0`}
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            animation: `confetti-float 3s ease-in-out ${dot.delay}s infinite alternate, confetti-appear 0.4s ease-out ${dot.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function EnrollmentSuccessPage() {
  const { enrolledCourses } = useStore();
  const [showContent, setShowContent] = useState(false);

  /**
   * "Now" is captured once, when the page mounts — not read during render.
   *
   * `Date.now()` in the render body is impure: it returns something different
   * on every re-render, so the "enrolled in the last 60 seconds" list could
   * quietly shrink mid-session and the courses someone just bought would
   * disappear from the confirmation screen while they were looking at it.
   */
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    document.title = "Enrollment Successful! | Elevate";
    /* Delay content reveal for the checkmark scale-in */
    const timer = setTimeout(() => setShowContent(true), 400);
    return () => clearTimeout(timer);
  }, []);

  /* Show the most recently enrolled courses (enrolled within the last 60 seconds) */
  const recentlyEnrolled = enrolledCourses.filter((c) => {
    const enrolledTime = new Date(c.enrolledAt).getTime();
    return mountedAt - enrolledTime < 60_000;
  });

  /* Fallback to all enrolled if no recent ones */
  const displayCourses =
    recentlyEnrolled.length > 0 ? recentlyEnrolled : enrolledCourses;
  const courseCount = displayCourses.length;

  return (
    <>
      {/* Confetti keyframes */}
      <style jsx global>{`
        @keyframes confetti-float {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-18px) rotate(15deg); }
        }
        @keyframes confetti-appear {
          0% { opacity: 0; transform: scale(0); }
          100% { opacity: 0.6; transform: scale(1); }
        }
        @keyframes check-scale-in {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <section className="relative min-h-screen bg-gradient-to-b from-primary-50 via-white to-neutral-50 overflow-hidden">
        <ConfettiDots />

        <div className="section-container py-12 sm:py-16 relative z-10">
          {/* ---- Success state ---- */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            {/* Animated checkmark */}
            <div
              className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-success-500 shadow-lg shadow-success-500/30"
              style={{
                animation: "check-scale-in 0.6s ease-out forwards",
              }}
            >
              <CheckCircle2 size={48} className="text-white" />
            </div>

            <h1
              className="heading-2 text-neutral-900 mb-3"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Enrollment Successful!
            </h1>
            <p className="text-neutral-600 text-lg">
              Congratulations! You&apos;ve been enrolled in{" "}
              <span className="font-semibold text-primary-700">
                {courseCount} {courseCount === 1 ? "course" : "courses"}
              </span>
              . Your learning journey starts now.
            </p>
          </div>

          {/* ---- Enrolled courses ---- */}
          {showContent && courseCount > 0 && (
            <div className="max-w-3xl mx-auto mb-14 animate-fade-in">
              <h2
                className="heading-4 text-neutral-900 mb-5 text-center"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Your New Courses
              </h2>
              <div className="space-y-4">
                {displayCourses.map((course) => (
                  <div
                    key={course.slug}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white rounded-xl border border-neutral-200 shadow-sm p-4 hover:shadow-md transition-shadow"
                  >
                    {/* Gradient thumbnail */}
                    <div
                      className={`h-20 sm:h-16 sm:w-24 rounded-lg bg-gradient-to-br ${course.gradient} flex items-center justify-center shrink-0`}
                    >
                      <Play size={20} className="text-white/50" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-neutral-800 line-clamp-1">
                        {course.title}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        By {course.instructor.name} &bull; {course.duration}
                      </p>
                    </div>

                    {/* Start Learning CTA */}
                    <Link
                      href={`/learn/${course.slug}`}
                      className="btn-primary py-2.5 px-5 text-sm gap-1.5 shrink-0"
                    >
                      Start Learning
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- What's next ---- */}
          {showContent && (
            <div className="max-w-3xl mx-auto mb-14 animate-fade-in">
              <div className="text-center mb-8">
                <Sparkles
                  size={20}
                  className="text-accent-500 mx-auto mb-2"
                />
                <h2
                  className="heading-4 text-neutral-900 mb-1"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  What&apos;s Next?
                </h2>
                <p className="text-neutral-500 text-sm">
                  Your learning journey begins now
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  {
                    step: 1,
                    icon: BookOpen,
                    title: "Access Your Course",
                    desc: "Head to My Courses to find all your enrolled courses and start learning at your own pace.",
                  },
                  {
                    step: 2,
                    icon: Play,
                    title: "Complete Lessons",
                    desc: "Watch video lectures, read articles, and complete quizzes to track your progress.",
                  },
                  {
                    step: 3,
                    icon: Award,
                    title: "Earn Certificate",
                    desc: "Complete all course modules to earn your certificate of completion.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.step}
                      className="relative bg-white rounded-xl border border-neutral-200 shadow-sm p-5 text-center"
                    >
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white shadow-sm">
                        {item.step}
                      </span>
                      <Icon
                        size={28}
                        className="text-primary-500 mx-auto mb-3 mt-2"
                      />
                      <h3
                        className="text-sm font-semibold text-neutral-800 mb-1.5"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---- CTA buttons ---- */}
          {showContent && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in">
              <Link
                href="/my-courses"
                className="btn-primary py-3.5 px-8 text-base font-semibold gap-2"
              >
                Go to My Courses
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/courses"
                className="btn-outline py-3.5 px-8 text-base font-semibold"
              >
                Browse More Courses
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
