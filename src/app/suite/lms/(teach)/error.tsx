"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ServerCrash } from "lucide-react";
import ErrorState from "@/components/feedback/ErrorState";

/**
 * Scoped to the instructor studio. The reassurance about unsaved work is not
 * decoration: the curriculum editor holds a lot of typing, and the first thing
 * an author wants to know when a page falls over is whether they have lost it.
 */
export default function InstructorError({
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
      title="This page didn't load"
      body="The studio couldn't reach the data behind this page. Anything you have already saved is safe. Only this view failed."
      route={pathname}
      reference={error.digest}
      primaryAction={{ label: "Try again", onClick: reset }}
      secondaryAction={{ label: "Back to overview", href: "/suite/lms/teach" }}
    />
  );
}
