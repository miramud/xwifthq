import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Star,
  Users,
  Globe,
  Calendar,
  CheckCircle2,
  Award,
  BookOpen,
  Play,
  FileText,
  Download,
  Flame,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Search,
} from "lucide-react";
import { getCourse, getCourses } from "@/lib/api/public";
import { getMemberCourse, hasSessionCookie } from "@/lib/api/server";
import type { Course } from "@/suite/lms/lib/course-data";
import SignInToViewCourse from "@/suite/lms/components/courses/SignInToViewCourse";
import CourseSidebar from "@/suite/lms/components/courses/CourseSidebar";
import CourseAccordion from "@/suite/lms/components/courses/CourseAccordion";
import CourseDetailClient from "@/suite/lms/components/courses/CourseDetailClient";
import ReviewForm from "@/suite/lms/components/courses/ReviewForm";
import CourseTabNav from "@/suite/lms/components/courses/CourseTabNav";
import VideoPreviewModal from "@/suite/lms/components/courses/VideoPreviewModal";
import RelatedCourses from "@/suite/lms/components/courses/RelatedCourses";
import CourseFAQ from "@/suite/lms/components/courses/CourseFAQ";
import MobileStickyBar from "@/suite/lms/components/courses/MobileStickyBar";
import TrackCourseView from "@/suite/lms/components/courses/TrackCourseView";
import { RichTextView } from "@/components/workspace/RichTextView";

