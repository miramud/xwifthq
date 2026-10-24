"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Clock,
  EyeOff,
  MapPin,
  MessageSquare,
  PenLine,
  Users,
} from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { DateLeaf, LoadFailed, Notice, PageSkeleton, ToneChip, labelCls } from "@/suite/hrm/components/ui2/kit";
import { DecorAvatar, SectionHead } from "@/suite/hrm/components/ui2/me-kit";
import {
  ApiError,
  hrm,
  type Interview,
  type InterviewScorecard,
  type PanelView,
  type ScorecardVerdict,
} from "@/lib/api/hrm-client";
import { formatDate, verdictTone } from "@/suite/hrm/lib/format";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

/**
 * Interviews I am on, and writing up what I thought.
 *
 * The screen exists to make one rule visible rather than mysterious: **until I
 * submit my own verdict, I cannot see anybody else's.** The first person to
 * write anything anchors everybody who reads it, and a panel that has read each
 * other's notes is one opinion wearing four names.
 *
 * So the hidden state is explained rather than shown as an empty list, an
 * empty list reads as nobody else having bothered, which is a different and
 * discouraging message.
 */
export default function MyInterviews() {
  const [interviews, setInterviews] = useState<Interview[] | null>(null);
  const [awaiting, setAwaiting] = useState(0);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      hrm.me
        .interviews()
        .then((res) => {
          setInterviews(res.data);
          setAwaiting(res.meta.awaitingMyScorecard);
          setSubmitted(res.meta.submittedInterviewIds);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const subtitle =
    awaiting > 0
      ? `${awaiting} still waiting on your write-up`
      : "Everything you have sat on is written up";

  if (error !== null && interviews === null) {
    return (
      <div>
        <PageHeader eyebrow="My employment" title="My interviews" />
        <LoadFailed icon={CalendarClock} title="Could not load your interviews" message={error} />
      </div>
    );
  }

  if (interviews === null) {
    return <PageSkeleton stats={3} />;
  }

  const toggle = (id: string) => setOpen(open === id ? null : id);

  const state = (interview: Interview) =>
    submitted.includes(interview.id) ? (
      <ToneChip tone="success" dot>
        Written up
      </ToneChip>
    ) : interview.status === "completed" ? (
      <ToneChip tone="warning" dot>
        Needs your verdict
      </ToneChip>
    ) : (
      <ToneChip tone="neutral" dot>
        {interview.statusLabel}
      </ToneChip>
    );

  const openButton = (interview: Interview) => (
    <Button
      size="sm"
      variant={open === interview.id ? "ghost" : "secondary"}
      onClick={() => toggle(interview.id)}
      aria-expanded={open === interview.id}
    >
      {open === interview.id ? "Close" : "Open"}
    </Button>
  );

  const candidate = (interview: Interview) => (
    <span className="flex items-center gap-3">
      <DecorAvatar name={interview.candidate?.name ?? "Candidate"} size={34} />
      <button
        type="button"
        onClick={() => toggle(interview.id)}
        className="block cursor-pointer truncate text-left text-sm font-semibold text-neutral-900 hover:text-primary-700"
      >
        {interview.candidate?.name ?? "Candidate"}
      </button>
    </span>
  );

  const columns: Column<Interview>[] = [
    {
      key: "candidate",
      header: "Candidate",
      primary: true,
      sortable: true,
      value: (i) => i.candidate?.name ?? "Candidate",
      render: candidate,
    },
    { key: "kind", header: "Kind", sortable: true, value: (i) => i.kindLabel },
    { key: "when", header: "When", sortable: true, value: (i) => i.scheduledAt, render: (i) => formatDate(i.scheduledAt) },
    { key: "length", header: "Length", align: "right", value: (i) => i.durationMinutes, render: (i) => `${i.durationMinutes} min` },
    { key: "where", header: "Where", value: (i) => i.location, hideOnMobile: true },
    { key: "state", header: "Your write-up", render: state, value: (i) => (submitted.includes(i.id) ? "Written up" : i.statusLabel) },
    { key: "actions", header: "", align: "right", tableOnly: true, render: openButton },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="My employment" title="My interviews" subtitle={subtitle} />

      <StatGrid cols={3}>
        <StatCard featured icon={CalendarClock} label="Interviews you sit on" value={interviews.length} />
        <StatCard icon={PenLine} hue={awaiting > 0 ? "sun" : "slate"} label="Awaiting your write-up" value={awaiting} />
        <StatCard icon={CalendarCheck} hue="mint" label="Verdicts in" value={submitted.length} />
      </StatGrid>

      <section aria-labelledby="interviews-heading">
        <SectionHead id="interviews-heading" title="Your interviews" subtitle="Open one to read the brief and write up your verdict" />
        {interviews.length === 0 ? (
          <Card>
            <Empty
              icon={CalendarClock}
              title="You are not on any panels"
              hint="Interviews you are asked to sit on appear here."
            />
          </Card>
        ) : (
          <DataView<Interview>
            rows={interviews}
            rowKey={(i) => i.id}
            columns={columns}
            storageKey="hrm.me.interviews"
            caption="Interviews you are on"
            searchPlaceholder="Search candidates"
            renderCard={(i) => (
              <div className={cx("flex h-full flex-col gap-3 p-5", open === i.id && "bg-primary-50/40")}>
                <div className="flex items-start justify-between gap-3">
                  <DateLeaf date={i.scheduledAt ?? ""} hue="blue" />
                  {state(i)}
                </div>
                <div>
                  {candidate(i)}
                  <p className="mt-1 text-xs text-neutral-500">{i.kindLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2 py-1">
                    <Clock size={12} aria-hidden />
                    {formatDate(i.scheduledAt)} · {i.durationMinutes} min
                  </span>
                  {i.location && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2 py-1">
                      <MapPin size={12} aria-hidden />
                      {i.location}
                    </span>
                  )}
                </div>
                <div className="mt-auto">{openButton(i)}</div>
              </div>
            )}
            renderListItem={(i) => (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  {candidate(i)}
                  <p className="mt-0.5 truncate pl-[46px] text-xs text-neutral-500">
                    {i.kindLabel} · {formatDate(i.scheduledAt)} · {i.durationMinutes} min
                    {i.location ? ` · ${i.location}` : ""}
                  </p>
                </div>
                {state(i)}
                {openButton(i)}
              </div>
            )}
          />
        )}
      </section>

      {open !== null && (
        <InterviewDetail
          interviewId={open}
          onChanged={() => {
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function InterviewDetail({
  interviewId,
  onChanged,
}: {
  interviewId: string;
  onChanged: () => void;
}) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [mine, setMine] = useState<InterviewScorecard | null>(null);
  const [panel, setPanel] = useState<PanelView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      hrm.me
        .interview(interviewId)
        .then((res) => {
          setInterview(res.data);
          setMine(res.meta.mine);
          setPanel(res.meta.panel);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [interviewId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return <LoadFailed icon={CalendarClock} title="That did not load" message={error} />;
  }

  if (interview === null || panel === null) {
    return <PageSkeleton stats={0} />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
      {mine?.isSubmitted === true ? (
        <SubmittedCard scorecard={mine} />
      ) : (
        <ScorecardForm
          interviewId={interviewId}
          existing={mine}
          onSaved={() => {
            void load();
            onChanged();
          }}
        />
      )}

      <PanelCard panel={panel} />
      </div>

      <div className="space-y-6">
        <Panel
          title={interview.candidate?.name ?? "Candidate"}
          subtitle={`${interview.kindLabel} · ${formatDate(interview.scheduledAt)} · ${interview.durationMinutes} min`}
          icon={CalendarClock}
          hue="blue"
        >
          {interview.agenda !== null ? (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">What to cover</p>
              <RichTextView value={interview.agenda} size="sm" className="rounded-xl bg-neutral-50 p-3 text-neutral-700" />
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No brief was written for this one.</p>
          )}
        </Panel>

        {interview.panel !== undefined && interview.panel.length > 1 && (
          <Panel title="Who else is on this" icon={Users} hue="grape" bodyClassName="px-5 pb-4 pt-3">
            <ul className="divide-y divide-neutral-100">
              {interview.panel.map((member) => (
                <li key={member.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <DecorAvatar name={member.name ?? "Unnamed"} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-neutral-900">{member.name ?? "Unnamed"}</span>
                    {/*
                      A panel where everybody covers everything is a panel that
                      agrees with itself, so what each person is there to assess is
                      worth showing.
                    */}
                    {member.focus !== null && (
                      <span className="block truncate text-xs text-neutral-500">{member.focus}</span>
                    )}
                  </span>
                  {member.isLead && <Chip hue="blue">Lead</Chip>}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

function SubmittedCard({ scorecard }: { scorecard: InterviewScorecard }) {
  return (
    <Panel
      title="Your verdict"
      subtitle="Submitted and locked, so it cannot be changed after the panel convenes."
      icon={ClipboardList}
      hue="mint"
    >
      <div className="space-y-4">
        <ToneChip tone={verdictTone(scorecard.verdict)}>{scorecard.verdictLabel}</ToneChip>

        <div className="grid gap-3 sm:grid-cols-2">
          {scorecard.strengths !== null && (
            <div className="rounded-xl border border-mint-100 bg-mint-50 p-3">
              <p className="text-xs font-bold text-mint-700">Strengths</p>
              <RichTextView value={scorecard.strengths} size="sm" className="mt-1 text-neutral-700" />
            </div>
          )}

          {scorecard.concerns !== null && (
            <div className="rounded-xl border border-coral-100 bg-coral-50 p-3">
              <p className="text-xs font-bold text-coral-700">Concerns</p>
              <RichTextView value={scorecard.concerns} size="sm" className="mt-1 text-neutral-700" />
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

const VERDICT_ON: Record<ScorecardVerdict, string> = {
  strong_yes: "border-mint-500 bg-mint-50",
  yes: "border-mint-500 bg-mint-50/60",
  no: "border-coral-500 bg-coral-50/60",
  strong_no: "border-coral-500 bg-coral-50",
};

const VERDICTS: { value: ScorecardVerdict; label: string; hint: string }[] = [
  { value: "strong_yes", label: "Strong yes", hint: "Would fight to hire." },
  { value: "yes", label: "Yes", hint: "Would hire." },
  { value: "no", label: "No", hint: "Would not hire." },
  { value: "strong_no", label: "Strong no", hint: "Would object to hiring." },
];

function ScorecardForm({
  interviewId,
  existing,
  onSaved,
}: {
  interviewId: string;
  existing: InterviewScorecard | null;
  onSaved: () => void;
}) {
  const [verdict, setVerdict] = useState<ScorecardVerdict | null>(
    existing?.verdict ?? null,
  );
  const [strengths, setStrengths] = useState(existing?.strengths ?? "");
  const [concerns, setConcerns] = useState(existing?.concerns ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (draft: boolean) => {
    if (verdict === null) {
      setError("Pick a verdict. There is deliberately no middle option.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await hrm.me.submitScorecard(interviewId, {
        verdict,
        strengths: strengths.trim() === "" ? undefined : strengths.trim(),
        concerns: concerns.trim() === "" ? undefined : concerns.trim(),
        draft,
      });

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Your verdict"
      subtitle="Write this before you talk to anybody else about the candidate."
      icon={PenLine}
      hue="blue"
    >
      <div className="space-y-5">
        <div>
          <span className={labelCls}>Would you hire them?</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {VERDICTS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={verdict === option.value}
                onClick={() => setVerdict(option.value)}
                className={cx(
                  "cursor-pointer rounded-xl border-2 px-3.5 py-2.5 text-left transition-colors",
                  verdict === option.value
                    ? VERDICT_ON[option.value]
                    : "border-neutral-200 bg-white hover:bg-neutral-50",
                )}
              >
                <span className="block text-sm font-semibold text-neutral-900">
                  {option.label}
                </span>
                <span className="block text-xs text-neutral-500">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
          {/*
            No neutral option, and the form says why rather than leaving
            somebody hunting for one.
          */}
          <p className="mt-2 text-xs text-neutral-500">
            There is no middle option on purpose: a panel of maybes produces a
            decision nobody made.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Strengths</span>
            <RichTextEditor minHeight={128} value={strengths} onChange={setStrengths} />
          </label>

          <label className="block">
            <span className={labelCls}>Concerns</span>
            <RichTextEditor minHeight={128} value={concerns} onChange={setConcerns} />
          </label>
        </div>

        {error !== null && <Notice tone="error">{error}</Notice>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <p className="text-xs text-neutral-500">
            A draft stays private and can be changed. Submitting is final.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save(true)} disabled={busy}>
              Save draft
            </Button>
            <Button variant="primary" onClick={() => void save(false)} disabled={busy}>
              {busy ? "Saving…" : "Submit"}
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PanelCard({ panel }: { panel: PanelView }) {
  if (!panel.visible) {
    return (
      <Panel title="What the others said" icon={EyeOff} hue="slate">
        <Empty
          icon={EyeOff}
          hue="slate"
          title="Hidden until you submit yours"
          hint="Reading the others first would shape your own. Write yours up and this opens."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="What the others said"
      subtitle={
        panel.outstanding > 0
          ? `${panel.outstanding} still to write up`
          : "Everybody has written theirs up"
      }
      icon={MessageSquare}
      hue="grape"
      bodyClassName="px-5 pb-4 pt-3"
    >
      {panel.scorecards.length === 0 ? (
        <Empty
          icon={MessageSquare}
          hue="grape"
          title="Nobody else has submitted yet"
          hint="Their verdicts appear here as they write them up."
        />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {panel.scorecards.map((card) => (
            <li key={card.id} className="space-y-2 py-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <DecorAvatar name={card.interviewer?.name ?? "An interviewer"} size={32} />
                <span className="flex-1 truncate text-sm font-semibold text-neutral-900">
                  {card.interviewer?.name ?? "An interviewer"}
                </span>
                <ToneChip tone={verdictTone(card.verdict)}>{card.verdictLabel}</ToneChip>
              </div>

              {card.strengths !== null && (
                <p className="pl-11 text-xs text-neutral-600">
                  <span className="font-semibold text-mint-700">Strengths:</span>{" "}
                  {richExcerpt(card.strengths, 200)}
                </p>
              )}

              {card.concerns !== null && (
                <p className="pl-11 text-xs text-neutral-600">
                  <span className="font-semibold text-coral-700">Concerns:</span> {richExcerpt(card.concerns, 200)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
