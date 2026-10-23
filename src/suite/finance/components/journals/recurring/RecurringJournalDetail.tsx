"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, CalendarDays, CalendarRange, History, PauseCircle, Pencil, PlayCircle, Repeat, RotateCcw, Trash2, TriangleAlert, UserRound, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { errorText, recurring, type RecurringJournalDetail as Detail, type RecurringRun } from "@/lib/api/finance-recurring-client";
import { Button, ButtonLink, Card, Chip, PageHeader, Panel } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, InfoList, InfoRow, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, day } from "@/suite/finance/lib/format";
import { JournalStatusChip } from "../JournalsBoard";
import { plainError } from "../meta";
import { RecurringStatusChip, templateAmount } from "./RecurringJournalsBoard";
import { RUN_STATUS, scheduleLabel } from "./schedule";

/**
 * One recurring journal: its schedule, its lines, and every occurrence so
 * far - the journal each made, or why one is waiting (a locked month, a
 * line the ledger refused) with a way to try it again.
 */

const NOTICES: Record<string, string> = {
  created: "Recurring journal set up. Each journal it makes goes for approval on its day.",
  saved: "Changes saved. They apply from the next journal it makes.",
};

export default function RecurringJournalDetail({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [t, setT] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    const n = params?.get("notice");
    return n ? (NOTICES[n] ?? n) : null;
  });

  useEffect(() => {
    let alive = true;
    recurring
      .get(id)
      .then((d) => {
        if (!alive) return;
        setT(d);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e) || "The recurring journal didn't load."));
    return () => {
      alive = false;
    };
  }, [id, reload]);

  if (loadError && !t)
    return (
      <div>
        <BackLink href="/suite/finance/journals/recurring" label="Recurring journals" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!t) return <Skeleton className="h-[28rem]" />;

  const may = (a: string) => mayDo(user, "recurring_journals", a);

  const act = async (key: string, fn: () => Promise<Detail>, done: string) => {
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      setT(await fn());
      setNotice(done);
    } catch (e) {
      setActionError(plainError(errorText(e)));
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (run?: RecurringRun) => {
    if (
      !run &&
      !(await confirm({
        title: "Make the next journal now?",
        body: t.nextRunOn ? `The journal for ${day(t.nextRunOn)} is made today, dated ${day(t.nextRunOn)}, and sent for approval. The schedule then moves on to the following date.` : "The next journal is made now and sent for approval.",
        confirmLabel: "Make it now",
        tone: "primary",
      }))
    )
      return;
    await act(
      run ? `run-${run.id}` : "run",
      async () => {
        const r = await recurring.run(t.id, run?.occurrenceDate);
        return r.template;
      },
      run ? `Tried ${day(run.occurrenceDate)} again.` : "Journal made and sent for approval.",
    );
  };

  const remove = async () => {
    if (!(await confirm({ title: `Delete ${t.name}?`, body: "It has never made a journal, so nothing in the books changes. The template is removed.", confirmLabel: "Delete template" }))) return;
    setBusy("delete");
    try {
      await recurring.remove(t.id);
      router.push("/suite/finance/journals/recurring");
    } catch (e) {
      setActionError(plainError(errorText(e)));
      setBusy(null);
    }
  };

  const ended = t.status === "ended";
  const waiting = t.runs.filter((r) => r.status === "skipped" || r.status === "failed" || r.status === "pending");
  const neverRan = t.runs.every((r) => r.journal === null);

  return (
    <div>
      <BackLink href="/suite/finance/journals/recurring" label="Recurring journals" />
      <PageHeader
        eyebrow="Recurring journal"
        title={t.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <RecurringStatusChip status={t.status} />
            <span>{scheduleLabel(t.frequency, t.dayOfMonth)}</span>
            {t.autoReverse && (
              <Chip hue="grape" icon={RotateCcw}>
                Reverses next month
              </Chip>
            )}
          </span>
        }
        actions={
          <>
            {may("update") && (
              <ButtonLink href={`/suite/finance/journals/recurring/${t.id}/edit`} icon={Pencil}>
                Edit
              </ButtonLink>
            )}
            {may("pause") && t.status === "active" && (
              <Button icon={PauseCircle} disabled={busy !== null} onClick={() => void act("pause", () => recurring.pause(t.id), "Paused. Nothing is made until it is resumed.")}>
                {busy === "pause" ? "Pausing…" : "Pause"}
              </Button>
            )}
            {may("resume") && t.status === "paused" && (
              <Button icon={PlayCircle} disabled={busy !== null} onClick={() => void act("resume", () => recurring.resume(t.id), "Resumed. Any date missed while paused is made at the next run.")}>
                {busy === "resume" ? "Resuming…" : "Resume"}
              </Button>
            )}
            {may("run_occurrence") && !ended && (
              <Button variant="primary" icon={Zap} disabled={busy !== null} onClick={() => void runNow()}>
                {busy === "run" ? "Making…" : "Run next now"}
              </Button>
            )}
            {may("delete") && neverRan && (
              <Button variant="danger" icon={Trash2} disabled={busy !== null} onClick={() => void remove()}>
                Delete
              </Button>
            )}
          </>
        }
      />

      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}
      {t.lastError && (
        <p className="mb-4 flex gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            The last run could not make a journal: {plainError(t.lastError)}
            {t.lastErrorAt && <span className="text-rose-600"> ({day(t.lastErrorAt)})</span>}
          </span>
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Panel title="Lines" subtitle={`Each journal: ${t.narration} - month`} icon={Repeat} hue="sky" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">Template lines</caption>
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="px-5 py-3">Account</th>
                    <th scope="col" className="px-3 py-3">Detail</th>
                    <th scope="col" className="px-3 py-3 text-right">Debit</th>
                    <th scope="col" className="px-5 py-3 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {t.lines.map((l) => {
                    const dims = [l.project?.name, l.costCentre?.name, l.counterparty?.name, l.person?.name].filter(Boolean).join(" · ");
                    return (
                      <tr key={l.lineNo}>
                        <td className="px-5 py-3">
                          <span className="font-mono text-[13px] text-neutral-500">{l.account.code}</span> <span className="text-neutral-900">{l.account.name}</span>
                        </td>
                        <td className="px-3 py-3 text-neutral-600">
                          {l.narration && <span className="block">{l.narration}</span>}
                          {dims && <span className="block text-xs text-neutral-500">{dims}</span>}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-neutral-900">
                          {l.debit ? `${l.currency && l.currency !== t.baseCurrency ? `${l.currency} ` : ""}${accounting(l.debit)}` : ""}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-neutral-900">
                          {l.credit ? `${l.currency && l.currency !== t.baseCurrency ? `${l.currency} ` : ""}${accounting(l.credit)}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Journals made"
            subtitle="Every occurrence so far, newest first"
            icon={History}
            hue="grape"
            bodyClassName="p-0"
            actions={waiting.length > 0 ? <Chip hue="rose" icon={TriangleAlert}>{waiting.length} waiting</Chip> : undefined}
          >
            {t.runs.length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-sm text-neutral-500">{t.nextRunOn ? `None yet. The first is made on ${day(t.nextRunOn)}.` : "None."}</p>
            ) : (
              <ul className="divide-y divide-neutral-100" aria-label="Journals made by this template">
                {t.runs.map((r) => (
                  <RunRow key={r.id} run={r} canRetry={may("run_occurrence")} busy={busy} onRetry={() => void runNow(r)} />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <InfoList>
              <InfoRow icon={CalendarClock} label="Next journal" hue="sky">
                {t.nextRunOn ? day(t.nextRunOn) : ended ? "None: it has ended" : "None"}
              </InfoRow>
              <InfoRow icon={CalendarDays} label="Last made">
                {t.lastRunOn ? day(t.lastRunOn) : "Not yet"}
              </InfoRow>
              <InfoRow icon={CalendarRange} label="Runs">
                From {day(t.startDate)}
                {t.endDate ? ` to ${day(t.endDate)}` : t.maxOccurrences ? `, ${t.maxOccurrences} journals in all` : ", no end"}
                <span className="block text-xs text-neutral-500">{t.occurrences} made so far</span>
              </InfoRow>
              <InfoRow icon={Repeat} label="Amount each time">
                <span className="tabular-nums">{templateAmount(t)}</span>
              </InfoRow>
              <InfoRow icon={UserRound} label="Set up by">
                {t.createdBy ?? "Unknown"}
                {t.updatedBy && t.updatedBy !== t.createdBy && <span className="block text-xs text-neutral-500">Last changed by {t.updatedBy}</span>}
              </InfoRow>
            </InfoList>
          </Card>

          {t.upcoming.length > 0 && (
            <Panel title="Coming up" icon={CalendarClock} hue="sky">
              <ol className="space-y-2 text-sm" aria-label="Next dates">
                {t.upcoming.map((d) => (
                  <li key={d} className="tabular-nums text-neutral-800">
                    {day(d)}
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          <p className="text-xs text-neutral-500">
            Each journal is sent for approval in the name of whoever last set the lines, so they can never post it themselves. Approve them from{" "}
            <Link href="/suite/approvals" className="font-semibold text-primary-700 hover:underline">
              Approvals
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function RunRow({ run: r, canRetry, busy, onRetry }: { run: RecurringRun; canRetry: boolean; busy: string | null; onRetry: () => void }) {
  const s = RUN_STATUS[r.status] ?? RUN_STATUS.pending;
  const retryable = r.status !== "created";
  return (
    <li className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold tabular-nums text-neutral-900">{day(r.occurrenceDate)}</span>
          <span className="text-xs text-neutral-500">#{r.occurrenceNo}</span>
          {r.journal ? <JournalStatusChip status={r.journal.status} /> : <Chip hue={s.hue} icon={s.icon}>{s.label}</Chip>}
        </p>
        {r.reason && <p className="mt-1 text-xs text-neutral-600">{plainError(r.reason)}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {r.journal && (
          <Link href={`/suite/finance/journals/${r.journal.id}`} className="text-sm font-semibold text-primary-700 hover:underline">
            {r.journal.journalNo ?? "Open journal"}
            <span className="ml-2 font-normal tabular-nums text-neutral-600">{accounting(r.journal.total)}</span>
          </Link>
        )}
        {retryable && canRetry && (
          <Button size="sm" icon={RotateCcw} disabled={busy !== null} onClick={onRetry}>
            {busy === `run-${r.id}` ? "Trying…" : "Try again"}
          </Button>
        )}
      </div>
    </li>
  );
}
