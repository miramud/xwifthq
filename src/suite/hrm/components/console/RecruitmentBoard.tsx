"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowDown,
  ArrowUp,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  Hourglass,
  Inbox,
  MapPin,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Timer,
  TrendingDown,
  UserRoundSearch,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PersonAvatar,
  StatCard,
  StatGrid,
  buttonClass,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ColumnChart, Donut, SegmentedGauge } from "@/components/workspace/charts";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  hrm,
  type CostPerHire,
  type EmploymentType,
  type InterviewerLoad,
  type JobRequisition,
  type OfferOutcomes,
  type PipelineStage,
  type RecruitmentAttention,
  type RecruitmentFunnel,
  type RecruitmentOverview,
  type RequisitionAgeing,
  type SourceRow,
  type StageDuration,
  type StageKind,
  type TimeToFill,
} from "@/lib/api/hrm-client";
import { Candidates, Offers } from "./RecruitmentLists";
import { INPUT } from "./Dialog";
import {
  formatDate,
  nairaFromKobo,
  requisitionTone,
  salaryBand,
  funnelShare,
} from "@/suite/hrm/lib/format";
import { FeaturedStat, IconTile, LoadError, ToneChip } from "../ui/recordKit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { Notice } from "@/suite/hrm/components/ui2/kit";

/**
 * Running recruitment.
 *
 * Three views, and the split follows who is asking. A recruiter lives on the
 * roles list and the board; whoever signs off headcount lives on the approvals
 * queue; and the analytics answer the four questions anybody eventually asks,
 * which channel works, where the funnel leaks, how long roles stay open, and
 * what a hire costs.
 *
 * The board shows only non-terminal stages, which the API decides. Matching on
 * a stage's *name* to work out whether it belongs on a board would break the
 * day somebody renames "Screening" to "Triage", the kind is what carries the
 * meaning.
 */

type Tab =
  | "attention"
  | "roles"
  | "candidates"
  | "offers"
  | "analytics"
  | "pipeline";

const TABS: { key: Tab; label: string }[] = [
  { key: "attention", label: "Needs you" },
  { key: "roles", label: "Roles" },
  /*
    Candidates and offers cut across roles, which is why neither could be
    reached before: the only route to either was through the one application
    it belonged to.
  */
  { key: "candidates", label: "Candidates" },
  { key: "offers", label: "Offers" },
  { key: "analytics", label: "Analytics" },
  { key: "pipeline", label: "Pipeline setup" },
];

export default function RecruitmentBoard() {
  /*
    Opens on what is waiting rather than on a list of roles. A recruiter
    arriving at this screen has something to do, and a list of vacancies is
    not it.
  */
  const [tab, setTab] = useState<Tab>("attention");
  const [overview, setOverview] = useState<RecruitmentOverview | null>(null);

  useEffect(() => {
    hrm.recruitment
      .overview()
      .then(setOverview)
      .catch(() => {
        // The tiles are a summary. Failing to load them should not stop the
        // lists below from working.
      });
  }, []);

  return (
    <div>
      <PageHeader
        title="Recruitment"
        subtitle="Roles, candidates and offers, and what is waiting on somebody right now."
        tabs={TABS}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {overview !== null && (
        <div className="mb-6">
          <Headline overview={overview} />
        </div>
      )}

      {tab === "attention" && <Attention />}
      {tab === "roles" && <Roles />}
      {tab === "candidates" && <Candidates />}
      {tab === "offers" && <Offers />}
      {tab === "analytics" && <Analytics />}
      {tab === "pipeline" && <PipelineSetup />}
    </div>
  );
}

function Headline({ overview }: { overview: RecruitmentOverview }) {
  return (
    <StatGrid>
      <FeaturedStat
        icon={Briefcase}
        label="Open roles"
        value={overview.openRoles}
        hint={
          overview.awaitingApproval > 0
            ? `${overview.awaitingApproval} awaiting approval`
            : "All approved"
        }
      />
      <StatCard
        icon={Users}
        hue="grape"
        label="Active candidates"
        value={overview.activeCandidates}
        hint={`${overview.hires} hired`}
      />
      <StatCard
        icon={Timer}
        hue="sky"
        label="Median time to fill"
        value={overview.timeToFill.medianDays === null ? "-" : overview.timeToFill.medianDays}
        unit={overview.timeToFill.medianDays === null ? undefined : "days"}
        hint="From approval, not from the advert"
      />
      <StatCard
        icon={Banknote}
        hue="mint"
        label="Advertising per hire"
        value={nairaFromKobo(overview.costPerHire.perHireKobo)}
        hint="Advertising spend only"
      />
    </StatGrid>
  );
}

/* ------------------------------------------------------------------ */
/*  Roles                                                              */
/* ------------------------------------------------------------------ */

