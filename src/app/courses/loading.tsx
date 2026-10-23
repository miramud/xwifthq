import { Skeleton, CourseGridSkeleton, LoadingRegion } from "@/components/feedback/Skeleton";

/**
 * Streamed while the catalog is fetched server-side.
 *
 * The lilac sky band is painted for real rather than skeletonised: it is
 * static chrome that never depends on the data, so showing it immediately makes
 * the page feel like it has arrived while only the grid is still coming. The
 * skeleton grid below matches the real tile proportions, so the swap does not
 * shift the layout.
 */
export default function CoursesLoading() {
  return (
    <LoadingRegion label="Loading courses">
      <section className="xw-sky">
        <div className="section-container flex flex-col items-center pb-10 pt-10 sm:pb-14 sm:pt-14">
          <Skeleton className="h-3 w-32 bg-white/70" />
          <Skeleton className="mt-6 h-6 w-40 rounded-full bg-white/70" />
          <Skeleton className="mt-4 h-9 w-64 bg-white/70 sm:h-11 sm:w-96" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl bg-white/60" />
          <Skeleton className="mt-6 h-8 w-44 rounded-full bg-white/70" />
        </div>
      </section>

      <div className="section-container pb-10 pt-2">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Filter rail, desktop only, mirroring CourseFilters. */}
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
