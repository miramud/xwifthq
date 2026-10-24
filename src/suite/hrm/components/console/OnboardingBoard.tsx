"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Gauge,
  ListChecks,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  PersonAvatar,
  Progress,
  StatCard,
  StatGrid,
  buttonClass,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  hrm,
  type EmploymentType,
  type OnboardingJourney,
  type OnboardingProgramme,
  type StepInput,
  type StepOwner,
} from "@/lib/api/hrm-client";
import {
  Dialog,
  ErrorNote,
  Field,
  FormActions,
  INPUT,
  useSubmit,
} from "./Dialog";
import { formatDate } from "@/suite/hrm/lib/format";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { IconTile, LoadError, PersonCell, ToneChip } from "../ui/recordKit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { Notice } from "@/suite/hrm/components/ui2/kit";

/**
 * Onboarding: who is part-way through, and the checklists they work from.
 *
 * The two tabs are genuinely different jobs. *Starters* is a chase list, it
 * changes daily and is read to find out what is holding a start up.
 * *Checklists* is configuration, edited rarely.
 *
 * Editing a checklist is safe at any time: a starter already part-way through
 * holds their own copy of the steps, so improving the template changes what the
 * *next* person is asked to do and nothing about what this one was.
 */

const OWNERS: { value: StepOwner; label: string }[] = [
  { value: "hr", label: "HR" },
  { value: "manager", label: "Line manager" },
  { value: "employee", label: "The starter" },
  { value: "it", label: "IT" },
  { value: "finance", label: "Finance" },
];

const TYPES: { value: EmploymentType | ""; label: string }[] = [
  { value: "", label: "Anybody (fallback)" },
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "casual", label: "Casual" },
];