function Roles() {
  const [editing, setEditing] = useState<JobRequisition | null>(null);
  const [rows, setRows] = useState<JobRequisition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      hrm.recruitment
        .requisitions({ openOnly: true })
        .then((res) => {
          setRows(res.data);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (
    row: JobRequisition,
    action: "submit" | "approve",
  ) => {
    setBusy(row.id);

    try {
      await hrm.recruitment.transition(row.id, action);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const actions = (row: JobRequisition) => (
    <div className="flex shrink-0 items-center gap-1.5">
      {row.status === "draft" && (
        <Button size="sm" icon={Send} onClick={() => void act(row, "submit")} disabled={busy === row.id}>
          Send for approval
        </Button>
      )}
      {row.status === "pending_approval" && (
        <Button
          size="sm"
          variant="primary"
          icon={CheckCircle2}
          onClick={() => void act(row, "approve")}
          disabled={busy === row.id}
        >
          Approve
        </Button>
      )}
      <button
        type="button"
        onClick={() => setEditing(row)}
        aria-label={`Edit ${row.jobTitle}`}
        className={buttonClass("ghost", "sm")}
      >
        <Pencil size={14} aria-hidden />
        Edit
      </button>
    </div>
  );

  /*
    A link, not a tab switch: a hiring manager has to be able to be sent their
    own vacancy.
  */
  const title = (row: JobRequisition) => (
    <Link
      href={`/suite/hrm/recruitment/${row.id}`}
      className="block truncate font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
    >
      {row.jobTitle}
    </Link>
  );

  const columns: Column<JobRequisition>[] = [
    {
      key: "role",
      header: "Role",
      primary: true,
      sortable: true,
      value: (r) => r.jobTitle,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <IconTile icon={Briefcase} hue={hueFor(r.department ?? r.jobTitle)} size={36} />
          <span className="min-w-0">
            {title(r)}
            <span className="block truncate text-xs text-neutral-500">
              {r.reference}
              {r.location ? ` · ${r.location}` : ""}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.department ?? "",
      render: (r) =>
        r.department ? <Chip hue={hueFor(r.department)} dot>{r.department}</Chip> : <span className="text-neutral-500">No department</span>,
    },
    {
      key: "band",
      header: "Salary band",
      hideOnMobile: true,
      value: (r) => r.salaryMinKobo ?? r.salaryMaxKobo ?? 0,
      sortable: true,
      render: (r) => <span className="whitespace-nowrap text-neutral-700">{salaryBand(r.salaryMinKobo, r.salaryMaxKobo)}</span>,
    },
    {
      key: "applied",
      header: "Applied",
      sortable: true,
      align: "right",
      value: (r) => r.applicationCount ?? 0,
      render: (r) => <span className="font-semibold tabular-nums text-neutral-900">{r.applicationCount ?? 0}</span>,
    },
    {
      key: "open",
      header: "Open",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      value: (r) => r.daysOpen ?? -1,
      render: (r) => (r.daysOpen !== null ? `${r.daysOpen}d` : "-"),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => r.statusLabel,
      render: (r) => <ToneChip tone={requisitionTone(r.status)}>{r.statusLabel}</ToneChip>,
    },
    { key: "actions", header: "", tableOnly: true, align: "right", render: (r) => actions(r) },
  ];

  return (
    <>
      {error !== null && (
        <Notice tone="error" role="alert" className="mb-4">
          {error}
        </Notice>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">Nothing can be advertised until it has been approved.</p>
        <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
          Raise a role
        </Button>
      </div>

      {rows === null ? (
        <div className="ws-card h-48 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
      ) : (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          storageKey="hrm.recruitment.roles"
          caption="Open roles"
          searchPlaceholder="Search roles"
          empty={<Empty icon={Briefcase} title="No open roles" hint="Raise one to start hiring." />}
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <IconTile icon={Briefcase} hue={hueFor(r.department ?? r.jobTitle)} size={44} />
                <ToneChip tone={requisitionTone(r.status)}>{r.statusLabel}</ToneChip>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{r.reference}</p>
                <div className="mt-0.5 text-[15px]">{title(r)}</div>
                <p className="mt-1 text-sm text-neutral-500">{salaryBand(r.salaryMinKobo, r.salaryMaxKobo)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip hue={hueFor(r.department ?? "none")} icon={Building2}>{r.department ?? "No department"}</Chip>
                {r.location && <Chip hue="slate" icon={MapPin}>{r.location}</Chip>}
                {r.headcount > 1 && <Chip hue="grape">{r.headcount} to hire</Chip>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-primary-50 px-3 py-2 text-primary-700">
                  <p className="text-[11px] font-medium opacity-80">Applied</p>
                  <p className="text-sm font-bold tabular-nums">{r.applicationCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-sun-50 px-3 py-2 text-sun-700">
                  <p className="text-[11px] font-medium opacity-80">Open</p>
                  <p className="text-sm font-bold tabular-nums">{r.daysOpen !== null ? `${r.daysOpen} days` : "-"}</p>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-100 pt-3">{actions(r)}</div>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <IconTile icon={Briefcase} hue={hueFor(r.department ?? r.jobTitle)} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {title(r)}
                </div>
                <p className="truncate text-xs text-neutral-500">
                  {r.reference} · {r.department ?? "No department"}
                  {r.location ? ` · ${r.location}` : ""}
                  {" · "}
                  {salaryBand(r.salaryMinKobo, r.salaryMaxKobo)}
                  {r.headcount > 1 ? ` · ${r.headcount} to hire` : ""}
                  {r.daysOpen !== null ? ` · open ${r.daysOpen} days` : ""}
                </p>
              </div>
              {(r.applicationCount ?? 0) > 0 && (
                <span className="text-xs text-neutral-500">{r.applicationCount} applied</span>
              )}
              <ToneChip tone={requisitionTone(r.status)}>{r.statusLabel}</ToneChip>
              {actions(r)}
            </div>
          )}
        />
      )}

      {(adding || editing !== null) && (
        <RequisitionDialog
          existing={editing ?? undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            void load();
          }}
        />
      )}
    </>
  );
}

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "casual", label: "Casual" },
];

function RequisitionDialog({
  existing,
  onClose,
  onSaved,
}: {
  /** Present when changing a role rather than raising one. */
  existing?: JobRequisition;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [jobTitle, setJobTitle] = useState(existing?.jobTitle ?? "");
  const [department, setDepartment] = useState(existing?.department ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    existing?.employmentType ?? "permanent",
  );
  const [headcount, setHeadcount] = useState(String(existing?.headcount ?? 1));
  const [salaryMin, setSalaryMin] = useState(
    existing?.salaryMinKobo != null ? String(existing.salaryMinKobo / 100) : "",
  );
  const [salaryMax, setSalaryMax] = useState(
    existing?.salaryMaxKobo != null ? String(existing.salaryMaxKobo / 100) : "",
  );
  const [justification, setJustification] = useState(
    existing?.justification ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const payload = {
        jobTitle: jobTitle.trim(),
        department: department.trim() === "" ? null : department.trim(),
        location: location.trim() === "" ? null : location.trim(),
        employmentType,
        headcount: Number(headcount || 1),
        // Typed in naira because that is what a policy document says; stored
        // in kobo so nothing rounds twice.
        salaryMinKobo: salaryMin === "" ? null : Math.round(Number(salaryMin) * 100),
        salaryMaxKobo: salaryMax === "" ? null : Math.round(Number(salaryMax) * 100),
        justification: justification.trim() === "" ? undefined : justification.trim(),
      };

      /*
        A role's details change while it is open far more often than anybody
        expects, a salary band signed off late, a location that moves, a
        second headcount approved. Without this the only options were to raise
        a duplicate or leave the advert wrong.
      */
      if (existing !== undefined) {
        await hrm.recruitment.updateRequisition(existing.id, payload);
      } else {
        await hrm.recruitment.createRequisition(payload);
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
        aria-label="Raise a role"
        className="relative z-10 w-full max-w-lg space-y-4 rounded-[1.25rem] bg-white p-6 shadow-2xl shadow-neutral-900/10"
      >
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">Raise a role</h2>

        <Field label="Job title">
          <JobTitlePicker mode="name" value={jobTitle} onChange={(name) => setJobTitle(name)} required />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Department">
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Location">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Basis">
            <SearchableSelect
              value={employmentType}
              onChange={(v) => setEmploymentType(v as EmploymentType)}
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </Field>
          <Field label="How many">
            <input
              type="number"
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              min={1}
              max={500}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Salary from (₦)">
            <input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              min={0}
              className={INPUT}
            />
          </Field>
          <Field label="Salary to (₦)">
            <input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              min={0}
              className={INPUT}
            />
          </Field>
        </div>

        <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs text-sky-700">
          The band is what gets approved. An offer outside it is refused rather
          than quietly made.
        </p>

        <Field label="Why this role (optional)">
          <RichTextEditor minHeight={76} value={justification} onChange={setJustification} />
        </Field>

        {error !== null && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
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
            {busy ? "Saving…" : "Raise"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  What is waiting on a human                                         */
/* ------------------------------------------------------------------ */

/**
 * The Monday-morning screen.
 *
 * Every row here is something a person has to do, with nothing else mixed in.
 * It is the tab the module opens on, because a recruiter arriving at
 * recruitment has something to chase and a list of vacancies is not it.
 */
function Attention() {
  const [data, setData] = useState<RecruitmentAttention | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hrm.recruitment
      .attention()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error !== null) {
    return <LoadError title="That did not load" message={error} />;
  }

  if (data === null) {
    return <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />;
  }

  const total =
    data.requisitionsAwaitingApproval.length +
    data.staleApplications.length +
    data.interviewsAwaitingScorecards.length +
    data.offersAwaitingApproval.length +
    data.offersUnsent.length +
    data.offersExpiringSoon.length;

  if (total === 0) {
    return (
      <Card>
        <Empty
          icon={Inbox}
          hue="mint"
          title="Nothing is waiting"
          hint="No roles to approve, nobody sitting too long, every scorecard in and every offer moving."
        />
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      {data.offersExpiringSoon.length > 0 && (
        <Panel
          title="Offers about to lapse"
          subtitle="Chase these before they lapse."
          icon={AlarmClock}
          hue="coral"
        >
          <QueueList>
            {data.offersExpiringSoon.map((row) => (
              <QueueItem key={row.offerId} name={row.candidateName ?? "A candidate"} sub={row.jobTitle}>
                <ToneChip tone={(row.daysLeft ?? 0) <= 2 ? "error" : "warning"}>
                  {row.daysLeft === 0 ? "Expires today" : `${row.daysLeft} days left`}
                </ToneChip>
              </QueueItem>
            ))}
          </QueueList>
        </Panel>
      )}

      {data.requisitionsAwaitingApproval.length > 0 && (
        <Panel title="Roles waiting on approval" icon={Briefcase} hue="blue">
          <QueueList>
            {data.requisitionsAwaitingApproval.map((row) => (
              <li key={row.requisitionId} className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50/80 px-3 py-2.5">
                <IconTile icon={Briefcase} hue="blue" size={34} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/suite/hrm/recruitment/${row.requisitionId}`}
                    className="block truncate text-sm font-semibold text-neutral-900 hover:text-primary-700"
                  >
                    {row.reference} · {row.jobTitle}
                  </Link>
                  <span className="text-xs text-neutral-500">
                    {row.requestedBy ?? "Somebody"} · since {formatDate(row.waitingSince)}
                  </span>
                </div>
              </li>
            ))}
          </QueueList>
        </Panel>
      )}

      {data.staleApplications.length > 0 && (
        <Panel
          title="Candidates nobody has touched"
          subtitle="Across every role, in one list."
          icon={Hourglass}
          hue="sun"
        >
          <QueueList>
            {data.staleApplications.map((row) => (
              <li key={row.applicationId} className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50/80 px-3 py-2.5">
                <PersonAvatar name={row.candidateName ?? "Unnamed"} size={34} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/suite/hrm/recruitment/candidates/${row.candidateId}`}
                    className="block truncate text-sm font-semibold text-neutral-900 hover:text-primary-700"
                  >
                    {row.candidateName ?? "Unnamed"}
                  </Link>
                  <p className="truncate text-xs text-neutral-500">
                    {row.reference} · {row.jobTitle} · {row.stage}
                  </p>
                </div>
                <ToneChip tone="warning">
                  {row.daysInStage} days
                  {row.allowedDays !== null ? ` of ${row.allowedDays}` : ""}
                </ToneChip>
              </li>
            ))}
          </QueueList>
        </Panel>
      )}

      {data.interviewsAwaitingScorecards.length > 0 && (
        <Panel
          title="Scorecards outstanding"
          subtitle="Write these up while the interview is fresh."
          icon={MessageSquare}
          hue="grape"
        >
          <QueueList>
            {data.interviewsAwaitingScorecards.map((row) => (
              <li key={row.interviewId} className="rounded-xl bg-neutral-50/80 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <PersonAvatar name={row.candidateName ?? "A candidate"} size={34} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                    {row.candidateName ?? "A candidate"}
                  </span>
                  <ToneChip tone={row.daysWaiting > 3 ? "error" : "warning"}>{row.daysWaiting} days</ToneChip>
                </div>
                {/*
                  Named rather than counted: "three outstanding" is not
                  actionable and "Ada and Grace owe you one" is.
                */}
                <p className="mt-1 truncate pl-[46px] text-xs text-neutral-500">
                  Waiting on {row.waitingOn.map((p) => p.name ?? "somebody").join(", ")}
                </p>
              </li>
            ))}
          </QueueList>
        </Panel>
      )}

      {(data.offersAwaitingApproval.length > 0 || data.offersUnsent.length > 0) && (
        <Panel title="Offers" icon={FileSignature} hue="mint">
          <QueueList>
            {data.offersAwaitingApproval.map((row) => (
              <OfferRow key={row.offerId} row={row} note="Waiting on an approver" />
            ))}
            {/*
              Approved but never sent is a different problem from waiting on
              an approver, and a single "pending" would hide which.
            */}
            {data.offersUnsent.map((row) => (
              <OfferRow key={row.offerId} row={row} note="Approved but not sent" />
            ))}
          </QueueList>
        </Panel>
      )}
    </div>
  );
}

function QueueList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2">{children}</ul>;
}

function QueueItem({
  name,
  sub,
  children,
}: {
  name: string;
  sub?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50/80 px-3 py-2.5">
      <PersonAvatar name={name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
        {sub && <p className="truncate text-xs text-neutral-500">{sub}</p>}
      </div>
      {children}
    </li>
  );
}

function OfferRow({
  row,
  note,
}: {
  row: { offerId: string; candidateName: string | null; jobTitle?: string; salaryKobo?: number };
  note: string;
}) {
  return (
    <QueueItem
      name={row.candidateName ?? "A candidate"}
      sub={`${row.jobTitle ?? "-"}${row.salaryKobo !== undefined ? ` · ${nairaFromKobo(row.salaryKobo)}` : ""}`}
    >
      <ToneChip tone="warning">{note}</ToneChip>
    </QueueItem>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline setup                                                     */
/* ------------------------------------------------------------------ */

const KINDS: { value: StageKind; label: string; hint: string }[] = [
  { value: "screening", label: "Screening", hint: "A sift before anybody talks." },
  { value: "interview", label: "Interview", hint: "A conversation." },
  { value: "assessment", label: "Assessment", hint: "A test, task or presentation." },
  { value: "offer", label: "Offer", hint: "Terms are being agreed." },
];

const KIND_LOOK: Record<string, { hue: Hue; icon: LucideIcon }> = {
  screening: { hue: "sky", icon: UserRoundSearch },
  interview: { hue: "grape", icon: MessageSquare },
  assessment: { hue: "sun", icon: ClipboardList },
  offer: { hue: "mint", icon: FileSignature },
};

function kindLook(kind: string) {
  return KIND_LOOK[kind] ?? { hue: "slate" as Hue, icon: Workflow };
}

/**
 * The institution's own process.
 *
 * Names belong to them; the *kind* belongs to the system, and the form says so
 * because that is what lets a funnel report survive somebody renaming
 * "Screening" to "Triage".
 */
function PipelineSetup() {
  const [stages, setStages] = useState<PipelineStage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      hrm.recruitment
        .stages()
        .then((res) => {
          setStages(res);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (index: number, direction: -1 | 1) => {
    if (stages === null) return;

    const next = [...stages];
    const target = index + direction;

    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];

    setBusy(true);

    try {
      await hrm.recruitment.reorderStages(next.map((s) => s.id));
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  const index = (stage: PipelineStage) => (stages ?? []).indexOf(stage);

  /*
    Terminal stages are outcomes rather than steps, so reordering them would
    say something the pipeline does not mean.
  */
  const reorder = (stage: PipelineStage) =>
    stage.isTerminal ? (
      <Chip hue="slate">Outcome</Chip>
    ) : (
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => void move(index(stage), -1)}
          disabled={busy || index(stage) === 0}
          aria-label="Move earlier"
          className={cx(buttonClass("secondary", "sm"), "w-9 px-0")}
        >
          <ArrowUp size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => void move(index(stage), 1)}
          disabled={busy || index(stage) === (stages ?? []).length - 1}
          aria-label="Move later"
          className={cx(buttonClass("secondary", "sm"), "w-9 px-0")}
        >
          <ArrowDown size={15} aria-hidden />
        </button>
      </div>
    );

  const chase = (stage: PipelineStage) =>
    stage.staleAfterDays !== null ? `chase after ${stage.staleAfterDays} days` : "no chase threshold";

  const columns: Column<PipelineStage>[] = [
    {
      key: "position",
      header: "#",
      value: (s) => s.position,
      render: (s) => <span className="text-xs font-semibold tabular-nums text-neutral-500">{s.position}</span>,
      tableOnly: true,
    },
    {
      key: "name",
      header: "Stage",
      primary: true,
      value: (s) => s.name,
      render: (s) => {
        const look = kindLook(s.kind);
        return (
          <span className="flex items-center gap-3">
            <IconTile icon={look.icon} hue={s.isTerminal ? "slate" : look.hue} size={34} />
            <span className="font-semibold text-neutral-900">{s.name}</span>
          </span>
        );
      },
    },
    {
      key: "kind",
      header: "Kind",
      value: (s) => s.kindLabel,
      render: (s) => <Chip hue={s.isTerminal ? "slate" : kindLook(s.kind).hue}>{s.kindLabel}</Chip>,
    },
    { key: "chase", header: "Chase", value: (s) => chase(s), hideOnMobile: true },
    { key: "order", header: "", tableOnly: true, align: "right", render: (s) => reorder(s) },
  ];

  return (
    <>
      {error !== null && (
        <Notice tone="error" role="alert" className="mb-4">
          {error}
        </Notice>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">Your hiring process</h2>
          <p className="max-w-2xl text-sm text-neutral-500">
            Call the stages whatever you call them. The kind underneath is what the reporting reads, so renaming one
            never breaks a funnel.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
          Add a stage
        </Button>
      </div>

      {stages === null ? (
        <div className="ws-card h-48 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
      ) : (
        <>
          {/* The process at a glance, in order: the lanes a candidate moves through. */}
          <ol className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Stages in order">
            {stages.map((stage) => {
              const look = kindLook(stage.kind);
              return (
                <li
                  key={stage.id}
                  className={cx(
                    "flex min-w-[9.5rem] flex-1 items-center gap-2.5 rounded-2xl border px-3 py-3",
                    stage.isTerminal ? "border-neutral-200 bg-neutral-50" : "border-transparent bg-white shadow-sm",
                  )}
                >
                  <IconTile icon={look.icon} hue={stage.isTerminal ? "slate" : look.hue} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{stage.name}</span>
                    <span className="block text-[11px] text-neutral-500">Step {stage.position}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <DataView
            rows={stages}
            columns={columns}
            rowKey={(s) => s.id}
            storageKey="hrm.recruitment.stages"
            caption="Hiring stages, in order"
            searchable={false}
            empty={<Empty icon={Workflow} title="No stages yet" hint="Add the first stage of your hiring process." />}
            renderCard={(s) => {
              const look = kindLook(s.kind);
              return (
                <div className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <IconTile icon={look.icon} hue={s.isTerminal ? "slate" : look.hue} size={44} />
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-neutral-600">
                      Step {s.position}
                    </span>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-neutral-900">{s.name}</p>
                    <p className="text-sm text-neutral-500">{s.kindLabel} · {chase(s)}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-3">
                    <Chip hue={s.isTerminal ? "slate" : look.hue}>{s.kindLabel}</Chip>
                    {reorder(s)}
                  </div>
                </div>
              );
            }}
            renderListItem={(s) => {
              const look = kindLook(s.kind);
              return (
                <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-neutral-400">{s.position}</span>
                  <IconTile icon={look.icon} hue={s.isTerminal ? "slate" : look.hue} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{s.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {s.kindLabel} · {chase(s)}
                    </p>
                  </div>
                  {reorder(s)}
                </div>
              );
            }}
          />
        </>
      )}

      {adding && (
        <StageDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void load();
          }}
        />
      )}
    </>
  );
}

function StageDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StageKind>("screening");
  const [staleAfterDays, setStaleAfterDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.recruitment.createStage({
        name: name.trim(),
        kind,
        staleAfterDays: staleAfterDays === "" ? null : Number(staleAfterDays),
      });

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
        aria-label="Add a stage"
        className="relative z-10 w-full max-w-md space-y-4 rounded-[1.25rem] bg-white p-6 shadow-2xl shadow-neutral-900/10"
      >
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">Add a stage</h2>

        <Field label="What you call it">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            placeholder="Triage, Tech screen, Panel…"
            className={INPUT}
          />
        </Field>

        <Field label="What it is">
          <SearchableSelect
            value={kind}
            onChange={(v) => setKind(v as StageKind)}
            options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
          />
          <p className="mt-1 text-xs text-neutral-500">
            {KINDS.find((k) => k.value === kind)?.hint} This is what the
            reporting reads, so your own name for it can change freely.
          </p>
        </Field>

        <Field label="Chase after (days)">
          <input
            type="number"
            value={staleAfterDays}
            onChange={(e) => setStaleAfterDays(e.target.value)}
            min={1}
            max={365}
            placeholder="Never"
            className={INPUT}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Anybody sitting here longer shows up under Needs you.
          </p>
        </Field>

        {error !== null && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
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
            {busy ? "Saving…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Analytics                                                          */
/* ------------------------------------------------------------------ */

const FUNNEL_HUES: Hue[] = ["blue", "sky", "grape", "sun", "mint", "coral", "rose"];

function Analytics() {
  const [data, setData] = useState<{
    funnel: RecruitmentFunnel;
    sources: SourceRow[];
    timeToFill: TimeToFill;
    costPerHire: CostPerHire;
    offers: OfferOutcomes;
    interviewers: InterviewerLoad[];
    stageDurations: StageDuration[];
    ageing: RequisitionAgeing;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hrm.recruitment
      .analytics()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error !== null) {
    return <LoadError title="That did not load" message={error} />;
  }

  if (data === null) {
    return <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />;
  }

  const sourceColumns: Column<SourceRow>[] = [
    {
      key: "source",
      header: "Source",
      primary: true,
      sortable: true,
      value: (r) => r.label,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <IconTile icon={Megaphone} hue={hueFor(r.label)} size={32} />
          <span className="font-semibold text-neutral-900">{r.label}</span>
          {r.isPaid && <Chip hue="sun">paid</Chip>}
        </span>
      ),
    },
    { key: "applied", header: "Applied", sortable: true, align: "right", value: (r) => r.applications },
    { key: "hired", header: "Hired", sortable: true, align: "right", value: (r) => r.hires },
    {
      key: "rate",
      header: "Rate",
      sortable: true,
      align: "right",
      value: (r) => r.hireRate,
      render: (r) => (
        <span className={r.hireRate === 0 ? "text-neutral-500" : "font-semibold text-neutral-900"}>{r.hireRate}%</span>
      ),
    },
    {
      key: "spent",
      header: "Spent",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      value: (r) => r.spendKobo,
      render: (r) => (r.spendKobo === 0 ? "-" : nairaFromKobo(r.spendKobo)),
    },
    /*
      The figure that decides next year's budget. A channel with a good hire
      rate and a terrible cost per hire is still a bad channel.
    */
    {
      key: "perHire",
      header: "Per hire",
      sortable: true,
      align: "right",
      value: (r) => r.costPerHireKobo ?? -1,
      render: (r) =>
        r.costPerHireKobo === null ? (
          <span className="text-neutral-400">-</span>
        ) : (
          <span className="font-semibold text-neutral-900">{nairaFromKobo(r.costPerHireKobo)}</span>
        ),
    },
  ];

  type AgeingRole = RequisitionAgeing["roles"][number];
  const ageingColumns: Column<AgeingRole>[] = [
    {
      key: "role",
      header: "Role",
      primary: true,
      sortable: true,
      value: (r) => r.jobTitle,
      render: (r) => (
        <span>
          <span className="block font-semibold text-neutral-900">
            {r.reference} · {r.jobTitle}
          </span>
          {r.department && <span className="text-xs text-neutral-500">{r.department}</span>}
        </span>
      ),
    },
    /*
      A role open two months with nobody in the pipeline is a sourcing
      problem; the same role with eight candidates is a decision problem. They
      need different interventions.
    */
    {
      key: "signal",
      header: "Signal",
      value: (r) => (r.isSourcingProblem ? "Nobody in the pipeline" : ""),
      render: (r) =>
        r.isSourcingProblem ? <ToneChip tone="error">Nobody in the pipeline</ToneChip> : <span className="text-neutral-400">-</span>,
    },
    { key: "active", header: "Active", sortable: true, align: "right", value: (r) => r.activeApplications },
    {
      key: "days",
      header: "Open",
      sortable: true,
      align: "right",
      value: (r) => r.daysOpen,
      render: (r) => <span className="font-semibold tabular-nums text-neutral-900">{r.daysOpen}d</span>,
    },
  ];

  const durationColumns: Column<StageDuration>[] = [
    { key: "stage", header: "Stage", primary: true, sortable: true, value: (r) => r.stage },
    { key: "moves", header: "Moves", sortable: true, align: "right", value: (r) => r.moves },
    {
      key: "median",
      header: "Median",
      sortable: true,
      align: "right",
      value: (r) => r.medianDays,
      render: (r) => <span className="font-semibold text-neutral-900">{r.medianDays}d</span>,
    },
    { key: "mean", header: "Mean", sortable: true, align: "right", value: (r) => r.averageDays, render: (r) => `${r.averageDays}d` },
    {
      key: "slowest",
      header: "Slowest",
      sortable: true,
      align: "right",
      value: (r) => r.slowestDays,
      render: (r) => <span className="text-neutral-500">{r.slowestDays}d</span>,
    },
  ];

  const interviewerColumns: Column<InterviewerLoad>[] = [
    {
      key: "name",
      header: "Interviewer",
      primary: true,
      sortable: true,
      value: (r) => r.name ?? "",
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <PersonAvatar name={r.name ?? "Unnamed"} size={30} />
          <span className="font-semibold text-neutral-900">{r.name ?? "Unnamed"}</span>
        </span>
      ),
    },
    { key: "panels", header: "Panels", sortable: true, align: "right", value: (r) => r.interviews },
    {
      key: "outstanding",
      header: "Outstanding",
      sortable: true,
      align: "right",
      value: (r) => r.outstanding,
      render: (r) =>
        r.outstanding === 0 ? (
          <span className="text-neutral-400">-</span>
        ) : (
          <span className="font-semibold text-sun-700">{r.outstanding}</span>
        ),
    },
    {
      key: "turnaround",
      header: "Turnaround",
      sortable: true,
      align: "right",
      value: (r) => r.averageTurnaroundHours ?? -1,
      render: (r) => (r.averageTurnaroundHours === null ? "-" : `${r.averageTurnaroundHours}h`),
    },
    /*
      Not a performance measure, some people interview for the hardest roles,
      but an interviewer who has never said no is not screening, and one who has
      never said yes is not either.
    */
    {
      key: "positive",
      header: "Positive",
      sortable: true,
      align: "right",
      value: (r) => r.positiveRate ?? -1,
      render: (r) => (r.positiveRate === null ? "-" : `${r.positiveRate}%`),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Funnel"
          icon={TrendingDown}
          hue="blue"
          subtitle={`${data.funnel.total} applications${
            data.funnel.withdrawn > 0 ? ` · ${data.funnel.withdrawn} withdrew, counted separately` : ""
          }`}
        >
          {data.funnel.stages.length === 0 ? (
            <Empty
              icon={TrendingDown}
              title="Nothing to measure yet"
              hint="The funnel fills in as candidates move through the pipeline."
            />
          ) : (
            <ul className="space-y-4">
              {data.funnel.stages.map((stage, i) => {
                const hue = FUNNEL_HUES[i % FUNNEL_HUES.length];
                const width = data.funnel.total === 0 ? 0 : (stage.reached / data.funnel.total) * 100;
                return (
                  <li key={stage.name}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-neutral-900">{stage.name}</span>
                      <span className="text-sm tabular-nums text-neutral-700">
                        <span className="font-bold text-neutral-900">{stage.reached}</span>
                        {data.funnel.total > 0 && (
                          <span className="ml-2 text-xs text-neutral-500">{funnelShare(stage.reached, data.funnel.total)}</span>
                        )}
                      </span>
                    </div>
                    <div className="ws-hatch h-3 overflow-hidden rounded-full">
                      <div className={cx("h-full rounded-full", HUE[hue].bar)} style={{ width: `${width}%` }} />
                    </div>
                    {stage.averageDaysToReach !== null && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {stage.averageDaysToReach} days in the previous stage on average
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="How offers end"
          icon={FileSignature}
          hue="mint"
          subtitle="Whether your offers are competitive, and why not."
        >
          <SegmentedGauge
            value={data.offers.acceptanceRate ?? 0}
            hue="mint"
            size={210}
            label="Acceptance rate"
            display={data.offers.acceptanceRate === null ? "-" : `${data.offers.acceptanceRate}%`}
          />
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-mint-50 px-3 py-2 text-mint-700">
              <dt className="text-[11px] font-medium opacity-80">Offers decided</dt>
              <dd className="text-sm font-bold tabular-nums">{`${data.offers.accepted} of ${data.offers.decided}`}</dd>
            </div>
            <div className="rounded-xl bg-sky-50 px-3 py-2 text-sky-700">
              <dt className="text-[11px] font-medium opacity-80">Median days to answer</dt>
              <dd className="text-sm font-bold tabular-nums">
                {data.offers.medianDaysToRespond === null ? "-" : String(data.offers.medianDaysToRespond)}
              </dd>
            </div>
          </dl>
          {/*
            Offers the candidate never saw are out of the denominator: an offer
            withdrawn internally says nothing about how competitive we are.
          */}
          <p className="mt-3 text-xs text-neutral-500">
            Counted against offers the candidate actually saw. Ones withdrawn before they went out are excluded.
          </p>
          {data.offers.declineReasons.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
              {data.offers.declineReasons.map((row, index) => (
                <li key={index} className="text-xs">
                  <span className="font-semibold text-neutral-900">{row.candidateName ?? "A candidate"}</span>
                  <span className="text-neutral-500">
                    {" · "}
                    {nairaFromKobo(row.salaryKobo)}
                    {row.reason !== null ? ` · ${row.reason}` : " · no reason given"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section aria-labelledby="rec-sources">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="rec-sources" className="text-lg font-bold tracking-tight text-neutral-900">
              Where hires come from
            </h2>
            <p className="text-sm text-neutral-500">
              Volume and hires are different questions. A channel can be good at one and useless at the other.
            </p>
          </div>
        </div>
        {data.sources.length === 0 ? (
          <Card>
            <Empty icon={Users} title="No applications yet" hint="Source effectiveness needs candidates to measure." />
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Applications by source" icon={Megaphone} hue="sky">
              <Donut
                data={data.sources.map((s) => ({ label: s.label, value: s.applications, hue: hueFor(s.label) }))}
                centerLabel="applied"
                size={160}
                legend="below"
                caption="Applications by source"
              />
            </Panel>
            <div className="xl:col-span-2">
              <DataView
                rows={data.sources}
                columns={sourceColumns}
                rowKey={(r) => r.source}
                storageKey="hrm.recruitment.sources"
                caption="Where hires come from"
                searchable={false}
                gridCols={2}
                renderCard={(r) => (
                  <div className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={Megaphone} hue={hueFor(r.label)} size={38} />
                      <p className="text-[15px] font-semibold text-neutral-900">{r.label}</p>
                      {r.isPaid && <Chip hue="sun">paid</Chip>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-neutral-50 px-2 py-2">
                        <p className="text-[11px] text-neutral-500">Applied</p>
                        <p className="text-sm font-bold tabular-nums">{r.applications}</p>
                      </div>
                      <div className="rounded-xl bg-mint-50 px-2 py-2 text-mint-700">
                        <p className="text-[11px] opacity-80">Hired</p>
                        <p className="text-sm font-bold tabular-nums">{r.hires}</p>
                      </div>
                      <div className="rounded-xl bg-primary-50 px-2 py-2 text-primary-700">
                        <p className="text-[11px] opacity-80">Rate</p>
                        <p className="text-sm font-bold tabular-nums">{r.hireRate}%</p>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Per hire{" "}
                      <span className="font-semibold text-neutral-900">
                        {r.costPerHireKobo === null ? "-" : nairaFromKobo(r.costPerHireKobo)}
                      </span>
                    </p>
                  </div>
                )}
              />
            </div>
          </div>
        )}
      </section>

      {data.ageing.roles.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel
            title="How long roles have been open"
            icon={Timer}
            hue="sun"
            subtitle="Bands rather than an average: ninety days open is a different conversation from thirty."
          >
            <div className="pt-8">
              <ColumnChart
                height={180}
                highlight="none"
                caption="Open roles by how long they have been open"
                data={[
                  { label: "Under 30", value: data.ageing.bands.under30, hue: "mint" },
                  { label: "30-60", value: data.ageing.bands.from30to60, hue: "sky" },
                  { label: "60-90", value: data.ageing.bands.from60to90, hue: "sun" },
                  { label: "Over 90", value: data.ageing.bands.over90, hue: "coral" },
                ]}
                format={(v) => `${v} ${v === 1 ? "role" : "roles"}`}
              />
            </div>
          </Panel>
          <div className="xl:col-span-2">
            <DataView
              rows={data.ageing.roles.slice(0, 8)}
              columns={ageingColumns}
              rowKey={(r) => r.requisitionId}
              rowHref={(r) => `/suite/hrm/recruitment/${r.requisitionId}`}
              storageKey="hrm.recruitment.ageing"
              caption="Longest-open roles"
              searchable={false}
              gridCols={2}
              renderCard={(r) => (
                <div className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <IconTile icon={Briefcase} hue={r.isSourcingProblem ? "coral" : "sun"} size={38} />
                    <span className="text-2xl font-bold tabular-nums text-neutral-900">{r.daysOpen}d</span>
                  </div>
                  <p className="font-semibold text-neutral-900">
                    {r.reference} · {r.jobTitle}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Chip hue="slate">{r.activeApplications} active</Chip>
                    {r.isSourcingProblem && <ToneChip tone="error">Nobody in the pipeline</ToneChip>}
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {data.stageDurations.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel
            title="How long each stage holds people"
            icon={Hourglass}
            hue="grape"
            subtitle="Median days in each stage."
          >
            <div className="pt-8">
              <ColumnChart
                height={180}
                caption="Median days candidates spend in each stage"
                hue="grape"
                data={data.stageDurations.map((r) => ({ label: r.stage, value: r.medianDays }))}
                format={(v) => `${v} days`}
              />
            </div>
          </Panel>
          <div className="xl:col-span-2">
            <p className="mb-3 text-sm text-neutral-500">
              Median as well as mean: one candidate who sat over Christmas drags an average somewhere nobody
              recognises.
            </p>
            <DataView
              rows={data.stageDurations}
              columns={durationColumns}
              rowKey={(r) => r.stage}
              storageKey="hrm.recruitment.durations"
              caption="How long each stage holds people"
              searchable={false}
              gridCols={2}
            />
          </div>
        </div>
      )}

      {data.interviewers.length > 0 && (
        <section aria-labelledby="rec-interviewers">
          <h2 id="rec-interviewers" className="text-lg font-bold tracking-tight text-neutral-900">
            Who is doing the interviewing
          </h2>
          <p className="mb-3 text-sm text-neutral-500">
            One person carrying the panel is a bottleneck the moment they take leave, and scorecards that arrive a week
            late hold up every decision they touch.
          </p>
          <DataView
            rows={data.interviewers}
            columns={interviewerColumns}
            rowKey={(r) => r.employeeId}
            storageKey="hrm.recruitment.interviewers"
            caption="Who is doing the interviewing"
            searchPlaceholder="Search interviewers"
            renderCard={(r) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <PersonAvatar name={r.name ?? "Unnamed"} size={42} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-900">{r.name ?? "Unnamed"}</p>
                    <p className="text-xs text-neutral-500">{r.interviews} panels</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {r.outstanding > 0 && <Chip hue="sun">{r.outstanding} outstanding</Chip>}
                  <Chip hue="sky">{r.averageTurnaroundHours === null ? "-" : `${r.averageTurnaroundHours}h`} turnaround</Chip>
                  <Chip hue="mint">{r.positiveRate === null ? "-" : `${r.positiveRate}%`} positive</Chip>
                </div>
              </div>
            )}
          />
        </section>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Panel title="Time to fill" icon={Timer} hue="sky">
          <dl className="grid grid-cols-2 gap-2">
            <Row label="Roles filled" value={String(data.timeToFill.filled)} hue="slate" />
            <Row
              label="Median"
              value={data.timeToFill.medianDays === null ? "-" : `${data.timeToFill.medianDays} days`}
              hue="sky"
            />
            <Row
              label="Average"
              value={data.timeToFill.averageDays === null ? "-" : `${data.timeToFill.averageDays} days`}
              hue="slate"
            />
            <Row
              label="Slowest"
              value={data.timeToFill.slowestDays === null ? "-" : `${data.timeToFill.slowestDays} days`}
              hue="coral"
            />
          </dl>
          {/*
            One role that took eleven months drags an average somewhere nobody
            recognises. The median is the number a hiring manager's experience
            actually matches.
          */}
          <p className="mt-3 text-xs text-neutral-500">
            Measured from approval, not from the advert. The median is the more honest figure when one role has dragged.
          </p>
        </Panel>

        <Panel title="Cost per hire" icon={Banknote} hue="mint">
          <dl className="grid grid-cols-2 gap-2">
            <Row label="Advertising spend" value={nairaFromKobo(data.costPerHire.advertisingSpendKobo)} hue="slate" />
            <Row label="Hires" value={String(data.costPerHire.hires)} hue="slate" />
            <Row label="Per hire" value={nairaFromKobo(data.costPerHire.perHireKobo)} hue="mint" />
          </dl>
          {/* Says what it covers, so nobody quotes it as the cost of hiring. */}
          <p className="mt-3 text-xs text-neutral-500">{data.costPerHire.basis}</p>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, hue = "slate" }: { label: string; value: string; hue?: Hue }) {
  const tone: Record<string, string> = {
    slate: "bg-neutral-50 text-neutral-900",
    sky: "bg-sky-50 text-sky-700",
    mint: "bg-mint-50 text-mint-700",
    coral: "bg-coral-50 text-coral-700",
  };
  return (
    <div className={cx("rounded-xl px-3 py-2.5", tone[hue] ?? tone.slate)}>
      <dt className="text-[11px] font-medium opacity-80">{label}</dt>
      <dd className="text-sm font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
