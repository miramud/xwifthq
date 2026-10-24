"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Gavel,
  GraduationCap,
  Handshake,
  Pencil,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Progress,
  StatCard,
  StatGrid,
  buttonClass,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  hrm,
  type ConversionOutcome,
  type EmploymentType,
  type InternshipCohort,
  type InternshipPlacement,
} from "@/lib/api/hrm-client";
import PlacementDialog from "./PlacementDialog";
import { INPUT } from "./Dialog";
import {
  conversionTone,
  formatDate,
  placementTone,
} from "@/suite/hrm/lib/format";
import { FeaturedStat, IconTile, InitialsAvatar, PersonCell, ToneChip } from "../ui/recordKit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { Notice } from "@/suite/hrm/components/ui2/kit";

/**
 * The internship space.
 *
 * Cohorts first, because every question an HR manager asks about interns is
 * about a group: how is the summer intake doing, which mentors are carrying
 * three people, how many are we converting.
 *
 * The outcome figures are shown as counts rather than a conversion rate, on
 * purpose. "30% converted" hides whether the problem is the pipeline or the
 * offer; ten completed, eight offered, three converted and five declined says
 * it outright.
 */

const DECISIONS: { value: Exclude<ConversionOutcome, "pending">; label: string; hint: string }[] = [
  {
    value: "converted",
    label: "Converted",
    hint: "They took a role. The engagement moves and a new agreement is issued.",
  },
  { value: "offered", label: "Offer out", hint: "A role was offered; waiting on them." },
  { value: "declined", label: "Declined", hint: "Offered and turned down." },
  { value: "not_converted", label: "No offer", hint: "No role was offered." },
];

