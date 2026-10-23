"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Eye,
  FlaskConical,
  Hammer,
  KanbanSquare,
  Settings2,
  ShieldCheck,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button, Chip, Empty, Panel, PersonAvatar } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { loadJobTitles } from "@/lib/api/job-titles-client";
import type { Hue } from "@/components/workspace/modules";
import {
  ApiError,
  projects as projectsApi,
  type ChosenSeat,
  type Project,
  type MemberCandidate,
  type ProjectMember,
  type ProjectRole,
  type ProjectSeat,
} from "@/lib/api/projects-client";
import {
  MiniStat,
  Notice,
  SectionHeading,
  TabSkeleton,
  fmtDate,
  hintCls,
  labelCls,
} from "./ui/pkit";
import ColleaguePicker from "./ColleaguePicker";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * Who is on the project, and how they sit on it.
 *
 * **Seats decide, roles label** (roles redesign, phase 2a). Each person has a
 * seat - Owner (everything on this project, team and cost included), Member
 * (works on it) or Viewer (reads it) - and a role shown beside their name
 * (Project manager, QA analyst...). Their organisation roles can add to a
 * seat, never take from it.
 *
 * **Oversight** is the fourth seat, given only by a role that joins every
 * project. Those people follow the work in their own section and are offered
 * none of it until they choose **Work on this project** (or whoever staffs
 * the project chooses it for them); **Back to oversight** undoes it.
 *
 * **A project always keeps one owner.** Removing or demoting the last leaves a
 * project nobody can staff or configure. The API refuses; the message says to
 * make somebody else an owner first.
 *
 * **Everybody has a job title here** — the organisation's own list, shared
 * with HR and the users screen. It is what their hours cost at. Adding
 * somebody starts from the title they already hold; a manager can change it
 * for this project without touching their record elsewhere.
 */

/** The member's job title on this project: its id, and its name. */
const jobTitleIdOf = (m: ProjectMember) => m.jobTitleId ?? m.disciplineId ?? "";
const jobTitleOf = (m: ProjectMember) => m.jobTitle ?? m.discipline ?? null;

const ROLES: { value: ProjectRole; label: string; hint: string }[] = [
  {
    value: "project_manager",
    label: "Project manager",
    hint: "Runs the project. An owner unless you choose otherwise.",
  },
  {
    value: "product_manager",
    label: "Product manager",
    hint: "Owns priority and scope. An owner unless you choose otherwise.",
  },
  { value: "member", label: "Member", hint: "Does the work." },
  {
    value: "qa_analyst",
    label: "QA analyst",
    hint: "Runs test sprints, writes test cases and reports findings.",
  },
  {
    value: "security_analyst",
    label: "Security analyst",
    hint: "Runs security assessments and reports vulnerabilities with remediations.",
  },
];

const SEATS: { value: ChosenSeat; label: string; hint: string }[] = [
  { value: "owner", label: "Owner", hint: "Everything on this project: team, settings, board and cost." },
  { value: "member", label: "Member", hint: "Works on it: adds work, moves their own, logs time." },
  { value: "viewer", label: "Viewer", hint: "Reads the project and changes nothing." },
];

/** A role is the same colour wherever it is shown. */
const ROLE_HUE: Record<ProjectRole, Hue> = {
  project_manager: "grape",
  product_manager: "sky",
  member: "mint",
  qa_analyst: "sun",
  security_analyst: "rose",
  oversight: "slate",
};

const SEAT_HUE: Record<ProjectSeat, Hue> = {
  owner: "grape",
  member: "mint",
  viewer: "slate",
  oversight: "blue",
};

const SEAT_LABEL: Record<ProjectSeat, string> = {
  owner: "Owner",
  member: "Member",
  viewer: "Viewer",
  oversight: "Oversight",
};