/* ------------------------------------------------------------------ */
/*  Static params                                                      */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  const courses = await getCourses();
  return courses.map((course) => ({
    slug: course.slug,
  }));
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const publicCourse = await getCourse(slug);
  const course = publicCourse ?? (await getMemberCourse<Course>(slug));

  if (!course) {
    return { title: "Course", robots: { index: false, follow: false } };
  }

  // An organisation's course is for its members: never indexed or shared as a card.
  if (!publicCourse) {
    return { title: course.title, robots: { index: false, follow: false } };
  }

  return {
    title: course.title,
    description: course.shortDescription,
    keywords: [
      course.category,
      course.level,
      course.instructor.name,
      "Elevate course",
      "tech training Nigeria",
    ],
    openGraph: {
      title: `${course.title} | Elevate`,
      description: course.shortDescription,
      url: `https://elevate.example.com/courses/${course.slug}`,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Server helper: Star Rating                                         */
/* ------------------------------------------------------------------ */

function StarRating({
  rating,
  count,
  size = 14,
  className = "",
}: {
  rating: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-sm font-semibold text-amber-300">
        {rating.toFixed(1)}
      </span>
      <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={
              i <= Math.round(rating)
                ? "text-amber-400 fill-amber-400"
                : "text-neutral-500 fill-neutral-500"
            }
          />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-sm text-primary-200">
          ({count.toLocaleString()} ratings)
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Server helper: Star Rating (dark-on-light variant)                 */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Server helper: Rating Breakdown                                    */
/* ------------------------------------------------------------------ */

function RatingBreakdown({ rating }: { rating: number }) {
  const distribution = [
    { stars: 5, pct: rating >= 4.5 ? 68 : 52 },
    { stars: 4, pct: rating >= 4.5 ? 22 : 28 },
    { stars: 3, pct: rating >= 4.0 ? 6 : 12 },
    { stars: 2, pct: rating >= 4.0 ? 3 : 5 },
    { stars: 1, pct: rating >= 4.0 ? 1 : 3 },
  ];

  return (
    <div className="space-y-2.5">
      {distribution.map((d) => (
        <div key={d.stars} className="flex items-center gap-3">
          <span className="text-sm text-neutral-600 w-8 text-right shrink-0">
            {d.stars}
            <Star
              size={10}
              className="inline ml-0.5 text-amber-400 fill-amber-400"
            />
          </span>
          <div className="flex-1 h-2.5 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-700"
              style={{ width: `${d.pct}%` }}
            />
          </div>
          <span className="text-xs text-neutral-500 w-10 text-right shrink-0">
            {d.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Server helper: Review Card                                         */
/* ------------------------------------------------------------------ */

function ReviewCard({
  review,
}: {
  review: {
    name: string;
    rating: number;
    date: string;
    comment: string;
    avatar: string;
  };
}) {
  return (
    <article className="border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-sm font-semibold text-primary-700 shrink-0">
          {review.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-800">
              {review.name}
            </p>
            <span className="text-xs text-neutral-400 shrink-0">
              {review.date}
            </span>
          </div>
          <div className="flex items-center gap-0.5 mt-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={12}
                className={
                  i <= review.rating
                    ? "text-amber-400 fill-amber-400"
                    : "text-neutral-300 fill-neutral-300"
                }
              />
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed">
        {review.comment}
      </p>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-100">
        <span className="text-xs text-neutral-400">Was this helpful?</span>
        <button
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-primary-600 transition-colors"
          aria-label="Mark review as helpful"
        >
          <ThumbsUp size={12} />
          Yes
        </button>
        <button
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
          aria-label="Mark review as not helpful"
        >
          <ThumbsDown size={12} />
          No
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /*
    Public catalogue first (cached). An organisation's course is never in it:
    it is private to the organisation, so a member reaches it through their own
    session instead, and anybody else gets the same answer as a course that
    doesn't exist. A visitor who isn't signed in may simply be a member who
    hasn't signed in yet, so they're offered that rather than a dead end.
  */
  const course = (await getCourse(slug)) ?? (await getMemberCourse<Course>(slug));

  if (!course) {
    if (!(await hasSessionCookie())) return <SignInToViewCourse slug={slug} />;
    notFound();
  }


  // Catalog used to build the "Students also bought" rail.
  const allCourses = await getCourses();

  // Related courses: same category, excluding current course
  const relatedCourses = allCourses.filter(
    (c) => c.categorySlug === course.categorySlug && c.slug !== course.slug
  );
  // If not enough from same category, fill with top-rated courses
  const displayRelated =
    relatedCourses.length >= 2
      ? relatedCourses.slice(0, 6)
      : [
          ...relatedCourses,
          ...allCourses
            .filter(
              (c) =>
                c.slug !== course.slug &&
                !relatedCourses.some((r) => r.slug === c.slug)
            )
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 6 - relatedCourses.length),
        ];

  // Total lectures / total hours for summary
  const totalLectures = course.sections.reduce(
    (a, s) => a + s.lectures.length,
    0
  );
  const totalSectionHours = course.sections.reduce(
    (a, s) =>
      a +
      s.lectures.reduce((acc, l) => {
        const [m, sec] = (l.duration ?? "").split(":").map(Number);
        return acc + m + (sec || 0) / 60;
      }, 0),
    0
  );

  // JSON-LD Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.shortDescription,
    provider: {
      "@type": "Organization",
      name: "Elevate",
      sameAs: "https://elevate.example.com",
    },
    instructor: {
      "@type": "Person",
      name: course.instructor.name,
      jobTitle: course.instructor.title,
    },
    offers: {
      "@type": "Offer",
      // Free, and stated as such in the structured data so a search result
      // does not advertise a price the course does not have.
      price: 0,
      priceCurrency: "NGN",
      availability: "https://schema.org/InStock",
      url: `https://elevate.example.com/courses/${course.slug}`,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: course.rating,
      reviewCount: course.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    courseMode: "Online",
    inLanguage: course.language,
    timeRequired: `P${course.durationMonths}M`,
    educationalLevel: course.level,
  };

  return (
    <>
      {/* Records one page view — the raw material for the instructor's
          traffic-source and enrollment-funnel analytics. */}
      <TrackCourseView slug={course.slug} />

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        /* "<" escaped: a title or subtitle holding "</script>" must not end the tag (stored XSS). */
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ================================================================ */}
      {/*  1. Course Header                                                */}
      {/* ================================================================ */}
      <section className="bg-gradient-to-br from-neutral-900 via-primary-900 to-neutral-900 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary-600/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-primary-500/10 blur-3xl" />
        </div>

        <div className="section-container py-10 sm:py-14 relative z-10">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-sm text-primary-300 flex-wrap">
              <li>
                <Link
                  href="/"
                  className="hover:text-white transition-colors"
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li>
                <Link
                  href="/courses"
                  className="hover:text-white transition-colors"
                >
                  Courses
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li>
                <Link
                  href={`/courses?category=${course.categorySlug}`}
                  className="hover:text-white transition-colors"
                >
                  {course.category}
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li
                className="text-white/70 font-medium truncate max-w-[200px] sm:max-w-none"
                aria-current="page"
              >
                {course.title}
              </li>
            </ol>
          </nav>

          <div className="lg:max-w-[60%]">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-3">
              {course.rating >= 4.7 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-full border border-amber-400/30">
                  <TrendingUp size={12} />
                  Bestseller
                </span>
              )}
              {course.rating >= 4.5 && course.rating < 4.7 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500/20 text-orange-300 text-xs font-bold rounded-full border border-orange-400/30">
                  <Flame size={12} />
                  Hot
                </span>
              )}
              {course.studentsEnrolled > 5000 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-500/20 text-primary-300 text-xs font-medium rounded-full border border-primary-400/30">
                  <Users size={12} />
                  Popular
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4 leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {course.title}
            </h1>

            {/* Short description */}
            <p className="text-primary-200 text-sm sm:text-base leading-relaxed mb-5 max-w-2xl">
              {course.shortDescription}
            </p>

            {/* Rating + Students */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
              <StarRating rating={course.rating} count={course.reviewCount} />
              <span className="flex items-center gap-1.5 text-sm text-primary-200">
                <Users size={14} />
                {course.studentsEnrolled.toLocaleString()} students
              </span>
            </div>

            {/* Instructor link */}
            <p className="text-sm text-primary-200 mb-4">
              Created by{" "}
              <a
                href="#instructor"
                className="text-primary-100 underline underline-offset-2 hover:text-white transition-colors font-medium"
              >
                {course.instructor.name}
              </a>
            </p>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-primary-200">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                Last updated {course.lastUpdated}
              </span>
              <span className="flex items-center gap-1.5">
                <Globe size={14} />
                {course.language}
              </span>
              <span className="px-2.5 py-0.5 bg-white/10 rounded-full text-xs font-medium backdrop-blur-sm">
                {course.level}
              </span>
            </div>

            {/*
              Mobile-only summary. The button is in MobileStickyBar rather
              than here — two enrol buttons on one screen, one of which did
              nothing, is what this used to be.
            */}
            <div className="mt-6 border-t border-white/10 pt-6 lg:hidden">
              <p className="text-2xl font-bold text-white">Free</p>
              <p className="mt-1 text-sm text-primary-200">
                {course.totalLectures} lectures · {course.totalHours} hours
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  2. Sticky Tab Navigation                                        */}
      {/* ================================================================ */}
      <CourseTabNav />

      {/* ================================================================ */}
      {/*  3. Two-column layout                                            */}
      {/* ================================================================ */}
      <section className="section-container py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* ---- Left column ---- */}
          <div className="flex-1 min-w-0 order-2 lg:order-1">
            {/* 3a. Video Preview Banner */}
            <div id="overview" className="scroll-mt-24 mb-8">
              <VideoPreviewModal
                gradient={course.gradient}
                courseTitle={course.title}
              />

              {/* Quick stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="flex items-center gap-2.5 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                  <Play size={18} className="text-primary-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">
                      {course.totalHours}h
                    </p>
                    <p className="text-xs text-neutral-500">Video content</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                  <FileText size={18} className="text-primary-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">
                      {course.articles}
                    </p>
                    <p className="text-xs text-neutral-500">Articles</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                  <Download size={18} className="text-primary-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">
                      {course.downloadableResources}
                    </p>
                    <p className="text-xs text-neutral-500">Resources</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                  <Award size={18} className="text-primary-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">
                      {course.hasCertificate ? "Yes" : "No"}
                    </p>
                    <p className="text-xs text-neutral-500">Certificate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3b. What You'll Learn */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-6 mb-8">
              <h2
                className="heading-4 text-neutral-900 mb-5"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                What you&apos;ll learn
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {course.learningOutcomes.slice(0, 8).map((outcome, i) => (
                  <div key={i} className="flex gap-2.5">
                    <CheckCircle2
                      size={18}
                      className="text-primary-600 shrink-0 mt-0.5"
                    />
                    <span className="text-sm text-neutral-700 leading-relaxed">
                      {outcome}
                    </span>
                  </div>
                ))}
              </div>
              {course.learningOutcomes.length > 8 && (
                <p className="text-sm text-primary-600 font-medium mt-4 cursor-pointer hover:text-primary-700 transition-colors">
                  + {course.learningOutcomes.length - 8} more learning outcomes
                </p>
              )}
            </div>

            {/* 3c. Course Content */}
            <div id="curriculum" className="scroll-mt-24 mb-8">
              <h2
                className="heading-4 text-neutral-900 mb-1"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Course Content
              </h2>
              <p className="text-sm text-neutral-500 mb-4">
                {course.sections.length} sections &bull; {totalLectures}{" "}
                lectures &bull; {Math.round(totalSectionHours / 60)}h total
                length
              </p>
              <CourseAccordion sections={course.sections} />
            </div>

            {/* 3d. Requirements */}
            <div className="mb-8">
              <h2
                className="heading-4 text-neutral-900 mb-4"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Requirements
              </h2>
              <ul className="space-y-2.5">
                {course.requirements.map((req, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-sm text-neutral-700"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 shrink-0 mt-2" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            {/* 3e. Description */}
            <div className="mb-8">
              <h2
                className="heading-4 text-neutral-900 mb-4"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Description
              </h2>
              <CourseDetailClient
                description={course.description}
                level={course.level}
                duration={course.duration}
                language={course.language}
                hasCertificate={course.hasCertificate}
                lastUpdated={course.lastUpdated}
              />
            </div>

            {/* 3f. Instructor Section */}
            <div id="instructor" className="scroll-mt-24 mb-8">
              <h2
                className="heading-4 text-neutral-900 mb-4"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Instructor
              </h2>
              <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  {/* Avatar */}
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-lg">
                    {course.instructor.avatar}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Name */}
                    <a
                      href="#instructor"
                      className="inline-block"
                    >
                      <h3
                        className="text-xl font-semibold text-primary-700 hover:text-primary-800 transition-colors"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {course.instructor.name}
                      </h3>
                    </a>
                    <p className="text-sm text-neutral-500 mb-4">
                      {course.instructor.title}
                    </p>

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 text-sm text-neutral-600">
                      <span className="flex items-center gap-1.5">
                        <Star
                          size={14}
                          className="text-amber-400 fill-amber-400"
                        />
                        {course.instructor.rating} Instructor rating
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users size={14} className="text-neutral-400" />
                        {course.instructor.studentCount.toLocaleString()}{" "}
                        students
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BookOpen size={14} className="text-neutral-400" />
                        {course.instructor.courseCount} courses
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Award size={14} className="text-neutral-400" />
                        {course.reviewCount.toLocaleString()} reviews
                      </span>
                    </div>

                    {/* Bio */}
                    <RichTextView value={course.instructor.bio} size="sm" className="text-neutral-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* 3g. Student Reviews */}
            <div id="reviews" className="scroll-mt-24 mb-8">
              <h2
                className="heading-4 text-neutral-900 mb-5"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Student Reviews
              </h2>

              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                {/* Overall rating */}
                <div className="flex flex-col items-center justify-center p-6 bg-primary-50 rounded-xl min-w-[160px] border border-primary-100">
                  <span
                    className="text-5xl font-bold text-primary-700"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {course.rating.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5 my-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={18}
                        className={
                          i <= Math.round(course.rating)
                            ? "text-amber-400 fill-amber-400"
                            : "text-neutral-300 fill-neutral-300"
                        }
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">
                    Course Rating
                  </span>
                </div>

                {/* Breakdown */}
                <div className="flex-1">
                  <RatingBreakdown rating={course.rating} />
                </div>
              </div>

              {/*
                Where a learner writes their own review. Renders nothing unless
                they hold a live enrollment on this course, so the section reads
                the same as before for visitors and prospective buyers.
              */}
              <div className="mb-6">
                <ReviewForm courseSlug={course.slug} />
              </div>

              {/* Search reviews */}
              <div className="relative mb-6">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
                  aria-label="Search reviews"
                />
              </div>

              {/* Review cards */}
              <div className="space-y-4">
                {course.reviews.slice(0, 3).map((review, i) => (
                  <ReviewCard key={i} review={review} />
                ))}
              </div>

              {course.reviews.length > 3 && (
                <button className="btn-outline w-full mt-5 py-3">
                  Show all {course.reviews.length} reviews
                </button>
              )}
            </div>

            {/* 3h. FAQ Section */}
            <div id="faq" className="scroll-mt-24 mb-8">
              <h2
                className="heading-4 text-neutral-900 mb-5"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Frequently Asked Questions
              </h2>
              <CourseFAQ />
            </div>
          </div>

          {/* ---- Right sidebar ---- */}
          <div className="w-full lg:w-[380px] shrink-0 order-1 lg:order-2">
            <CourseSidebar course={course} />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  4. Related Courses                                              */}
      {/* ================================================================ */}
      {displayRelated.length > 0 && (
        <section className="bg-neutral-50 border-t border-neutral-200">
          <div className="section-container py-10 sm:py-14">
            <div className="relative">
              <h2
                className="heading-3 text-neutral-900 mb-8"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Students also bought
              </h2>
              <RelatedCourses
                courses={displayRelated.map((c) => ({
                  slug: c.slug,
                  title: c.title,
                  gradient: c.gradient,
                  instructor: { name: c.instructor.name },
                  rating: c.rating,
                  reviewCount: c.reviewCount,
                  studentsEnrolled: c.studentsEnrolled,
                }))}
              />
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/*  5. Mobile Sticky Bottom Bar                                     */}
      {/* ================================================================ */}
      <MobileStickyBar courseSlug={course.slug} courseTitle={course.title} />
    </>
  );
}
