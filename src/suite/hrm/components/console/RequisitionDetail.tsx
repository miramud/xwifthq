"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  FileSignature,
  Globe,
  Hourglass,
  MapPin,
  Megaphone,
  MessageSquare,
  Plus,
  Star,
  TrendingDown,
  UserRound,
  UserRoundSearch,
  Users,
  Wallet,
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
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import ApplicationPanel from "@/suite/hrm/components/console/ApplicationPanel";
import {
  ApiError,
  hrm,
  type BoardColumn,
  type CandidateSource,
  type Employee,
  type JobApplication,
  type JobPosting,
  type JobRequisition,
  type PipelineStage,
  type RecruitmentFunnel,
} from "@/lib/api/hrm-client";
import {
  applicationTone,
  formatDate,
  nairaFromKobo,
  requisitionTone,
  salaryBand,
  funnelShare,
} from "@/suite/hrm/lib/format";
import { INPUT } from "./Dialog";
import { FeaturedStat, IconTile, LoadError, ToneChip } from "../ui/recordKit";

/**
 * One role, and the people being considered for it.
 *
 * A page rather than a tab, so a hiring manager can be sent a link to their own
 * vacancy. The board is the working surface; the postings and the funnel sit
 * underneath it because they are read once and the board is read all day.
 */

const KIND_LOOK: Record<string, { hue: Hue; icon: LucideIcon }> = {
  screening: { hue: "sky", icon: UserRoundSearch },
  interview: { hue: "grape", icon: MessageSquare },
  assessment: { hue: "sun", icon: ClipboardList },
  offer: { hue: "mint", icon: FileSignature },
};

function kindLook(kind: string) {
  return KIND_LOOK[kind] ?? { hue: "slate" as Hue, icon: Workflow };
}

