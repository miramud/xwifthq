import { Skeleton, CourseGridSkeleton, LoadingRegion } from "@/components/feedback/Skeleton";

/**
 * Streamed while the catalog is fetched server-side.
 *
 * The violet header band is painted for real rather than skeletonised — it is
 * static chrome that never depends on the data, so showing it immediately makes
 * the page feel like it has arrived while only the grid is still coming. The
 * skeleton grid below matches the real tile proportions, so the swap does not
 * shift the layout.
 */
export default function CoursesLoading() {
  return (
    <LoadingRegion label="Loading courses">
      <section className="bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 text-white">
        <div className="section-container py-10 sm:py-14">
          <Skeleton className="h-3 w-40 bg-white/20" />
          <Skeleton className="mt-5 h-9 w-72 bg-white/20 sm:h-11 sm:w-96" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl bg-white/15" />
        </div>
      </section>

      <div className="section-container py-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Filter rail — desktop only, mirroring CourseFilters. */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="space-y-6 rounded-2xl bg-white p-5 shadow-md">
              {Array.from({ length: 4 }, (_, group) => (
                <div key={group} className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  {Array.from({ length: 4 }, (_, row) => (
                    <div key={row} className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </aside>

          <div className="flex-1">
            <div className="mb-6 flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-40 rounded-lg" />
            </div>
            <CourseGridSkeleton count={6} />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
