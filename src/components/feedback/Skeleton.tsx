/* ------------------------------------------------------------------ */
/*  Loading placeholders.                                              */
/* ------------------------------------------------------------------ */

/**
 * Skeletons rather than a centred spinner, because these routes are server
 * components: the shell can paint immediately and only the data-dependent
 * regions need to wait. A skeleton that matches the real layout also reserves
 * the space the content will take, so nothing jumps when it arrives.
 *
 * `motion-reduce:animate-none` throughout — a pulsing page is exactly the kind
 * of ambient motion someone with vestibular sensitivity has asked not to see.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200 motion-reduce:animate-none ${className}`}
    />
  );
}

/** Wraps a loading region so screen readers announce it rather than silence. */
export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Matches the proportions of a CourseGrid tile so the swap is invisible. */
export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-md">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}

export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}
