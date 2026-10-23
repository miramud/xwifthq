"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  EyeOff,
  Gavel,
  FileText,
  Megaphone,
  Scale,
  ShieldCheck,
  ShieldQuestion,
  Undo2,
} from "lucide-react";
import { ApiError, hrm, type MyCase } from "@/lib/api/hrm-client";
import {
  Button,
  Card,
  Empty,
  PageHeader,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import {
  LoadFailed,
  ModalFrame,
  Notice,
  PageSkeleton,
  ToneChip,
  hintCls,
  inputCls,
  labelCls,
} from "@/suite/hrm/components/ui2/kit";
import { SectionHead } from "@/suite/hrm/components/ui2/me-kit";
import { formatDate } from "@/suite/hrm/lib/format";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * Somebody's own disciplinaries and grievances.
 *
 * This screen exists because the module could describe a grievance process it
 * gave nobody a way to start. Every case route sits behind `access:hrm` and
 * HR's permission keys, so raising a grievance meant asking HR to file it
 * for you — which routes the confidential complaint through the function a
 * grievance is most often *about*.
 *
 * Two things it is careful with.
 *
 * **It never shows somebody a case they are only the subject of.** Being
 * complained about does not entitle you to read the complaint before the
 * institution decides to put it to you. The API decides that; this screen
 * simply renders what comes back rather than asking for more.
 *
 * **Anonymity is offered plainly, not buried.** A worker reporting an unsafe
 * rota run by their own manager needs it, and a form that makes it look like
 * an unusual request gets no report at all.
 */
export default function MyCases() {
  const [cases, setCases] = useState<MyCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);
  const [appealing, setAppealing] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await hrm.myCases.list();

      setCases(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not load.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    hrm.myCases
      .list()
      .then((result) => {
        if (!cancelled) setCases(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const header = (actions?: React.ReactNode) => (
    <PageHeader
      eyebrow="My employment"
      title="My cases"
      subtitle="Anything you have raised, and anything raised about you that you have been told of."
      actions={actions}
    />
  );

  if (error !== null && cases === null) {
    return (
      <div>
        {header()}
        <LoadFailed
          icon={AlertTriangle}
          title="That did not load"
          message={error}
        />
      </div>
    );
  }

  if (cases === null) {
    return <PageSkeleton stats={3} />;
  }

  const appealingCase = cases.find((c) => c.id === appealing) ?? null;
  const openCount = cases.filter((c) => c.outcomeLabel === null).length;
  const liveWarnings = cases.filter((c) => c.hasLiveWarning).length;

  return (
    <div className="space-y-6">
      {header(
        <Button
          variant="primary"
          icon={Megaphone}
          onClick={() => setRaising(true)}
        >
          Raise a grievance
        </Button>,
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/*
          Where it goes, said first: the fear that stops a grievance being
          raised is that it lands on the manager it is about.
        */}
        <div className="relative overflow-hidden rounded-[1.125rem] border border-grape-100 bg-grape-50 p-5 lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-grape-700 shadow-sm">
              <ShieldCheck size={20} aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-grape-700">
                Something about your work, your treatment or your workplace that
                needs looking at?
              </p>
              <p className="mt-1.5 text-sm text-neutral-700">
                It goes to HR, not to your manager. You can leave your name off
                if you would rather. A grievance about the way a team is run
                should not depend on being willing to sign it.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-[1.125rem] border border-sky-100 bg-sky-50 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm">
            <EyeOff size={20} aria-hidden />
          </span>
          <p className="text-sm text-neutral-700">
            <span className="block font-semibold text-sky-700">
              Anonymity is yours to choose
            </span>
            Tick one box when you raise it and HR sees the grievance, not the
            name.
          </p>
        </div>
      </div>

      <StatGrid cols={3}>
        <StatCard
          icon={Scale}
          hue="blue"
          label="Cases on your record"
          value={cases.length}
        />
        <StatCard
          icon={ShieldQuestion}
          hue="sky"
          label="Still being dealt with"
          value={openCount}
        />
        <StatCard
          icon={Gavel}
          hue={liveWarnings > 0 ? "sun" : "slate"}
          label="Live warnings"
          value={liveWarnings}
        />
      </StatGrid>

      <section aria-labelledby="cases-heading">
        <SectionHead
          id="cases-heading"
          title="Your cases"
          subtitle="Grievances you raised and disciplinaries you were told of"
        />
        {cases.length === 0 ? (
          <Card>
            <Empty
              icon={Scale}
              hue="grape"
              title="Nothing open"
              hint="Cases you raise, and any you are formally notified of, appear here."
            />
          </Card>
        ) : (
          <CaseList rows={cases} onAppeal={setAppealing} onRead={setReading} />
        )}
      </section>

      {raising && (
        <RaiseGrievanceDialog
          onClose={() => setRaising(false)}
          onRaised={() => {
            setRaising(false);
            void load();
          }}
        />
      )}

      {reading !== null && <DecisionDialog caseId={reading} onClose={() => setReading(null)} />}

      {appealingCase !== null && (
        <AppealDialog
          caseId={appealingCase.id}
          onClose={() => setAppealing(null)}
          onAppealed={() => {
            setAppealing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function KindTile({ row, size = 36 }: { row: MyCase; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-xl",
        row.kind === "disciplinary"
          ? "bg-sun-50 text-sun-700"
          : "bg-sky-50 text-sky-700",
      )}
    >
      {row.kind === "disciplinary" ? (
        <Gavel size={16} aria-hidden />
      ) : (
        <ShieldQuestion size={16} aria-hidden />
      )}
    </span>
  );
}

function CaseState({ row }: { row: MyCase }) {
  return row.outcomeLabel !== null ? (
    <ToneChip tone={row.hasLiveWarning ? "warning" : "neutral"} dot>
      {row.outcomeLabel}
    </ToneChip>
  ) : (
    <ToneChip tone="info" dot>
      {row.statusLabel}
    </ToneChip>
  );
}

function Decided({ row }: { row: MyCase }) {
  if (row.outcomeLabel === null)
    return <span className="text-neutral-400">-</span>;
  return (
    <span className="text-xs text-neutral-600">
      Decided {formatDate(row.outcomeOn)}
      {row.warningExpiresOn !== null && (
        <>
          {" · "}
          {/*
            Said out loud because it is the fact people most often do not
            know: a warning stops counting on a date, and after it the
            record no longer escalates anything.
          */}
          stops counting on {formatDate(row.warningExpiresOn)}
        </>
      )}
    </span>
  );
}

/*
  Only while the window is open. The API decides; this renders what it
  said rather than guessing at a deadline.
*/
function AppealAction({
  row,
  onAppeal,
  onRead,
}: {
  row: MyCase;
  onAppeal: (id: string) => void;
  /** Open the decision and its reasons (H14). */
  onRead: (id: string) => void;
}) {
  const read =
    row.outcomeLabel !== null ? (
      <Button size="sm" icon={FileText} onClick={() => onRead(row.id)}>
        Read the decision
      </Button>
    ) : null;

  if (row.isAppealable) {
    return (
      <span className="flex flex-wrap justify-end gap-2">
        {read}
        <Button size="sm" icon={Undo2} onClick={() => onAppeal(row.id)}>
          Appeal this
        </Button>
      </span>
    );
  }
  if (row.appealedAt !== null) {
    return (
      <span className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-neutral-500">
          You appealed on {formatDate(row.appealedAt)}.
        </span>
        {read}
      </span>
    );
  }
  return read;
}

function CaseList({
  rows,
  onAppeal,
  onRead,
}: {
  rows: MyCase[];
  onAppeal: (id: string) => void;
  onRead: (id: string) => void;
}) {
  const title = (row: MyCase) => `${row.reference} · ${row.summary}`;

  const columns: Column<MyCase>[] = [
    {
      key: "case",
      header: "Case",
      primary: true,
      sortable: true,
      value: title,
      render: (row) => (
        <span className="flex items-center gap-3">
          <KindTile row={row} />
          <span className="font-semibold text-neutral-900">{title(row)}</span>
        </span>
      ),
    },
    { key: "kind", header: "Kind", sortable: true, value: (r) => r.kindLabel },
    {
      key: "opened",
      header: "Raised",
      sortable: true,
      value: (r) => r.openedOn,
      render: (r) => formatDate(r.openedOn),
    },
    {
      key: "state",
      header: "Where it stands",
      render: (r) => <CaseState row={r} />,
      value: (r) => r.outcomeLabel ?? r.statusLabel,
    },
    {
      key: "decided",
      header: "Outcome",
      render: (r) => <Decided row={r} />,
      hideOnMobile: true,
    },
    {
      key: "appeal",
      header: "",
      align: "right",
      tableOnly: true,
      render: (r) => <AppealAction row={r} onAppeal={onAppeal} onRead={onRead} />,
    },
  ];

  return (
    <DataView<MyCase>
      rows={rows}
      rowKey={(r) => r.id}
      columns={columns}
      storageKey="hrm.me.cases"
      caption="Your cases"
      searchPlaceholder="Search cases"
      gridCols={2}
      renderCard={(row) => (
        <div className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <KindTile row={row} size={40} />
            <CaseState row={row} />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-neutral-900">
              {title(row)}
            </p>
            <p className="text-xs text-neutral-500">
              {row.kindLabel} · raised {formatDate(row.openedOn)}
            </p>
          </div>
          {row.outcomeLabel !== null && (
            <p className="rounded-xl bg-neutral-50 px-3 py-2">
              <Decided row={row} />
            </p>
          )}
          <div className="mt-auto">
            <AppealAction row={row} onAppeal={onAppeal} onRead={onRead} />
          </div>
        </div>
      )}
      renderListItem={(row) => (
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <KindTile row={row} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {title(row)}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {row.kindLabel} · raised {formatDate(row.openedOn)}
            </p>
          </div>
          <CaseState row={row} />
          <AppealAction row={row} onAppeal={onAppeal} onRead={onRead} />
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */

function RaiseGrievanceDialog({
  onClose,
  onRaised,
}: {
  onClose: () => void;
  onRaised: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await hrm.myCases.raise({
        summary,
        detail: detail === "" ? null : detail,
        anonymous,
      });
      onRaised();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not send.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalFrame
      title="Raise a grievance"
      subtitle="It goes to HR, not to your manager."
      icon={Megaphone}
      hue="grape"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || summary.trim() === ""}
          >
            Send it
          </Button>
        </>
      }
    >
      {/*
          Every field here is labelled with `htmlFor` rather than by wrapping,
          and its hint hangs off `aria-describedby`. Nesting both in one label
          makes the accessible name "What is the problem One line. There is
          room for the detail below." — a screen reader reads the hint as part
          of the field's name every time focus lands on it.
        */}
      <div>
        <label htmlFor="grievance-summary" className={labelCls}>
          What is the problem
        </label>
        <input
          id="grievance-summary"
          aria-describedby="grievance-summary-hint"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          required
          maxLength={2000}
          className={inputCls}
        />
        <p id="grievance-summary-hint" className={hintCls}>
          One line. There is room for the detail below.
        </p>
      </div>

      <div>
        <label htmlFor="grievance-detail" className={labelCls}>
          What happened
        </label>
        <RichTextEditor id="grievance-detail" variant="full" describedBy="grievance-detail-hint" value={detail} onChange={setDetail} />
        <p id="grievance-detail-hint" className={hintCls}>
          Dates and names help, but say as much or as little as you want to.
        </p>
      </div>

      {/*
          Offered plainly rather than buried in a settings link. Somebody
          reporting an unsafe ward run by their own manager needs this, and a
          form that makes it look unusual gets no report at all.
        */}
      <div className="flex items-start gap-3 rounded-xl border border-grape-100 bg-grape-50/60 px-3.5 py-3">
        <input
          id="grievance-anonymous"
          type="checkbox"
          aria-describedby="grievance-anonymous-hint"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary-600"
        />
        <div>
          <label
            htmlFor="grievance-anonymous"
            className="text-sm font-semibold text-neutral-800"
          >
            Do not attach my name
          </label>
          <p
            id="grievance-anonymous-hint"
            className="mt-0.5 text-xs text-neutral-600"
          >
            HR will see the grievance but not who raised it. They may not be
            able to come back to you for more detail, and it will not appear in
            your own list afterwards.
          </p>
        </div>
      </div>

      {error !== null && <Notice tone="error">{error}</Notice>}
    </ModalFrame>
  );
}

function AppealDialog({
  caseId,
  onClose,
  onAppealed,
}: {
  caseId: string;
  onClose: () => void;
  onAppealed: () => void;
}) {
  const [grounds, setGrounds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await hrm.myCases.appeal(caseId, grounds);
      onAppealed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not send.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalFrame
      title="Appeal the outcome"
      icon={Undo2}
      hue="sun"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || grounds.trim() === ""}
          >
            Appeal
          </Button>
        </>
      }
    >
      <div>
        <label htmlFor="appeal-grounds" className={labelCls}>
          Why you are appealing
        </label>
        <RichTextEditor id="appeal-grounds" minHeight={154} describedBy="appeal-grounds-hint" value={grounds} onChange={setGrounds} />
        <p id="appeal-grounds-hint" className={hintCls}>
          Somebody who was not involved in the original decision will hear it.
        </p>
      </div>

      {error !== null && <Notice tone="error">{error}</Notice>}
    </ModalFrame>
  );
}

/**
 * The decision, with the reasons for it (H14).
 *
 * The list carries only the outcome's name; the reasons, the appeal's result
 * and the served steps come from the case itself, loaded when asked for. The
 * investigator's working notes are never in it — the API leaves them out.
 */
function DecisionDialog({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const [row, setRow] = useState<MyCase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.myCases
      .get(caseId)
      .then((result) => {
        if (!cancelled) setRow(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <ModalFrame
      title={row ? `${row.reference} · ${row.outcomeLabel ?? row.statusLabel}` : "The decision"}
      subtitle={row?.outcomeOn ? `Decided ${formatDate(row.outcomeOn)}` : undefined}
      icon={Gavel}
      hue="grape"
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      {row === null && error === null && (
        <div className="h-24 animate-pulse rounded-xl bg-neutral-50" aria-busy="true" aria-label="Loading" />
      )}

      {row !== null && (
        <div className="space-y-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Why</h3>
            {row.outcomeReason ? (
              <RichTextView value={row.outcomeReason} size="sm" className="mt-1 text-neutral-800" />
            ) : (
              <p className="mt-1 text-sm text-neutral-800">No reasons were recorded.</p>
            )}
          </section>

          {row.warningExpiresOn !== null && (
            <p className="rounded-xl bg-sun-50 px-3 py-2 text-sm text-sun-700">
              The warning stays on your record until {formatDate(row.warningExpiresOn)}.
            </p>
          )}

          {row.appealedAt !== null && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your appeal</h3>
              {row.appealGrounds && (
                <RichTextView value={row.appealGrounds} size="sm" className="mt-1 text-neutral-700" />
              )}
              <p className="mt-2 text-sm text-neutral-800">
                {row.appealOutcome === null || row.appealOutcome === undefined
                  ? "Not heard yet."
                  : row.appealOutcome === "upheld"
                    ? "Upheld: the decision was overturned."
                    : "Dismissed: the decision stands."}
              </p>
              {row.appealReason && (
                <RichTextView value={row.appealReason} size="sm" className="mt-1 text-neutral-700" />
              )}
            </section>
          )}

          {row.isAppealable && (
            <p className="text-xs text-neutral-500">
              You can appeal within 14 days of the decision. After that the case closes by itself.
            </p>
          )}

          {(row.events ?? []).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">What happened</h3>
              <ol className="mt-2 space-y-2 border-l border-neutral-200 pl-4">
                {(row.events ?? []).map((event) => (
                  <li key={event.id} className="text-sm">
                    <p className="text-xs text-neutral-500">{formatDate(event.occurredAt)}</p>
                    <p className="text-neutral-800">{eventLabel(event.kind)}</p>
                    {event.note && <RichTextView value={event.note} size="sm" className="text-neutral-600" />}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </ModalFrame>
  );
}

/** "outcome_issued" → "Outcome issued". */
function eventLabel(kind: string): string {
  const text = kind.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
