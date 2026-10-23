"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  BadgeCheck,
  CalendarRange,
  CircleCheck,
  FileSignature,
  Flag,
  History,
  Lightbulb,
  Lock,
  Pencil,
  Radio,
  Target,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  charter as charterApi,
  type Charter,
  type CharterNarrative,
  type Project,
} from "@/lib/api/projects-client";
import {
  IconTile,
  NameAvatar,
  Notice,
  Skeleton,
  inputCls,
  labelCls,
  hintCls,
} from "./ui/pkit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * Why this project exists, and who agreed to it.
 *
 * **Half of this page is not stored anywhere.** The stakeholders, team,
 * milestones and schedule are read live on every open, so a stakeholder who
 * leaves disappears from the charter. That is the point: a charter that copied
 * them would hold a version wrong three weeks later and authoritative-looking
 * forever, which is the exact failure a charter is supposed to prevent. The
 * page says which parts are live rather than leaving a reader to assume the
 * whole thing was typed at kick-off.
 *
 * **Editing after sign-off clears it, and the screen warns before and reports
 * after.** An approval is of a text — somebody read these words and put their
 * name to them — so a charter that kept its sign-off through a rewrite would
 * be worse than one never signed, because somebody downstream is relying on it.
 */
const SECTIONS: { key: keyof CharterNarrative; label: string; hint: string; icon: LucideIcon; hue: Hue }[] = [
  {
    key: "purpose",
    label: "Purpose",
    hint: "Why this is being done at all. The question a status report never answers.",
    icon: Target,
    hue: "blue",
  },
  {
    key: "background",
    label: "Background",
    hint: "What was happening beforehand that made it necessary.",
    icon: History,
    hue: "slate",
  },
  {
    key: "scopeIn",
    label: "In scope",
    hint: "What this project will deliver.",
    icon: CircleCheck,
    hue: "mint",
  },
  {
    key: "scopeOut",
    label: "Out of scope",
    hint: "What it will not. The half nobody writes, and the half every argument is about.",
    icon: Ban,
    hue: "coral",
  },
  {
    key: "successCriteria",
    label: "Success criteria",
    hint: "How anybody will know it worked. Not a list of deliverables.",
    icon: Trophy,
    hue: "sun",
  },
  {
    key: "assumptions",
    label: "Assumptions",
    hint: "What has to hold true. These become the risks when they stop holding.",
    icon: Lightbulb,
    hue: "grape",
  },
  {
    key: "constraints",
    label: "Constraints",
    hint: "Budget, deadlines, technology, anything fixed from outside.",
    icon: Lock,
    hue: "sky",
  },
];