export default function RequisitionDetail({ requisitionId }: { requisitionId: string }) {
  const [requisition, setRequisition] = useState<JobRequisition | null>(null);
  const [board, setBoard] = useState<BoardColumn[]>([]);
  const [funnel, setFunnel] = useState<RecruitmentFunnel | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [colleagues, setColleagues] = useState<Employee[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      hrm.recruitment
        .requisition(requisitionId)
        .then((res) => {
          setRequisition(res.data);
          setBoard(res.meta.board);
          setFunnel(res.meta.funnel);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [requisitionId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Promise.all([hrm.recruitment.stages(), hrm.employees.list({ perPage: 100 })])
      .then(([pipelineStages, staff]) => {
        setStages(pipelineStages);
        setColleagues(staff.data);
      })
      .catch(() => {
        // Both are pickers. Failing to load them should not stop the board
        // itself from being readable.
      });
  }, []);

  const totals = useMemo(
    () => ({
      active: board.reduce((sum, column) => sum + column.count, 0),
      stale: board.reduce((sum, column) => sum + column.stale, 0),
    }),
    [board],
  );

  const back = (
    <Link
      href="/suite/hrm/recruitment"
      className="inline-flex items-center gap-1.5 normal-case tracking-normal hover:text-primary-700"
    >
      <ArrowLeft size={14} aria-hidden />
      All roles
    </Link>
  );

  if (error !== null && requisition === null) {
    return (
      <div>
        <PageHeader eyebrow={back} title="Role" />
        <LoadError title="Could not load this role" message={error} />
      </div>
    );
  }

  if (requisition === null) {
    return <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />;
  }

  const spend = (requisition.postings ?? []).reduce((s, p) => s + p.costKobo, 0);

  return (
    <div>
      <PageHeader
        eyebrow={back}
        title={`${requisition.reference} · ${requisition.jobTitle}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2 pt-1">
            <ToneChip tone={requisitionTone(requisition.status)}>{requisition.statusLabel}</ToneChip>
            <Chip hue={hueFor(requisition.department ?? "none")} icon={Building2}>
              {requisition.department ?? "No department"}
            </Chip>
            {requisition.location !== null && (
              <Chip hue="slate" icon={MapPin}>
                {requisition.location}
              </Chip>
            )}
            <Chip hue="mint" icon={Wallet}>
              {salaryBand(requisition.salaryMinKobo, requisition.salaryMaxKobo)}
            </Chip>
            {requisition.hiringManager?.name !== undefined && (
              <Chip hue="grape" icon={UserRound}>
                {requisition.hiringManager?.name}
              </Chip>
            )}
          </span>
        }
        actions={
          <>
            <Button icon={Megaphone} onClick={() => setAdvertising(true)} disabled={!requisition.canAdvertise}>
              Advertise
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)} disabled={!requisition.isOpen}>
              Add a candidate
            </Button>
          </>
        }
      />

      {error !== null && (
        <p role="alert" className="mb-4 rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
          {error}
        </p>
      )}

      <div className="space-y-6">
        <StatGrid>
          <FeaturedStat
            icon={Users}
            label="In the pipeline"
            value={totals.active}
            hint={`${requisition.headcount} to hire`}
          />
          <StatCard
            icon={Hourglass}
            hue={totals.stale > 0 ? "sun" : "mint"}
            label="Waiting too long"
            value={totals.stale}
            hint={totals.stale > 0 ? "Past the stage's chase threshold" : "Everybody is moving"}
          />
          <StatCard
            icon={CalendarDays}
            hue="sky"
            label="Days open"
            value={requisition.daysOpen === null ? "-" : requisition.daysOpen}
            hint="From approval"
          />
          <StatCard
            icon={Megaphone}
            hue="grape"
            label="Advertising spend"
            value={nairaFromKobo(spend)}
            hint={`${(requisition.postings ?? []).length} postings`}
          />
        </StatGrid>

        {/* ------------------------------ board ------------------------- */}

        <section aria-labelledby="pipeline-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="pipeline-heading" className="text-lg font-bold tracking-tight text-neutral-900">
                Pipeline
              </h2>
              <p className="text-sm text-neutral-500">Open a card to move, interview or make an offer.</p>
            </div>
          </div>

          {board.length === 0 ? (
            <Card>
              <Empty icon={Users} title="No pipeline" hint="Set up stages before working candidates." />
            </Card>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1 pb-2">
              <div className="flex gap-4">
                {board.map((column) => {
                  const look = kindLook(column.kind);
                  return (
                    <section
                      key={column.stageId}
                      aria-label={`${column.name}, ${column.count}`}
                      className="flex w-72 shrink-0 flex-col rounded-[1.125rem] bg-neutral-100/70 p-3"
                    >
                      <header className="mb-3 flex items-center gap-2 px-1">
                        <IconTile icon={look.icon} hue={look.hue} size={28} />
                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">{column.name}</h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-600 shadow-sm">
                          {column.count}
                        </span>
                      </header>

                      {column.stale > 0 && (
                        <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-sun-50 px-2.5 py-1.5 text-xs font-medium text-sun-700">
                          <AlarmClock size={13} aria-hidden />
                          {column.stale} waiting too long
                        </p>
                      )}

                      <ul className="space-y-2.5">
                        {column.applications.map((application) => (
                          <li key={application.id}>
                            <CandidateCard application={application} onOpen={() => setOpen(application.id)} />
                          </li>
                        ))}

                        {column.applications.length === 0 && (
                          <li className="rounded-xl border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">
                            Nobody here
                          </li>
                        )}
                      </ul>

                      {requisition.isOpen && (
                        <button
                          type="button"
                          onClick={() => setAdding(true)}
                          className="mt-2.5 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 text-xs font-semibold text-neutral-500 transition-colors hover:border-primary-300 hover:bg-white hover:text-primary-700"
                        >
                          <Plus size={14} aria-hidden />
                          Add a candidate
                        </button>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Postings requisition={requisition} onAdvertise={() => setAdvertising(true)} onChanged={load} />
          </div>

          {funnel !== null && funnel.stages.length > 0 && (
            <Panel
              title="How this role's funnel looks"
              icon={TrendingDown}
              hue="blue"
              subtitle={`${funnel.total} applications${funnel.withdrawn > 0 ? ` · ${funnel.withdrawn} withdrew` : ""}`}
            >
              <ul className="space-y-3.5">
                {funnel.stages.map((stage) => {
                  const hue = kindLook(stage.kind).hue;
                  const width = funnel.total === 0 ? 0 : (stage.reached / funnel.total) * 100;
                  return (
                    <li key={stage.name}>
                      <div className="mb-1 flex items-center gap-3">
                        <span className="flex-1 truncate text-sm font-medium text-neutral-700">{stage.name}</span>
                        {funnel.total > 0 && (
                          <span className="text-xs text-neutral-500">{funnelShare(stage.reached, funnel.total)}</span>
                        )}
                        <span className="text-sm font-bold tabular-nums text-neutral-900">{stage.reached}</span>
                      </div>
                      <div className="ws-hatch h-2.5 overflow-hidden rounded-full">
                        <div className={cx("h-full rounded-full", HUE[hue].bar)} style={{ width: `${width}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      {open !== null && (
        <ApplicationPanel
          applicationId={open}
          stages={stages}
          colleagues={colleagues}
          onClose={() => setOpen(null)}
          onChanged={() => void load()}
        />
      )}

      {adding && (
        <AddCandidateDialog
          requisitionId={requisitionId}
          postings={requisition.postings ?? []}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void load();
          }}
        />
      )}

      {advertising && (
        <AdvertiseDialog
          requisitionId={requisitionId}
          defaultTitle={requisition.jobTitle}
          onClose={() => setAdvertising(false)}
          onAdvertised={() => {
            setAdvertising(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** A candidate on the board: who, where they are now, how long they have sat, and where they came from. */
function CandidateCard({ application, onOpen }: { application: JobApplication; onOpen: () => void }) {
  const name = application.candidate?.name ?? "Unnamed";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "ws-card block w-full cursor-pointer p-3.5 text-left transition-shadow outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300",
        application.isStale && "!border-sun-400",
      )}
    >
      <div className="flex items-start gap-2.5">
        <PersonAvatar name={name} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          <p className="truncate text-xs text-neutral-500">{application.candidate?.currentTitle ?? "-"}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ToneChip tone={applicationTone(application.status)}>{application.sourceLabel}</ToneChip>
        {application.rating !== null && (
          <Chip hue="sun" icon={Star}>
            {application.rating}
          </Chip>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-xs text-neutral-500">
        <span className={cx("inline-flex items-center gap-1", application.isStale && "font-semibold text-sun-700")}>
          <Clock size={12} aria-hidden />
          {application.daysInStage}d
          {application.isStale && <span className="sr-only">, waiting too long</span>}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} aria-hidden />
          {formatDate(application.appliedAt)}
        </span>
      </div>
    </button>
  );
}

function Postings({
  requisition,
  onAdvertise,
  onChanged,
}: {
  requisition: JobRequisition;
  onAdvertise: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const postings = requisition.postings ?? [];

  const toggle = async (posting: JobPosting) => {
    setBusy(posting.id);

    try {
      await hrm.recruitment.updatePosting(
        posting.id,
        posting.isPublished ? "unpublish" : "publish",
      );
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  /*
    Published and open are different things: a posting past its closing date
    is still published and no longer taking anybody.
  */
  const state = (posting: JobPosting) => (
    <ToneChip tone={posting.isOpen ? "success" : "neutral"}>
      {posting.isPublished ? (posting.isOpen ? "Live" : "Closed") : "Draft"}
    </ToneChip>
  );

  const toggleButton = (posting: JobPosting) => (
    <button
      type="button"
      onClick={() => void toggle(posting)}
      disabled={busy === posting.id}
      className={buttonClass("secondary", "sm")}
    >
      {posting.isPublished ? "Take down" : "Publish"}
    </button>
  );

  const columns: Column<JobPosting>[] = [
    {
      key: "channel",
      header: "Where",
      primary: true,
      sortable: true,
      value: (p) => p.channel ?? p.title,
      render: (p) => (
        <span className="flex items-center gap-3">
          <IconTile icon={Globe} hue={hueFor(p.channel ?? p.title)} size={34} />
          <span className="font-semibold text-neutral-900">{p.channel ?? p.title}</span>
        </span>
      ),
    },
    {
      key: "cost",
      header: "Cost",
      sortable: true,
      align: "right",
      value: (p) => p.costKobo,
      render: (p) => nairaFromKobo(p.costKobo),
    },
    {
      key: "closes",
      header: "Closes",
      sortable: true,
      hideOnMobile: true,
      value: (p) => p.closesOn ?? "",
      render: (p) => (p.closesOn !== null ? formatDate(p.closesOn) : "-"),
    },
    { key: "state", header: "Status", render: (p) => state(p) },
    { key: "toggle", header: "", tableOnly: true, align: "right", render: (p) => toggleButton(p) },
  ];

  return (
    <section aria-labelledby="postings-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="postings-heading" className="text-lg font-bold tracking-tight text-neutral-900">
            Where it is advertised
          </h2>
          <p className="max-w-xl text-sm text-neutral-500">
            Each advert carries its own cost, so cost per hire is attributable to the channel that produced the
            candidate.
          </p>
        </div>
        <Button size="sm" icon={Megaphone} onClick={onAdvertise} disabled={!requisition.canAdvertise}>
          Advertise
        </Button>
      </div>

      {!requisition.canAdvertise && postings.length === 0 ? (
        <Card>
          <Empty
            icon={Megaphone}
            hue="sun"
            title="Not approved yet"
            hint="A role has to be approved before it can be advertised. Otherwise you end up with a candidate you cannot make an offer to."
          />
        </Card>
      ) : (
        <DataView
          rows={postings}
          columns={columns}
          rowKey={(p) => p.id}
          storageKey="hrm.recruitment.postings"
          caption="Where this role is advertised"
          searchable={false}
          gridCols={2}
          empty={<Empty icon={Megaphone} title="Not advertised anywhere" hint="Add an advert and record what it cost." />}
          renderCard={(p) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <IconTile icon={Globe} hue={hueFor(p.channel ?? p.title)} size={40} />
                {state(p)}
              </div>
              <div>
                <p className="font-semibold text-neutral-900">{p.channel ?? p.title}</p>
                <p className="text-sm text-neutral-500">
                  {nairaFromKobo(p.costKobo)}
                  {p.closesOn !== null ? ` · closes ${formatDate(p.closesOn)}` : ""}
                </p>
              </div>
              <div className="mt-auto border-t border-neutral-100 pt-3">{toggleButton(p)}</div>
            </div>
          )}
          renderListItem={(p) => (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3">
              <IconTile icon={Globe} hue={hueFor(p.channel ?? p.title)} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{p.channel ?? p.title}</p>
                <p className="truncate text-xs text-neutral-500">
                  {nairaFromKobo(p.costKobo)}
                  {p.closesOn !== null ? ` · closes ${formatDate(p.closesOn)}` : ""}
                </p>
              </div>
              {state(p)}
              {toggleButton(p)}
            </div>
          )}
        />
      )}
    </section>
  );
}

const SOURCES: { value: CandidateSource; label: string }[] = [
  { value: "career_site", label: "Career site" },
  { value: "referral", label: "Referral" },
  { value: "job_board", label: "Job board" },
  { value: "agency", label: "Agency" },
  { value: "social_media", label: "Social media" },
  { value: "internal", label: "Internal" },
  { value: "outreach", label: "Outreach" },
  { value: "other", label: "Other" },
];

function AddCandidateDialog({
  requisitionId,
  postings,
  onClose,
  onAdded,
}: {
  requisitionId: string;
  postings: JobPosting[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [source, setSource] = useState<CandidateSource>("career_site");
  const [postingId, setPostingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.recruitment.apply(requisitionId, {
        name: name.trim(),
        email: email.trim(),
        currentTitle: currentTitle.trim() === "" ? undefined : currentTitle.trim(),
        source,
        postingId: postingId === "" ? null : postingId,
      });

      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label="Add a candidate" onClose={onClose} onSubmit={submit}>
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={INPUT}
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={INPUT}
        />
        {/*
          Matching on the address is what makes a returning candidate one
          person rather than two — and what surfaces that they were turned
          down for something similar last year.
        */}
        <p className="mt-1 text-xs text-neutral-500">
          If they have applied before, this links to the same person.
        </p>
      </Field>

      <Field label="Current role (optional)">
        <input
          type="text"
          value={currentTitle}
          onChange={(e) => setCurrentTitle(e.target.value)}
          className={INPUT}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="How they found us">
          <SearchableSelect
            value={source}
            onChange={(v) => setSource(v as CandidateSource)}
            options={SOURCES.map((s) => ({ value: s.value, label: s.label }))}
          />
        </Field>

        {postings.length > 0 && (
          <Field label="Through which advert">
            <SearchableSelect
              value={postingId}
              onChange={setPostingId}
              options={[
                { value: "", label: "Not through an advert" },
                ...postings.map((posting) => ({
                  value: posting.id,
                  label: posting.channel ?? posting.title,
                })),
              ]}
            />
          </Field>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
          {error}
        </p>
      )}

      <Actions busy={busy} onClose={onClose} label="Add" />
    </Dialog>
  );
}

function AdvertiseDialog({
  requisitionId,
  defaultTitle,
  onClose,
  onAdvertised,
}: {
  requisitionId: string;
  defaultTitle: string;
  onClose: () => void;
  onAdvertised: () => void;
}) {
  const [channel, setChannel] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [cost, setCost] = useState("0");
  const [closesOn, setClosesOn] = useState("");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.recruitment.advertise(requisitionId, {
        title: title.trim() === "" ? undefined : title.trim(),
        channel: channel.trim() === "" ? undefined : channel.trim(),
        costKobo: Math.round(Number(cost || 0) * 100),
        closesOn: closesOn === "" ? null : closesOn,
        publish,
      });

      onAdvertised();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label="Advertise this role" onClose={onClose} onSubmit={submit}>
      <Field label="Where">
        <input
          type="text"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="Careers page, Jobberman, LinkedIn…"
          required
          className={INPUT}
        />
      </Field>

      <Field label="Advert title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={INPUT}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What it cost (₦)">
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            min={0}
            className={INPUT}
          />
        </Field>
        <Field label="Closes on (optional)">
          <input
            type="date"
            value={closesOn}
            onChange={(e) => setClosesOn(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      {/*
        The cost is what makes cost-per-hire answerable at all, and it is only
        ever entered here. Worth saying so rather than leaving a zero.
      */}
      <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs text-sky-700">
        Recording the cost is what lets the analytics say which channel actually
        pays for itself.
      </p>

      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
        />
        Publish straight away
      </label>

      {error !== null && (
        <p role="alert" className="rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
          {error}
        </p>
      )}

      <Actions busy={busy} onClose={onClose} label="Advertise" />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function Dialog({
  label,
  onClose,
  onSubmit,
  children,
}: {
  label: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
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
        aria-label={label}
        className="relative z-10 w-full max-w-md space-y-4 rounded-[1.25rem] bg-white p-6 shadow-2xl shadow-neutral-900/10"
      >
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">{label}</h2>
        {children}
      </form>
    </div>
  );
}

function Actions({
  busy,
  onClose,
  label,
}: {
  busy: boolean;
  onClose: () => void;
  label: string;
}) {
  return (
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
        {busy ? "Saving…" : label}
      </button>
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
      <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Used by the candidate page to link back to a role. */
export function RoleLink({ id, label }: { id: string; label: string }) {
  return (
    <Link
      href={`/suite/hrm/recruitment/${id}`}
      className="font-medium text-primary-700 hover:underline"
    >
      {label}
    </Link>
  );
}
