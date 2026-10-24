"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, LayoutDashboard, ListOrdered, PiggyBank, ShieldAlert } from "lucide-react";
import { PageHeader, Panel } from "@/components/workspace/kit";
import { BackLink, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { FundsSnapshotView } from "@/suite/finance/components/requests/ui";
import { useAuth } from "@/lib/auth-store";
import { mayUseOperations } from "@/suite/operations/lib/operations-access";
import { ApiError, events, opsError, type EventFull } from "@/lib/api/operations-travel-client";
import { eventStatus } from "../travel/labels";
import { ApprovalLink, MetaChip } from "../travel/shared";
import { Blockers, BudgetDashboard, BudgetLines, EventFacts, type DocLinks } from "./EventParts";

/** An event as the desk sees it: the facts and the budget dashboard, read-only. */
export default function DeskEventDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [event, setEvent] = useState<EventFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    events.desk.get(id).then(
      (e) => {
        if (!alive) return;
        setEvent(e);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This event wasn't found. Drafts show here once they are sent." : `This event didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !event) {
    return (
      <div>
        <BackLink href="/suite/operations/events" label="Events" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!event) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the event…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const e = event;
  const links: DocLinks = {
    request: (d) => (mayUseOperations(user, "purchase_requests") ? `/suite/operations/procurement/requests/${d.id}` : null),
    order: (d) => (mayUseOperations(user, "purchase_orders") ? `/suite/operations/procurement/orders/${d.id}` : null),
    trip: (d) => (mayUseOperations(user, "travel_desk") && d.status !== "draft" ? `/suite/operations/travel/${d.id}` : null),
  };

  return (
    <div>
      <BackLink href="/suite/operations/events" label="Events" />
      <PageHeader eyebrow={`${e.number} · ${e.typeLabel}`} title={e.name} subtitle={<MetaChip meta={eventStatus(e.status)} />} actions={<ApprovalLink approvalId={e.approvalId} />} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="About the event" icon={Info} hue="sky">
            <EventFacts event={e} />
          </Panel>
          {!e.dashboard && (
            <Panel title="Budget" icon={ListOrdered} hue="mint">
              <BudgetLines lines={e.lines} categories={{}} />
            </Panel>
          )}
        </div>
        <aside className="min-w-0 space-y-6" aria-label="Funds and close-out">
          <Panel title="Funds when it was sent" icon={PiggyBank} hue="grape">
            {e.funds ? <FundsSnapshotView snapshot={e.funds} /> : <p className="text-sm text-neutral-500">Charged to a cost centre: no project funds were checked.</p>}
          </Panel>
          {e.dashboard && e.status === "approved" && (
            <Panel title="Before it can close" icon={ShieldAlert} hue="sun">
              <Blockers blockers={e.dashboard.blockers} />
            </Panel>
          )}
        </aside>
      </div>

      {e.dashboard && (
        <section className="mt-8" aria-labelledby="dashboard-title">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <LayoutDashboard size={18} aria-hidden />
            </span>
            <h2 id="dashboard-title" className="text-lg font-bold tracking-tight text-neutral-900">
              Budget dashboard
            </h2>
          </div>
          <BudgetDashboard dashboard={e.dashboard} links={links} />
        </section>
      )}
    </div>
  );
}
