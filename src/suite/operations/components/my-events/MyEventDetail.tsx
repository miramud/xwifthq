"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheckBig, ClipboardCheck, Info, LayoutDashboard, ListOrdered, PencilLine, PiggyBank, Send, ShieldAlert, Sparkles } from "lucide-react";
import { Button, ButtonLink, PageHeader, Panel } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Field, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { FundsSnapshotView } from "@/suite/finance/components/requests/ui";
import { useAuth } from "@/lib/auth-store";
import { mayUseOperations } from "@/suite/operations/lib/operations-access";
import {
  ApiError,
  events,
  opsError,
  opsMessages,
  travel,
  type DashboardLine,
  type EventFull,
  type GenerateResult,
  type OpsOptions,
} from "@/lib/api/operations-travel-client";
import { eventStatus } from "../travel/labels";
import { ApprovalLink, MetaChip, SubmitForApproval } from "../travel/shared";
import { Blockers, BudgetDashboard, BudgetLines, EventFacts, type DocLinks } from "../events/EventParts";
import { eventBudget } from "../events/budget";
import GenerateDialog from "./GenerateDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * An event I lead: send the draft, then - once approved - run its budget
 * line by line, raise what each line needs, and close it out when every
 * service is confirmed and every advance retired.
 */
export default function MyEventDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventFull | null>(null);
  const [options, setOptions] = useState<OpsOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [generating, setGenerating] = useState<DashboardLine | null>(null);
  const [notice, setNotice] = useState<React.ReactNode>(null);

  useEffect(() => {
    let alive = true;
    events.me.get(id).then(
      (e) => {
        if (!alive) return;
        setEvent(e);
        setLoadError(null);
      },
      (e: unknown) =>
        alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This event wasn't found among the ones you lead or created." : `This event didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  useEffect(() => {
    travel.options().then(setOptions, () => undefined);
  }, []);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !event) {
    return (
      <div>
        <BackLink href="/suite/operations/my/events" label="My events" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!event) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the event…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const e = event;
  const categories = options?.eventCategories ?? {};
  const seesProcurement = mayUseOperations(user, "purchase_orders");
  const links: DocLinks = {
    request: (d) => `/suite/operations/my/requests/${d.id}`,
    order: (d) => (seesProcurement ? `/suite/operations/procurement/orders/${d.id}` : null),
    trip: (d) => `/suite/operations/my/trips/${d.id}`,
  };

  const generated = (r: GenerateResult) => {
    setGenerating(null);
    if (r.kind === "purchase_request" && r.id) return router.push(`/suite/operations/my/requests/${r.id}`);
    if (r.kind === "travel" && r.id) return router.push(`/suite/operations/my/trips/${r.id}`);
    setNotice(
      r.id ? (
        <>
          The advance is with the FCU.{" "}
          <Link href={`/suite/finance/requests/${r.id}`} className="font-semibold underline underline-offset-2">
            Follow it in Finance
          </Link>
          .
        </>
      ) : (
        "The advance is recorded. Finance isn't switched on for this organisation, so it waits there."
      ),
    );
    refresh();
  };

  return (
    <div>
      <BackLink href="/suite/operations/my/events" label="My events" />
      <PageHeader
        eyebrow={`${e.number ?? "Draft event"} · ${e.typeLabel}`}
        title={e.name}
        subtitle={<MetaChip meta={eventStatus(e.status)} />}
        actions={
          <>
            {e.status === "draft" && (
              <ButtonLink href={`/suite/operations/my/events/new?id=${e.id}`} icon={PencilLine}>
                Edit the draft
              </ButtonLink>
            )}
            <ApprovalLink approvalId={e.approvalId} />
          </>
        }
      />

      {notice && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700 ring-1 ring-mint-500/30">
          <CircleCheckBig size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{notice}</span>
        </p>
      )}

      {e.status === "draft" && (
        <Panel title="Send for approval" subtitle="The whole budget is approved at once; the project's funds are checked first" icon={Send} className="mb-5">
          <SubmitForApproval
            label="Send for approval"
            blocked={e.lines.length === 0 ? "Add the budget lines before you send it." : eventBudget(e.lines).overCap ? "Contingency is over its 10% cap. Edit the draft and lower it." : null}
            onSubmit={async (reason) => setEvent(await events.me.submit(e.id, reason))}
          />
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel title="About the event" icon={Info} hue="sky">
            <EventFacts event={e} />
          </Panel>
          {!e.dashboard && (
            <Panel title="Budget" icon={ListOrdered} hue="mint">
              <BudgetLines lines={e.lines} categories={categories} />
            </Panel>
          )}
        </div>
        <aside className="min-w-0 space-y-5" aria-label="Funds">
          <Panel title="Funds when it was sent" icon={PiggyBank} hue="grape">
            {e.funds ? (
              <FundsSnapshotView snapshot={e.funds} />
            ) : (
              <p className="text-sm text-neutral-500">{e.project ? "The project's funds are checked against the whole budget when you send it." : "Charged to a cost centre: no project funds to check."}</p>
            )}
          </Panel>
          {e.dashboard && (
            <Panel title="Before it can close" icon={ShieldAlert} hue="sun">
              <Blockers blockers={e.dashboard.blockers} />
            </Panel>
          )}
        </aside>
      </div>

      {e.dashboard && (
        <section className="mt-8" aria-labelledby="dashboard-title">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <LayoutDashboard size={18} aria-hidden />
            </span>
            <div>
              <h2 id="dashboard-title" className="text-lg font-bold tracking-tight text-neutral-900">
                Budget dashboard
              </h2>
              <p className="text-sm text-neutral-500">{e.status === "approved" ? "Raise what each line needs; its commitments and payments show here." : "Final figures, line by line."}</p>
            </div>
          </div>
          <BudgetDashboard
            dashboard={e.dashboard}
            links={links}
            actions={
              e.status === "approved"
                ? (l) => (
                    <Button size="sm" icon={Sparkles} onClick={() => setGenerating(l)} className="w-full sm:w-auto">
                      Raise for this line
                    </Button>
                  )
                : undefined
            }
          />
        </section>
      )}

      {e.status === "approved" && e.dashboard && <CloseOut event={e} onClosed={setEvent} />}

      {generating && <GenerateDialog event={e} line={generating} options={options} onClose={() => setGenerating(null)} onDone={generated} />}
    </div>
  );
}

/** Close-out: who came and what it achieved. Unused money goes back to the project. */
function CloseOut({ event, onClosed }: { event: EventFull; onClosed: (e: EventFull) => void }) {
  const confirm = useConfirm();
  const blockers = event.dashboard?.blockers ?? [];
  const [attendance, setAttendance] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const close = async () => {
    const found: Record<string, string> = {};
    const n = Number(attendance);
    if (attendance.trim() === "" || !Number.isInteger(n) || n < 0) found.attendance = "Enter how many attended, a whole number.";
    if (!outcomes.trim()) found.outcomes = "Say what the event achieved.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const ok = await confirm({
      title: "Close out this event?",
      body: "Its budget lines are released and whatever was not used goes back to the project. Nothing more can be raised from it.",
      confirmLabel: "Close the event",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    setRefusals([]);
    try {
      onClosed(await events.me.close(event.id, n, outcomes.trim()));
    } catch (e) {
      const list = opsMessages(e, "event");
      if (list.length > 1) setRefusals(list);
      else setError(opsError(e));
      setBusy(false);
    }
  };

  return (
    <Panel title="Close out the event" subtitle="Once every service is confirmed and every advance retired" icon={ClipboardCheck} hue="mint" className="mt-8">
      {blockers.length > 0 && (
        <p className="mb-4 text-sm text-neutral-600">
          It can&apos;t close yet: {blockers.length === 1 ? "one thing is" : `${blockers.length} things are`} still open, listed under &ldquo;Before it can close&rdquo;.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field id="close-attendance" label="How many attended">
          <input
            id="close-attendance"
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            value={attendance}
            onChange={(x) => setAttendance(x.target.value)}
            placeholder={String(event.participantsInternal + event.participantsExternal)}
            aria-invalid={errors.attendance ? true : undefined}
          />
          <FieldError message={errors.attendance} />
        </Field>
        <Field id="close-outcomes" label="Outcomes">
          <RichTextEditor id="close-outcomes" minHeight={102} value={outcomes} onChange={setOutcomes} placeholder="What participants can now do, and what follows." invalid={Boolean(errors.outcomes ? true : undefined)} />
          <FieldError message={errors.outcomes} />
        </Field>
      </div>
      {error && <ErrorNote className="mt-4">{error}</ErrorNote>}
      {refusals.length > 0 && (
        <ErrorNote className="mt-4">
          <p className="font-semibold">It can&apos;t close yet:</p>
          <ul className="mt-1 list-disc pl-5">
            {refusals.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </ErrorNote>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="primary" icon={ClipboardCheck} disabled={busy || blockers.length > 0} onClick={() => void close()}>
          {busy ? "Closing…" : "Close the event"}
        </Button>
      </div>
    </Panel>
  );
}
