"use client";

import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Info, Lock, Play, Route as RouteIcon, Users } from "lucide-react";
import type { ContextFieldDef, RoutePreview } from "@/lib/api/approvals-client";
import { formatMoney } from "@/lib/api/approvals-client";
import { ApiError, orgFoundations, type PolicyDefinition } from "@/lib/api/org-foundations-client";
import { Button, Chip, Panel, cx } from "@/components/workspace/kit";
import { ErrorNote, FaceAvatar } from "@/suite/lms/components/ui/ws";
import { ValueInput } from "./ConditionBuilder";
import { cleanContext, flagLabel, normaliseErrors, type BuilderField, type FieldErrors, type Op } from "./policy-logic";
import { LookupSelect, smallLabel } from "./parts";
import { STAGE_TYPES } from "./StageEditor";

/*
  The simulator: pick somebody, describe a request, and see exactly who it
  would go to under this version — before anybody relies on it. For a draft
  it plans against the rules as they are on screen, unsaved edits included;
  nothing is saved. Problems in those rules come back as a 422 and are shown
  in place, like a failed save.
*/

const REQUESTER_FIELDS = new Set(["requesterId", "requesterUnitId", "requesterApprovalRoles", "documentAmount"]);

export function Simulator({
  policyId,
  fields,
  flags,
  definition,
  onErrors,
}: {
  policyId: string;
  fields: ContextFieldDef[];
  /** Flag fields the rules test ("flags.urgent"), offered as switches. */
  flags: string[];
  /** The draft's rules as on screen; omitted for a version that can't change. */
  definition?: PolicyDefinition;
  /** Told the rules' problems from a 422 (or null when a run succeeds). */
  onErrors?: (errors: FieldErrors | null) => void;
}) {
  const id = useId();
  const [requesterId, setRequesterId] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [flagValues, setFlagValues] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<RoutePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!requesterId) {
      setError("Choose who is asking first.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      setResult(await orgFoundations.approvals.simulate(policyId, requesterId, cleanContext(values, flagValues), definition));
      onErrors?.(null);
    } catch (e) {
      setResult(null);
      if (e instanceof ApiError && e.status === 422 && e.errors && Object.keys(e.errors).some((k) => k !== "requesterId" && k !== "context")) {
        onErrors?.(normaliseErrors(e.errors));
        setError("The rules have problems, marked on the left. Fix them and simulate again.");
      } else {
        setError(e instanceof ApiError ? e.errors?.requesterId?.[0] ?? e.message : "The simulation didn't run. Try again.");
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <Panel title="Simulator" subtitle="Who would a request go to under this version?" icon={FlaskConical} hue="grape">
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-requester`} className={smallLabel}>
            Asked by
          </label>
          <LookupSelect id={`${id}-requester`} lookup="people" value={requesterId} onChange={setRequesterId} placeholder="Choose a person" />
        </div>

        {/* The requester's own details come from "Asked by"; the engine works them out. */}
        {fields.filter((f) => !REQUESTER_FIELDS.has(f.key)).map((f) => {
          const field: BuilderField = { key: f.key, label: f.label, type: f.type, options: f.options ?? [] };
          const op: Op = f.type === "list" || f.type === "project_list" ? "in" : "eq";
          const value = values[f.key] ?? (op === "in" ? [] : f.type === "boolean" ? false : f.type === "money" || f.type === "number" ? null : "");
          return (
            <div key={f.key}>
              <label htmlFor={`${id}-${f.key}`} className={smallLabel}>
                {f.label}
              </label>
              <ValueInput id={`${id}-${f.key}`} field={field} op={op} value={value} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
            </div>
          );
        })}

        {flags.length > 0 && (
          <fieldset>
            <legend className={smallLabel}>Flags raised</legend>
            <div className="flex flex-wrap gap-2">
              {flags.map((key) => (
                <label key={key} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={Boolean(flagValues[key])}
                    onChange={(e) => setFlagValues((s) => ({ ...s, [key]: e.target.checked }))}
                    className="h-4 w-4 accent-primary-600"
                  />
                  {flagLabel(key)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button icon={Play} onClick={() => void run()} disabled={running} className="w-full">
          {running ? "Working out the route…" : "Simulate"}
        </Button>

        {definition && <p className="text-xs text-neutral-500">Uses the rules as they are on screen, including unsaved changes. Nothing is saved.</p>}

        <div aria-live="polite">{result && <RouteTimeline route={result} />}</div>
      </div>
    </Panel>
  );
}

const OUTCOME = {
  routed: { hue: "blue" as const, icon: RouteIcon, words: "Routed" },
  auto_approved: { hue: "mint" as const, icon: CheckCircle2, words: "Approved automatically" },
  unresolved: { hue: "rose" as const, icon: AlertTriangle, words: "Can't be routed" },
};

/** The planned route as a vertical timeline: each stage, who, and why. */
export function RouteTimeline({ route }: { route: RoutePreview }) {
  const o = OUTCOME[route.outcome] ?? OUTCOME.routed;
  const stages = [...route.stages].sort((a, b) => a.order - b.order);
  return (
    <section aria-label="Planned route" className="border-t border-neutral-100 pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip hue={o.hue} icon={o.icon}>
          {o.words}
        </Chip>
        {route.flags.map((f) => (
          <Chip key={f} hue="sun" icon={AlertTriangle}>
            {flagLabel(`flags.${f}`)}
          </Chip>
        ))}
      </div>
      {route.reason && <p className="mb-3 text-sm text-neutral-700">{route.reason}</p>}
      {route.outcome === "unresolved" && route.unresolvedStages.length > 0 && (
        <div role="alert" className="mb-3 rounded-xl border border-rose-500/30 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          Nobody was found for: <strong>{route.unresolvedStages.join(", ")}</strong>. A request like this would wait for an administrator to route it.
        </div>
      )}
      {(route.documentAmount != null || route.aggregatedAmount != null) && (
        <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
          {route.documentAmount != null && (
            <div className="rounded-xl bg-neutral-50 px-3 py-2">
              <dt className="text-neutral-500">This request</dt>
              <dd className="font-semibold tabular-nums text-neutral-900">{formatMoney(route.documentAmount)}</dd>
            </div>
          )}
          {route.aggregatedAmount != null && route.aggregatedAmount !== route.documentAmount && (
            <div className="rounded-xl bg-sun-50 px-3 py-2">
              <dt className="text-sun-700">With recent similar requests</dt>
              <dd className="font-semibold tabular-nums text-neutral-900">{formatMoney(route.aggregatedAmount)}</dd>
            </div>
          )}
        </dl>
      )}

      {stages.length === 0 ? (
        <p className="text-sm text-neutral-500">No stages: nobody needs to act.</p>
      ) : (
        <ol className="relative space-y-4 pl-8 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-0.5 before:rounded-full before:bg-neutral-200">
          {stages.map((s, i) => {
            const empty = s.approvers.length === 0;
            return (
              <li key={`${s.key}-${i}`} className="relative">
                <span
                  className={cx(
                    "absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-4 ring-white",
                    empty ? "bg-rose-500 text-white" : s.isControl ? "bg-neutral-800 text-white" : "bg-primary-600 text-white",
                  )}
                  aria-hidden
                >
                  {empty ? "!" : s.isControl ? <Lock size={11} /> : i + 1}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-neutral-900">{s.name}</p>
                  <span className="text-xs text-neutral-500">
                    {STAGE_TYPES.find((t) => t.value === s.type)?.label ?? (s.isControl ? "Control" : s.type)}
                    {s.completion === "all" ? " · all must answer" : s.completion === "quorum" && s.quorum ? ` · ${s.quorum} must answer` : ""}
                  </span>
                  {s.isControl && <Chip hue="slate">Control</Chip>}
                  {empty && <Chip hue="rose">Nobody found</Chip>}
                </div>
                {s.approvers.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {s.approvers.map((a) => (
                      <li key={`${a.id}-${a.via}`} className="flex items-center gap-2 text-sm text-neutral-800">
                        <FaceAvatar name={a.name} size={24} />
                        <span className="min-w-0">
                          <span className="font-medium">{a.name ?? "Unknown"}</span>
                          <span className="text-xs text-neutral-500"> · {a.via}{a.scope ? ` (${a.scope})` : ""}</span>
                          {a.onBehalfOf && <span className="block text-xs text-grape-700">Covering for {a.onBehalfOf}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.reasons.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-600">
                    <span className="font-semibold">Why: </span>
                    {s.reasons.join("; ")}
                  </p>
                )}
                {s.notes.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {s.notes.map((n, k) => (
                      <li key={k} className="flex items-start gap-1.5 text-xs text-sky-700">
                        <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {route.trace.length > 0 && (
        <details className="mt-4 rounded-xl bg-neutral-50 p-3">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
            <Users size={14} aria-hidden /> How the engine worked it out ({route.trace.length} steps)
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-neutral-600">
            {route.trace.map((t, k) => (
              <li key={k}>{t}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
