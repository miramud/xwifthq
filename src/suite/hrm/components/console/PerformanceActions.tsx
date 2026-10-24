"use client";

import { useState } from "react";
import {
  hrm,
  type Kpi,
  type KpiStatus,
  type MetricDirection,
  type MetricType,
  type Milestone,
  type MilestoneStatus,
} from "@/lib/api/hrm-client";
import { useSubmit } from "./Dialog";
import { Button } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ModalFrame, Notice, hintCls, inputCls, labelCls } from "../ui2/kit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/*
  The shared HR `Dialog` furniture, in the workspace style. Same props and the
  same accessible wiring (a label's hint on `aria-describedby`, Escape and the
  backdrop close), so the forms below read exactly as they did.
*/
const INPUT = inputCls;

function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <ModalFrame title={title} subtitle={subtitle} onClose={onClose} wide={wide}>
      {children}
    </ModalFrame>
  );
}

function Field({
  id,
  label,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className={hintCls}>
          {hint}
        </p>
      )}
    </div>
  );
}

function FormActions({
  onCancel,
  submitLabel,
  saving,
  disabled = false,
  danger = false,
}: {
  onCancel: () => void;
  submitLabel: string;
  saving: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="-mx-6 -mb-5 mt-2 flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
      <Button onClick={onCancel}>Cancel</Button>
      <Button type="submit" variant={danger ? "danger" : "primary"} disabled={saving || disabled}>
        {saving ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}

function ErrorNote({ error }: { error: string | null }) {
  if (error === null) return null;

  return <Notice tone="error">{error}</Notice>;
}

/**
 * Setting targets and milestones, rather than only reading them.
 *
 * `PerformanceBoard` rendered attainment percentages for nine write endpoints
 * that nothing called. No target could be set, changed, closed or measured
 * from the product, so the only KPIs that could exist were the seeder's and
 * every figure on that board was decoration.
 *
 * Three judgements the forms carry.
 *
 * **Direction is asked, never inferred.** Roughly a third of real targets are
 * "lower is better", sickness absence, complaints, time to fill a vacancy,
 * and a form that assumes "higher" silently scores half an institution's
 * targets backwards.
 *
 * **Closed and cancelled are offered separately.** A closed target's result
 * counts towards the score; a cancelled one is excluded. Somebody tidying up a
 * target that was overtaken by events needs the second, and a single "close"
 * button would quietly mark them down for it.
 *
 * **A milestone delivered late is recorded as delivered and as late.** The
 * board already reports those separately; the form has to let somebody say
 * *when* it actually landed rather than defaulting to today.
 */

const METRIC_TYPES: { value: MetricType; label: string; unitHint: string }[] = [
  { value: "number", label: "A count", unitHint: "e.g. admissions, referrals" },
  { value: "percentage", label: "A percentage", unitHint: "0 to 100" },
  { value: "currency", label: "Money", unitHint: "in naira" },
  { value: "duration", label: "A length of time", unitHint: "e.g. days, minutes" },
  { value: "boolean", label: "Done or not done", unitHint: "1 or 0" },
];

/* ------------------------------------------------------------------ */
/*  Targets                                                            */
/* ------------------------------------------------------------------ */

export function KpiDialog({
  employeeId,
  existing,
  onClose,
  onSaved,
}: {
  employeeId: string;
  /** Present when editing rather than setting a new one. */
  existing?: Kpi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [metricType, setMetricType] = useState<MetricType>(
    existing?.metricType ?? "number",
  );
  const [direction, setDirection] = useState<MetricDirection>(
    existing?.direction ?? "higher",
  );
  const [targetValue, setTargetValue] = useState(
    existing !== undefined ? String(existing.target) : "",
  );
  const [baselineValue, setBaselineValue] = useState(
    existing?.baseline != null ? String(existing.baseline) : "",
  );
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [weight, setWeight] = useState(String(existing?.weight ?? 1));
  const [periodStart, setPeriodStart] = useState(existing?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(existing?.periodEnd ?? "");

  const { submit, saving, error } = useSubmit(onSaved);

  const payload = () => ({
    title,
    description: description === "" ? undefined : description,
    metricType,
    direction,
    targetValue: Number(targetValue),
    baselineValue: baselineValue === "" ? undefined : Number(baselineValue),
    unit: unit === "" ? undefined : unit,
    weight: Number(weight),
    periodStart,
    periodEnd,
  });

  const chosen = METRIC_TYPES.find((t) => t.value === metricType);

  return (
    <Dialog
      title={existing !== undefined ? "Edit the target" : "Set a target"}
      subtitle="A number, a direction and a period. A target needs all three."
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            existing !== undefined
              ? hrm.performance.updateKpi(existing.id, payload())
              : hrm.performance.createKpi(employeeId, payload()),
          )
        }
        className="space-y-4"
      >
        <Field id="kpi-title" label="What is being measured">
          <input
            id="kpi-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            required
            className={INPUT}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="kpi-metric" label="Kind of number" hint={chosen?.unitHint}>
            <SearchableSelect
              id="kpi-metric"
              aria-describedby="kpi-metric-hint"
              value={metricType}
              onChange={(v) => setMetricType(v as MetricType)}
              options={METRIC_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </Field>

          {/*
            Asked, never inferred. About a third of real targets are "lower is
            better", absence, complaints, time to fill, and assuming higher
            scores those backwards without anybody noticing.
          */}
          <Field
            id="kpi-direction"
            label="Good means"
            hint="Absence, complaints and waiting times are all targets where lower is the achievement."
          >
            <SearchableSelect
              id="kpi-direction"
              aria-describedby="kpi-direction-hint"
              value={direction}
              onChange={(v) => setDirection(v as MetricDirection)}
              options={[
                { value: "higher", label: "Higher is better" },
                { value: "lower", label: "Lower is better" },
              ]}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="kpi-target" label="Target">
            <input
              id="kpi-target"
              type="number"
              step="any"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              required
              className={INPUT}
            />
          </Field>

          <Field
            id="kpi-baseline"
            label="Starting from"
            hint="Optional."
          >
            <input
              id="kpi-baseline"
              type="number"
              step="any"
              aria-describedby="kpi-baseline-hint"
              value={baselineValue}
              onChange={(e) => setBaselineValue(e.target.value)}
              className={INPUT}
            />
          </Field>

          <Field id="kpi-unit" label="Unit">
            <input
              id="kpi-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={32}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="kpi-from" label="From">
            <input
              id="kpi-from"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              className={INPUT}
            />
          </Field>

          <Field id="kpi-to" label="Until">
            <input
              id="kpi-to"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
              className={INPUT}
            />
          </Field>

          <Field
            id="kpi-weight"
            label="Weight"
            hint="Relative to their other targets."
          >
            <input
              id="kpi-weight"
              type="number"
              min={1}
              max={100}
              aria-describedby="kpi-weight-hint"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <Field id="kpi-description" label="Notes">
          <RichTextEditor id="kpi-description" minHeight={102} value={description} onChange={setDescription} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel={existing !== undefined ? "Save" : "Set it"}
          saving={saving}
          disabled={
            title.trim() === "" ||
            targetValue === "" ||
            periodStart === "" ||
            periodEnd === ""
          }
        />
      </form>
    </Dialog>
  );
}

export function RecordReadingDialog({
  kpi,
  onClose,
  onSaved,
}: {
  kpi: Kpi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [measuredOn, setMeasuredOn] = useState("");
  const [note, setNote] = useState("");
  const { submit, saving, error } = useSubmit(onSaved);

  return (
    <Dialog
      title="Record a reading"
      subtitle={kpi.title}
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.performance.record(kpi.id, {
              value: Number(value),
              measuredOn: measuredOn === "" ? undefined : measuredOn,
              note: note === "" ? undefined : note,
            }),
          )
        }
        className="space-y-4"
      >
        <Field
          id="reading-value"
          label={kpi.unit != null ? `Reading (${kpi.unit})` : "Reading"}
          hint={`Target is ${kpi.target}. ${
            kpi.direction === "lower" ? "Lower is better." : "Higher is better."
          }`}
        >
          <input
            id="reading-value"
            type="number"
            step="any"
            aria-describedby="reading-value-hint"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            className={INPUT}
          />
        </Field>

        {/*
          Defaults to blank, not today. A figure for last month entered this
          morning is a reading for last month, and dating it now bends the
          series in a way nobody will spot later.
        */}
        <Field
          id="reading-date"
          label="Measured on"
          hint="Leave blank for today. Set it if this reading is for an earlier period."
        >
          <input
            id="reading-date"
            type="date"
            aria-describedby="reading-date-hint"
            value={measuredOn}
            onChange={(e) => setMeasuredOn(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field id="reading-note" label="Note">
          <RichTextEditor id="reading-note" minHeight={76} value={note} onChange={setNote} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Record"
          saving={saving}
          disabled={value === ""}
        />
      </form>
    </Dialog>
  );
}

export function KpiStatusDialog({
  kpi,
  onClose,
  onSaved,
}: {
  kpi: Kpi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<KpiStatus>(kpi.status);
  const { submit, saving, error } = useSubmit(onSaved);

  return (
    <Dialog title="Change the target's status" subtitle={kpi.title} onClose={onClose}>
      <form
        onSubmit={(e) =>
          submit(e, () => hrm.performance.setKpiStatus(kpi.id, status))
        }
        className="space-y-4"
      >
        <Field id="kpi-status" label="Status">
          <SearchableSelect
            id="kpi-status"
            value={status}
            onChange={(v) => setStatus(v as KpiStatus)}
            options={[
              { value: "draft", label: "Draft: not yet agreed with them" },
              { value: "active", label: "Active" },
              { value: "closed", label: "Closed: the result counts" },
              { value: "cancelled", label: "Cancelled: excluded from their score" },
            ]}
          />
        </Field>

        {/*
          The distinction that would otherwise cost somebody a rating. A target
          overtaken by a reorganisation should be cancelled, not closed, and a
          single "close" button would mark them down for a target nobody could
          have met.
        */}
        <p className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-600">
          Closing and cancelling are different. A closed target&rsquo;s result
          counts towards their score. A cancelled one is left out of it
          entirely, which is what you want for a target overtaken by events.
        </p>

        <ErrorNote error={error} />
        <FormActions onCancel={onClose} submitLabel="Save" saving={saving} />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Milestones                                                         */
/* ------------------------------------------------------------------ */

export function MilestoneDialog({
  employeeId,
  kpis,
  onClose,
  onSaved,
}: {
  employeeId: string;
  kpis: Kpi[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [kpiId, setKpiId] = useState("");
  const [weight, setWeight] = useState("1");
  const { submit, saving, error } = useSubmit(onSaved);

  return (
    <Dialog
      title="Set a milestone"
      subtitle="Something with a date that is either delivered or not."
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.performance.createMilestone(employeeId, {
              title,
              description: description === "" ? undefined : description,
              dueOn,
              kpiId: kpiId === "" ? undefined : kpiId,
              weight: Number(weight),
            }),
          )
        }
        className="space-y-4"
      >
        <Field id="milestone-title" label="What has to be delivered">
          <input
            id="milestone-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            required
            className={INPUT}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="milestone-due" label="Due">
            <input
              id="milestone-due"
              type="date"
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
              required
              className={INPUT}
            />
          </Field>

          <Field
            id="milestone-weight"
            label="Weight"
            hint="Relative to their other milestones."
          >
            <input
              id="milestone-weight"
              type="number"
              min={1}
              max={100}
              aria-describedby="milestone-weight-hint"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        {kpis.length > 0 && (
          <Field
            id="milestone-kpi"
            label="Towards which target"
            hint="Optional. A milestone can stand on its own."
          >
            <SearchableSelect
              id="milestone-kpi"
              aria-describedby="milestone-kpi-hint"
              value={kpiId}
              onChange={setKpiId}
              options={[
                { value: "", label: "On its own" },
                ...kpis.map((kpi) => ({ value: kpi.id, label: kpi.title })),
              ]}
            />
          </Field>
        )}

        <Field id="milestone-description" label="Notes">
          <RichTextEditor id="milestone-description" minHeight={102} value={description} onChange={setDescription} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Set it"
          saving={saving}
          disabled={title.trim() === "" || dueOn === ""}
        />
      </form>
    </Dialog>
  );
}

export function MilestoneStatusDialog({
  milestone,
  onClose,
  onSaved,
}: {
  /*
    Narrower than `Milestone` on purpose. The rows embedded in an employee's
    performance payload carry less than the standalone resource does, and this
    form only ever needed these four.
  */
  milestone: Pick<Milestone, "id" | "title" | "status" | "achievedOn">;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<MilestoneStatus>(milestone.status);
  const [achievedOn, setAchievedOn] = useState(milestone.achievedOn ?? "");
  const { submit, saving, error } = useSubmit(onSaved);

  return (
    <Dialog
      title="Update the milestone"
      subtitle={milestone.title}
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.performance.setMilestoneStatus(
              milestone.id,
              status,
              achievedOn === "" ? undefined : achievedOn,
            ),
          )
        }
        className="space-y-4"
      >
        <Field id="milestone-status" label="Status">
          <SearchableSelect
            id="milestone-status"
            value={status}
            onChange={(v) => setStatus(v as MilestoneStatus)}
            options={[
              { value: "planned", label: "Planned" },
              { value: "in_progress", label: "In progress" },
              { value: "achieved", label: "Achieved" },
              { value: "missed", label: "Missed" },
              { value: "cancelled", label: "Cancelled: excluded from their score" },
            ]}
          />
        </Field>

        {/*
          Asked rather than stamped with today. Something delivered last
          Friday and recorded this morning was delivered last Friday, and the
          board reports "delivered, and late" as a separate fact from
          "delivered", which only works if the real date is available.
        */}
        {status === "achieved" && (
          <Field
            id="milestone-achieved"
            label="Delivered on"
            hint="The day it actually landed, which may not be today. Late delivery is recorded as delivered and as late, not as missed."
          >
            <input
              id="milestone-achieved"
              type="date"
              aria-describedby="milestone-achieved-hint"
              value={achievedOn}
              onChange={(e) => setAchievedOn(e.target.value)}
              className={INPUT}
            />
          </Field>
        )}

        <ErrorNote error={error} />
        <FormActions onCancel={onClose} submitLabel="Save" saving={saving} />
      </form>
    </Dialog>
  );
}
