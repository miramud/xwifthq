"use client";

import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import ErrorState from "@/components/feedback/ErrorState";
import { PublicStatus } from "@/components/site/PublicStatus";
import { inWorkspace, recoveryFor } from "@/lib/recovery";

/**
 * The not-found screen, in the words of the module the reader was in.
 *
 * A client component only because the root `not-found` is not given the path
 * it was rendered for, and the way back depends on it. Inside a workspace it
 * keeps the suite's plain layout; on the public site it sits on the lilac sky
 * like every other public page.
 */
export default function NotFoundState() {
  const pathname = usePathname();
  const way = recoveryFor(pathname);

  if (inWorkspace(pathname)) {
    return (
      <div className="ws min-h-dvh bg-canvas">
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

  return (
    <PublicStatus
      icon={Compass}
      eyebrow="Error 404"
      title="That page isn't here"
      body={way.missing}
      route={pathname}
      primaryAction={way.home}
      secondaryAction={way.wider}
    />
  );
}
