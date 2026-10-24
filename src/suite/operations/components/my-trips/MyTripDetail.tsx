"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, FileText, History, NotebookPen, PencilLine, PiggyBank, RefreshCw, Route, Send, Users } from "lucide-react";
import { Button, ButtonLink, PageHeader, Panel } from "@/components/workspace/kit";
import { todayYmd } from "@/components/workspace/Calendar";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { FundsSnapshotView } from "@/suite/finance/components/requests/ui";
import { Money } from "@/suite/finance/components/banking/ui";
import { useAuth } from "@/lib/auth-store";
import { ApiError, opsError, travel, type OpsOptions, type TripFull } from "@/lib/api/operations-travel-client";
import { leadTime } from "../travel/cost";
import { tripStatus } from "../travel/labels";
import { AdvanceMemoCard, ApprovalLink, FactRow, MetaChip, SubmitForApproval } from "../travel/shared";
import { BookingsList, ChangesList, Itinerary, TravellersTable, TripReport, TripTicket } from "../travel/TripParts";
import ChangeDialog from "./ChangeDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * One of my trips: the ticket, the itinerary, each traveller's entitlement,
 * what the desk booked and changed, and the advance in Finance. A draft is
 * sent from here; a live trip can be changed or cancelled; once back, the
 * trip report is written here.
 */
