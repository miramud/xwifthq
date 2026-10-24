"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { FilterX, SlidersHorizontal } from "lucide-react";
import { Button, PageHeader, Panel, Segmented } from "@/components/workspace/kit";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { platformAudit, type AuditFilters } from "@/lib/api/platform-client";
import AuditTable from "./AuditTable";
import { LoadError, Pager, useLoad } from "./ui";

type Severity = "" | "info" | "warning" | "critical";

const field =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";

/**
 * What everybody did, across every organisation and the platform itself.
 *
 * Filters go to the API (the log is far too long to page through in the
 * browser), and text filters wait for a pause in typing before asking.
 */
export default function AuditLogBoard() {
  const id = useId();
  const [organisation, setOrganisation] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [severity, setSeverity] = useState<Severity>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<AuditFilters>({});

  // Debounce the free-text filters into one applied set.
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied({
        organisation: organisation.trim() || undefined,
        actor: actor.trim() || undefined,
        action: action.trim() || undefined,
        severity: severity || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [organisation, actor, action, severity, from, to]);

  const fetchLog = useCallback(() => platformAudit.list({ ...applied, page, perPage: 30 }), [applied, page]);
  const { data, error, loading, reload } = useLoad(fetchLog, "The audit log didn't load.");

  const filtered = Boolean(organisation || actor || action || severity || from || to);

  function clear() {
    setOrganisation("");
    setActor("");
    setAction("");
    setSeverity("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        subtitle="Every change recorded on the platform and in every organisation."
      />

      <Panel
        title="Filters"
        subtitle="Narrow the log by organisation, person, action, date or severity"
        icon={SlidersHorizontal}
        hue="sky"
        actions={
          filtered ? (
            <Button size="sm" variant="ghost" icon={FilterX} onClick={clear}>
              Clear filters
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-neutral-600" htmlFor={`${id}-org`}>
            Organisation
            <input id={`${id}-org`} value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Name or slug" className={`${field} mt-1`} />
          </label>
          <label className="text-xs font-medium text-neutral-600" htmlFor={`${id}-actor`}>
            Person
            <input id={`${id}-actor`} value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Name or email" className={`${field} mt-1`} />
          </label>
          <label className="text-xs font-medium text-neutral-600" htmlFor={`${id}-action`}>
            Action
            <input id={`${id}-action`} value={action} onChange={(e) => setAction(e.target.value)} placeholder="For example, course.deleted" className={`${field} mt-1`} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-neutral-600" htmlFor={`${id}-from`}>
              From
              <input id={`${id}-from`} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="text-xs font-medium text-neutral-600" htmlFor={`${id}-to`}>
              To
              <input id={`${id}-to`} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1`} />
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented<Severity>
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={[
              { key: "", label: "All" },
              { key: "critical", label: "Critical" },
              { key: "warning", label: "Warning" },
              { key: "info", label: "Info" },
            ]}
          />
        </div>
      </Panel>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-96 rounded-[1.25rem]" />
      ) : (
        <div aria-busy={loading || undefined} className={loading ? "opacity-60 transition-opacity" : undefined}>
          <AuditTable rows={data.data} />
          <Pager page={data.meta.currentPage} lastPage={data.meta.lastPage} total={data.meta.total} onPage={setPage} noun="entries" />
        </div>
      )}
    </div>
  );
}
