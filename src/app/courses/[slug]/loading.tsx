import { Skeleton, LoadingRegion } from "@/components/feedback/Skeleton";

/**
 * Streamed while a course page is fetched.
 *
 * The dark hero and the sticky purchase card are the two things that define
 * this page's shape, so both are reserved at full size. The purchase card in
 * particular must not arrive late and push the page around — it is the element
 * people are reaching for.
 */
export default function CourseDetailLoading() {
  return (
    <LoadingRegion label="Loading course">
      <section className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-primary-900 to-neutral-900">
        <div className="section-container relative z-10 py-10 sm:py-14">
          <Skeleton className="h-3 w-64 bg-white/20" />

          <div className="mt-6 lg:max-w-[60%]">
            <Skeleton className="h-6 w-28 rounded-full bg-white/20" />
            <Skeleton className="mt-4 h-10 w-full bg-white/20 sm:h-12" />
            <Skeleton className="mt-3 h-10 w-3/4 bg-white/20 sm:h-12" />
            <Skeleton className="mt-5 h-4 w-full bg-white/15" />
            <Skeleton className="mt-2 h-4 w-5/6 bg-white/15" />

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Skeleton className="h-4 w-32 bg-white/15" />
              <Skeleton className="h-4 w-28 bg-white/15" />
              <Skeleton className="h-4 w-24 bg-white/15" />
            </div>
          </div>
        </div>
      </section>

      <div className="section-container py-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-8">
            {/* Tab rail */}
            <div className="flex gap-6 border-b border-neutral-200 pb-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-20" />
              ))}
            </div>

            {/* "What you'll learn" grid */}
            <div className="rounded-2xl border border-neutral-200 p-6">
              <Skeleton className="h-5 w-44" />
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Curriculum accordion */}
            <div className="space-y-3">
              <Skeleton className="h-5 w-36" />
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          </div>

          {/* Purchase card */}
          <aside className="w-full shrink-0 lg:w-80">
            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-lg">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <div className="space-y-2 pt-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-3.5 w-full" />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </LoadingRegion>
  );
}
