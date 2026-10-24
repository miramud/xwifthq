"use client";

import { use, useEffect, useState } from "react";
import { Route } from "lucide-react";
import LearningPathBuilder from "@/suite/lms/components/console/LearningPathBuilder";
import PathRoster from "@/suite/lms/components/console/PathRoster";
import { learningPaths as api, ApiError, type LearningPath } from "@/lib/api/saas-client";
import { ButtonLink, Card, Empty } from "@/components/workspace/kit";
import { Skeleton } from "@/suite/lms/components/ui/ws";

export default function EditLearningPathPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [path, setPath] = useState<LearningPath | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    api
      .get(slug)
      .then((data) => alive && setPath(data))
      .catch((err: unknown) => {
        if (!alive) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? "This learning path no longer exists, or belongs to another organisation."
            : "We could not load this learning path.",
        );
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  if (error) {
    return (
      <Card>
        <Empty
          icon={Route}
          hue="grape"
          title={error}
          action={
            <ButtonLink href="/suite/lms/learning-paths" variant="primary">
              Back to learning paths
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  if (!path) {
    return (
      <div className="space-y-4" role="status" aria-busy="true">
        <span className="sr-only">Loading learning path</span>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  // Keyed on the slug so navigating between paths remounts the builder with the
  // new record rather than leaving the previous one's edits in local state.
  return (
    <div className="space-y-6">
      <LearningPathBuilder key={path.slug} existing={path} />

      {/*
        Below the builder, because editing the path is what somebody came here
        to do. But it belongs on this page rather than anywhere else: the only
        thing the product could previously say about who holds a path was how
        many of them there were.
      */}
      <PathRoster slug={path.slug} />
    </div>
  );
}
