"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Lock, Route, TriangleAlert, Zap } from "lucide-react";
import { approvals, ApiError, formatMoney, type RoutePreview } from "@/lib/api/approvals-client";
import { flagLabel, STAGE_TYPE } from "@/suite/approvals/lib/labels";
import { Chip, cx } from "./kit";

/**
 * "Your request will go to…": the route a request would take, shown before
 * anybody presses send. Every module's submit dialog can drop this in with
 * the process code and the same context it is about to submit.
 *
 * It asks the engine (`approvals.simulate`) 400ms after the context stops
 * changing, and draws the answer as a horizontal stepper: each stage with
 * the people it would wait on, a lock on control stages, and any warning the
 * engine raised (a purchase that looks split, a stage nobody holds).
 */
export function ApprovalRoutePreview({
  process,
  context,
  className,
  delay = 400,
}: {
  process: string;
  context: Record<string, unknown>;
  className?: string;
  /** Debounce, in ms. */
  delay?: number;
}) {
  // Stable key so a parent re-rendering with an equal object does not re-ask.
  const key = useMemo(() => JSON.stringify({ process, context }), [process, context]);
  const [state, setState] = useState<{ key: string; route: RoutePreview | null; error: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    const { process: p, context: c } = JSON.parse(key) as { process: string; context: Record<string, unknown> };
    const t = setTimeout(() => {
      approvals
        .simulate(p, c)
        .then((route) => alive && setState({ key, route, error: null }))
        .catch((e: unknown) =>
          alive &&
          setState({
            key,
            route: null,
            error: e instanceof ApiError && e.status === 422 ? e.message : "The route couldn't be worked out just now.",
          }),
        );
    }, delay);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [key, delay]);

  const loading = state === null || state.key !== key;
  const route = state?.route ?? null;

  return (
    <section
      aria-label="Who this request will go to"
      aria-busy={loading}
      className={cx("@container rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4", className)}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          <Route size={15} aria-hidden />
        </span>
        <p className="text-sm font-semibold text-neutral-900">Your request will go to</p>
        {loading && state !== null && <span className="text-xs text-neutral-500">Updating…</span>}
      </div>

      {state === null ? (
        <div className="flex gap-2" aria-hidden>
          <span className="h-14 w-40 animate-pulse rounded-xl bg-neutral-200/60" />
          <span className="h-14 w-40 animate-pulse rounded-xl bg-neutral-200/60" />
        </div>
      ) : state.error ? (
        <p className="text-sm text-neutral-600">{state.error}</p>
      ) : route ? (
        <RouteStepper route={route} />
      ) : null}

      {/* What screen readers hear, in one line. */}
      {route && !state?.error && (
        <p className="sr-only" aria-live="polite">
          {route.outcome === "auto_approved"
            ? "This request will be approved automatically."
            : `Your request will go to: ${route.summary}`}
        </p>
      )}
    </section>
  );
}

/** A narrow container stacks the stages; a wide one runs them left to right with arrows. */
function RouteStepper({ route }: { route: RoutePreview }) {
  return (
    <div className="space-y-3">
      {route.outcome === "auto_approved" ? (
        <p className="flex items-center gap-2 text-sm text-neutral-700">
          <Zap size={15} className="text-mint-700" aria-hidden />
          Nobody needs to sign this off — it is approved as soon as you send it.
        </p>
      ) : (
        <ol className="flex flex-col gap-2 @xl:flex-row @xl:flex-wrap @xl:items-stretch @xl:gap-x-1" aria-label="Route">
          {route.stages.map((s, i) => {
            const names = s.approvers.map((a) => a.name ?? a.via).filter(Boolean);
            const unresolved = route.unresolvedStages.includes(s.key) || s.approvers.length === 0;
            return (
              <li key={s.key} className="flex items-center gap-1">
                <div
                  className={cx(
                    "min-w-0 flex-1 rounded-xl border px-3 py-2 @xl:min-w-[9rem] @xl:max-w-[16rem] @xl:flex-none",
                    unresolved ? "ws-hatch border-sun-500/50" : "border-neutral-200 bg-white",
                  )}
                >
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="tabular-nums">{i + 1}</span>
                    <span aria-hidden>·</span>
                    {STAGE_TYPE[s.type] ?? s.type}
                    {s.isControl && (
                      <span className="inline-flex items-center gap-0.5 text-grape-700" title="Control stage">
                        <Lock size={11} aria-hidden />
                        <span className="sr-only">control stage</span>
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{s.name}</p>
                  <p className="truncate text-xs text-neutral-600">
                    {unresolved
                      ? "Nobody holds this role yet"
                      : names.join(", ")}
                    {s.completion === "quorum" && s.quorum ? ` · any ${s.quorum}` : s.completion === "all" && names.length > 1 ? " · all of them" : ""}
                  </p>
                </div>
                {i < route.stages.length - 1 && <ArrowRight size={14} className="hidden shrink-0 text-neutral-400 @xl:block" aria-hidden />}
              </li>
            );
          })}
        </ol>
      )}

      {(route.flags.length > 0 || route.outcome === "unresolved") && (
        <div className="flex flex-wrap gap-2">
          {route.flags.map((f) => (
            <Chip key={f} hue="sun" icon={TriangleAlert}>
              {flagLabel(f)}
            </Chip>
          ))}
          {route.outcome === "unresolved" && (
            <Chip hue="rose" icon={TriangleAlert}>
              {route.unresolvedStages.length > 0
                ? "Some stages have nobody to approve them — an admin will route it by hand"
                : route.reason ?? "This request can't be routed yet"}
            </Chip>
          )}
        </div>
      )}

      {route.aggregatedAmount != null && route.documentAmount != null && route.aggregatedAmount > route.documentAmount && (
        <p className="text-xs text-neutral-600">
          Judged on {formatMoney(route.aggregatedAmount)} — this request together with related ones — rather than {formatMoney(route.documentAmount)}.
        </p>
      )}
    </div>
  );
}

export default ApprovalRoutePreview;