export default function InternshipsBoard() {
  const [cohorts, setCohorts] = useState<InternshipCohort[] | null>(null);
  const [due, setDue] = useState<InternshipPlacement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<InternshipPlacement | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingCohort, setEditingCohort] = useState<InternshipCohort | null>(
    null,
  );
  const [placingInto, setPlacingInto] = useState<InternshipCohort | null>(null);
  const [editingPlacement, setEditingPlacement] =
    useState<InternshipPlacement | null>(null);

  /*
    A promise chain rather than async/await.

    React 19's `react-hooks/set-state-in-effect` rejects an effect whose
    callback awaits and then sets state, the continuation is close enough to
    synchronous for the rule to treat it as a cascading render. Settling the
    state inside `.then` puts every write behind a callback the rule accepts,
    and the behaviour is identical.
  */
  const load = useCallback(
    () =>
      Promise.all([
        hrm.internships.cohorts(),
        hrm.internships.decisionsDue(30),
      ])
        .then(([list, decisions]) => {
          setCohorts(list);
          setDue(decisions.data);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const totals = (cohorts ?? []).reduce(
    (t, c) => ({
      placed: t.placed + (c.outcomes?.placed ?? 0),
      completed: t.completed + (c.outcomes?.completed ?? 0),
      offered: t.offered + (c.outcomes?.offered ?? 0),
      converted: t.converted + (c.outcomes?.converted ?? 0),
    }),
    { placed: 0, completed: 0, offered: 0, converted: 0 },
  );

  const interns = (cohorts ?? []).flatMap((c) => c.placements ?? []);

  /* ------------------------------ columns ------------------------------ */

  const dueColumns: Column<InternshipPlacement>[] = [
    {
      key: "name",
      header: "Intern",
      primary: true,
      sortable: true,
      value: (p) => p.intern?.name ?? "",
      render: (p) => (
        <PersonCell
          name={p.intern?.name ?? "Unnamed"}
          sub={`${p.cohort?.name ?? "No cohort"} · ${p.mentor?.name ? `mentored by ${p.mentor.name}` : "no mentor"}`}
          href={`/suite/hrm/people/${p.employeeId}`}
        />
      ),
    },
    {
      key: "ends",
      header: "Ends",
      sortable: true,
      value: (p) => p.endsOn ?? "",
      render: (p) => <span className="tabular-nums">{formatDate(p.endsOn)}</span>,
    },
    {
      key: "conversion",
      header: "Decision",
      render: (p) => <ToneChip tone={conversionTone(p.conversion)}>{p.conversionLabel}</ToneChip>,
    },
    {
      key: "actions",
      header: "",
      tableOnly: true,
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setEditingPlacement(p)}
            aria-label={`Edit ${p.intern?.name ?? "this placement"}`}
            className={buttonClass("ghost", "sm")}
          >
            <Pencil size={14} aria-hidden />
            Edit
          </button>
          <Button variant="primary" size="sm" icon={Gavel} onClick={() => setDeciding(p)}>
            Decide
          </Button>
        </div>
      ),
    },
  ];

  const cohortChip = (cohort: InternshipCohort) => (
    <ToneChip tone={cohort.status === "running" ? "success" : cohort.status === "open" ? "info" : "neutral"}>
      {cohort.statusLabel}
    </ToneChip>
  );

  const cohortActions = (cohort: InternshipCohort) => (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setEditingCohort(cohort)}
        aria-label={`Edit ${cohort.name}`}
        className={buttonClass("ghost", "sm")}
      >
        <Pencil size={14} aria-hidden />
        Edit
      </button>
      {/*
        Without this every cohort on the board was necessarily empty, and the
        conversion screen had nothing to decide about.
      */}
      {!cohort.isFull && (
        <button
          type="button"
          onClick={() => setPlacingInto(cohort)}
          aria-label={`Place an intern into ${cohort.name}`}
          className={buttonClass("secondary", "sm")}
        >
          <UserPlus size={14} aria-hidden />
          Place an intern
        </button>
      )}
    </div>
  );

  const capacityLine = (cohort: InternshipCohort) =>
    `${cohort.placementCount ?? 0} placed${cohort.capacity !== null ? ` of ${cohort.capacity}` : " · uncapped"}`;

  const cohortColumns: Column<InternshipCohort>[] = [
    {
      key: "name",
      header: "Cohort",
      primary: true,
      sortable: true,
      value: (c) => c.name,
      render: (c) => (
        <span className="flex items-center gap-3">
          <IconTile icon={GraduationCap} hue={hueFor(c.name)} size={36} />
          <span>
            <span className="block font-semibold text-neutral-900">{c.name}</span>
            <span className="block text-xs text-neutral-500">
              {formatDate(c.startsOn)} to {formatDate(c.endsOn)}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "placed",
      header: "Places",
      sortable: true,
      value: (c) => c.placementCount ?? 0,
      render: (c) => <span className="whitespace-nowrap">{capacityLine(c)}</span>,
    },
    {
      key: "converted",
      header: "Converted",
      align: "right",
      hideOnMobile: true,
      value: (c) => c.outcomes?.converted ?? 0,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <div className="flex flex-wrap gap-1.5">
          {cohortChip(c)}
          {c.isFull && <ToneChip tone="warning">Full</ToneChip>}
        </div>
      ),
    },
    { key: "actions", header: "", tableOnly: true, align: "right", render: (c) => cohortActions(c) },
  ];

  const internColumns: Column<InternshipPlacement>[] = [
    {
      key: "name",
      header: "Intern",
      primary: true,
      sortable: true,
      value: (p) => p.intern?.name ?? "",
      render: (p) => (
        <PersonCell
          name={p.intern?.name ?? "Unnamed"}
          sub={p.focusArea ?? p.institution ?? "-"}
          href={`/suite/hrm/people/${p.employeeId}`}
        />
      ),
    },
    {
      key: "cohort",
      header: "Cohort",
      sortable: true,
      hideOnMobile: true,
      value: (p) => (cohorts ?? []).find((c) => c.id === p.cohortId)?.name ?? "",
    },
    {
      key: "status",
      header: "Placement",
      render: (p) => <ToneChip tone={placementTone(p.status)}>{p.statusLabel}</ToneChip>,
    },
    {
      key: "conversion",
      header: "Decision",
      render: (p) => <ToneChip tone={conversionTone(p.conversion)}>{p.conversionLabel}</ToneChip>,
    },
    {
      key: "decide",
      header: "",
      tableOnly: true,
      align: "right",
      render: (p) =>
        p.awaitingDecision ? (
          <button type="button" onClick={() => setDeciding(p)} className={buttonClass("secondary", "sm")}>
            Decide
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Internships"
        subtitle="Interns arrive in cohorts, and you manage each cohort as a group."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New cohort
          </Button>
        }
      />

      {error !== null && (
        <Notice tone="error" role="alert" className="mb-4">
          {error}
        </Notice>
      )}

      <div className="space-y-6">
        {cohorts !== null && (
          <StatGrid>
            <FeaturedStat icon={GraduationCap} label="On programme" value={totals.placed} hint={`${cohorts.length} cohorts`} />
            <StatCard icon={CheckCircle2} hue="mint" label="Completed" value={totals.completed} hint="Finished their placement" />
            <StatCard icon={Handshake} hue="sky" label="Offered a role" value={totals.offered} hint="Counts, not a rate" />
            <StatCard icon={Users} hue="grape" label="Converted" value={totals.converted} hint="Now on the payroll" />
          </StatGrid>
        )}

        {/* ------------------------ decisions falling due ---------------- */}

        {due.length > 0 && (
          <section aria-labelledby="intern-due">
            <div className="mb-3 flex items-center gap-3">
              <IconTile icon={Gavel} hue="sun" size={36} />
              <div>
                <h2 id="intern-due" className="text-lg font-bold tracking-tight text-neutral-900">
                  Decisions falling due
                </h2>
                <p className="text-sm text-neutral-500">
                  Placements ending with nothing decided. A decision made after somebody has gone home is a postmortem
                </p>
              </div>
            </div>
            <DataView
              rows={due}
              columns={dueColumns}
              rowKey={(p) => p.id}
              storageKey="hrm.internships.due"
              caption="Conversion decisions falling due"
              searchable={false}
              renderCard={(p) => (
                <div className="flex h-full flex-col gap-4 p-5">
                  <PersonCell
                    name={p.intern?.name ?? "Unnamed"}
                    sub={p.cohort?.name ?? "No cohort"}
                    href={`/suite/hrm/people/${p.employeeId}`}
                    size={44}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <Chip hue="slate" icon={CalendarRange}>Ends {formatDate(p.endsOn)}</Chip>
                    <ToneChip tone={conversionTone(p.conversion)}>{p.conversionLabel}</ToneChip>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {p.mentor?.name ? `Mentored by ${p.mentor.name}` : "No mentor"}
                  </p>
                  <div className="mt-auto flex gap-1.5 border-t border-neutral-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingPlacement(p)}
                      aria-label={`Edit ${p.intern?.name ?? "this placement"}`}
                      className={buttonClass("ghost", "sm")}
                    >
                      Edit
                    </button>
                    <Button variant="primary" size="sm" onClick={() => setDeciding(p)}>
                      Decide
                    </Button>
                  </div>
                </div>
              )}
            />
          </section>
        )}

        {/* ------------------------------ cohorts ------------------------ */}

        <section aria-labelledby="intern-cohorts">
          <h2 id="intern-cohorts" className="mb-3 text-lg font-bold tracking-tight text-neutral-900">
            Cohorts
          </h2>
          {cohorts === null ? (
            <div className="ws-card h-40 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
          ) : (
            <DataView
              rows={cohorts}
              columns={cohortColumns}
              rowKey={(c) => c.id}
              storageKey="hrm.internships.cohorts"
              caption="Internship cohorts"
              searchPlaceholder="Search cohorts"
              defaultView="grid"
              empty={
                <Empty
                  icon={GraduationCap}
                  hue="grape"
                  title="No cohorts yet"
                  hint="An intern is an ordinary employee with a placement; the cohort is what lets you manage the intake as one."
                />
              }
              renderCard={(c) => (
                <div className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <IconTile icon={GraduationCap} hue={hueFor(c.name)} size={44} />
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {cohortChip(c)}
                      {c.isFull && <ToneChip tone="warning">Full</ToneChip>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-neutral-900">{c.name}</p>
                    <p className="text-sm text-neutral-500">
                      {formatDate(c.startsOn)} to {formatDate(c.endsOn)}
                    </p>
                  </div>
                  {c.capacity !== null ? (
                    <Progress
                      value={c.capacity > 0 ? ((c.placementCount ?? 0) / c.capacity) * 100 : 0}
                      hue={hueFor(c.name)}
                      label={capacityLine(c)}
                    />
                  ) : (
                    <p className="text-xs text-neutral-500">{capacityLine(c)}</p>
                  )}
                  {c.outcomes && (
                    <dl className="grid grid-cols-3 gap-2 text-center">
                      <Outcome label="On programme" value={c.outcomes.placed} tone="bg-primary-50 text-primary-700" />
                      <Outcome label="Completed" value={c.outcomes.completed} tone="bg-mint-50 text-mint-700" />
                      <Outcome label="Withdrew" value={c.outcomes.withdrawn} tone="bg-neutral-100 text-neutral-700" />
                      <Outcome label="Offered" value={c.outcomes.offered} tone="bg-sky-50 text-sky-700" />
                      <Outcome label="Converted" value={c.outcomes.converted} tone="bg-grape-50 text-grape-700" />
                      <Outcome label="Declined" value={c.outcomes.declined} tone="bg-sun-50 text-sun-700" />
                      <Outcome label="Undecided" value={c.outcomes.undecided} tone="bg-neutral-100 text-neutral-700" />
                    </dl>
                  )}
                  {(c.placements ?? []).length > 0 && (
                    <div className="flex items-center -space-x-2" aria-label={`${(c.placements ?? []).length} interns`}>
                      {(c.placements ?? []).slice(0, 6).map((p) => (
                        <span key={p.id} className="rounded-full ring-2 ring-white">
                          <InitialsAvatar name={p.intern?.name ?? "Unnamed"} size={28} />
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto border-t border-neutral-100 pt-3">{cohortActions(c)}</div>
                </div>
              )}
              renderListItem={(c) => (
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <IconTile icon={GraduationCap} hue={hueFor(c.name)} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{c.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {formatDate(c.startsOn)} to {formatDate(c.endsOn)} · {capacityLine(c)}
                    </p>
                  </div>
                  {cohortChip(c)}
                  {c.isFull && <ToneChip tone="warning">Full</ToneChip>}
                  {cohortActions(c)}
                </div>
              )}
            />
          )}
        </section>

        {/* ------------------------------ interns ------------------------ */}

        {interns.length > 0 && (
          <section aria-labelledby="intern-people">
            <h2 id="intern-people" className="mb-3 text-lg font-bold tracking-tight text-neutral-900">
              Interns
            </h2>
            <DataView
              rows={interns}
              columns={internColumns}
              rowKey={(p) => p.id}
              storageKey="hrm.internships.interns"
              caption="Interns across every cohort"
              searchPlaceholder="Search interns"
              renderCard={(p) => (
                <div className="flex h-full flex-col gap-4 p-5">
                  <PersonCell
                    name={p.intern?.name ?? "Unnamed"}
                    sub={p.focusArea ?? p.institution ?? "-"}
                    href={`/suite/hrm/people/${p.employeeId}`}
                    size={44}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <ToneChip tone={placementTone(p.status)}>{p.statusLabel}</ToneChip>
                    <ToneChip tone={conversionTone(p.conversion)}>{p.conversionLabel}</ToneChip>
                  </div>
                  {p.awaitingDecision && (
                    <div className="mt-auto border-t border-neutral-100 pt-3">
                      <button type="button" onClick={() => setDeciding(p)} className={buttonClass("secondary", "sm")}>
                        Decide
                      </button>
                    </div>
                  )}
                </div>
              )}
            />
          </section>
        )}
      </div>

      {deciding !== null && (
        <ConversionDialog
          placement={deciding}
          onClose={() => setDeciding(null)}
          onDecided={() => {
            setDeciding(null);
            void load();
          }}
        />
      )}

      {(placingInto !== null || editingPlacement !== null) && (
        <PlacementDialog
          cohort={placingInto ?? undefined}
          existing={editingPlacement ?? undefined}
          onClose={() => {
            setPlacingInto(null);
            setEditingPlacement(null);
          }}
          onSaved={() => {
            setPlacingInto(null);
            setEditingPlacement(null);
            void load();
          }}
        />
      )}

      {(creating || editingCohort !== null) && (
        <CohortDialog
          existing={editingCohort ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditingCohort(null);
          }}
          onCreated={() => {
            setCreating(false);
            setEditingCohort(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Outcome({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl px-2 py-1.5 ${tone}`}>
      <dt className="truncate text-[11px] font-medium opacity-80">{label}</dt>
      <dd className="text-sm font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function ConversionDialog({
  placement,
  onClose,
  onDecided,
}: {
  placement: InternshipPlacement;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [conversion, setConversion] =
    useState<Exclude<ConversionOutcome, "pending">>("converted");
  const [employmentType, setEmploymentType] =
    useState<Exclude<EmploymentType, "intern">>("permanent");
  const [jobTitle, setJobTitle] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsEnd = employmentType === "contract" || employmentType === "casual";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.internships.decideConversion(placement.id, {
        conversion,
        conversionNote: note.trim() === "" ? undefined : note.trim(),
        ...(conversion === "converted"
          ? {
              employmentType,
              jobTitle: jobTitle.trim() === "" ? undefined : jobTitle.trim(),
              endsOn: employmentType === "contract" && endsOn !== "" ? endsOn : undefined,
            }
          : {}),
      });

      onDecided();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog onClose={onClose} onSubmit={submit}>
      <h2 className="text-lg font-bold tracking-tight text-neutral-900">
        {placement.intern?.name ?? "This intern"}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {placement.cohort?.name ?? "No cohort"} · placement ends{" "}
        {formatDate(placement.endsOn)}
      </p>

      {error !== null && (
        <Notice tone="error" role="alert" className="mt-4">
          {error}
        </Notice>
      )}

      <fieldset className="mt-5 space-y-2">
        <legend className="mb-1.5 text-xs font-semibold text-neutral-700">
          What happened
        </legend>
        {DECISIONS.map((decision) => (
          <label
            key={decision.value}
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
              conversion === decision.value
                ? "border-primary-400 bg-primary-50 ring-4 ring-primary-100"
                : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <input
              type="radio"
              name="conversion"
              value={decision.value}
              checked={conversion === decision.value}
              onChange={() => setConversion(decision.value)}
              className="mt-0.5 accent-primary-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-neutral-900">
                {decision.label}
              </span>
              <span className="block text-xs text-neutral-500">
                {decision.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {conversion === "converted" && (
        <div className="mt-4 space-y-4 rounded-2xl bg-mint-50/60 p-4">
          <p className="text-xs text-mint-700">
            Their internship counts as service. The start date stays as it is,
            so six months here is six months of service.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Now engaged as
              </span>
              <SearchableSelect
                value={employmentType}
                onChange={(v) =>
                  setEmploymentType(v as Exclude<EmploymentType, "intern">)
                }
                options={[
                  { value: "permanent", label: "Permanent" },
                  { value: "contract", label: "Contract" },
                  { value: "casual", label: "Casual" },
                ]}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Job title
              </span>
              <JobTitlePicker
                mode="name"
                value={jobTitle}
                onChange={(name) => setJobTitle(name)}
                clearable
              />
            </label>
          </div>

          {needsEnd && employmentType === "contract" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Term ends
              </span>
              <input
                type="date"
                required
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
                className={INPUT}
              />
            </label>
          )}
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
          Note
        </span>
        <RichTextEditor minHeight={76} value={note} onChange={setNote} />
      </label>

      <DialogActions busy={busy} onClose={onClose} label="Record the decision" />
    </Dialog>
  );
}

function CohortDialog({
  existing,
  onClose,
  onCreated,
}: {
  /** Present when changing a cohort rather than opening one. */
  existing?: InternshipCohort;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(existing?.endsOn ?? "");
  const [capacity, setCapacity] = useState(
    existing?.capacity != null ? String(existing.capacity) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const payload = {
        name: name.trim(),
        startsOn,
        endsOn,
        capacity: capacity === "" ? undefined : Number(capacity),
      };

      /*
        Dates move, and a cohort's capacity is usually settled after the
        budget is. Without editing, the only options were a duplicate cohort
        or a set of dates everybody knows to ignore.
      */
      if (existing !== undefined) {
        await hrm.internships.updateCohort(existing.id, payload);
      } else {
        await hrm.internships.createCohort({
          ...payload,
          // Open, not planned: a cohort created from this screen is one
          // somebody is about to place interns into.
          status: "open",
        });
      }

      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog onClose={onClose} onSubmit={submit}>
      <h2 className="text-lg font-bold tracking-tight text-neutral-900">
        {existing !== undefined ? "Edit cohort" : "New cohort"}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {existing !== undefined
          ? "Move its dates or change how many places it has. Interns already placed stay placed."
          : "An intake of interns, managed as one group."}
      </p>

      {error !== null && (
        <Notice tone="error" role="alert" className="mt-4">
          {error}
        </Notice>
      )}

      <label className="mt-5 block">
        <span className="mb-1.5 block text-xs font-semibold text-neutral-700">Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Summer intake"
          className={INPUT}
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Starts
          </span>
          <input
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">Ends</span>
          <input
            type="date"
            required
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className={INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            Places
          </span>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Uncapped"
            className={INPUT}
          />
        </label>
      </div>

      <DialogActions
        busy={busy}
        onClose={onClose}
        label={existing !== undefined ? "Save changes" : "Create cohort"}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function Dialog({
  children,
  onClose,
  onSubmit,
}: {
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm"
      />
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-[1.25rem] bg-white p-5 shadow-2xl shadow-neutral-900/10 sm:p-6"
      >
        {children}
      </form>
    </div>
  );
}

function DialogActions({
  busy,
  onClose,
  label,
}: {
  busy: boolean;
  onClose: () => void;
  label: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-4">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}
