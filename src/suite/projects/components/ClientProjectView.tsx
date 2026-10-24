import {
  CalendarCheck2,
  CalendarClock,
  Circle,
  CircleCheck,
  FileText,
  Flag,
  Info,
  Lock,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * What a client sees when they open a link.
 *
 * **A page for somebody who has never used this product and never will.** No
 * navigation, nothing to click that leads anywhere else, no vocabulary from
 * the board. Someone opening this has been sent a link by a supplier and wants
 * one question answered, *how is it going*, and the page should answer it
 * above the fold and then get out of the way.
 *
 * **Every date says it can change.** These are worked out from a live plan,
 * not promised, and a page that does not say so is one that gets quoted back
 * in a meeting. The line is in the header rather than a footnote nobody reads.
 *
 * **A milestone with no date is not a milestone with a blank date.** Where
 * only a derived date exists it is labelled *expected*; where the team set a
 * real one it is labelled *due*. Collapsing the two would present an estimate
 * as a commitment, which on a client-facing page is the one mistake worth
 * designing around.
 *
 * Server-rendered, and deliberately no `"use client"`: there is nothing here
 * to interact with, and a client who has JavaScript disabled or blocked by a
 * corporate proxy still gets the whole page. For the same reason it draws
 * with plain markup and the workspace's CSS classes rather than the kit's
 * client components.
 *
 * The page lives outside the signed-in shell, so it carries the `ws` class
 * itself: that is what swaps in the workspace palette, typeface and canvas
 * (see `globals.css`), without it every `primary-*` here would be the
 * marketing site's teal.
 */
export default function ClientProjectView({ data }: { data: SharedProject }) {
  const { project, progress, milestones, timeline, documents } = data;

  const milestonesDone = milestones.filter((m) => m.isComplete).length;
  const pct = progress.total === 0 ? 0 : Math.round((progress.complete / progress.total) * 100);

  return (
    <div className="ws min-h-screen">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* ---------------- header ---------------- */}
        <header className="ws-card relative overflow-hidden p-6 sm:p-8">
          {/* A quiet wash of colour, so the page reads as somebody's product and not a printout. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-100/70 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-grape-100/60 blur-3xl"
          />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
              Project status
            </p>

            {project.company !== null && (
              <p className="mt-3 text-sm font-medium text-neutral-500">{project.company}</p>
            )}

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-[30px]">
              {project.name}
            </h1>

            {project.summary !== null && (
              <RichTextView value={project.summary} className="mt-2 max-w-2xl text-neutral-600" />
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-50 px-2.5 py-1 font-semibold text-mint-700">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-500" aria-hidden />
                {project.statusLabel}
              </span>

              {project.targetEndsOn !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
                  <Flag size={12} aria-hidden />
                  Target {formatDate(project.targetEndsOn)}
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 px-1 text-neutral-500">
                <CalendarClock size={13} aria-hidden />
                As at {formatDate(data.asAt)}
              </span>
            </div>

            {/* Not a footnote. See the class comment. */}
            <p className="mt-5 flex items-start gap-2 rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm text-primary-800">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>{data.basis}</span>
            </p>
          </div>
        </header>

        {/* ---------------- progress ---------------- */}
        <section className="ws-card mt-6 p-6 sm:p-8" aria-labelledby="client-progress">
          <SectionTitle id="client-progress" icon={TrendingUp} tile="bg-primary-50 text-primary-700">
            Progress
          </SectionTitle>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            {milestones.length > 0 ? (
              <p className="text-sm text-neutral-600">
                <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">
                  {milestonesDone} of {milestones.length}
                </span>{" "}
                milestones complete
              </p>
            ) : (
              <p className="text-sm text-neutral-600">
                <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">
                  {progress.complete} of {progress.total}
                </span>{" "}
                items complete
              </p>
            )}

            <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-bold tabular-nums text-primary-700">
              {pct}%
            </span>
          </div>

          {/* Hatched remainder: what is left reads as "not yet", not as an empty trough. */}
          <div
            className="ws-hatch mt-4 h-3 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={`${progress.complete} of ${progress.total} items complete`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600"
              style={{ width: `${pct}%` }}
            />
          </div>
        </section>

        {(milestones.length > 0 || timeline.length > 0) && (
          <div
            className={classes("mt-6 grid gap-6", milestones.length > 0 && timeline.length > 0 && "md:grid-cols-2")}
          >
            {/* ---------------- milestones ---------------- */}
            {milestones.length > 0 && (
              <section className="ws-card p-6" aria-labelledby="client-milestones">
                <SectionTitle id="client-milestones" icon={Flag} tile="bg-coral-50 text-coral-700">
                  Milestones
                </SectionTitle>

                <ol className="relative mt-5 space-y-4">
                  {/* The thread the milestones hang on. */}
                  <span
                    aria-hidden
                    className="absolute bottom-2 left-[11px] top-2 w-px bg-neutral-200"
                  />
                  {milestones.map((milestone, i) => (
                    <li key={`${milestone.title}-${i}`} className="relative flex items-start gap-3">
                      <span
                        className={classes(
                          "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                          milestone.isComplete ? "bg-mint-50 text-mint-600" : "bg-white text-neutral-400",
                        )}
                      >
                        {milestone.isComplete ? (
                          <CircleCheck size={18} aria-hidden />
                        ) : (
                          <Circle size={18} aria-hidden />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p
                          className={classes(
                            "text-sm font-medium",
                            milestone.isComplete ? "text-neutral-500 line-through" : "text-neutral-900",
                          )}
                        >
                          {milestone.title}
                        </p>
                        {milestone.isComplete && <span className="sr-only">Complete.</span>}

                        {/*
                          Due and expected are different claims, so they are worded
                          differently. Presenting an estimate as a commitment is the
                          one mistake worth designing around here.
                        */}
                        {milestone.dueOn !== null ? (
                          <p className="mt-0.5 text-xs font-medium text-neutral-600">
                            Due {formatDate(milestone.dueOn)}
                          </p>
                        ) : milestone.expectedOn !== null ? (
                          <p className="mt-0.5 text-xs italic text-neutral-500">
                            Expected around {formatDate(milestone.expectedOn)}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-neutral-500">Not yet scheduled</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* ---------------- timeline ---------------- */}
            {timeline.length > 0 && (
              <section className="ws-card p-6" aria-labelledby="client-timeline">
                <SectionTitle id="client-timeline" icon={CalendarCheck2} tile="bg-grape-50 text-grape-700">
                  Timeline
                </SectionTitle>

                <ol className="mt-5 space-y-2">
                  {timeline.map((block, i) => (
                    <li
                      key={`${block.name}-${i}`}
                      className={classes(
                        "flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm",
                        block.isCurrent
                          ? "bg-primary-50 text-primary-800 ring-1 ring-primary-100"
                          : block.isComplete
                            ? "bg-neutral-50 text-neutral-500"
                            : "ws-hatch text-neutral-700",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className={classes(
                            "h-2 w-2 shrink-0 rounded-full",
                            block.isCurrent ? "bg-primary-500" : block.isComplete ? "bg-mint-500" : "bg-neutral-300",
                          )}
                        />
                        <span className="truncate font-medium">{block.name}</span>
                        {block.isCurrent && (
                          <span className="shrink-0 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Now
                          </span>
                        )}
                        {block.isComplete && <span className="sr-only">(finished)</span>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums">
                        {formatDate(block.startsOn)} to {formatDate(block.endsOn)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}

        {/* ---------------- documents ---------------- */}
        {documents.length > 0 && (
          <section className="ws-card mt-6 p-6" aria-labelledby="client-documents">
            <SectionTitle id="client-documents" icon={FileText} tile="bg-sun-50 text-sun-700">
              Documents
            </SectionTitle>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {documents.map((document) => (
                <li key={document.id}>
                  <a
                    href={`/api/shared/${data.token}/documents/${document.id}`}
                    className="flex h-full items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 outline-none transition hover:border-primary-200 hover:bg-primary-50/40 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sun-50 text-sun-700">
                      <FileText size={18} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">
                        {document.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {document.kindLabel}
                        {document.addedOn !== null && ` · ${formatDate(document.addedOn)}`}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-8 flex items-start gap-3 px-1 text-xs text-neutral-500">
          <Lock size={14} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
          <div>
            {data.sharedBy.organisation !== null && (
              <p className="font-medium text-neutral-600">
                Shared with you by {data.sharedBy.organisation}.
              </p>
            )}
            <p className="mt-1">
              This link is private. It expires, and whoever sent it can withdraw it
              at any time.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({
  id,
  icon: Icon,
  tile,
  children,
}: {
  id: string;
  icon: LucideIcon;
  /** The icon tile's wash and ink, as literal classes so Tailwind sees them. */
  tile: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-base font-bold tracking-tight text-neutral-900">
      <span className={classes("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}>
        <Icon size={18} aria-hidden />
      </span>
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The payload, which is an allowlist built by hand on the server.
 *
 * Typed narrowly here on purpose: if somebody widens the server payload, this
 * type does not follow it, and a field cannot reach the page without a person
 * deciding it should.
 */
export interface SharedProject {
  /** Carried through from the URL, for the document links. */
  token: string;
  project: {
    name: string;
    summary: string | null;
    status: string;
    statusLabel: string;
    startsOn: string | null;
    targetEndsOn: string | null;
    company: string | null;
  };
  progress: { total: number; complete: number };
  milestones: {
    title: string;
    isComplete: boolean;
    dueOn: string | null;
    expectedOn: string | null;
  }[];
  timeline: {
    name: string;
    startsOn: string;
    endsOn: string;
    isComplete: boolean;
    isCurrent: boolean;
  }[];
  documents: {
    id: string;
    title: string;
    description: string | null;
    kind: string;
    kindLabel: string;
    addedOn: string | null;
  }[];
  sharedBy: { organisation: string | null };
  asAt: string;
  basis: string;
}

/**
 * Joins the classes that apply. A local copy of the kit's `cx`: this page is a
 * server component, and the kit module is a client one.
 */
function classes(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
