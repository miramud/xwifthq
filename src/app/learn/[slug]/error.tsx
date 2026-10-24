"use client";

import { useEffect } from "react";
import { BookX } from "lucide-react";
import ErrorState from "@/components/feedback/ErrorState";

/**
 * The course player runs full-screen and fixed, so a failure here would
 * otherwise leave a learner staring at a blank white overlay with no way out.
 *
 * The line about progress matters: the player writes each completed lesson to
 * the server as it goes, and someone whose page just died mid-course needs to
 * know they are not about to redo it.
 */
export default function LearnError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="fixed inset-0 bg-canvas z-50 flex items-center justify-center overflow-y-auto">
      <ErrorState
        icon={BookX}
        title="The course player did not load"
        body="We could not open this course. Every lesson you have finished is saved, so you will pick up where you left off."
        reference={error.digest}
        primaryAction={{ label: "Try again", onClick: reset }}
        secondaryAction={{ label: "Back to my courses", href: "/my-courses" }}
      />
    </div>
  );
}
