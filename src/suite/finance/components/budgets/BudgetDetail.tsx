"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Hourglass, Send, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, ButtonLink, Chip, PageHeader } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { compact, day } from "@/suite/finance/lib/format";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { useProjectOptions } from "@/suite/finance/components/revenue/ui";
import { budgets, errorText, versionText, type BudgetDetail as Detail } from "@/lib/api/finance-budgets-client";
import { BudgetLines } from "./BudgetLines";
import { VersusActual } from "./VersusActual";
import { budgetStatus } from "./meta";

/**
 * One version of a year's budget: against actual (the default), and its
 * lines. A draft is edited line by line and sent for approval; approval
 * puts it in force and supersedes the version before.
 */

type Tab = "actual" | "lines";

export default function BudgetDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const confirm = useConfirm();
  const projects = useProjectOptions();
  const [tab, setTab] = useState<Tab>(params?.get("tab") === "lines" ? "lines" : "actual");
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ projectId: string; costCentreId: string }>({ projectId: "", costCentreId: "" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    budgets.get(id, { projectId: filter.projectId || null, costCentreId: filter.costCentreId || null }).then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`The budget didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, filter, reload]);

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => (!filter.projectId || r.projectId === filter.projectId) && (!filter.costCentreId || r.costCentreId === filter.costCentreId)),
    [data, filter],
  );

  if (error && !data)
    return (
      <div>
        <BackLink href="/suite/finance/budgets" label="All budgets" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!data)
    return (
      <div aria-busy="true">
        <BackLink href="/suite/finance/budgets" label="All budgets" />
        <p className="sr-only">Loading the budget…</p>
        <Skeleton className="mb-5 h-24" />
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const s = budgetStatus(data.status);
  const draft = data.status === "draft";
  const can = {
    edit: draft && mayDo(user, "budgets", "save_row"),
    refresh: draft && mayDo(user, "budgets", "refresh_revenue"),
    submit: draft && mayDo(user, "budgets", "submit"),
  };

  const submit = async () => {
    const ok = await confirm({
      title: `Send ${versionText(data.version).toLowerCase()} of FY${data.fiscalYear} for approval?`,
      body: `Income ${compact(data.totals.income)}, expense ${compact(data.totals.expense)}, net ${compact(data.totals.net)}. Once sent the lines are fixed; if it is returned you can change them again. When approved it comes into force${data.versionNo > 0 ? " and replaces the version before" : ""}.`,
      confirmLabel: "Send for approval",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      const b = await budgets.submit(data.id);
      setNotice(b.status === "approved" ? "Approved and in force: no approval process is switched on for budgets." : "Sent for approval. You'll see the outcome here.");
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const centres = data.costCentres.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }));
  const filters = (
    <div className="flex flex-wrap gap-2">
      <SearchableSelect
        value={filter.costCentreId}
        onChange={(v) => setFilter((f) => ({ ...f, costCentreId: v }))}
        options={centres}
        clearable
        clearLabel="Every cost centre"
        placeholder="Every cost centre"
        searchPlaceholder="Search cost centres"
        noOptionsText="No cost centres yet."
        size="sm"
        aria-label="Cost centre"
        className="w-52"
      />
      <SearchableSelect
        value={filter.projectId}
        onChange={(v) => setFilter((f) => ({ ...f, projectId: v }))}
        options={projects.items}
        clearable
        clearLabel="Every project"
        placeholder="Every project"
        searchPlaceholder="Search projects"
        noOptionsText={projects.status === "loading" ? "Loading projects…" : "No projects."}
        size="sm"
        aria-label="Project"
        className="w-52"
      />
    </div>
  );

  return (
    <div>
      <BackLink href="/suite/finance/budgets" label="All budgets" />
      <Notice text={notice} />
      <PageHeader
        eyebrow={`FY${data.fiscalYear} · ${versionText(data.version)}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.name}
            <Chip hue={s.hue} icon={s.icon}>
              {data.status === "approved" ? "Approved, in force" : s.label}
            </Chip>
          </span>
        }
        subtitle={
          data.status === "approved" && data.approvedAt
            ? `Approved ${day(data.approvedAt)}. Net ${compact(data.totals.net)} on income of ${compact(data.totals.income)}.`
            : `Net ${compact(data.totals.net)} on income of ${compact(data.totals.income)}${data.createdBy ? `. Started by ${data.createdBy}.` : "."}`
        }
        actions={
          <>
            {data.approvalId && (
              <ButtonLink href={`/suite/approvals/${data.approvalId}`} icon={ExternalLink}>
                Open the approval
              </ButtonLink>
            )}
            {can.submit && (
              <Button variant="primary" icon={Send} onClick={submit} disabled={busy}>
                {busy ? "Sending…" : "Send for approval"}
              </Button>
            )}
          </>
        }
        tabs={[
          { key: "actual", label: "Budget against actual" },
          { key: "lines", label: "Lines", count: data.rows.length },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {actionError && <ErrorNote className="mb-5">{actionError}</ErrorNote>}
      {data.status === "pending_approval" && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-2xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm text-sun-700">
          <Hourglass size={16} className="mt-0.5 shrink-0" aria-hidden />
          In approval. The lines are fixed until it is approved, or returned for changes.
        </p>
      )}
      {(data.status === "superseded" || data.status === "rejected") && (
        <p className="mb-5 flex items-start gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden />
          {data.status === "superseded" ? "A later version replaced this one. It is kept for the record." : "This version was rejected. Start a new one from the budgets page."}
        </p>
      )}

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-neutral-600">{filter.projectId || filter.costCentreId ? "Filtered" : "The whole company"}</p>
        {filters}
      </div>

      {tab === "actual" ? (
        <VersusActual va={data.versusActual} />
      ) : (
        <BudgetLines
          budget={data}
          rows={rows}
          canEdit={can.edit}
          canRefresh={can.refresh}
          onSaved={(m) => {
            setNotice(m);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
