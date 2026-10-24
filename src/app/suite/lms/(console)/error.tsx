"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ServerCrash } from "lucide-react";
import ErrorState from "@/components/feedback/ErrorState";

/**
 * Scoped to the admin console so a failure in one panel does not take the
 * whole shell down: the sidebar stays mounted and the admin can move to
 * another section instead of losing their place entirely.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <ErrorState
      icon={ServerCrash}
      title="This page did not load"
      body="We could not reach the data behind this page. Nothing has changed, so it is safe to try again."
      route={pathname}
      reference={error.digest}
      primaryAction={{ label: "Try again", onClick: reset }}
      secondaryAction={{ label: "Back to overview", href: "/suite/lms" }}
    />
  );
}
