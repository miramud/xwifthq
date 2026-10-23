import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Clouds } from "@/components/site/Sky";

/**
 * The public site's version of a status screen (the 404 and the root error
 * boundary): a lilac sky with clouds, and one white frame floating on it that
 * says what happened and how to get out. Workspace routes keep the plainer
 * `ErrorState`, which matches the suite chrome around it.
 *
 * `role="alert"` is only set for a real failure. A 404 is not an emergency,
 * so it reads as an ordinary heading instead of interrupting a screen reader.
 */
export function PublicStatus({
  icon: Icon,
  eyebrow,
  title,
  body,
  route,
  reference,
  primaryAction,
  secondaryAction,
  tone = "neutral",
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  route?: string;
  reference?: string;
  primaryAction: { label: string; href: string } | { label: string; onClick: () => void };
  secondaryAction?: { label: string; href: string };
  tone?: "neutral" | "error";
}) {
  const tile = tone === "error" ? "bg-error-500/10 text-error-600" : "bg-primary-50 text-primary-600";

  return (
    <section className="xw-sky relative isolate flex min-h-[70vh] items-center overflow-hidden px-4 py-20 sm:py-28">
      <Clouds className="-z-10" />

      <div
        role={tone === "error" ? "alert" : undefined}
        className="xw-frame mx-auto w-full max-w-xl px-6 py-10 text-center sm:px-12 sm:py-14"
      >
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${tile}`}>
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>

        <p className="xw-eyebrow mt-6">{eyebrow}</p>
        <h1 className="xw-h2 mt-4">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-600">{body}</p>

        {route && (
          <p className="mx-auto mt-6 w-fit max-w-full truncate rounded-full bg-neutral-100 px-4 py-1.5 font-mono text-xs text-neutral-600">
            <span className="text-primary-600" aria-hidden="true">
              &gt;{" "}
            </span>
            {route}
          </p>
        )}

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
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
          <p className="mt-8 text-xs text-neutral-500">
            Contacting support? Mention reference <span className="break-all font-mono text-neutral-700">{reference}</span>.
          </p>
        )}
      </div>
    </section>
  );
}
