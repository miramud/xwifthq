"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Grid2x2,
  Mail,
  Phone,
  Plus,
  ShieldAlert,
  Star,
  StickyNote,
  Trash2,
  Users,
} from "lucide-react";
import { Button, Chip, Empty, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  companies as companiesApi,
  stakeholders as stakeholdersApi,
  type EngagementStrategy,
  type ExternalPerson,
  type Project,
  type ProjectStakeholder,
  type StakeholderMapMeta,
  type StakeholderRole,
  type StakeholderWeight,
} from "@/lib/api/projects-client";
import {
  NameAvatar,
  Notice,
  Skeleton,
  inputCls,
} from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

const ROLES: { value: StakeholderRole; label: string }[] = [
  { value: "sponsor", label: "Sponsor" },
  { value: "decision_maker", label: "Decision maker" },
  { value: "contact", label: "Main contact" },
  { value: "reviewer", label: "Reviewer" },
  { value: "end_user", label: "End user" },
  { value: "observer", label: "Observer" },
];

const WEIGHTS: { value: StakeholderWeight; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

/**
 * The four quadrants, in reading order.
 *
 * Labels come from the API on each row, but the grid has to render a quadrant
 * with nobody in it, an empty "manage closely" box is the most important
 * thing on this screen, because it means nobody has been identified as able to
 * stop the project.
 */
const QUADRANTS: { key: EngagementStrategy; label: string; axes: string }[] = [
  { key: "manage_closely", label: "Manage closely", axes: "High influence · high interest" },
  { key: "keep_satisfied", label: "Keep satisfied", axes: "High influence · low interest" },
  { key: "keep_informed", label: "Keep informed", axes: "Low influence · high interest" },
  { key: "monitor", label: "Monitor", axes: "Low influence · low interest" },
];


/** Each quadrant's colour, from what it asks of you rather than where it sits. */
const QUADRANT_HUE: Record<EngagementStrategy, Hue> = {
  manage_closely: "rose",
  keep_satisfied: "sun",
  keep_informed: "sky",
  monitor: "slate",
};

/** Each quadrant's wash, in its own hue. */
const QUADRANT_BG: Record<EngagementStrategy, string> = {
  manage_closely: "bg-rose-50/70",
  keep_satisfied: "bg-sun-50/80",
  keep_informed: "bg-sky-50/80",
  monitor: "bg-neutral-100/70",
};

/** The grid laid out as Mendelow draws it: influence rising, interest across. */
const GRID_ORDER: EngagementStrategy[] = ["keep_satisfied", "manage_closely", "monitor", "keep_informed"];

/**
 * Who, on the other side, matters on this project, and how much.
 *
 * **Not a contact list.** The roster of people at a client lives once, on the
 * company; what this screen records is the judgement that only makes sense per
 * project: how much influence somebody has *here*, and how much they care. A
 * finance director who signs off one engagement and never hears about another
 * is not the same stakeholder twice.
 *
 * The pair of axes is the Mendelow grid, and the strategy it implies is
 * derived on every read rather than stored, so it can never disagree with the
 * two facts it came from.
 *
 * The number worth acting on is `unmanagedRisks`: somebody who can hold
 * delivery up by not answering, who is not being managed closely. That is a
 * sign-off nobody has arranged yet, and it is stated in words at the top
 * rather than left for a reader to infer from four boxes.
 */
export default function StakeholderMap({
  project,
  onChanged,
}: {
  project: Project;
  onChanged?: () => void;
}) {
  const confirm = useConfirm();
  const [map, setMap] = useState<ProjectStakeholder[] | null>(null);
  const [meta, setMeta] = useState<StakeholderMapMeta | null>(null);
  const [roster, setRoster] = useState<ExternalPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [adding, setAdding] = useState(false);
  /** Whose note is being written. */
  const [noting, setNoting] = useState<string | null>(null);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  const companySlug = project.externalCompany?.slug ?? null;

  useEffect(() => {
    /*
      An internal project has nobody on the other side, so there is nothing to
      ask for. Guarded inside the effect and not only in the render body: a
      return further down runs *after* this has already fired, which is how the
      first version sent a request whose only possible answer was an empty map
      - on every visit to an internal project's tab.
    */
    if (companySlug === null) {
      setMap([]);
      setMeta(null);

      return;
    }

    let cancelled = false;

    /*
      The map, and the company's roster to choose from. Fetched together
      because the "add somebody" control is useless without the second.
    */
    Promise.all([
      stakeholdersApi.list(project.slug),
      companiesApi.get(companySlug),
    ])
      .then(([res, company]) => {
        if (cancelled) return;

        setMap(res.data);
        setMeta(res.meta);
        /* Somebody who left is kept on past placements and never offered anew. */
        setRoster((company.stakeholders ?? []).filter((p) => p.isActive));
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setMap([]);
      });

    return () => {
      cancelled = true;
    };
  }, [project.slug, companySlug, reloads]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);

    try {
      await action();
      reload();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  /* An internal project has nobody on the other side, and says so. */
  if (project.externalCompany == null) {
    return (
      <Panel title="Stakeholders" icon={Users} hue="grape" bodyClassName="p-0">
        <Empty
          icon={Building2}
          hue="slate"
          title="No external company on this project"
          hint={
            project.can.update
              ? "Stakeholders are the people at the company this is being delivered for. Set one in Settings, then map the people you deal with."
              : "Stakeholders are the people at the company this is being delivered for. A project manager can set one in Settings."
          }
        />
      </Panel>
    );
  }

  if (map === null || meta === null) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-72" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const canManage = meta.canManage;
  /** Already on the map, so the picker does not offer them twice. */
  const placed = new Set(map.map((s) => s.person.id));
  const available = roster.filter((p) => !placed.has(p.id));
  const companyName = project.externalCompany.name;

  /* ------------------------------------------------------------------ */
  /*  One stakeholder, drawn three ways                                  */
  /*                                                                     */
  /*  Plain functions rather than components: they close over `busy` and */
  /*  `noting`, and a component declared in here would remount, and     */
  /*  lose a half-typed note, on every render.                          */
  /* ------------------------------------------------------------------ */

  const who = (entry: ProjectStakeholder) => (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={cx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          HUE[QUADRANT_HUE[entry.strategy] ?? "slate"].soft,
        )}
        aria-hidden
      >
        {entry.person.initials}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <span className="truncate">{entry.person.name}</span>
          {entry.isPrimary && (
            <Star
              size={14}
              className="shrink-0 fill-sun-500 text-sun-500"
              aria-label="Main contact"
            />
          )}
        </p>
        <p className="truncate text-xs text-neutral-500">
          {entry.person.jobTitle ?? entry.roleDescription}
        </p>

        {(hasText(entry.person.email) || hasText(entry.person.phone)) && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {hasText(entry.person.email) && (
              <a
                href={`mailto:${entry.person.email}`}
                className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
              >
                <Mail size={12} aria-hidden />
                {entry.person.email}
              </a>
            )}
            {hasText(entry.person.phone) && (
              <a
                href={`tel:${entry.person.phone}`}
                className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:underline"
              >
                <Phone size={12} aria-hidden />
                {entry.person.phone}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const standing = (entry: ProjectStakeholder) => (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip hue={entry.canBlockDelivery ? "grape" : "slate"} className="!px-2 !py-0.5 text-[11px]">
          {entry.roleLabel}
        </Chip>
        <Chip
          hue={entry.isUnmanagedRisk ? "coral" : (QUADRANT_HUE[entry.strategy] ?? "slate")}
          icon={entry.isUnmanagedRisk ? ShieldAlert : undefined}
          className="!px-2 !py-0.5 text-[11px]"
        >
          {entry.strategyLabel}
        </Chip>
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-500">
        Influence {entry.influenceLabel.toLowerCase()} · interest{" "}
        {entry.interestLabel.toLowerCase()}
      </p>
    </div>
  );

  const reasoning = (entry: ProjectStakeholder) => (
    <div className="min-w-0 max-w-[22rem]">
      {/* "Keep satisfied" means nothing to somebody who was not on the course. */}
      <p className="text-xs leading-relaxed text-neutral-600">{entry.guidance}</p>

      {/*
        Why this person is high influence, in the words of whoever decided
        it. Accepted by the API from the first commit and shown nowhere - so
        the judgement the whole grid rests on had no room for its reasoning.
      */}
      {hasText(entry.notes) && (
        <RichTextView value={entry.notes} size="sm" className="mt-1.5 border-l-2 border-grape-100 pl-2 text-xs text-neutral-600" />
      )}
    </div>
  );

  const controls = (entry: ProjectStakeholder) =>
    canManage ? (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <SearchableSelect
            value={entry.role}
            onChange={(value) =>
              void run(`role-${entry.id}`, () =>
                stakeholdersApi.update(project.slug, entry.id, {
                  role: value,
                }),
              )
            }
            disabled={busy !== null}
            aria-label={`Role for ${entry.person.name}`}
            size="sm"
            className="w-44"
            options={ROLES.map((r) => ({ value: r.value, label: `${r.label}` }))}
          />

          <SearchableSelect
            value={entry.influence}
            onChange={(value) =>
              void run(`influence-${entry.id}`, () =>
                stakeholdersApi.update(project.slug, entry.id, {
                  influence: value,
                }),
              )
            }
            disabled={busy !== null}
            aria-label={`Influence of ${entry.person.name}`}
            size="sm"
            className="w-44"
            options={WEIGHTS.map((r) => ({ value: r.value, label: `Influence: ${r.label}` }))}
          />

          <SearchableSelect
            value={entry.interest}
            onChange={(value) =>
              void run(`interest-${entry.id}`, () =>
                stakeholdersApi.update(project.slug, entry.id, {
                  interest: value,
                }),
              )
            }
            disabled={busy !== null}
            aria-label={`Interest of ${entry.person.name}`}
            size="sm"
            className="w-44"
            options={WEIGHTS.map((r) => ({ value: r.value, label: `Interest: ${r.label}` }))}
          />

          <span className="flex items-center">
            <button
              type="button"
              onClick={() => setNoting(noting === entry.id ? null : entry.id)}
              aria-label={`Note on ${entry.person.name}`}
              aria-expanded={noting === entry.id}
              title="Why they sit where they do"
              className={ICON_BUTTON}
            >
              <StickyNote size={16} aria-hidden />
            </button>

            {/*
              Set, never cleared. A project with nobody to ring is worse than
              the state being left, so the primary is moved by naming the new
              one.
            */}
            {!entry.isPrimary && (
              <button
                type="button"
                onClick={() =>
                  void run(`primary-${entry.id}`, () =>
                    stakeholdersApi.update(project.slug, entry.id, {
                      isPrimary: true,
                    }),
                  )
                }
                disabled={busy !== null}
                aria-label={`Make ${entry.person.name} the main contact`}
                title="Make them the person to ring"
                className={cx(ICON_BUTTON, "hover:!bg-sun-50 hover:!text-sun-700")}
              >
                <Star size={16} aria-hidden />
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: `Take ${entry.person.name} off this map?`,
                  body: `${entry.person.name} stays on their company's contact list; they just stop being a stakeholder on ${project.name}. This doesn't go to the recycle bin, so add them to the map again to put them back.`,
                  confirmLabel: "Take off map",
                });
                if (ok) await run(`remove-${entry.id}`, () => stakeholdersApi.remove(project.slug, entry.id));
              }}
              disabled={busy !== null}
              aria-label={`Take ${entry.person.name} off this map`}
              className={cx(ICON_BUTTON, "hover:!bg-error-50 hover:!text-error-700")}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </span>
        </div>

        {noting === entry.id && (
          <NoteForm
            value={entry.notes ?? ""}
            busy={busy === `note-${entry.id}`}
            onCancel={() => setNoting(null)}
            onSubmit={async (notes) => {
              await run(`note-${entry.id}`, () =>
                stakeholdersApi.update(project.slug, entry.id, { notes }),
              );
              setNoting(null);
            }}
          />
        )}
      </div>
    ) : null;

  const columns: Column<ProjectStakeholder>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      value: (s) => s.person.name,
      sortable: true,
      render: who,
    },
    {
      key: "standing",
      header: "Role and strategy",
      value: (s) => s.strategyLabel,
      sortable: true,
      render: standing,
    },
    {
      key: "guidance",
      header: "How to engage",
      value: (s) => s.guidance,
      hideOnMobile: true,
      render: reasoning,
    },
    ...(canManage
      ? [
          {
            key: "manage",
            header: "Placement",
            render: (s: ProjectStakeholder) => controls(s),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {error !== null && <Notice tone="error">{error}</Notice>}

      {/* The one sentence worth reading before a sign-off date. */}
      {map.length > 0 && meta.unmanagedRisks > 0 && (
        <Notice tone="warn">
          {meta.unmanagedRisks === 1
            ? "One person can hold this up and is not being managed closely."
            : `${meta.unmanagedRisks} people can hold this up and are not being managed closely.`}{" "}
          A sign-off nobody has arranged yet.
        </Notice>
      )}

      {map.length > 0 && !meta.hasPrimary && (
        <Notice tone="info">
          Nobody is marked as the person to ring. Star whoever you deal with day
          to day.
        </Notice>
      )}

      {/* ---------------------------- the grid --------------------------- */}

      {map.length > 0 && (
        <Panel
          title="Influence and interest"
          subtitle="Where everybody sits, and what that means for how you engage them."
          icon={Grid2x2}
          hue="grape"
        >
          <div className="relative sm:pb-6 sm:pl-7">
            {/* The axes, as Mendelow draws them: influence up, interest across. */}
            <span
              aria-hidden
              className="absolute bottom-6 left-0 top-0 hidden items-center sm:flex"
            >
              <span className="-rotate-90 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Influence →
              </span>
            </span>
            <span
              aria-hidden
              className="absolute bottom-0 left-7 right-0 hidden justify-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500 sm:flex"
            >
              Interest →
            </span>

            <div className="grid gap-3 sm:grid-cols-2">
              {GRID_ORDER.map((key) => {
                const quadrant = QUADRANTS.find((q) => q.key === key)!;
                const people = map.filter((s) => s.strategy === quadrant.key);
                const count = meta.grid[quadrant.key] ?? 0;
                const hue = QUADRANT_HUE[quadrant.key];
                const isKey = quadrant.key === "manage_closely";

                return (
                  <div
                    key={quadrant.key}
                    className={cx(
                      "flex min-h-[9.5rem] flex-col rounded-[1.25rem] p-4",
                      QUADRANT_BG[quadrant.key],
                      isKey && "order-first ring-2 ring-rose-200 sm:order-none",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cx("flex items-center gap-2 text-sm font-bold", HUE[hue].text)}>
                          <span className={cx("h-2.5 w-2.5 rounded-full", HUE[hue].dot)} aria-hidden />
                          {quadrant.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">{quadrant.axes}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-neutral-800 shadow-sm">
                        {count}
                      </span>
                    </div>

                    {people.length === 0 ? (
                      <p className="mt-3 text-xs text-neutral-500">
                        {/*
                          An empty "manage closely" box is the most important
                          thing on this screen: nobody has been identified as
                          able to stop the project.
                        */}
                        {isKey
                          ? "Nobody here. On a client project that usually means the sponsor has not been identified."
                          : "Nobody here."}
                      </p>
                    ) : (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {people.map((s) => (
                          <li
                            key={s.id}
                            className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5 text-xs text-neutral-700 shadow-sm ring-1 ring-neutral-200/70"
                          >
                            <NameAvatar name={s.person.name} size={22} />
                            <span className="truncate font-medium">{s.person.name}</span>
                            <span className="shrink-0 text-neutral-500">· {s.roleLabel}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      )}

      {/* ---------------------------- the people ------------------------- */}

      <section aria-labelledby="stakeholder-map-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 id="stakeholder-map-title" className="text-base font-bold tracking-tight text-neutral-900">
              Stakeholder map
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              The people at {companyName} who matter on this project.
            </p>
          </div>
          {canManage && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setAdding((v) => !v)}
              disabled={available.length === 0 && !adding}
              aria-expanded={adding}
            >
              Add a stakeholder
            </Button>
          )}
        </div>

        {adding && (
          <PlaceForm
            available={available}
            companySlug={project.externalCompany.slug}
            busy={busy === "place"}
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              await run("place", () => stakeholdersApi.place(project.slug, input));
              setAdding(false);
            }}
          />
        )}

        <DataView
          rows={map}
          columns={columns}
          rowKey={(s) => s.id}
          storageKey="projects.stakeholders"
          caption={`Stakeholders at ${companyName}`}
          searchPlaceholder="Search people"
          gridCols={2}
          empty={
            <Empty
              icon={Users}
              hue="grape"
              title="Nobody mapped yet"
              hint={
                canManage
                  ? "Record who signs off, who to ring and how much each person cares. It is the difference between a delay you saw coming and one you did not."
                  : "A project or product manager records who signs off and who to ring."
              }
              action={
                canManage &&
                available.length === 0 && (
                  <Link
                    href="/suite/projects/companies"
                    className={buttonClass("secondary", "sm")}
                  >
                    Add people at {companyName} first
                  </Link>
                )
              }
            />
          }
          renderCard={(entry) => (
            <div
              className={cx(
                "flex h-full flex-col gap-3 p-5",
                entry.isUnmanagedRisk && "bg-coral-50/30",
              )}
            >
              {who(entry)}
              {standing(entry)}
              {reasoning(entry)}
              {canManage && (
                <div className="mt-auto border-t border-neutral-100 pt-3">{controls(entry)}</div>
              )}
            </div>
          )}
          renderListItem={(entry) => (
            <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start">
              <div className="min-w-0 lg:w-64">{who(entry)}</div>
              <div className="min-w-0 flex-1 space-y-2">
                {standing(entry)}
                {reasoning(entry)}
              </div>
              {canManage && <div className="lg:max-w-sm">{controls(entry)}</div>}
            </div>
          )}
        />
      </section>
    </div>
  );
}

const ICON_BUTTON =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50";

function hasText(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value !== "";
}

/* ------------------------------------------------------------------ */


function PlaceForm({
  available,
  companySlug,
  busy,
  onCancel,
  onSubmit,
}: {
  available: ExternalPerson[];
  companySlug: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    externalStakeholderId: string;
    role: StakeholderRole;
    influence: StakeholderWeight;
    interest: StakeholderWeight;
    notes?: string;
  }) => Promise<void>;
}) {
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState<StakeholderRole>("contact");
  const [influence, setInfluence] = useState<StakeholderWeight>("medium");
  const [interest, setInterest] = useState<StakeholderWeight>("medium");
  const [notes, setNotes] = useState("");

  if (available.length === 0) {
    return (
      <div className="mb-4 rounded-[1.25rem] border border-neutral-200 bg-neutral-50/60 px-4 py-3 text-sm text-neutral-600">
        Everybody recorded at this company is already on the map.{" "}
        <Link
          href="/suite/projects/companies"
          className="font-medium text-primary-700 hover:underline"
        >
          Add somebody to {companySlug}
        </Link>{" "}
        first.
      </div>
    );
  }

  return (
    <div className="mb-4 grid gap-4 rounded-[1.25rem] border border-primary-100 bg-primary-50/40 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="text-[13px] font-semibold text-neutral-700">
        <label htmlFor="sh-person">Person</label>
        <SearchableSelect
          id="sh-person"
          value={personId}
          onChange={(value) => setPersonId(value)}
          className="mt-1.5"
          placeholder="Choose somebody"
          searchPlaceholder="Search people"
          options={available.map((p) => ({ value: p.id, label: p.name, hint: p.jobTitle ?? undefined }))}
        />
      </div>

      <div className="text-[13px] font-semibold text-neutral-700">
        <label htmlFor="sh-role">What they are</label>
        <SearchableSelect
          id="sh-role"
          value={role}
          onChange={(value) => setRole(value as StakeholderRole)}
          className="mt-1.5"
          options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
        />
      </div>

      <div className="text-[13px] font-semibold text-neutral-700">
        <label htmlFor="sh-influence">Influence here</label>
        <SearchableSelect
          id="sh-influence"
          value={influence}
          onChange={(value) => setInfluence(value as StakeholderWeight)}
          className="mt-1.5"
          options={WEIGHTS.map((w) => ({ value: w.value, label: w.label }))}
        />
      </div>

      <div className="text-[13px] font-semibold text-neutral-700">
        <label htmlFor="sh-interest">How much they care</label>
        <SearchableSelect
          id="sh-interest"
          value={interest}
          onChange={(value) => setInterest(value as StakeholderWeight)}
          className="mt-1.5"
          options={WEIGHTS.map((w) => ({ value: w.value, label: w.label }))}
        />
      </div>

      <label className="text-[13px] font-semibold text-neutral-700 sm:col-span-2 lg:col-span-4">
        Why (optional)
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Signs off the budget, but delegates everything else"
          className={cx(inputCls, "mt-1.5")}
        />
      </label>

      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="button"
          onClick={() =>
            void onSubmit({
              externalStakeholderId: personId,
              role,
              influence,
              interest,
              notes: notes.trim() === "" ? undefined : notes.trim(),
            })
          }
          disabled={busy || personId === ""}
          className={buttonClass("primary")}
        >
          {busy ? "Adding…" : "Add to map"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * The reasoning behind a placement.
 *
 * Sent as `null` when cleared rather than omitted, because the API tells those
 * two apart: a present null means "delete what was there" and an absent key
 * means "I sent nothing". Omitting it would save successfully and keep the old
 * note, which is the shape of bug where the form says it worked.
 */
function NoteForm({
  value,
  busy,
  onCancel,
  onSubmit,
}: {
  value: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (notes: string | null) => Promise<void>;
}) {
  const [notes, setNotes] = useState(value);

  return (
    <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3">
      <p className="text-xs font-semibold text-neutral-700">Why they sit where they do</p>
      <RichTextEditor
        value={notes}
        onChange={setNotes}
        minHeight={64}
        label="Stakeholder note"
        placeholder="Signs off the budget, but delegates everything else"
        className="mt-1.5"
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => void onSubmit(notes.trim() === "" ? null : notes.trim())}
          disabled={busy}
          className={buttonClass("primary", "sm")}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass("secondary", "sm")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
