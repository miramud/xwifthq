"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { tours as toursApi, type TourProgress, type TourStatus } from "@/lib/api/tours-client";
import { tourByKey, tourForPath, type TourDefinition, type TourKey, type TourStep } from "./tours";

/**
 * The walkthrough that points at a dashboard's parts one at a time.
 *
 * The owner's ask (26 Sep 2026): on the first visit to each dashboard after
 * signing in, walk people through it with instructions over the things they
 * point at, Back and Next to the end — and let anybody replay it.
 *
 * Choices worth knowing:
 *
 *  - **Never in the way.** Skip, Back, the close button and Esc work on every
 *    step; the dimmed layer stops stray clicks but does not trap anybody.
 *    Where the tour has got to is saved as best effort: if the API is down,
 *    this browser remembers instead, and the page carries on either way.
 *  - **Only what is there.** A step whose target isn't on screen when the tour
 *    starts is left out — a panel the person can't see, a module that is off.
 *  - **Once each.** A finished or skipped tour stays that way until the person
 *    replays it from the ? button or their profile menu.
 */

const WAIT_FOR_PAGE_MS = 300;
const WAIT_FOR_PAGE_TRIES = 20;
const SPOT_PADDING = 8;
const GAP = 14;
const EDGE = 16;

/* ------------------------------------------------------------------ */
/*  Finding what a step points at                                      */
/* ------------------------------------------------------------------ */

