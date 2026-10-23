"use client";

import { useEffect, useState } from "react";
import { BookCheck, BookOpen, CircleCheck, ExternalLink } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Progress } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { stampOf } from "@/suite/operations/components/assets/labels";
import { myRepository, repoError, type PolicyToRead } from "@/lib/api/repository-client";
import { richExcerpt } from "@/lib/richText";

/**
 * The policies in force, the ones sent to me to read first: open the file,
 * then say I have read it. What I have read, and policies I may read but
 * was not asked to, follow.
 */
export default function MyPolicies() {
  const confirm = useConfirm();
  const [data, setData] = useState<{ policies: PolicyToRead[]; toRead: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    myRepository.policies().then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Your policies didn't load. ${repoError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Policies to read" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading your policies…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const toRead = data.policies.filter((p) => p.assigned && !p.acknowledgedAt);
  const read = data.policies.filter((p) => p.assigned && p.acknowledgedAt);
  const others = data.policies.filter((p) => !p.assigned);
  const asked = toRead.length + read.length;

  const acknowledge = async (p: PolicyToRead) => {
    const ok = await confirm({
      title: `Confirm you have read ${p.code}?`,
      body: `You confirm you have read and understood ${p.title}, version ${p.version}. Your confirmation is recorded with the date.`,
      confirmLabel: "I have read it",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(p.versionId);
    setActionError(null);
    try {
      const r = await myRepository.acknowledge(p.versionId);
      setData((d) =>
        d
          ? {
              toRead: Math.max(0, d.toRead - 1),
              policies: d.policies.map((x) => (x.versionId === p.versionId ? { ...x, acknowledgedAt: r.acknowledgedAt ?? new Date().toISOString() } : x)),
            }
          : d,
      );
    } catch (e) {
      setActionError(repoError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Policies to read"
        subtitle={toRead.length ? `${toRead.length} ${toRead.length === 1 ? "policy is" : "policies are"} waiting for you to read and confirm.` : "You are up to date with every policy sent to you."}
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      {data.policies.length === 0 ? (
        <Card>
          <Empty icon={BookCheck} title="No policies in force yet" hint="When a policy or SOP is approved, it appears here. Those sent to you to read come first." />
        </Card>
      ) : (
        <div className="space-y-6">
          {asked > 0 && (
            <Card className="p-5">
              <Progress value={(read.length / asked) * 100} hue={toRead.length ? "sun" : "mint"} label={`${read.length} of ${asked} read`} showValue />
            </Card>
          )}

          {toRead.length > 0 && (
            <section aria-labelledby="to-read">
              <h2 id="to-read" className="mb-3 text-[15px] font-semibold text-neutral-900">
                To read <span className="tabular-nums text-neutral-500">· {toRead.length}</span>
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {toRead.map((p) => (
                  <li key={p.versionId}>
                    <Card className="flex h-full flex-col gap-3 border-l-4 border-l-sun-500 p-5">
                      <PolicyHead p={p} />
                      {p.changeSummary && <p className="line-clamp-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{richExcerpt(p.changeSummary, 320)}</p>}
                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        <a
                          href={myRepository.policyFileHref(p.versionId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                        >
                          <ExternalLink size={16} aria-hidden />
                          Open
                          <span className="sr-only"> {p.title} (opens in a new tab)</span>
                        </a>
                        <Button variant="primary" icon={CircleCheck} disabled={busy === p.versionId} onClick={() => void acknowledge(p)}>
                          {busy === p.versionId ? "Saving…" : "I have read it"}
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(read.length > 0 || others.length > 0) && (
            <section aria-labelledby="in-force">
              <h2 id="in-force" className="mb-3 text-[15px] font-semibold text-neutral-900">
                {toRead.length ? "Read, and others in force" : "In force"}
              </h2>
              <Card>
                <ul className="divide-y divide-neutral-100">
                  {[...read, ...others].map((p) => (
                    <li key={p.versionId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <PolicyHead p={p} />
                      <div className="flex shrink-0 items-center gap-2">
                        {p.acknowledgedAt ? (
                          <Chip hue="mint" icon={CircleCheck}>
                            Read {stampOf(p.acknowledgedAt).split(",")[0]}
                          </Chip>
                        ) : (
                          <Chip>For reference</Chip>
                        )}
                        <a
                          href={myRepository.policyFileHref(p.versionId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary-700 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                        >
                          <BookOpen size={15} aria-hidden />
                          Open
                          <span className="sr-only"> {p.title} (opens in a new tab)</span>
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function PolicyHead({ p }: { p: PolicyToRead }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span className="font-mono font-semibold text-neutral-700">{p.code}</span>
        <span>{p.kindLabel}</span>
        <span>· v{p.version}</span>
        {p.effectiveOn && <span>· effective {day(p.effectiveOn)}</span>}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold text-neutral-900">{p.title}</p>
    </div>
  );
}