export default function MyTripDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [trip, setTrip] = useState<TripFull | null>(null);
  const [options, setOptions] = useState<OpsOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let alive = true;
    travel.me.get(id).then(
      (t) => {
        if (!alive) return;
        setTrip(t);
        setLoadError(null);
      },
      (e: unknown) =>
        alive &&
        setLoadError(e instanceof ApiError && e.status === 404 ? "This trip wasn't found among yours. It may be somebody else's, or it was removed." : `This trip didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  useEffect(() => {
    travel.options().then(setOptions, () => undefined);
  }, []);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !trip) {
    return (
      <div>
        <BackLink href="/suite/operations/my/trips" label="My trips" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!trip) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the trip…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[180px]" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const t = trip;
  const grades = options?.travelGrades ?? {};
  const classes = options?.destinationClasses ?? {};
  const reasons = options?.changeReasons ?? {};
  const mine = user?.id === t.requesterId;
  const live = t.status === "approved" || t.status === "booked";
  const today = todayYmd();
  const lead = leadTime(t.departsOn, t.destinationClass, today);
  const blocked =
    t.travellers.length === 0
      ? "Add who is travelling before you send it."
      : t.overPolicy && !t.justification?.trim()
        ? "Some costs are above the travel policy. Edit the draft and write the justification; the MD approves it."
        : lead?.late && !t.lateBookingReason?.trim()
          ? `This trip leaves within ${lead.lead} days. Edit the draft and say why it is booked late.`
          : null;

  return (
    <div>
      <BackLink href="/suite/operations/my/trips" label="My trips" />
      <PageHeader
        eyebrow={t.number ?? "Draft trip"}
        title={t.purpose}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <MetaChip meta={tripStatus(t.status)} />
            {t.requester && !mine && <span>Raised by {t.requester}</span>}
          </span>
        }
        actions={
          <>
            {t.status === "draft" && mine && (
              <ButtonLink href={`/suite/operations/my/trips/new?id=${t.id}`} icon={PencilLine}>
                Edit the draft
              </ButtonLink>
            )}
            {live && mine && (
              <Button icon={RefreshCw} onClick={() => setChanging(true)}>
                Change or cancel
              </Button>
            )}
            <ApprovalLink approvalId={t.approvalId} />
          </>
        }
      />

      <TripTicket trip={t} classes={classes} />

      {t.status === "draft" && mine && (
        <Panel title="Send for approval" subtitle="The project's funds are checked, then it goes to your approvers" icon={Send} className="mb-6">
          <SubmitForApproval
            label="Send for approval"
            blocked={blocked}
            hint={t.overPolicy || t.tripType === "international" ? "Above-policy and international trips also go to the MD." : undefined}
            onSubmit={async (reason) => setTrip(await travel.me.submit(t.id, reason))}
          />
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {live && mine && <ReportPanel trip={t} today={today} onDone={setTrip} />}
          {t.report && (
            <Panel title="Trip report" icon={NotebookPen} hue="mint">
              <TripReport trip={t} />
            </Panel>
          )}

          <Panel title="Itinerary" icon={Route} hue="coral">
            <Itinerary legs={t.legs} departsOn={t.departsOn} returnsOn={t.returnsOn} />
          </Panel>

          <Panel title="Travellers and entitlement" subtitle="From the travel policy for each grade" icon={Users} hue="mint">
            <TravellersTable travellers={t.travellers} grades={grades} />
          </Panel>

          {t.status !== "draft" && (
            <Panel title="Bookings" subtitle="Recorded by the travel desk" icon={BedDouble} hue="grape">
              <BookingsList bookings={t.bookings} empty={live ? "The travel desk hasn't booked anything yet." : "Nothing was booked."} />
            </Panel>
          )}

          {t.status !== "draft" && (
            <Panel title="Changes and cancellations" icon={RefreshCw} hue="sun">
              <ChangesList changes={t.changes} bookings={t.bookings} reasons={reasons} />
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Money and reasons">
          <Panel title="Travel advance" subtitle="DTA, hotel and taxi, paid by Finance" icon={PiggyBank} hue="coral">
            <AdvanceMemoCard memo={t.advanceMemo} memoId={t.advanceMemoId} />
          </Panel>
          <Panel title="Funds when it was sent" icon={PiggyBank} hue="grape">
            {t.funds ? (
              <FundsSnapshotView snapshot={t.funds} />
            ) : (
              <p className="text-sm text-neutral-500">{t.project ? "The project's funds are checked and recorded when you send it." : "Charged to a cost centre or an event line: no project funds to check."}</p>
            )}
          </Panel>
          <Panel title="Details" icon={FileText} hue="slate">
            <dl className="space-y-3">
              <FactRow label="Charged to">{t.project ? `${t.project.name}${t.project.code ? ` (${t.project.code})` : ""}` : "A cost centre"}</FactRow>
              <FactRow label="Justification">{t.justification || <span className="text-neutral-500">None given</span>}</FactRow>
              {t.lateBookingReason && <FactRow label="Why it was booked late">{t.lateBookingReason}</FactRow>}
              {t.eventId && <FactRow label="For an event">Raised from an event budget line</FactRow>}
            </dl>
          </Panel>
          {t.changes.length > 0 && (
            <Panel title="Change fees so far" icon={History} hue="slate">
              <Money
                value={t.changes.filter((c) => c.status === "approved" || c.status === "executed").reduce((s, c) => s + c.fee, 0)}
                className="text-2xl font-bold text-neutral-900"
              />
              <p className="mt-1 text-xs text-neutral-500">Approved and carried-out changes</p>
            </Panel>
          )}
        </aside>
      </div>

      {changing && (
        <ChangeDialog
          trip={t}
          reasons={reasons}
          onClose={() => setChanging(false)}
          onDone={(next) => {
            setTrip(next);
            setChanging(false);
          }}
        />
      )}
    </div>
  );
}

/** Back from the trip: what it achieved. Offered once the trip has started. */
function ReportPanel({ trip, today, onDone }: { trip: TripFull; today: string; onDone: (t: TripFull) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = trip.departsOn <= today;

  if (!started) {
    return (
      <Panel title="Trip report" icon={NotebookPen} hue="mint">
        <p className="text-sm text-neutral-600">Once you are back, write what the trip achieved here. It is due within 5 working days of your return.</p>
      </Panel>
    );
  }

  const send = async () => {
    if (!text.trim()) {
      setError("Say what the trip achieved.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await travel.me.report(trip.id, text.trim()));
    } catch (e) {
      setError(opsError(e));
      setBusy(false);
    }
  };

  return (
    <Panel title="Write the trip report" subtitle="Due within 5 working days of your return. It completes the trip." icon={NotebookPen} hue="mint">
      <label htmlFor="trip-report" className="mb-1.5 block text-sm font-medium text-neutral-700">
        What the trip achieved
      </label>
      <RichTextEditor id="trip-report" minHeight={154} value={text} onChange={setText} placeholder="Who you met, what was agreed, and what happens next." />
      {error && <ErrorNote className="mt-3">{error}</ErrorNote>}
      <div className="mt-3 flex justify-end">
        <Button variant="primary" icon={NotebookPen} disabled={busy} onClick={() => void send()}>
          {busy ? "Sending…" : "Send the trip report"}
        </Button>
      </div>
    </Panel>
  );
}