function selectorFor(target: string): string {
  if (/^[[#.]/.test(target)) return target;
  return `[data-tour="${target.replace(/["\\]/g, "\\$&")}"]`;
}

function isShown(el: Element): boolean {
  const withCheck = el as Element & { checkVisibility?: () => boolean };
  if (typeof withCheck.checkVisibility === "function") return withCheck.checkVisibility();
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

/** The first of a step's targets that is on the page and visible, if any. */
export function resolveTarget(target: TourStep["target"]): HTMLElement | null {
  if (!target) return null;
  for (const candidate of Array.isArray(target) ? target : [target]) {
    let found: NodeListOf<HTMLElement>;
    try {
      found = document.querySelectorAll<HTMLElement>(selectorFor(candidate));
    } catch {
      continue; /* a malformed selector is a missing target */
    }
    for (const el of Array.from(found)) {
      if (isShown(el)) return el;
    }
  }
  return null;
}

/** The steps that can be shown right now: centred notes, and steps whose target is on screen. */
export function availableSteps(steps: TourStep[]): TourStep[] {
  return steps.filter((step) => !step.target || resolveTarget(step.target) !== null);
}

/* ------------------------------------------------------------------ */
/*  Remembering what has been seen                                     */
/* ------------------------------------------------------------------ */

const EMPTY: TourProgress = { completed: [], dismissed: [] };

function storageKey(userId: string): string {
  return `elevate:tours:${userId}`;
}

function readLocal(userId: string): TourProgress {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<TourProgress>;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeLocal(userId: string, progress: TourProgress): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(progress));
  } catch {
    /* storage blocked: the API is the record */
  }
}

function union(a: TourProgress, b: TourProgress): TourProgress {
  return {
    completed: Array.from(new Set([...a.completed, ...b.completed])),
    dismissed: Array.from(new Set([...a.dismissed, ...b.dismissed])),
  };
}

function withStatus(progress: TourProgress, key: string, status: TourStatus): TourProgress {
  const completed = progress.completed.filter((k) => k !== key);
  const dismissed = progress.dismissed.filter((k) => k !== key);
  return status === "completed"
    ? { completed: [...completed, key], dismissed }
    : { completed, dismissed: [...dismissed, key] };
}

function without(progress: TourProgress, key: string): TourProgress {
  return {
    completed: progress.completed.filter((k) => k !== key),
    dismissed: progress.dismissed.filter((k) => k !== key),
  };
}

function seen(progress: TourProgress, key: string): boolean {
  return progress.completed.includes(key) || progress.dismissed.includes(key);
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface Running {
  tour: TourDefinition;
  steps: TourStep[];
  index: number;
}

export interface TourContextValue {
  /** The tour that belongs to the page on screen, if it has one. */
  currentTour: TourDefinition | undefined;
  /** The tour being shown, and where it has got to. */
  active: { key: TourKey; index: number; total: number } | null;
  start: (key: TourKey) => boolean;
  /** Forgets that a tour was seen, then shows it again. */
  replay: (key?: TourKey) => void;
  next: () => void;
  back: () => void;
  finish: () => void;
  skip: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const INERT: TourContextValue = {
  currentTour: undefined,
  active: null,
  start: () => false,
  replay: () => {},
  next: () => {},
  back: () => {},
  finish: () => {},
  skip: () => {},
};

/** Tours for the page on screen. Outside a `TourProvider` it does nothing. */
export function useTour(): TourContextValue {
  return useContext(TourContext) ?? INERT;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const eligible = Boolean(userId) && user?.mustChangePassword !== true;

  const [loaded, setLoaded] = useState<{ userId: string; progress: TourProgress } | null>(null);
  const progress = loaded && loaded.userId === userId ? loaded.progress : null;
  const [running, setRunning] = useState<Running | null>(null);
  const autoStarted = useRef<Set<string>>(new Set());

  // What this person has already seen: the API, merged with this browser's
  // copy so a tour skipped while the API was down stays skipped.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    toursApi
      .progress()
      .then((remote) => {
        if (alive) setLoaded({ userId, progress: union(remote, readLocal(userId)) });
      })
      .catch(() => {
        if (alive) setLoaded({ userId, progress: readLocal(userId) });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const record = useCallback(
    (key: string, status: TourStatus) => {
      if (!userId) return;
      const next = withStatus(progress ?? readLocal(userId), key, status);
      writeLocal(userId, next);
      setLoaded({ userId, progress: next });
      toursApi.mark(key, status).catch(() => {
        /* remembered locally; the page carries on */
      });
    },
    [userId, progress],
  );

  const start = useCallback((key: TourKey): boolean => {
    const tour = tourByKey(key);
    if (!tour) return false;
    const steps = availableSteps(tour.steps);
    if (steps.length === 0) return false;
    setRunning({ tour, steps, index: 0 });
    return true;
  }, []);

  const end = useCallback(
    (status: TourStatus) => {
      if (!running) return;
      record(running.tour.key, status);
      setRunning(null);
    },
    [running, record],
  );

  const finish = useCallback(() => end("completed"), [end]);
  const skip = useCallback(() => end("dismissed"), [end]);

  const next = useCallback(() => {
    if (!running) return;
    if (running.index >= running.steps.length - 1) {
      end("completed");
      return;
    }
    setRunning({ ...running, index: running.index + 1 });
  }, [running, end]);

  const back = useCallback(() => {
    if (running && running.index > 0) setRunning({ ...running, index: running.index - 1 });
  }, [running]);

  const currentTour = useMemo(() => tourForPath(pathname), [pathname]);

  const replay = useCallback(
    (key?: TourKey) => {
      const target = key ?? currentTour?.key;
      if (!target) return;
      if (userId) {
        const next = without(progress ?? readLocal(userId), target);
        writeLocal(userId, next);
        setLoaded({ userId, progress: next });
        toursApi.reset(target).catch(() => {
          /* replaying still works; the API just keeps its old answer */
        });
      }
      autoStarted.current.add(target);
      start(target);
    },
    [currentTour, start, userId, progress],
  );

  // The first visit to a dashboard: wait for the page to render what the
  // tour points at (dashboards load their data after mounting), then start.
  const runningKey = running?.tour.key ?? null;
  useEffect(() => {
    if (!eligible || !progress || !currentTour || runningKey) return;
    const key = currentTour.key;
    if (seen(progress, key) || autoStarted.current.has(key)) return;

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const ready = availableSteps(currentTour.steps).filter((s) => s.target).length;
      const enough = ready >= Math.min(2, currentTour.steps.filter((s) => s.target).length);
      if (enough || tries >= WAIT_FOR_PAGE_TRIES) {
        window.clearInterval(timer);
        autoStarted.current.add(key);
        if (ready > 0 || currentTour.steps.some((s) => !s.target)) start(key);
      }
    }, WAIT_FOR_PAGE_MS);

    return () => window.clearInterval(timer);
  }, [eligible, progress, currentTour, runningKey, start]);

  // A tour belongs to its page: leaving the page ends it without a verdict,
  // so it is offered again next time.
  const [runningPath, setRunningPath] = useState(pathname);
  if (runningPath !== pathname) {
    setRunningPath(pathname);
    if (running) setRunning(null);
  }

  const value = useMemo<TourContextValue>(
    () => ({
      currentTour,
      active: running ? { key: running.tour.key, index: running.index, total: running.steps.length } : null,
      start,
      replay,
      next,
      back,
      finish,
      skip,
    }),
    [currentTour, running, start, replay, next, back, finish, skip],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {running && (
        <TourOverlay
          key={running.tour.key}
          tour={running.tour}
          step={running.steps[running.index]}
          index={running.index}
          total={running.steps.length}
          onNext={next}
          onBack={back}
          onSkip={skip}
        />
      )}
    </TourContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  The overlay: spotlight and popover                                 */
/* ------------------------------------------------------------------ */

interface Layout {
  spot: { top: number; left: number; width: number; height: number } | null;
  popover: { top: number; left: number } | null;
  sheet: boolean;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isSmallScreen(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches;
}

function place(
  target: DOMRect | null,
  popover: { width: number; height: number },
  preferred: TourStep["placement"],
): Layout["popover"] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampLeft = (left: number) => Math.min(Math.max(left, EDGE), Math.max(EDGE, vw - popover.width - EDGE));
  const clampTop = (top: number) => Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - popover.height - EDGE));

  if (!target) {
    return { top: clampTop((vh - popover.height) / 2), left: clampLeft((vw - popover.width) / 2) };
  }

  const spot = {
    top: target.top - SPOT_PADDING,
    bottom: target.bottom + SPOT_PADDING,
    left: target.left - SPOT_PADDING,
    right: target.right + SPOT_PADDING,
  };
  const centreX = target.left + target.width / 2 - popover.width / 2;
  const centreY = target.top + target.height / 2 - popover.height / 2;

  const options = {
    bottom: { fits: spot.bottom + GAP + popover.height <= vh - EDGE, top: spot.bottom + GAP, left: clampLeft(centreX) },
    top: { fits: spot.top - GAP - popover.height >= EDGE, top: spot.top - GAP - popover.height, left: clampLeft(centreX) },
    right: { fits: spot.right + GAP + popover.width <= vw - EDGE, top: clampTop(centreY), left: spot.right + GAP },
    left: { fits: spot.left - GAP - popover.width >= EDGE, top: clampTop(centreY), left: spot.left - GAP - popover.width },
  } as const;

  const order: (keyof typeof options)[] =
    preferred && preferred !== "auto"
      ? [preferred, "bottom", "top", "right", "left"]
      : ["bottom", "top", "right", "left"];

  for (const side of order) {
    if (options[side].fits) return { top: options[side].top, left: options[side].left };
  }
  // Nowhere fits (a target taller than the screen): keep it on screen, over the target.
  return { top: clampTop(vh - popover.height - EDGE), left: clampLeft(centreX) };
}

function TourOverlay({
  tour,
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
}: {
  tour: TourDefinition;
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ spot: null, popover: null, sheet: false });
  const last = index === total - 1;

  const measure = useCallback(() => {
    const target = resolveTarget(step.target);
    const rect = target ? target.getBoundingClientRect() : null;
    const sheet = isSmallScreen();
    const box = dialogRef.current?.getBoundingClientRect();
    const size = { width: box?.width || 360, height: box?.height || 220 };
    setLayout({
      spot: rect
        ? {
            top: rect.top - SPOT_PADDING,
            left: rect.left - SPOT_PADDING,
            width: rect.width + SPOT_PADDING * 2,
            height: rect.height + SPOT_PADDING * 2,
          }
        : null,
      popover: sheet ? null : place(rect, size, step.placement),
      sheet,
    });
  }, [step]);

  // Bring the target into view, then keep the spotlight on it as the page
  // scrolls, resizes or finishes loading around it.
  useEffect(() => {
    const target = resolveTarget(step.target);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    let frame = window.requestAnimationFrame(measure);
    const onChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    const settle = window.setInterval(onChange, 400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(settle);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [measure, step]);

  // Focus moves into the popover on every step, and goes back to wherever it
  // was when the tour ends.
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, [index]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => opener?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onBack, onSkip]);

  const positioned = layout.sheet || layout.popover !== null;

  return createPortal(
    // `ws` for the popover's tokens and type, but never its background: the
    // `.ws` rule paints the workspace canvas, which turned this full-screen
    // layer into an opaque sheet and hid every highlighted element behind it.
    // Inline, because the unlayered `.ws` rule outranks a `bg-transparent` utility.
    <div className="ws fixed inset-0 z-[80]" style={{ background: "transparent" }} data-tour-overlay="">
      {/* Stops stray clicks on the page; it never closes the tour by itself. */}
      <div className="absolute inset-0" aria-hidden onClick={(event) => event.stopPropagation()} />

      {layout.spot ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-2xl ring-2 ring-primary-400 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
          style={{
            top: layout.spot.top,
            left: layout.spot.left,
            width: layout.spot.width,
            height: layout.spot.height,
            boxShadow: "0 0 0 9999px rgba(12, 24, 33, 0.58)",
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-[rgba(12,24,33,0.58)]" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${tour.name} tour`}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={
          layout.sheet
            ? "fixed inset-x-0 bottom-0 rounded-t-[1.5rem] bg-white p-5 pb-6 shadow-2xl outline-none motion-safe:animate-fade-in"
            : "fixed w-[min(360px,calc(100vw-32px))] rounded-[1.25rem] bg-white p-5 shadow-2xl shadow-neutral-900/20 outline-none focus-visible:ring-2 focus-visible:ring-primary-300 motion-safe:transition-[top,left] motion-safe:duration-200 motion-safe:ease-out"
        }
        style={
          layout.sheet
            ? undefined
            : {
                top: layout.popover?.top ?? 0,
                left: layout.popover?.left ?? 0,
                visibility: positioned ? "visible" : "hidden",
              }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700">
              Step {index + 1} of {total}
            </span>
            <span className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={
                    i === index
                      ? "h-1.5 w-4 rounded-full bg-primary-600"
                      : i < index
                        ? "h-1.5 w-1.5 rounded-full bg-primary-300"
                        : "h-1.5 w-1.5 rounded-full bg-neutral-200"
                  }
                />
              ))}
            </span>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close the tour"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <h2 id={titleId} className="mt-2 text-base font-bold tracking-tight text-neutral-900">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-neutral-600">
          {step.body}
        </p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={index === 0}
              className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-neutral-200 bg-white px-3.5 text-[13px] font-semibold text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onNext}
              className="inline-flex h-9 cursor-pointer items-center rounded-xl bg-primary-600 px-4 text-[13px] font-semibold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              {last ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
