"use client";

import { useCallback, useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { ButtonLink, Card, PageHeader, Panel } from "@/components/workspace/kit";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { banking, errorText, type StatementAnalysis, type StatementDetail } from "@/lib/api/finance-banking-client";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { day } from "@/suite/finance/lib/format";
import { isProcessing } from "@/suite/finance/components/banking/labels";
import RetryImportButton from "@/suite/finance/components/banking/RetryImportButton";
import { Figure, ImportStatusChip, Money, Spinner, VerifiedBadge } from "@/suite/finance/components/banking/ui";
import AnalysisView from "./AnalysisView";
import JournalsPanel from "./JournalsPanel";
import ReviewQueue from "./ReviewQueue";
import VerificationPanel, { Pipeline } from "./VerificationPanel";

/**
 * One uploaded statement: what was read and whether it can be trusted, the
 * review queue, the journals proposed from it, and where the money went.
 * The approval engine links here.
 */

type Tab = "review" | "journals" | "analysis";

export default function StatementImportDetail({ id, pollMs = 2000 }: { id: string; pollMs?: number }) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("review");
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  const [analysis, setAnalysis] = useState<StatementAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [accountCurrency, setAccountCurrency] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    banking.statements
      .get(id)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`This statement didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [id, reload]);

  // A CSV prints no currency; the account knows it.
  const accountId = detail?.bankAccountId ?? null;
  const needCurrency = detail !== null && !detail.currency;
  useEffect(() => {
    if (!needCurrency || accountId === null) return;
    let alive = true;
    banking.accounts.list().then(
      (rows) => alive && setAccountCurrency(rows.find((a) => a.id === accountId)?.currency ?? null),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [needCurrency, accountId]);

  // Still on the queue: look again shortly.
  const processing = detail !== null && isProcessing(detail.status);
  useEffect(() => {
    if (!processing) return;
    const t = window.setTimeout(() => setReload((k) => k + 1), pollMs);
    return () => window.clearTimeout(t);
  }, [processing, detail, pollMs]);

  // The analysis loads the first time its tab opens, and again after a change.
  useEffect(() => {
    if (tab !== "analysis" || detail === null || analysis !== null) return;
    let alive = true;
    banking.statements
      .analysis(id)
      .then((a) => alive && setAnalysis(a))
      .catch((e: unknown) => alive && setAnalysisError(`The analysis didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [tab, id, detail, analysis]);

  const refresh = useCallback(() => {
    setReload((k) => k + 1);
    setAnalysis(null);
  }, []);

  if (loadError && detail === null) {
    return (
      <div>
        <BackLink href="/suite/finance/banking/imports" label="Statements" />
        <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the statement…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[180px]" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const d = detail;
  const currency = d.currency ?? accountCurrency ?? "NGN";
  const failed = d.status === "failed_validation";
  const ready = d.status === "ready_for_review";
  const may = {
    classify: mayDo(user, "statements", "update_line"),
    propose: mayDo(user, "statements", "propose"),
    submit: mayDo(user, "statements", "submit"),
    post: mayDo(user, "statements", "post"),
  };
  const periodTitle = d.periodFrom ? `${day(d.periodFrom)} to ${day(d.periodTo)}` : d.fileName;
  const tabs = [
    { key: "review", label: "Review", count: d.counts.needsAccount || undefined },
    { key: "journals", label: "Journals", count: d.journals.length || undefined },
    { key: "analysis", label: "Analysis" },
  ];

  return (
    <div>
      <BackLink href={`/suite/finance/banking/${d.bankAccountId}`} label={d.bankAccount ?? "Bank account"} />
      <PageHeader
        eyebrow={`${d.bankAccount ?? "Bank statement"}${d.accountNo ? ` · ${d.accountNo}` : ""}`}
        title={periodTitle}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ImportStatusChip status={d.status} />
            <VerifiedBadge verified={d.verified} />
            <span className="text-neutral-500">
              {d.fileName}
              {d.uploadedBy ? ` · uploaded by ${d.uploadedBy}` : ""}
              {d.uploadedAt ? ` on ${day(d.uploadedAt)}` : ""}
            </span>
          </span>
        }
        actions={
          d.periodTo && !failed && !processing ? (
            <ButtonLink href={`/suite/finance/banking/${d.bankAccountId}/reconciliation/${d.periodTo.slice(0, 7)}`} icon={Scale}>
              Reconcile this month
            </ButtonLink>
          ) : (
            <RetryImportButton statement={d} allowed={mayDo(user, "statements", "retry")} size="md" variant="primary" onRetried={refresh} />
          )
        }
        tabs={failed || processing ? undefined : tabs}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {loadError && <ErrorNote className="mb-4">{loadError}</ErrorNote>}

      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Opening balance">
              <Money value={d.opening} currency={currency} />
            </Figure>
            <Figure label="Withdrawals" tone="out">
              <Money value={d.withdrawals} currency={currency} />
            </Figure>
            <Figure label="Deposits" tone="in">
              <Money value={d.deposits} currency={currency} />
            </Figure>
            <Figure label="Closing balance">
              <Money value={d.closing} currency={currency} />
            </Figure>
          </dl>
        </div>
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <Pipeline detail={d} />
        </div>
      </Card>

      {processing ? (
        <Panel title="Reading the statement" subtitle="This page updates by itself">
          <Spinner label="Reading the file and checking it against the account. This takes a few seconds." />
        </Panel>
      ) : (
        <div className="space-y-6">
          {(failed || tab === "review") && <VerificationPanel detail={d} />}

          {!failed && tab === "review" && (
            <Panel
              title="Review the lines"
              subtitle={
                ready
                  ? d.counts.needsAccount > 0
                    ? `${d.counts.needsAccount} ${d.counts.needsAccount === 1 ? "line needs" : "lines need"} an account before journals can be sent.`
                    : "Every line has an account. Propose the journals next."
                  : "This statement has been sent on; its lines can no longer change."
              }
            >
              <ReviewQueue
                importId={d.id}
                currency={currency}
                editable={ready && may.classify}
                initialFilter={ready && d.counts.needsAccount > 0 ? "needs_account" : "all"}
                focusIds={focusIds}
                onClearFocus={() => setFocusIds(null)}
                onChanged={refresh}
              />
            </Panel>
          )}

          {!failed && tab === "journals" && <JournalsPanel detail={d} currency={currency} may={may} onChanged={refresh} />}

          {!failed && tab === "analysis" &&
            (analysisError ? (
              <ErrorNote>{analysisError}</ErrorNote>
            ) : analysis === null ? (
              <Skeleton className="h-[480px]" />
            ) : (
              <AnalysisView
                data={analysis}
                onShowLines={(ids) => {
                  setFocusIds(ids);
                  setTab("review");
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}