export default function ProjectCharterPanel({ project }: { project: Project }) {
  const [data, setData] = useState<Charter | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CharterNarrative | null>(null);
  const [busy, setBusy] = useState(false);
  /** Said out loud the moment it happens, not discovered later. */
  const [cleared, setCleared] = useState(false);

  const [approving, setApproving] = useState(false);
  const [approvedAs, setApprovedAs] = useState("");

  useEffect(() => {
    let live = true;

    charterApi
      .forProject(project.slug)
      .then((response) => {
        if (!live) return;

        setData(response.data);
        setCanEdit(response.meta.canEdit);
        setIsStarted(response.meta.isStarted);
        setError(null);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!live) return;

        setError(e instanceof ApiError ? e.message : "Could not load the charter.");
        setLoaded(true);
      });

    return () => {
      live = false;
    };
  /*
   * Only the slug. Every write here returns the whole assembled charter, so
   * the response is the refresh — a reload key would be a second request for
   * data already in hand.
   */
  }, [project.slug]);

  function startEditing() {
    if (data === null) return;

    setDraft({ ...data.narrative });
    setCleared(false);
    setEditing(true);
  }

  async function save() {
    if (draft === null || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await charterApi.save(project.slug, draft);

      setData(response.data);
      setCleared(response.meta.approvalCleared);
      setIsStarted(true);
      setEditing(false);
      setDraft(null);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (approvedAs.trim() === "") return;

    try {
      const next = await charterApi.approve(project.slug, approvedAs.trim());

      setData(next);
      setApproving(false);
      setApprovedAs("");
      setCleared(false);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That could not be approved.");
    }
  }

  async function unapprove() {
    try {
      setData(await charterApi.unapprove(project.slug));
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That could not be withdrawn.");
    }
  }

  if (!loaded) {
    return (
      <div className="grid gap-5 lg:grid-cols-3" aria-busy="true" aria-label="Loading the charter">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (data === null) {
    return (
      <Panel title="Charter" icon={FileSignature} hue="blue">
        <Notice tone="error">{error ?? "Could not load the charter."}</Notice>
      </Panel>
    );
  }

  const written = SECTIONS.filter((s) => (data.narrative[s.key] ?? "") !== "");

  return (
    <div className="space-y-5">
      {error !== null && <Notice tone="error">{error}</Notice>}

      {/* Reported at the moment it happens. */}
      {cleared && (
        <div role="alert">
          <Notice tone="warn">
            The charter changed, so its approval has been cleared. Whoever signed
            it off agreed to the previous wording and will need to approve this
            one.
          </Notice>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Charter"
          subtitle={data.project.company ?? undefined}
          icon={FileSignature}
          hue="blue"
          actions={
            canEdit && !editing ? (
              <Button size="sm" icon={Pencil} onClick={startEditing}>
                {isStarted ? "Edit" : "Write it"}
              </Button>
            ) : undefined
          }
        >
          {/* ---------------- approval ---------------- */}
          {data.approval.isApproved ? (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-mint-100 bg-mint-50 px-4 py-3">
              <IconTile icon={BadgeCheck} hue="mint" size={34} />
              <span className="min-w-0 flex-1 text-sm text-neutral-800">
                Approved by <strong className="font-semibold">{data.approval.as}</strong>
                {data.approval.by !== null && (
                  <span className="text-neutral-600"> · recorded by {data.approval.by}</span>
                )}
                {data.approval.at !== null && (
                  <span className="text-neutral-600"> on {data.approval.at}</span>
                )}
              </span>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => void unapprove()}>
                  Withdraw
                </Button>
              )}
            </div>
          ) : (
            isStarted &&
            canEdit && (
              <div className="mb-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 p-4">
                {approving ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-56 flex-1">
                      <label htmlFor="charter-approved-as" className={labelCls}>
                        Who approved it, in their words
                      </label>
                      <input
                        id="charter-approved-as"
                        value={approvedAs}
                        onChange={(e) => setApprovedAs(e.target.value)}
                        placeholder="Finance Director, Acme"
                        aria-describedby="charter-approved-hint"
                        className={inputCls}
                      />
                      {/* Stored as typed — see the controller for why. */}
                      <p id="charter-approved-hint" className={hintCls}>
                        Recorded exactly as written, so it still reads correctly
                        after they change job.
                      </p>
                    </div>
                    <div className="mb-6 flex gap-2">
                      <Button
                        variant="primary"
                        disabled={approvedAs.trim() === ""}
                        onClick={() => void approve()}
                      >
                        Record it
                      </Button>
                      <Button onClick={() => setApproving(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="min-w-0 flex-1 text-sm text-neutral-600">
                      Not signed off yet.
                    </p>
                    <Button size="sm" icon={FileSignature} onClick={() => setApproving(true)}>
                      Record an approval
                    </Button>
                  </div>
                )}
              </div>
            )
          )}

          {/* ---------------- the narrative ---------------- */}
          {editing && draft !== null ? (
            <div className="space-y-4">
              {data.approval.isApproved && (
                <Notice tone="warn">
                  This charter is approved. Changing any of the wording below will
                  clear that approval.
                </Notice>
              )}

              {SECTIONS.map((section) => (
                <div key={section.key}>
                  <label htmlFor={`charter-${section.key}`} className={labelCls}>
                    {section.label}
                  </label>
                  <RichTextEditor
                    id={`charter-${section.key}`}
                    value={draft[section.key] ?? ""}
                    onChange={(html) => setDraft((d) => (d === null ? d : { ...d, [section.key]: html }))}
                    placeholder={section.hint}
                  />
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <Button variant="primary" disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : !isStarted ? (
            <Empty
              icon={FileSignature}
              title="No charter yet"
              hint="Why the project exists, what it covers and (the useful half) what it does not."
            />
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              {written.map((section) => (
                <div
                  key={section.key}
                  className={cx(
                    "rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4",
                    /* Purpose reads first and widest: it is the one sentence everyone needs. */
                    section.key === "purpose" && "sm:col-span-2",
                  )}
                >
                  <dt className="flex items-center gap-2">
                    <IconTile icon={section.icon} hue={section.hue} size={28} />
                    <span className={cx("text-xs font-semibold uppercase tracking-wide", HUE[section.hue].text)}>
                      {section.label}
                    </span>
                  </dt>
                  <dd className="mt-2.5">
                    <RichTextView value={data.narrative[section.key]} size="sm" />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>

        {/* ---------------- assembled, not transcribed ---------------- */}
        <Panel
          title="From the project"
          subtitle="Read fresh each time you open this, never copied in"
          icon={Radio}
          hue="mint"
        >
          <div className="space-y-6">
            <Block icon={UserRound} hue="grape" title="Stakeholders">
              {data.stakeholders.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  Nobody mapped yet. The stakeholder tab is where they go.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {data.stakeholders.map((person, i) => (
                    <li key={`${person.name}-${i}`} className="flex items-center gap-2.5">
                      <NameAvatar name={person.name} size={28} />
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium text-neutral-900">{person.name}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {person.roleLabel}{" "}
                          {/* Derived from the Mendelow grid, never stored. */}
                          <span className="text-neutral-500">({person.strategy})</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block icon={Users} hue="sky" title="Team">
              {data.team.length === 0 ? (
                <p className="text-xs text-neutral-500">Nobody staffed yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.team.map((member, i) => (
                    <li key={`${member.name}-${i}`} className="flex items-center gap-2.5">
                      <NameAvatar name={member.name} size={28} />
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium text-neutral-900">{member.name}</p>
                        <p className="truncate text-xs text-neutral-500">{member.roleLabel}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block icon={Flag} hue="coral" title="Milestones">
              {data.milestones.length === 0 ? (
                <p className="text-xs text-neutral-500">None marked. Any work item can be one.</p>
              ) : (
                <ul className="space-y-2">
                  {data.milestones.map((milestone) => (
                    <li key={milestone.id} className="flex items-start gap-2 text-sm">
                      <span
                        className={cx(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          milestone.isComplete ? HUE.mint.dot : HUE.coral.dot,
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={
                            milestone.isComplete ? "text-neutral-500 line-through" : "text-neutral-900"
                          }
                        >
                          {milestone.title}
                        </span>
                        {milestone.isComplete && <span className="sr-only"> (complete)</span>}
                        {milestone.dueOn !== null && (
                          <span className="block text-xs text-neutral-500">{milestone.dueOn}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block icon={CalendarRange} hue="blue" title="Schedule">
              {data.schedule === null ? (
                <p className="text-xs text-neutral-500">
                  Nothing schedulable yet: no estimated work, or a dependency loop.
                </p>
              ) : (
                <div className="rounded-2xl bg-primary-50/60 p-3.5">
                  <p className="text-sm font-semibold text-neutral-900">
                    {data.schedule.startsOn} to {data.schedule.endsOn}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    {data.schedule.durationDays} working days over{" "}
                    {data.schedule.itemCount} items
                  </p>
                  {/*
                    The caveat stays here, unlike on the client link: this is
                    read by people who can act on it.
                  */}
                  {data.schedule.unestimated > 0 && (
                    <Chip hue="sun" className="mt-2">
                      {data.schedule.unestimated} unestimated
                    </Chip>
                  )}
                </div>
              )}
            </Block>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Block({
  icon,
  hue,
  title,
  children,
}: {
  icon: LucideIcon;
  hue: Hue;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <IconTile icon={icon} hue={hue} size={24} />
        {title}
      </h4>
      {children}
    </section>
  );
}
