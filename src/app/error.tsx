"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import ErrorState from "@/components/feedback/ErrorState";
import { inWorkspace, recoveryFor } from "@/lib/recovery";

/**
 * Route-level error boundary for everything under the root layout.
 *
 * Without one of these a single thrown render error replaced the entire
 * application with Next's default error screen — navbar, footer and all. This
 * keeps the shell intact and gives the reader a way forward.
 *
 * `reset()` re-renders the segment. It is offered first because a transient
 * fetch failure genuinely does recover on a retry.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // The digest is all that reaches production; the message is stripped.
    // Reported rather than logged so an error tracker can pick it up.
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <div
      className={inWorkspace(pathname) ? "ws min-h-dvh bg-canvas" : undefined}
    >
      <ErrorState
        icon={TriangleAlert}
        title="This page didn't load"
        body="Something broke on our side while putting this page together. Nothing you have saved is affected."
        route={pathname}
        reference={error.digest}
        primaryAction={{ label: "Try again", onClick: reset }}
        /* Back to the module the reader was in — not the course catalogue for everybody. */
        secondaryAction={recoveryFor(pathname).home}
      />
    </div>
  );
}
