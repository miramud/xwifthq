"use client";

import { useCallback, useEffect, useState } from "react";
import { Segmented, Toolbar } from "@/components/workspace/kit";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { ApiError, platformOrganisations, type Paginated, type PlatformAuditEntry } from "@/lib/api/platform-client";
import AuditTable from "../AuditTable";
import { LoadError, Pager } from "../ui";

type Severity = "" | "info" | "warning" | "critical";

/** Everything recorded against one organisation, newest first. */
export default function OrganisationAudit({ slug }: { slug: string }) {
  const [severity, setSeverity] = useState<Severity>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<PlatformAuditEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    platformOrganisations
      .audit(slug, { severity: severity || undefined, page, perPage: 25 })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "The audit trail didn't load."));
  }, [slug, severity, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Toolbar>
        <Segmented<Severity>
          label="Severity"
          value={severity}
          onChange={(v) => {
            setSeverity(v);
            setPage(1);
          }}
          options={[
            { key: "", label: "All" },
            { key: "critical", label: "Critical" },
            { key: "warning", label: "Warning" },
            { key: "info", label: "Info" },
          ]}
        />
      </Toolbar>

      {error ? (
        <LoadError
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      ) : data === null ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <AuditTable rows={data.data} showOrganisation={false} />
          <Pager page={data.meta.currentPage} lastPage={data.meta.lastPage} total={data.meta.total} onPage={setPage} noun="entries" />
        </>
      )}
    </div>
  );
}