export default function OnboardingBoard() {
  const [tab, setTab] = useState<"Starters" | "Checklists">("Starters");

  return (
    <div>
      <PageHeader
        title="Onboarding"
        subtitle="Who is part-way through a checklist, and the checklists they work from."
        tabs={[
          { key: "Starters", label: "Starters" },
          { key: "Checklists", label: "Checklists" },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as "Starters" | "Checklists")}
      />

      {tab === "Starters" ? <Starters /> : <Programmes />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Starters                                                            */
/* ------------------------------------------------------------------ */

function Starters() {
  const [journeys, setJourneys] = useState<OnboardingJourney[] | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<OnboardingJourney | null>(
    null,
  );
  const [abandoning, setAbandoning] = useState<OnboardingJourney | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    hrm.onboarding
      .journeys()
      .then((res) => {
        setJourneys(res.data);
        setOverdueCount(res.meta.withOverdueSteps);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [reloadKey]);

  if (error !== null) {
    return <LoadError message={error} />;
  }

  if (journeys === null) {
    return <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />;
  }

  const ready = journeys.filter((j) => j.requiredComplete).length;
  const average =
    journeys.length === 0
      ? 0
      : Math.round(journeys.reduce((sum, j) => sum + (j.progress ?? 0), 0) / journeys.length);

  /*
    A start date moving is the ordinary case, not an exception, notice
    periods get extended, visas take longer. Without "Move dates" every step
    on the checklist goes red and stays red.
  */
  const actions = (journey: OnboardingJourney) => (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => setRescheduling(journey)}
        aria-label={`Move the dates for ${journey.employee?.name ?? "this starter"}`}
        className={buttonClass("secondary", "sm")}
      >
        <CalendarClock size={15} aria-hidden />
        Move dates
      </button>
      <button
        type="button"
        onClick={() => setAbandoning(journey)}
        aria-label={`Stop onboarding ${journey.employee?.name ?? "this starter"}`}
        className={buttonClass("ghost", "sm")}
      >
        Stop
      </button>
    </div>
  );

  const flags = (journey: OnboardingJourney) => (
    <>
      {(journey.overdueCount ?? 0) > 0 && <ToneChip tone="error">{journey.overdueCount} late</ToneChip>}
      {journey.requiredComplete && <ToneChip tone="success">Ready to close</ToneChip>}
    </>
  );

  const columns: Column<OnboardingJourney>[] = [
    {
      key: "name",
      header: "Starter",
      primary: true,
      sortable: true,
      value: (j) => j.employee?.name ?? "",
      render: (j) => (
        <PersonCell
          name={j.employee?.name ?? "Unnamed"}
          sub={j.employee?.jobTitle ?? "-"}
          href={`/suite/hrm/people/${j.employeeId}`}
        />
      ),
    },
    {
      key: "programme",
      header: "Checklist",
      sortable: true,
      hideOnMobile: true,
      value: (j) => j.programmeName,
      render: (j) => <Chip hue={hueFor(j.programmeName)} icon={ListChecks}>{j.programmeName}</Chip>,
    },
    {
      key: "starts",
      header: "Starts",
      sortable: true,
      value: (j) => j.anchorDate ?? "",
      render: (j) => <span className="whitespace-nowrap tabular-nums">{formatDate(j.anchorDate)}</span>,
    },
    {
      key: "progress",
      header: "Progress",
      sortable: true,
      value: (j) => j.progress ?? 0,
      render: (j) => (
        <div className="flex w-36 items-center gap-2">
          <div className="flex-1">
            <Progress value={j.progress ?? 0} hue={(j.overdueCount ?? 0) > 0 ? "coral" : "sky"} size="sm" />
          </div>
          <span className="text-xs font-semibold tabular-nums text-neutral-700">{j.progress ?? 0}%</span>
        </div>
      ),
    },
    {
      key: "flags",
      header: "Status",
      render: (j) => <div className="flex flex-wrap gap-1.5">{flags(j)}</div>,
    },
    { key: "actions", header: "", tableOnly: true, align: "right", render: (j) => actions(j) },
  ];

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard icon={Users} hue="sky" label="Starters" value={journeys.length} hint="Working through a checklist" />
        <StatCard
          icon={AlertTriangle}
          hue={overdueCount > 0 ? "coral" : "mint"}
          label="With a late step"
          value={overdueCount}
          hint={overdueCount > 0 ? `${overdueCount} with a step past its date` : "Nothing overdue"}
        />
        <StatCard icon={CheckCircle2} hue="mint" label="Ready to close" value={ready} hint="Every required step done" />
        <StatCard icon={Gauge} hue="grape" label="Average progress" value={average} unit="%" hint="Across required steps" />
      </StatGrid>

      <DataView
        rows={journeys}
        columns={columns}
        rowKey={(j) => j.id}
        storageKey="hrm.onboarding.starters"
        caption="Starters working through onboarding"
        searchPlaceholder="Search starters"
        empty={
          <Empty
            icon={ClipboardList}
            hue="sky"
            title="Nobody is onboarding"
            hint="A checklist is started automatically when somebody is taken on."
          />
        }
        renderCard={(j) => (
          <div className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <PersonAvatar name={j.employee?.name ?? "Unnamed"} size={44} />
              <div className="min-w-0 flex-1">
                <PersonCellName j={j} />
                <p className="truncate text-xs text-neutral-500">{j.employee?.jobTitle ?? "-"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip hue={hueFor(j.programmeName)} icon={ListChecks}>{j.programmeName}</Chip>
              <Chip hue="slate" icon={CalendarClock}>Starts {formatDate(j.anchorDate)}</Chip>
              {flags(j)}
            </div>
            <Progress
              value={j.progress ?? 0}
              hue={(j.overdueCount ?? 0) > 0 ? "coral" : "sky"}
              label="Required steps done"
              showValue
            />
            <div className="mt-auto border-t border-neutral-100 pt-3">{actions(j)}</div>
          </div>
        )}
        renderListItem={(j) => (
          <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
            <PersonAvatar name={j.employee?.name ?? "Unnamed"} size={40} />
            <div className="min-w-0 flex-1">
              <PersonCellName j={j} />
              <p className="truncate text-xs text-neutral-500">
                {j.employee?.jobTitle ?? "-"} · {j.programmeName} · starts {formatDate(j.anchorDate)}
              </p>
            </div>
            <div className="flex w-32 items-center gap-2">
              <div className="flex-1">
                <Progress value={j.progress ?? 0} hue={(j.overdueCount ?? 0) > 0 ? "coral" : "sky"} size="sm" />
              </div>
              <span className="text-xs font-semibold tabular-nums">{j.progress ?? 0}%</span>
            </div>
            {flags(j)}
            {actions(j)}
          </div>
        )}
      />

      {rescheduling !== null && (
        <RescheduleDialog
          journey={rescheduling}
          onClose={() => setRescheduling(null)}
          onSaved={() => {
            setRescheduling(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {abandoning !== null && (
        <AbandonDialog
          journey={abandoning}
          onClose={() => setAbandoning(null)}
          onSaved={() => {
            setAbandoning(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function PersonCellName({ j }: { j: OnboardingJourney }) {
  return (
    <Link
      href={`/suite/hrm/people/${j.employeeId}`}
      className="block truncate text-sm font-semibold text-neutral-900 hover:text-primary-700"
    >
      {j.employee?.name ?? "Unnamed"}
    </Link>
  );
}

/**
 * Moving a starter's dates.
 *
 * Every step hangs off one anchor, so a start date that slips by a fortnight
 * turns a whole checklist red, and the only alternative was to work through
 * it step by step or to ignore the colour, which is how a checklist stops
 * being read at all.
 */
function RescheduleDialog({
  journey,
  onClose,
  onSaved,
}: {
  journey: OnboardingJourney;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [anchorDate, setAnchorDate] = useState(journey.anchorDate ?? "");
  const { submit, saving, error } = useSubmit(onSaved);

  return (
    <Dialog
      title="Move the dates"
      subtitle={`${journey.employee?.name ?? "Unnamed"} · currently starting ${formatDate(journey.anchorDate)}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () => hrm.onboarding.reschedule(journey.id, anchorDate))
        }
        className="space-y-3"
      >
        <Field
          id="ob-anchor"
          label="New start date"
          hint="Every step moves with it, keeping the same offsets. Steps already done stay done."
        >
          <input
            id="ob-anchor"
            type="date"
            aria-describedby="ob-anchor-hint"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            required
            className={INPUT}
          />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Move them"
          saving={saving}
          disabled={anchorDate === ""}
        />
      </form>
    </Dialog>
  );
}

/**
 * Stopping a checklist that will never finish.
 *
 * Somebody who never turned up, or left inside a fortnight. Without this their
 * journey sits at the top of the list forever, going redder, and the overdue
 * count at the head of the page stops meaning anything.
 */
function AbandonDialog({
  journey,
  onClose,
  onSaved,
}: {
  journey: OnboardingJourney;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const { submit, saving, error } = useSubmit(onSaved);

  return (
    <Dialog
      title="Stop this checklist"
      subtitle={journey.employee?.name ?? "Unnamed"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () => hrm.onboarding.abandon(journey.id, reason))
        }
        className="space-y-3"
      >
        <Field
          id="ob-abandon"
          label="Why"
          hint="For somebody who never started, or left before onboarding finished. Their employment record is not touched."
        >
          <RichTextEditor id="ob-abandon" minHeight={102} describedBy="ob-abandon-hint" value={reason} onChange={setReason} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Stop it"
          saving={saving}
          danger
          disabled={reason.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Checklists                                                          */
/* ------------------------------------------------------------------ */

function Programmes() {
  const confirm = useConfirm();
  const [archiving, setArchiving] = useState<string | null>(null);
  const [programmes, setProgrammes] = useState<OnboardingProgramme[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OnboardingProgramme | "new" | null>(null);

  const load = useCallback(
    () =>
      hrm.onboarding
        .programmes()
        .then((res) => {
          setProgrammes(res);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  const archive = async (id: string) => {
    const programme = programmes?.find((p) => p.id === id);
    const ok = await confirm({
      title: programme ? `Archive the ${programme.name} programme?` : "Archive this programme?",
      body: "New starters can't be put on it any more. Anyone already on it carries on, and past starters' records still name it. Archiving isn't a delete, so nothing goes to the recycle bin.",
      confirmLabel: "Archive programme",
    });
    if (!ok) return;
    setArchiving(id);

    try {
      await hrm.onboarding.archiveProgramme(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not save.");
    } finally {
      setArchiving(null);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return <LoadError message={error} />;
  }

  const steps = (p: OnboardingProgramme) => p.stepCount ?? p.steps?.length ?? 0;

  const actions = (programme: OnboardingProgramme) => (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={() => setEditing(programme)} className={buttonClass("secondary", "sm")}>
        Edit steps
      </button>
      {/*
        Archived, never deleted. A past starter's journey still names the
        programme it came from, and deleting one would leave that history
        pointing at nothing.
      */}
      {programme.isActive !== false && (
        <button
          type="button"
          disabled={archiving === programme.id}
          onClick={() => void archive(programme.id)}
          aria-label={`Archive ${programme.name}`}
          className={buttonClass("ghost", "sm")}
        >
          <Archive size={15} aria-hidden />
          Archive
        </button>
      )}
    </div>
  );

  const typeChips = (programme: OnboardingProgramme) => (
    <>
      <Chip hue={programme.isFallback ? "slate" : "sky"}>{programme.employmentTypeLabel ?? "Anybody"}</Chip>
      {programme.isDefault && <Chip hue="blue" dot>Default</Chip>}
    </>
  );

  const columns: Column<OnboardingProgramme>[] = [
    {
      key: "name",
      header: "Checklist",
      primary: true,
      sortable: true,
      value: (p) => p.name,
      render: (p) => (
        <span className="flex items-center gap-3">
          <IconTile icon={ListChecks} hue={hueFor(p.name)} size={36} />
          <span className="font-semibold text-neutral-900">{p.name}</span>
        </span>
      ),
    },
    {
      key: "for",
      header: "For",
      sortable: true,
      value: (p) => p.employmentTypeLabel ?? "Anybody",
      render: (p) => <div className="flex flex-wrap gap-1.5">{typeChips(p)}</div>,
    },
    { key: "steps", header: "Steps", sortable: true, align: "right", value: (p) => steps(p) },
    {
      key: "used",
      header: "Starters",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      value: (p) => p.journeyCount ?? 0,
    },
    { key: "actions", header: "", tableOnly: true, align: "right", render: (p) => actions(p) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">One per kind of starter. The one with no type is the fallback.</p>
        <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
          New checklist
        </Button>
      </div>

      {programmes === null ? (
        <div className="ws-card h-40 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
      ) : (
        <DataView
          rows={programmes}
          columns={columns}
          rowKey={(p) => p.id}
          storageKey="hrm.onboarding.checklists"
          caption="Onboarding checklists"
          searchPlaceholder="Search checklists"
          defaultView="grid"
          empty={
            <Empty
              icon={ClipboardList}
              hue="sky"
              title="No checklists yet"
              hint="Without one, taking somebody on creates their record but nothing to work through."
            />
          }
          renderCard={(p) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <IconTile icon={ListChecks} hue={hueFor(p.name)} size={44} />
                <div className="flex flex-wrap justify-end gap-1.5">{typeChips(p)}</div>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-neutral-900">{p.name}</p>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{p.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-sky-50 px-3 py-2 text-sky-700">
                  <p className="text-[11px] font-medium opacity-80">Steps</p>
                  <p className="text-sm font-bold tabular-nums">{steps(p)}</p>
                </div>
                <div className="rounded-xl bg-grape-50 px-3 py-2 text-grape-700">
                  <p className="text-[11px] font-medium opacity-80">Starters have used it</p>
                  <p className="text-sm font-bold tabular-nums">{p.journeyCount ?? 0}</p>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-100 pt-3">{actions(p)}</div>
            </div>
          )}
          renderListItem={(p) => (
            <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <IconTile icon={ListChecks} hue={hueFor(p.name)} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{p.name}</p>
                <p className="truncate text-xs text-neutral-500">
                  {steps(p)} steps · {p.journeyCount ?? 0} starter{p.journeyCount === 1 ? "" : "s"} have used it
                </p>
              </div>
              {typeChips(p)}
              {actions(p)}
            </div>
          )}
        />
      )}

      {editing !== null && (
        <ProgrammeEditor
          programme={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ProgrammeEditor({
  programme,
  onClose,
  onSaved,
}: {
  programme: OnboardingProgramme | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  /*
    The catalogue, for the optional course on a step. Loaded once: a
    programme editor is opened deliberately and a list of courses is small,
    so there is nothing to gain from fetching it per row.
  */
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/courses?perPage=200")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data?: { id: string; title: string }[] }) => {
        if (!cancelled) setCourses(body.data ?? []);
      })
      .catch(() => {
        /* No catalogue is a legitimate state, and the picker says "No course"
           either way, the step simply stays a manual one. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [name, setName] = useState(programme?.name ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">(
    programme?.employmentType ?? "",
  );
  const [isDefault, setIsDefault] = useState(programme?.isDefault ?? false);
  const [steps, setSteps] = useState<StepInput[]>(
    programme?.steps?.map((s) => ({
      title: s.title,
      ownerRole: s.ownerRole,
      courseId: s.courseId ?? null,
      dueOffsetDays: s.dueOffsetDays,
      isRequired: s.isRequired,
      category: s.category ?? undefined,
    })) ?? [
      { title: "Issue laptop and access", ownerRole: "it", dueOffsetDays: -3, isRequired: true },
      { title: "Sign the agreement", ownerRole: "hr", dueOffsetDays: 0, isRequired: true },
      { title: "Bank and tax details", ownerRole: "finance", dueOffsetDays: 2, isRequired: true },
    ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (index: number, change: Partial<StepInput>) =>
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...change } : step)),
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      if (programme === null) {
        await hrm.onboarding.createProgramme({
          name: name.trim(),
          employmentType: employmentType === "" ? null : employmentType,
          isDefault,
          steps,
        });
      } else {
        await hrm.onboarding.updateProgramme(programme.id, {
          name: name.trim(),
          employmentType: employmentType === "" ? null : employmentType,
          isDefault,
        });
        // Steps go in their own call: the whole list at once, so a reorder is
        // one request rather than N that can half-apply.
        await hrm.onboarding.replaceSteps(programme.id, steps);
      }

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm"
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl rounded-[1.25rem] bg-white p-5 shadow-2xl shadow-neutral-900/10 sm:p-6"
      >
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">
          {programme === null ? "New checklist" : `Edit ${programme.name}`}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Starters already part-way through keep the steps they were given;
          editing here only changes what the next person is asked to do.
        </p>

        {error !== null && (
          <Notice tone="error" role="alert" className="mt-4">
            {error}
          </Notice>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              Name
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Standard onboarding"
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              For which starters
            </span>
            <SearchableSelect
              value={employmentType}
              onChange={(v) => setEmploymentType(v as EmploymentType | "")}
              options={TYPES.map((type) => ({ value: type.value, label: type.label }))}
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="accent-primary-600"
          />
          Use this one by default
        </label>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-neutral-900">
              Steps, in order
            </p>
            <button
              type="button"
              onClick={() =>
                setSteps((current) => [
                  ...current,
                  { title: "", ownerRole: "hr", dueOffsetDays: 0, isRequired: true },
                ])
              }
              className={buttonClass("secondary", "sm")}
            >
              <Plus size={15} aria-hidden />
              Add a step
            </button>
          </div>

          <ul className="mt-2 space-y-2">
            {steps.map((step, index) => (
              <li
                key={index}
                className="grid items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]"
              >
                <input
                  type="text"
                  required
                  value={step.title}
                  onChange={(e) => patch(index, { title: e.target.value })}
                  placeholder="What has to happen"
                  className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                />

                <SearchableSelect
                  size="sm"
                  value={step.ownerRole}
                  onChange={(v) => patch(index, { ownerRole: v as StepOwner })}
                  aria-label={`Who does step ${index + 1}`}
                  className="w-full sm:w-36"
                  options={OWNERS.map((owner) => ({ value: owner.value, label: owner.label }))}
                />

                <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <span className="whitespace-nowrap">Day</span>
                  <input
                    type="number"
                    min={-365}
                    max={365}
                    value={step.dueOffsetDays ?? 0}
                    onChange={(e) =>
                      patch(index, { dueOffsetDays: Number(e.target.value) })
                    }
                    /* Negative is before day one, where the blocking steps live. */
                    className="h-9 w-16 rounded-lg border border-neutral-200 bg-white px-2 text-xs outline-none focus:border-primary-400"
                  />
                </label>

                <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={step.isRequired ?? true}
                    onChange={(e) => patch(index, { isRequired: e.target.checked })}
                    className="accent-primary-600"
                  />
                  Required
                </label>

                {/*
                  Optional, and last in the row because it is the unusual
                  case. A step that names a course is assigned when the
                  starter's checklist is created and ticks itself off when
                  they finish it, instead of somebody ticking it by hand with
                  no idea whether it was done.
                */}
                <SearchableSelect
                  size="sm"
                  value={step.courseId ?? ""}
                  onChange={(v) => patch(index, { courseId: v === "" ? null : v })}
                  aria-label={`Course for step ${index + 1}`}
                  className="w-full sm:w-44"
                  options={[
                    { value: "", label: "No course" },
                    ...courses.map((course) => ({ value: course.id, label: course.title })),
                  ]}
                />

                <button
                  type="button"
                  onClick={() =>
                    setSteps((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove step ${index + 1}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-error-500/10 hover:text-error-700"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-2 text-xs text-neutral-500">
            Day 0 is the first day. A negative number is before it: the laptop
            and the access card usually belong there.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className={buttonClass("secondary")}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className={buttonClass("primary")}
          >
            {busy ? "Saving…" : "Save checklist"}
          </button>
        </div>
      </form>
    </div>
  );
}