/** The seat a role gives when nobody chooses one: what the server does too. */
const ROLE_SEAT: Record<ProjectRole, ProjectSeat> = {
  project_manager: "owner",
  product_manager: "owner",
  member: "member",
  qa_analyst: "member",
  security_analyst: "member",
  oversight: "oversight",
};

const seatOf = (m: ProjectMember): ProjectSeat => m.seat ?? ROLE_SEAT[m.role];

export default function ProjectTeam({
  project,
  onChanged,
  startAdding = false,
}: {
  project: Project;
  onChanged?: () => void;
  /** Open with the add form showing — the header's "+" beside the avatars. */
  startAdding?: boolean;
}) {
  const confirm = useConfirm();
  const [members, setMembers] = useState<ProjectMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(startAdding && project.can.manageMembers);
  /** Picked from colleagues by name — never typed as an id. */
  const [person, setPerson] = useState<MemberCandidate | null>(null);
  const [role, setRole] = useState<ProjectRole>("member");
  /** Follows the role until somebody picks a seat themselves. */
  const [seat, setSeat] = useState<ChosenSeat>("member");
  const [seatChosen, setSeatChosen] = useState(false);
  const [jobTitleId, setJobTitleId] = useState("");
  /** Who is picked now, so a slow title lookup for somebody else is dropped. */
  const pickedRef = useRef<string | null>(null);

  /*
    Picking a colleague starts from the job title they already hold. The
    candidates list names it (and usually its id); a name alone is matched
    against the organisation's list. Unknown is fine — left empty, the server
    uses the person's own title.
  */
  const pickPerson = (next: MemberCandidate | null) => {
    setPerson(next);
    pickedRef.current = next?.userId ?? null;
    setJobTitleId(next?.jobTitleId ?? "");

    const name = next?.jobTitle?.trim().toLowerCase();
    if (next === null || next.jobTitleId || !name) return;

    loadJobTitles()
      .then((titles) => {
        const match = titles.find((t) => t.name.trim().toLowerCase() === name);
        if (match !== undefined && pickedRef.current === next.userId) {
          setJobTitleId((current) => (current === "" ? match.id : current));
        }
      })
      .catch(() => {});
  };

  const pickRole = (next: ProjectRole) => {
    setRole(next);
    if (!seatChosen) {
      const given = ROLE_SEAT[next];
      setSeat(given === "oversight" ? "member" : given);
    }
  };

  const load = useCallback(async () => {
    try {
      setMembers(await projectsApi.members(project.slug));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not load.");
      setMembers([]);
    }
  }, [project.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);

    try {
      await action();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  if (members === null) {
    return <TabSkeleton stats={0} />;
  }

  const manage = project.can.manageMembers;
  const team = members.filter((m) => seatOf(m) !== "oversight");
  const overseeing = members.filter((m) => seatOf(m) === "oversight");

  /* On every team through a role that joins every project, not set here. */
  const leadBadge = (member: ProjectMember) =>
    member.role === "oversight" || member.joinsEveryProject ? (
      <Chip hue={SEAT_HUE.oversight} icon={ShieldCheck} className="!px-2 !py-0.5 text-[11px]">
        Oversight · every project
      </Chip>
    ) : null;

  const seatControl = (member: ProjectMember) =>
    manage ? (
      <SearchableSelect
        value={seatOf(member)}
        disabled={busy !== null}
        onChange={(value) =>
          void run(`seat-${member.id}`, () => projectsApi.setMemberSeat(project.slug, member.id, value as ChosenSeat))
        }
        aria-label={`Seat for ${member.name ?? "this person"}`}
        size="sm"
        className="w-32"
        options={SEATS.map((s) => ({ value: s.value, label: s.label, hint: s.hint }))}
      />
    ) : (
      <Chip hue={SEAT_HUE[seatOf(member)]}>{member.seatLabel ?? SEAT_LABEL[seatOf(member)]}</Chip>
    );

  const roleControl = (member: ProjectMember) =>
    manage ? (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <SearchableSelect
          value={member.role}
          disabled={busy !== null}
          onChange={(value) =>
            void run(member.id, () => projectsApi.setMemberRole(project.slug, member.id, value as ProjectRole))
          }
          aria-label={`Role for ${member.name ?? "this person"}`}
          size="sm"
          className="w-44"
          options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
        />
        {leadBadge(member)}
      </span>
    ) : (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Chip hue={ROLE_HUE[member.role]}>{member.roleLabel}</Chip>
        {leadBadge(member)}
      </span>
    );

  /*
    Their job title on this project. A title the list no longer carries (since
    retired, say) still shows by name until somebody picks another.
  */
  const jobTitleControl = (member: ProjectMember, className = "w-52") =>
    manage ? (
      <JobTitlePicker
        mode="id"
        value={jobTitleIdOf(member)}
        onChange={(value) =>
          void run(`jt-${member.id}`, () =>
            projectsApi.setMemberJobTitle(project.slug, member.id, member.role, value === "" ? null : value),
          )
        }
        clearable
        disabled={busy !== null}
        placeholder={jobTitleOf(member) ?? "No job title"}
        aria-label={`Job title for ${member.name ?? "this person"}`}
        size="sm"
        className={className}
      />
    ) : jobTitleOf(member) !== null ? (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-neutral-700">
        <BriefcaseBusiness size={14} className="shrink-0 text-neutral-400" aria-hidden />
        <span className="truncate">{jobTitleOf(member)}</span>
      </span>
    ) : (
      <span className="text-[13px] text-neutral-500">No job title</span>
    );

  /** Somebody whose role joins every project: never off the team, only back to their Oversight seat. */
  const everyProject = (member: ProjectMember) => Boolean(member.joinsEveryProject);

  const removeControl = (member: ProjectMember) => {
    const who = member.name ?? "this person";

    if (everyProject(member)) {
      return manage || member.isYou ? (
        <Button
          size="sm"
          variant="ghost"
          icon={Undo2}
          disabled={busy !== null}
          onClick={async () => {
            const ok = await confirm({
              title: member.isYou ? `Stop working on ${project.name}?` : `Move ${who} back to oversight?`,
              body: `${member.isYou ? "You keep" : `${who} keeps`} an Oversight seat here, through a role that joins every project: the project stays in view as far as that role reaches, and no work is offered here until somebody chooses Work on this project again.`,
              confirmLabel: "Back to oversight",
            });
            if (ok) await run(member.id, () => projectsApi.stopWorking(project.slug, member.id));
          }}
        >
          Back to oversight
        </Button>
      ) : (
        <span className="text-xs text-neutral-500">On every project</span>
      );
    }

    return manage ? (
      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={async () => {
          const ok = await confirm({
            title: `Remove ${who} from ${project.name}?`,
            body: `${who} loses access to the project. Their account, and the work and time they logged, stay as they are. Removing a member doesn't go to the recycle bin; add them again to give access back.`,
            confirmLabel: "Remove from project",
          });
          if (ok) await run(member.id, () => projectsApi.removeMember(project.slug, member.id));
        }}
        className="!text-error-700 hover:!bg-error-50"
      >
        Remove
      </Button>
    ) : null;
  };

  const powers = (member: ProjectMember) => (
    <div className="flex flex-wrap gap-1.5">
      {member.managesProject && (
        <Chip hue="grape" icon={Settings2} className="!px-2 !py-0.5 text-[11px]">
          Project
        </Chip>
      )}
      {member.managesMembers && (
        <Chip hue="coral" icon={Users} className="!px-2 !py-0.5 text-[11px]">
          Team
        </Chip>
      )}
      {member.managesTesting && (
        <Chip hue="sun" icon={FlaskConical} className="!px-2 !py-0.5 text-[11px]">
          Testing
        </Chip>
      )}
      {member.managesBoard ? (
        <Chip hue="blue" icon={KanbanSquare} className="!px-2 !py-0.5 text-[11px]">
          Whole board
        </Chip>
      ) : seatOf(member) === "viewer" ? (
        <Chip hue="slate" icon={Eye} className="!px-2 !py-0.5 text-[11px]">
          Reads only
        </Chip>
      ) : (
        <Chip hue="slate" className="!px-2 !py-0.5 text-[11px]">
          Own work
        </Chip>
      )}
    </div>
  );

  const columns: Column<ProjectMember>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      value: (m) => `${m.name ?? "Unnamed"} ${m.email ?? ""}`,
      render: (m) => (
        <span className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={m.name ?? "Unnamed"} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{m.name ?? "Unnamed"}</span>
            <span className="block truncate text-xs text-neutral-500">{m.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "jobTitle",
      header: "Job title",
      value: (m) => jobTitleOf(m) ?? "",
      render: (m) => jobTitleControl(m),
    },
    { key: "seat", header: "Seat", value: (m) => SEAT_LABEL[seatOf(m)], render: seatControl },
    { key: "role", header: "Role", value: (m) => m.roleLabel, render: roleControl },
    { key: "powers", header: "May change", render: powers, hideOnMobile: true },
    {
      key: "added",
      header: "Added",
      value: (m) => m.addedAt ?? "",
      render: (m) => <span className="text-neutral-600">{fmtDate(m.addedAt)}</span>,
      hideOnMobile: true,
    },
    ...(manage || team.some((m) => m.isYou && everyProject(m))
      ? [{ key: "actions", header: "", align: "right" as const, tableOnly: true, render: removeControl }]
      : []),
  ];

  const count = (s: ProjectSeat) => members.filter((m) => seatOf(m) === s).length;

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Team"
        hint="Who is on this project, their seat, and what each of them may do."
        actions={
          manage ? (
            <Button variant="primary" icon={UserPlus} onClick={() => setAdding((a) => !a)}>
              Add somebody
            </Button>
          ) : undefined
        }
      />

      {error !== null && <Notice tone="error">{error}</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat label="Working on it" value={count("owner") + count("member")} hue="blue" />
        {SEATS.map((s) => (
          <MiniStat key={s.value} label={`${s.label}s`} value={count(s.value)} hue={SEAT_HUE[s.value]} hint={s.hint} />
        ))}
        <MiniStat
          label="Oversight"
          value={overseeing.length}
          hue={SEAT_HUE.oversight}
          hint="On every project through their role."
        />
      </div>

      {adding && manage && (
        <Panel title="Add somebody" subtitle="They see the board as soon as they are added." icon={UserPlus} hue="mint">
          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (person === null) return;

              void run("add", async () => {
                await projectsApi.addMember(project.slug, {
                  userId: person.userId,
                  role,
                  seat,
                  /* Left out when unknown: the server uses their own title. */
                  ...(jobTitleId === "" ? {} : { disciplineId: jobTitleId }),
                });
                pickPerson(null);
                setSeatChosen(false);
                setAdding(false);
              });
            }}
            className="flex flex-col gap-4 xl:flex-row xl:items-start"
          >
            <div className="min-w-0 flex-1">
              <ColleaguePicker slug={project.slug} value={person} onChange={pickPerson} />
            </div>

            <div className="xl:w-52">
              <label htmlFor="add-job-title" className={labelCls}>
                Job title
              </label>
              <JobTitlePicker
                id="add-job-title"
                mode="id"
                value={jobTitleId}
                onChange={(value) => setJobTitleId(value)}
                clearable
                placeholder={person?.jobTitle ?? "Their own"}
                aria-describedby="add-job-title-hint"
              />
              <p id="add-job-title-hint" className={hintCls}>
                What their hours cost at here.
              </p>
            </div>

            <div className="xl:w-44">
              <label htmlFor="add-role" className={labelCls}>
                Role
              </label>
              <SearchableSelect
                id="add-role"
                value={role}
                onChange={(value) => pickRole(value as ProjectRole)}
                options={ROLES.map((r) => ({ value: r.value, label: r.label, hint: r.hint }))}
              />
            </div>

            <div className="xl:w-36">
              <label htmlFor="add-seat" className={labelCls}>
                Seat
              </label>
              <SearchableSelect
                id="add-seat"
                value={seat}
                onChange={(value) => {
                  setSeat(value as ChosenSeat);
                  setSeatChosen(true);
                }}
                options={SEATS.map((s) => ({ value: s.value, label: s.label, hint: s.hint }))}
                aria-describedby="add-seat-hint"
              />
              <p id="add-seat-hint" className={hintCls}>
                What they may do here.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={UserPlus}
              disabled={busy !== null || person === null}
              className="xl:mt-[26px]"
            >
              {person === null ? "Add" : `Add ${person.name?.split(" ")[0] ?? "them"}`}
            </Button>
          </form>
        </Panel>
      )}

      <DataView
        rows={team}
        columns={columns}
        rowKey={(m) => m.id}
        storageKey="projects.team"
        defaultView="grid"
        caption="People on this project"
        searchPlaceholder="Search the team"
        empty={team.length === 0 ? <Empty icon={Users} title="Nobody on it yet" hint="Add the people doing the work." /> : undefined}
        renderCard={(m) => (
          <div className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <PersonAvatar name={m.name ?? "Unnamed"} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-neutral-900">{m.name ?? "Unnamed"}</p>
                <p className="truncate text-xs text-neutral-500">{m.email}</p>
              </div>
              {seatControl(m)}
            </div>
            {jobTitleControl(m, "w-full")}
            <p className="text-xs leading-relaxed text-neutral-600">{m.roleDescription}</p>
            {powers(m)}
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
              {roleControl(m)}
              {removeControl(m)}
            </div>
          </div>
        )}
        renderListItem={(m) => (
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <PersonAvatar name={m.name ?? "Unnamed"} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{m.name ?? "Unnamed"}</p>
              <p className="truncate text-xs text-neutral-500">
                {[jobTitleOf(m), m.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            {manage && jobTitleControl(m, "w-48")}
            {seatControl(m)}
            {roleControl(m)}
            {removeControl(m)}
          </div>
        )}
      />

      {overseeing.length > 0 && (
        <Panel
          title="Oversight"
          subtitle="On every project through a role. They follow the work here and are offered none of it until they choose to work on it."
          icon={Eye}
          hue="blue"
        >
          <ul className="-my-1 divide-y divide-neutral-100" aria-label="Oversight on this project">
            {overseeing.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <PersonAvatar name={m.name ?? "Unnamed"} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {m.name ?? "Unnamed"}
                    {m.isYou && <span className="ml-1.5 text-xs font-medium text-neutral-500">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {[jobTitleOf(m), m.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span title="On every project's team because their role joins every project. Changed in the organisation's roles.">
                  {leadBadge(m) ?? (
                    <Chip hue={SEAT_HUE.oversight} icon={ShieldCheck} className="!px-2 !py-0.5 text-[11px]">
                      Oversight · every project
                    </Chip>
                  )}
                </span>
                {manage || m.isYou ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Hammer}
                    disabled={busy !== null}
                    onClick={() => void run(`work-${m.id}`, () => projectsApi.workOnProject(project.slug, m.id))}
                    aria-label={m.isYou ? "Work on this project" : `Work on this project: ${m.name ?? "this person"}`}
                  >
                    Work on this project
                  </Button>
                ) : (
                  <span className="text-xs text-neutral-500">On every project</span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-neutral-500">
        <ShieldCheck size={14} className="mt-px shrink-0 text-neutral-400" aria-hidden />
        A project always keeps at least one owner. To step down, make somebody else an owner first.
      </p>
    </div>
  );
}
