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
import { Clouds } from "@/components/site/Sky";
import { LEARNER_CARD } from "@/components/learner/LearnerHeader";

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
    document.title = "You're enrolled | XwiftHQ";
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

      <section className="xw-sky relative isolate min-h-screen overflow-hidden">
        <Clouds className="-z-10" />
        <ConfettiDots />

        <div className="section-container relative z-10 py-12 sm:py-16">
          {/* ---- Success state ---- */}
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {/* Animated checkmark */}
            <div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 shadow-[0_20px_40px_-16px_rgb(150_56_205/0.7)]"
              style={{
                animation: "check-scale-in 0.6s ease-out forwards",
              }}
            >
              <CheckCircle2 size={40} className="text-white" aria-hidden="true" />
            </div>

            <p className="xw-eyebrow mb-4">Enrollment confirmed</p>
            <h1 className="xw-h1">You&apos;re in. Let&apos;s get learning.</h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              You&apos;re now enrolled in{" "}
              <span className="font-semibold text-primary-700">
                {courseCount} {courseCount === 1 ? "course" : "courses"}
              </span>
              . Everything is ready for you in My courses.
            </p>
          </div>

          {/* ---- Enrolled courses ---- */}
          {showContent && courseCount > 0 && (
            <div className="mx-auto mb-14 max-w-3xl animate-fade-in">
              <h2 className="mb-5 text-center font-heading text-xl font-semibold tracking-[-0.01em] text-neutral-900">
                Your new courses
              </h2>
              <ul className="space-y-3">
                {displayCourses.map((course) => (
                  <li
                    key={course.slug}
                    className={`${LEARNER_CARD} flex flex-col items-stretch gap-4 p-3 sm:flex-row sm:items-center sm:pr-4`}
                  >
                    {/* Gradient thumbnail */}
                    <div
                      className={`flex h-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-16 sm:w-24 ${course.gradient}`}
                      aria-hidden="true"
                    >
                      <Play size={20} className="text-white/60" />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1 px-1 sm:px-0">
                      <h3 className="line-clamp-1 font-heading text-base font-semibold text-neutral-900">
                        {course.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        By {course.instructor.name} &bull; {course.duration}
                      </p>
                    </div>

                    {/* Start learning */}
                    <Link href={`/learn/${course.slug}`} className="btn-primary shrink-0 px-5 py-2.5">
                      Start learning
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ---- What's next ---- */}
          {showContent && (
            <div className="mx-auto mb-14 max-w-4xl animate-fade-in">
              <div className="mb-8 text-center">
                <Sparkles size={20} className="mx-auto mb-2 text-primary-500" aria-hidden="true" />
                <h2 className="xw-h2">What happens next</h2>
                <p className="mt-2 text-sm text-neutral-600">Three steps from here to your certificate.</p>
              </div>

              <ol className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {[
                  {
                    step: 1,
                    icon: BookOpen,
                    title: "Open your course",
                    desc: "Every course you are enrolled in waits in My courses. Start whenever suits you and go at your own pace.",
                  },
                  {
                    step: 2,
                    icon: Play,
                    title: "Work through the lessons",
                    desc: "Watch the videos, read the articles and take the quizzes. Your progress saves as you go.",
                  },
                  {
                    step: 3,
                    icon: Award,
                    title: "Earn your certificate",
                    desc: "Finish every lesson in a course that awards one and your certificate is issued straight away.",
                  },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.step}
                      className={`flex flex-col p-6 ${i % 2 === 0 ? "xw-glow-card" : "xw-tile"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                          {String(item.step).padStart(2, "0")}
                        </span>
                        <Icon size={22} className="text-primary-500" aria-hidden="true" />
                      </div>
                      <h3 className="xw-h3 mt-6">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{item.desc}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* ---- Calls to action ---- */}
          {showContent && (
            <div className="flex flex-col items-center justify-center gap-3 animate-fade-in sm:flex-row">
              <Link href="/my-courses" className="btn-primary w-full sm:w-auto">
                Go to My courses
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/courses" className="btn-outline w-full sm:w-auto">
                Browse more courses
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
