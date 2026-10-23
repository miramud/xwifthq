"use client";

import { useEffect } from "react";

const VISITOR_KEY = "tt_visitor_id";

/**
 * Records one view of a course-detail page.
 *
 * The request reaches Laravel through a Next route handler, so the server sees
 * the proxy's IP for every visitor. To keep unique-visitor counts honest the
 * browser mints its own opaque id once and reuses it; the backend salts and
 * hashes it before storing, so the raw value never lands in the database.
 *
 * Renders nothing. Failures are swallowed — analytics must never break a page.
 */
export default function TrackCourseView({ slug }: { slug: string }) {
  useEffect(() => {
    let visitorId: string;

    try {
      visitorId = localStorage.getItem(VISITOR_KEY) ?? "";
      if (!visitorId) {
        visitorId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        localStorage.setItem(VISITOR_KEY, visitorId);
      }
    } catch {
      // Private mode / storage disabled: fall back to a per-load id.
      visitorId = "";
    }

    const controller = new AbortController();

    void fetch(`/api/courses/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId: visitorId || undefined,
        referrer: document.referrer || undefined,
      }),
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {});

    return () => controller.abort();
  }, [slug]);

  return null;
}
