"use client";

import { CircleHelp } from "lucide-react";
import { useTour } from "./TourProvider";

/**
 * Replays the tour for the page on screen. Hidden on pages that have none, so
 * it never offers something that does nothing.
 *
 * `icon` sits in the workspace top bar; `inline` is a text button for pages
 * outside the workspace shell (My learning).
 */
export function TourHelpButton({ variant = "icon" }: { variant?: "icon" | "inline" }) {
  const { currentTour, replay, active } = useTour();
  if (!currentTour) return null;

  const label = `Take the ${currentTour.name} tour`;

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={() => replay(currentTour.key)}
        disabled={active !== null}
        data-tour="tour-help"
        className="btn-outline gap-1.5 px-4 py-2 text-sm"
      >
        <CircleHelp size={16} aria-hidden />
        Take the tour
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => replay(currentTour.key)}
      disabled={active !== null}
      aria-label={label}
      title={label}
      data-tour="tour-help"
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-default disabled:opacity-50"
    >
      <CircleHelp size={19} aria-hidden />
    </button>
  );
}
