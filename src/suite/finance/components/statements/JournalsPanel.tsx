"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookCheck, FilePlus2, NotebookPen, Send, ShieldCheck, Stamp, UserCheck } from "lucide-react";
import { Button, ButtonLink, Chip, Empty, Panel } from "@/components/workspace/kit";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { banking, errorText, type StatementDetail } from "@/lib/api/finance-banking-client";
import { day } from "@/suite/finance/lib/format";
import { humanise } from "@/suite/finance/components/banking/labels";
import { Money } from "@/suite/finance/components/banking/ui";

/**
 * From reviewed lines to the ledger, maker-checker. Proposing builds draft
 * journals (bank charges grouped by month, own-account transfers as one
 * journal, a reversal pair as none); sending them for approval hands them to
 * somebody who neither uploaded nor reviewed the statement; approval posts.
 * Where the organisation runs no approval step, that second person posts
 * here instead.
 */

const JOURNAL_STATUS: Record<string, { label: string; hue: "sun" | "grape" | "mint" | "rose" | "slate" }> = {
  draft: { label: "Draft", hue: "sun" },
  pending_approval: { label: "Waiting for approval", hue: "grape" },
  posted: { label: "Posted", hue: "mint" },
  rejected: { label: "Rejected", hue: "rose" },
  reversed: { label: "Reversed", hue: "slate" },
};

