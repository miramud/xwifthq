import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  The shared shape of every "something went wrong" screen.           */
/* ------------------------------------------------------------------ */

/**
 * One layout behind every error boundary, the 404 page and the offline-ish
 * states, so a failure never looks like it came from a different product.
 *
 * The rules it follows, which the individual screens then inherit:
 *
 *  • Say what happened and how to get out of it. An error with no recovery
 *    path is a dead end, so `primaryAction` is required, not optional.
 *  • Never apologise and never blame. "We couldn't load this" beats
 *    "Oops! Something went wrong :(".
 *  • `route` prints the path that failed in a mono face. It is the one
 *    decorative-looking element here that is actually information — it tells
 *    the reader where they are and gives support something to search for.
 *  • `role="alert"` so a screen reader announces the failure rather than
 *    leaving someone waiting on content that will never arrive.
 */
export interface ErrorStateProps {
  icon: LucideIcon;
  /** Short, factual. Sentence case, no exclamation marks. */
  title: string;
  /** One or two sentences: what happened, and what it means for them. */
  body: string;
  /** The path or resource involved, shown as a mono line. */
  route?: string;
  /** Support reference — Next's error `digest`, when there is one. */
  reference?: string;
  primaryAction: { label: string; href: string } | { label: string; onClick: () => void };
  secondaryAction?: { label: string; href: string };
  /** `error` for a failure, `neutral` for a 404 (nothing actually broke). */
  tone?: "error" | "neutral";
}

export default function ErrorState({
  icon: Icon,
  title,
  body,
  route,
  reference,
  primaryAction,
  secondaryAction,
  tone = "error",
}: ErrorStateProps) {
  const accent =
    tone === "error"
      ? { ring: "bg-error-500/10", text: "text-error-600" }
      : { ring: "bg-primary-500/10", text: "text-primary-600" };

  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center sm:py-24"
    >
      <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${accent.ring}`}>
        <Icon className={`h-7 w-7 ${accent.text}`} aria-hidden="true" />
      </div>

      <h1 className="heading-3 text-neutral-800">{title}</h1>

      <p className="mt-3 max-w-md leading-relaxed text-neutral-600">{body}</p>

      {route && (
        <p className="mt-6 max-w-full truncate rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-500">
          <span className="text-primary-500" aria-hidden="true">
            &gt;{" "}
          </span>
          {route}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {"href" in primaryAction ? (
          <Link href={primaryAction.href} className="btn-primary">
            {primaryAction.label}
          </Link>
        ) : (
          <button type="button" onClick={primaryAction.onClick} className="btn-primary">
            {primaryAction.label}
          </button>
        )}

        {secondaryAction && (
          <Link href={secondaryAction.href} className="btn-outline">
            {secondaryAction.label}
          </Link>
        )}
      </div>

      {reference && (
        <p className="mt-8 text-xs text-neutral-400">
          Quote reference <span className="font-mono text-neutral-500">{reference}</span> if you
          contact support.
        </p>
      )}
    </div>
  );
}
