"use client";

import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import ErrorState from "@/components/feedback/ErrorState";
import { inWorkspace, recoveryFor } from "@/lib/recovery";

/**
 * The not-found screen, in the words of the module the reader was in.
 *
 * A client component only because the root `not-found` is not given the path
 * it was rendered for, and the way back depends on it.
 */
export default function NotFoundState() {
  const pathname = usePathname();
  const way = recoveryFor(pathname);

  return (
    <div
      className={inWorkspace(pathname) ? "ws min-h-dvh bg-canvas" : undefined}
    >
      <ErrorState
        icon={Compass}
        tone="neutral"
        title="That page isn't here"
        body={way.missing}
        primaryAction={way.home}
        secondaryAction={way.wider}
      />
    </div>
  );
}