export default function JournalsPanel({
  detail,
  currency,
  may,
  onChanged,
}: {
  detail: StatementDetail;
  currency: string;
  may: { propose: boolean; submit: boolean; post: boolean };
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<null | "propose" | "submit" | "post">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ready = detail.status === "ready_for_review";
  const submitted = detail.status === "submitted";
  const posted = detail.status === "posted";
  const waiting = detail.counts.needsAccount;
  const journals = detail.journals;

  const run = async (what: "propose" | "submit" | "post") => {
    setError(null);
    setNotice(null);
    if (what === "post") {
      const ok = await confirm({
        title: "Post these journals to the ledger?",
        body: "They go into the books dated as on the statement. A posted journal can only be undone by reversing it.",
        confirmLabel: "Post journals",
        tone: "primary",
      });
      if (!ok) return;
    }
    setBusy(what);
    try {
      if (what === "propose") {
        const r = await banking.statements.propose(detail.id);
        setNotice(
          `${r.journals.length} draft ${r.journals.length === 1 ? "journal" : "journals"} proposed.` +
            (r.unclassified > 0 ? ` ${r.unclassified} ${r.unclassified === 1 ? "line still needs" : "lines still need"} an account; they are left out until classified.` : ""),
        );
      } else if (what === "submit") {
        const r = await banking.statements.submit(detail.id);
        setNotice(r.approvalId ? "Sent for approval. The approver sees it in Approvals." : "Sent for checking. Somebody who neither uploaded nor reviewed this statement can now post it here.");
      } else {
        await banking.statements.post(detail.id);
        setNotice("Posted. The journals are in the ledger.");
      }
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        {error && <ErrorNote>{error}</ErrorNote>}
        {notice && (
          <p role="status" className="rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">
            {notice}
          </p>
        )}

        <Panel
          title="Proposed journals"
          subtitle={journals.length ? `${journals.length} ${journals.length === 1 ? "journal" : "journals"} from this statement` : "Nothing proposed yet"}
          icon={NotebookPen}
          actions={
            ready && may.propose ? (
              <Button size="sm" icon={FilePlus2} disabled={busy !== null} onClick={() => void run("propose")}>
                {busy === "propose" ? "Proposing…" : journals.length ? "Propose again" : "Propose journals"}
              </Button>
            ) : undefined
          }
          bodyClassName="p-0"
        >
          {ready && waiting > 0 && (
            <p className="mx-5 mt-4 rounded-xl bg-sun-50 px-4 py-2.5 text-sm text-sun-700">
              {waiting} {waiting === 1 ? "line has" : "lines have"} no account yet. Propose now and they are left out; classify them first to include them.
            </p>
          )}
          {journals.length === 0 ? (
            <Empty
              icon={NotebookPen}
              title="No journals proposed yet."
              hint={ready ? "Classify the lines, then propose journals. You can propose again after changing a line." : "Nothing was proposed from this statement."}
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {journals.map((j) => {
                const s = JOURNAL_STATUS[j.status] ?? { label: humanise(j.status), hue: "slate" as const };
                return (
                  <li key={j.id}>
                    <Link
                      href={`/suite/finance/journals/${j.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 outline-none hover:bg-neutral-50 focus-visible:bg-primary-50/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">{j.narration ?? "Journal"}</span>
                        <span className="block text-xs text-neutral-500">
                          {j.journalNo ?? "Unnumbered draft"} · {day(j.date)}
                        </span>
                      </span>
                      <Chip hue={s.hue} dot className="hidden sm:inline-flex">
                        {s.label}
                      </Chip>
                      <Money value={j.total} currency={currency} className="w-36 text-right text-sm font-semibold text-neutral-900" />
                      <ArrowUpRight size={15} className="shrink-0 text-neutral-400" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Getting it into the books" icon={ShieldCheck} hue="grape">
          <ol className="space-y-4 text-sm">
            <Step icon={FilePlus2} done={journals.length > 0} title="Propose journals">
              Builds draft journals from the classified lines. Bank charges are grouped by month; a reversal and the payment it undoes cancel out.
            </Step>
            <Step icon={UserCheck} done={submitted || posted} title="Send for approval">
              A second person checks them. Whoever uploaded the statement or classified its lines can&apos;t approve it.
            </Step>
            <Step icon={Stamp} done={posted} title="Post">
              Approval posts the journals to the ledger. Where there is no approval step, a second person posts them here.
            </Step>
          </ol>

          <div className="mt-5 border-t border-neutral-100 pt-4">
            {posted ? (
              <Chip hue="mint" icon={BookCheck}>
                Posted to the ledger
              </Chip>
            ) : submitted && detail.approvalId ? (
              <div className="space-y-2">
                <Chip hue="grape" icon={Send}>
                  Waiting for approval
                </Chip>
                <ButtonLink href={`/suite/approvals/${detail.approvalId}`} size="sm" icon={ArrowUpRight}>
                  Open in Approvals
                </ButtonLink>
              </div>
            ) : submitted ? (
              may.post ? (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500">Sent for checking. Post only if you neither uploaded nor reviewed this statement.</p>
                  <Button variant="primary" icon={Stamp} disabled={busy !== null} onClick={() => void run("post")}>
                    {busy === "post" ? "Posting…" : "Post journals"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Sent for checking. A colleague with permission to post statements posts it from here.</p>
              )
            ) : ready && may.submit ? (
              <div className="space-y-2">
                <Button variant="primary" icon={Send} disabled={busy !== null || journals.length === 0 || waiting > 0} onClick={() => void run("submit")} className="w-full">
                  {busy === "submit" ? "Sending…" : "Send for approval"}
                </Button>
                <p className="text-xs text-neutral-500">
                  {journals.length === 0 ? "Propose the journals first." : waiting > 0 ? `Classify or ignore the ${waiting} remaining ${waiting === 1 ? "line" : "lines"} first.` : "Every line is accounted for."}
                </p>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Step({ icon: Icon, done, title, children }: { icon: typeof Send; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={done ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-mint-700" : "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500"}>
        <Icon size={15} aria-hidden />
      </span>
      <span>
        <span className="block font-semibold text-neutral-900">
          {title}
          {done && <span className="ml-1.5 text-xs font-semibold text-mint-700">Done</span>}
        </span>
        <span className="block text-xs leading-relaxed text-neutral-600">{children}</span>
      </span>
    </li>
  );
}
