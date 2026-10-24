"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, CheckCheck, FileText, NotebookPen, PiggyBank, Plus, RefreshCw, Route, Users } from "lucide-react";
import { Button, PageHeader, Panel } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { FundsSnapshotView } from "@/suite/finance/components/requests/ui";
import { amount } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { ApiError, opsError, travel, type OpsOptions, type TripChange, type TripFull } from "@/lib/api/operations-travel-client";
import { tripStatus } from "./labels";
import { AdvanceMemoCard, ApprovalLink, FactRow, MetaChip } from "./shared";
import { BookingsList, ChangesList, Itinerary, TravellersTable, TripReport, TripTicket } from "./TripParts";
import BookingDialog from "./BookingDialog";

/**
 * A trip on the travel desk: record what was booked, and carry out changes
 * once they are approved. Everything else is the traveller's.
 */
export default function DeskTripDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [trip, setTrip] = useState<TripFull | null>(null);
  const [options, setOptions] = useState<OpsOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [booking, setBooking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyChange, setBusyChange] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    travel.desk.get(id).then(
      (t) => {
        if (!alive) return;
        setTrip(t);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This trip wasn't found. Drafts only reach the desk once they are sent." : `This trip didn't load. ${opsError(e)}`),
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
        <BackLink href="/suite/operations/travel" label="Travel desk" />
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
  const canBook = mayDoOps(user, "travel_desk", "book") && (t.status === "approved" || t.status === "booked");
  const canExecute = mayDoOps(user, "travel_desk", "execute_change");
  const reasons = options?.changeReasons ?? {};

  const execute = async (c: TripChange) => {
    const booked = c.bookingId ? t.bookings.find((b) => b.id === c.bookingId) : null;
    const ok = await confirm({
      title: c.kind === "cancellation" ? "Mark the cancellation as done?" : "Mark the change as done?",
      body: (
        <div className="space-y-2">
          <p>Confirm the agency has carried it out: &ldquo;{c.description}&rdquo;</p>
          <p>
            {c.kind === "cancellation"
              ? booked
                ? `The booking ${booked.reference ?? ""} is marked cancelled.`
                : "No booking was named, so the whole trip is cancelled."
              : booked
                ? `The booking ${booked.reference ?? ""} is marked changed.`
                : "No booking was named; the bookings stay as they are."}{" "}
            The fee of {amount(c.fee)} is recorded against {reasons[c.reason]?.toLowerCase() ?? "its reason"}.
          </p>
        </div>
      ),
      confirmLabel: "Mark as done",
      tone: c.kind === "cancellation" ? "danger" : "primary",
    });
    if (!ok) return;
    setBusyChange(c.id);
    setActionError(null);
    try {
      setTrip(await travel.desk.executeChange(c.id));
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusyChange(null);
    }
  };

  return (
    <div>
      <BackLink href="/suite/operations/travel" label="Travel desk" />
      <PageHeader
        eyebrow={`${t.number} · ${t.requester ?? ""}`}
        title={t.purpose}
        subtitle={<MetaChip meta={tripStatus(t.status)} />}
        actions={
          <>
            <ApprovalLink approvalId={t.approvalId} />
            {canBook && (
              <Button variant="primary" icon={Plus} onClick={() => setBooking(true)}>
                Record a booking
              </Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <TripTicket trip={t} classes={options?.destinationClasses ?? {}} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel
            title="Bookings"
            subtitle={t.status === "approved" ? "Approved and waiting to be booked" : undefined}
            icon={BedDouble}
            hue="grape"
            actions={
              canBook && t.bookings.length > 0 ? (
                <Button size="sm" icon={Plus} onClick={() => setBooking(true)}>
                  Add another
                </Button>
              ) : undefined
            }
          >
            <BookingsList bookings={t.bookings} empty={canBook ? "Nothing booked yet. Record the flights, hotel and ground transport as you book them." : "Nothing booked."} />
          </Panel>

          <Panel title="Changes and cancellations" subtitle="Carried out only once approved" icon={RefreshCw} hue="sun">
            <ChangesList
              changes={t.changes}
              bookings={t.bookings}
              reasons={reasons}
              action={(c) =>
                c.status === "approved" && canExecute ? (
                  <Button size="sm" variant="primary" icon={CheckCheck} disabled={busyChange === c.id} onClick={() => void execute(c)}>
                    {busyChange === c.id ? "Saving…" : "Mark as done"}
                  </Button>
                ) : c.status === "in_approval" ? (
                  <p className="text-xs text-neutral-500">Waiting for approval before the agency is asked.</p>
                ) : null
              }
            />
          </Panel>

          <Panel title="Itinerary" icon={Route} hue="coral">
            <Itinerary legs={t.legs} departsOn={t.departsOn} returnsOn={t.returnsOn} />
          </Panel>

          <Panel title="Travellers and entitlement" icon={Users} hue="mint">
            <TravellersTable travellers={t.travellers} grades={options?.travelGrades ?? {}} />
          </Panel>

          {t.report && (
            <Panel title="Trip report" icon={NotebookPen} hue="mint">
              <TripReport trip={t} />
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Money and reasons">
          <Panel title="Travel advance" icon={PiggyBank} hue="coral">
            <AdvanceMemoCard memo={t.advanceMemo} memoId={t.advanceMemoId} financeHref={false} />
          </Panel>
          <Panel title="Funds when it was sent" icon={PiggyBank} hue="grape">
            {t.funds ? <FundsSnapshotView snapshot={t.funds} /> : <p className="text-sm text-neutral-500">No project funds were checked: a cost centre or an event line pays.</p>}
          </Panel>
          <Panel title="Details" icon={FileText} hue="slate">
            <dl className="space-y-3">
              <FactRow label="Charged to">{t.project ? t.project.name : "A cost centre"}</FactRow>
              <FactRow label="Flights estimate">{amount(t.flightsEstimate)}</FactRow>
              <FactRow label="Justification">{t.justification || <span className="text-neutral-500">None given</span>}</FactRow>
              {t.lateBookingReason && <FactRow label="Why it was booked late">{t.lateBookingReason}</FactRow>}
            </dl>
          </Panel>
        </aside>
      </div>

      {booking && (
        <BookingDialog
          trip={t}
          vendors={options ? options.vendors : null}
          onClose={() => setBooking(false)}
          onDone={(next) => {
            setTrip(next);
            setBooking(false);
          }}
        />
      )}
    </div>
  );
}
