"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import ErrorState from "@/components/feedback/ErrorState";
import { PublicStatus } from "@/components/site/PublicStatus";
import { inWorkspace, recoveryFor } from "@/lib/recovery";

/**
 * Route-level error boundary for everything under the root layout.
 *
 * Without one of these a single thrown render error replaced the entire
 * application with Next's default error screen, navbar, footer and all. This
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
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  const title = "This page didn't load";
  const body = "Something went wrong on our side while building this page. Anything you've already saved is safe.";
  // Back to the module the reader was in, not the course catalogue for everybody.
  const way = recoveryFor(pathname).home;

  if (inWorkspace(pathname)) {
    return (
      <div className="ws min-h-dvh bg-canvas">
        <ErrorState
          icon={TriangleAlert}
          title={title}
          body={body}
          route={pathname}
          reference={error.digest}
          primaryAction={{ label: "Try again", onClick: reset }}
          secondaryAction={way}
        />
      </div>
    );
  }

  return (
    <PublicStatus
      icon={TriangleAlert}
      tone="error"
      eyebrow="Something went wrong"
      title={title}
      body={body}
      route={pathname}
      reference={error.digest}
      primaryAction={{ label: "Try again", onClick: reset }}
      secondaryAction={way}
    />
  );
}
