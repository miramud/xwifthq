"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ban, BadgeCheck, Check, FileDown, Fingerprint, Hash, OctagonX, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { plainError, spend, type PaymentScheduleDetail, type VoucherSummary } from "@/lib/api/finance-payments-client";
import { Button, Card, Chip, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { StepUpDialog, stepUpReason } from "@/components/workspace/StepUpDialog";
import { mfa } from "@/lib/api/account-client";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, day } from "@/suite/finance/lib/format";
import ReasonDialog from "../vouchers/ReasonDialog";
import { PvNumber, VoucherStatusChip } from "../vouchers/ui";
import { SCHEDULE_STATUS, bankFileName, groupHash, saveText, sha256Hex } from "./meta";

/**
 * One payment schedule: its vouchers and total, the second person's
 * approval, the bank file (its SHA-256 shown once it is produced, so the
 * file uploaded to the bank can be proved to be the one approved), and the
 * bank reference recorded against each voucher as it goes out.
 */

const STAGES = ["Built", "Approved by a second person", "Bank file downloaded", "Bank references recorded"];

export default function ScheduleDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [s, setS] = useState<PaymentScheduleDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [localHash, setLocalHash] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "initiated" | "failed"; voucher: VoucherSummary } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  /** Approving needs the approver's authenticator code (the total reached the organisation's step-up amount). */
  const [askCode, setAskCode] = useState(false);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(() => (params?.get("notice") === "built" ? "Schedule built. Somebody other than you approves it before the bank file can be downloaded." : null));

  const load = useCallback(() => {
    spend.schedules.get(id).then(
      (d) => {
        setS(d);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(plainError(e, "The schedule didn't load.")),
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load, reload]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/payments?tab=schedules" label="All schedules" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!s) return <Skeleton className="h-[30rem]" />;

  const meta = SCHEDULE_STATUS[s.status] ?? SCHEDULE_STATUS.draft;
  const builtByMe = user?.id === s.createdById;
  const approvedish = s.status === "approved" || s.status === "downloaded" || s.status === "completed";
  const live = s.vouchers.filter((v) => v.status !== "cancelled");
  const sent = live.filter((v) => v.status === "payment_initiated" || v.status === "paid_confirmed").length;
  const stage = s.status === "draft" ? 1 : s.status === "approved" ? 2 : sent < live.length ? 3 : 4;
  const canApprove = s.status === "draft" && mayDo(user, "payments", "approve");
  const canDownload = (s.status === "approved" || s.status === "downloaded") && mayDo(user, "payments", "bank_file");
  // The API refuses once any payment on the schedule has gone out.
  const canCancel =
    (s.status === "draft" || s.status === "approved" || s.status === "downloaded") &&
    !s.vouchers.some((v) => v.status === "payment_initiated" || v.status === "paid_confirmed") &&
    mayDo(user, "payments", "cancel");

  const approved = () => {
    setNotice("Schedule approved. The bank file can now be downloaded.");
    load();
  };

  const openStepUp = () => {
    setAskCode(true);
    mfa
      .status()
      .then((m) => setEnrolled(m.enabled))
      .catch(() => setEnrolled(null));
  };

  const approve = async () => {
    // The code dialog says what is being approved and is the confirmation itself.
    if (s.stepUp) return openStepUp();
    const ok = await confirm({
      title: `Approve ${s.reference}?`,
      body: `${live.length} ${live.length === 1 ? "payment" : "payments"} totalling ${amount(s.total)} from ${s.bankAccount ?? "this account"}. Once approved, the bank file can be downloaded and uploaded to the bank.`,
      confirmLabel: "Approve schedule",
      tone: "primary",
    });
    if (!ok) return;
    setBusy("approve");
    setActionError(null);
    try {
      await spend.schedules.approve(s.id);
      approved();
    } catch (e) {
      const reason = stepUpReason(e);
      // The step-up amount was set after this page loaded.
      if (reason === "MFA_REQUIRED" || reason === "MFA_NOT_ENROLLED") openStepUp();
      else setActionError(plainError(e));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("file");
    setActionError(null);
    try {
      const text = await spend.schedules.bankFile(s.id);
      saveText(text, bankFileName(s.reference));
      setLocalHash(await sha256Hex(text));
      setNotice("Bank file downloaded. Its fingerprint is below; upload it to the bank as it is.");
      load();
    } catch (e) {
      setActionError(plainError(e, "The bank file wasn't produced."));
    } finally {
      setBusy(null);
    }
  };

  const matches = localHash && s.fileSha256 ? localHash === s.fileSha256 : null;

  return (
    <div>
      <BackLink href="/suite/finance/payments?tab=schedules" label="All schedules" />
      <Notice text={notice} />

      <Card className="mb-5 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Payment schedule</p>
            <h1 className="mt-2">
              <PvNumber value={s.reference} size="xl" />
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip hue={meta.hue} icon={meta.icon}>
                {meta.label}
              </Chip>
              <span className="text-sm text-neutral-500">
                From <span className="font-semibold text-neutral-800">{s.bankAccount ?? "—"}</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-600">
              Built by {s.createdBy ?? "—"}
              {s.createdAt ? ` on ${day(s.createdAt)}` : ""}
              {s.approvedBy ? ` · approved by ${s.approvedBy}${s.approvedAt ? ` on ${day(s.approvedAt)}` : ""}` : ""}
            </p>
          </div>
          <div className="lg:text-right">
            <p className="text-sm text-neutral-500">
              {live.length} {live.length === 1 ? "payment" : "payments"}
            </p>
            <p className="text-[32px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">{amount(s.total)}</p>
            <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
              {canDownload && (
                <Button variant={s.status === "approved" ? "primary" : "secondary"} icon={FileDown} onClick={download} disabled={busy !== null}>
                  {busy === "file" ? "Preparing…" : s.status === "downloaded" ? "Download bank file again" : "Download bank file"}
                </Button>
              )}
              {canApprove && (
                <Button variant="primary" icon={BadgeCheck} onClick={approve} disabled={busy !== null || builtByMe} aria-describedby={builtByMe ? "sched-sod" : undefined}>
                  {busy === "approve" ? "Approving…" : "Approve schedule"}
                </Button>
              )}
              {canCancel && (
                <Button variant="ghost" icon={Ban} onClick={() => setCancelling(true)} disabled={busy !== null}>
                  Cancel schedule
                </Button>
              )}
            </div>
            {canApprove && builtByMe && (
              <p id="sched-sod" className="mt-2 flex items-start gap-1.5 text-xs text-neutral-600 lg:justify-end">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-grape-600" aria-hidden />
                You built this schedule, so somebody else approves it.
              </p>
            )}
            {canApprove && !builtByMe && s.stepUp && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-600 lg:justify-end">
                <Fingerprint size={14} className="mt-0.5 shrink-0 text-primary-600" aria-hidden />
                At this amount, approving needs the code from your authenticator app.
              </p>
            )}
          </div>
        </div>
        {actionError && <ErrorNote className="mt-4">{actionError}</ErrorNote>}

        <ol className="mt-6 grid gap-3 sm:grid-cols-4" aria-label="Where this schedule is">
          {STAGES.map((label, i) => {
            const done = i < stage;
            const now = i === stage && s.status !== "cancelled";
            return (
              <li key={label} className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm", done ? "bg-mint-50 text-mint-700" : now ? "bg-primary-50 text-primary-700" : "ws-hatch text-neutral-500")}>
                <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-mint-500 text-white" : now ? "bg-white ring-2 ring-primary-500" : "bg-white")}>
                  {done ? <Check size={13} aria-hidden /> : i + 1}
                </span>
                <span className="font-semibold">{label}</span>
                <span className="sr-only">{done ? ", done" : now ? ", next" : ", to come"}</span>
              </li>
            );
          })}
        </ol>
        {s.status === "draft" && (
          <p className="mt-3 text-xs text-neutral-500">
            A second person approves every schedule: whoever built it can&apos;t, so no one person can both choose the payments and release them.
          </p>
        )}
      </Card>

      {(s.fileSha256 || localHash) && (
        <Card className="mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Fingerprint size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-neutral-900">Bank file fingerprint (SHA-256)</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Recorded when the file was produced{s.generatedAt ? `, ${day(s.generatedAt)}` : ""}. A file whose fingerprint differs has been changed since.
            </p>
            <p className="mt-2 break-all rounded-lg bg-neutral-50 px-3 py-2 font-mono text-[13px] leading-relaxed text-neutral-800">{groupHash(s.fileSha256 ?? localHash ?? "")}</p>
            {matches !== null && (
              <p className={cx("mt-2 flex items-center gap-1.5 text-sm font-semibold", matches ? "text-mint-700" : "text-rose-700")}>
                {matches ? <Check size={15} aria-hidden /> : <OctagonX size={15} aria-hidden />}
                {matches ? "The file you downloaded matches the recorded fingerprint." : "The file you downloaded doesn't match the recorded fingerprint. Don't upload it; download it again."}
              </p>
            )}
          </div>
        </Card>
      )}

      <Panel title="Vouchers on this schedule" icon={Hash} bodyClassName="p-0 pt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Vouchers on {s.reference}</caption>
            <thead>
              <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th scope="col" className="py-2.5 pl-5 pr-2">Voucher</th>
                <th scope="col" className="px-2 py-2.5">Payee and account</th>
                <th scope="col" className="px-2 py-2.5">Status</th>
                <th scope="col" className="px-2 py-2.5">Bank reference</th>
                <th scope="col" className="px-2 py-2.5 text-right">Net payable</th>
                <th scope="col" className="py-2.5 pl-2 pr-5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {s.vouchers.map((v) => {
                const canRecord = v.status === "scheduled" && approvedish && mayDo(user, "payments", "initiated");
                const canFail = v.status === "payment_initiated" && mayDo(user, "payments", "failed");
                return (
                  <tr key={v.id} className="border-b border-neutral-100 align-top last:border-b-0">
                    <td className="py-3 pl-5 pr-2">
                      <Link href={`/suite/finance/vouchers/${v.id}`} className="hover:underline">
                        <PvNumber value={v.pvNo} />
                      </Link>
                    </td>
                    <td className="px-2 py-3">
                      <span className="font-medium text-neutral-900">{v.payee}</span>
                      <span className="block text-xs text-neutral-500">
                        {v.payeeBank ? (
                          <>
                            {v.payeeBank.accountName} · {v.payeeBank.bankName} <span className="font-mono">•••• {v.payeeBank.last4}</span>
                          </>
                        ) : (
                          "No bank account on record"
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <VoucherStatusChip status={v.status} />
                    </td>
                    <td className="px-2 py-3 font-mono text-[13px] text-neutral-700">{v.cibReference ?? <span className="font-sans text-neutral-500">—</span>}</td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums text-neutral-900">{amount(v.net, v.currency as "NGN")}</td>
                    <td className="py-2 pl-2 pr-5">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canRecord && (
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "initiated", voucher: v })}>
                            Record bank reference
                          </Button>
                        )}
                        {canFail && (
                          <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "failed", voucher: v })}>
                            Payment failed
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50/70 font-semibold text-neutral-900">
                <th scope="row" colSpan={4} className="py-3 pl-5 pr-2 text-left">
                  Total
                </th>
                <td className="px-2 py-3 text-right tabular-nums">{amount(s.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {s.status === "draft" && live.length > 0 && (
          <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">Bank references are recorded once the schedule is approved.</p>
        )}
      </Panel>

      {dialog?.kind === "initiated" && (
        <ReasonDialog
          title={`Record the bank reference for ${dialog.voucher.pvNo}`}
          subtitle={`${dialog.voucher.payee}, ${amount(dialog.voucher.net)}. The reference the bank's portal gave when the payment went out.`}
          label="Bank reference"
          placeholder="e.g. CIB2610060012345"
          hint="The FCU matches it to the bank statement to confirm the payment."
          single
          maxLength={64}
          confirmLabel="Record bank reference"
          busyLabel="Recording…"
          onClose={() => setDialog(null)}
          onConfirm={async (ref) => {
            await spend.schedules.initiated(dialog.voucher.id, ref);
            setDialog(null);
            setNotice(`${dialog.voucher.pvNo} recorded as sent, reference ${ref}.`);
            load();
          }}
        />
      )}
      {cancelling && (
        <ReasonDialog
          title={`Cancel ${s.reference}?`}
          subtitle={`Its ${live.length === 1 ? "payment goes" : `${live.length} payments go`} back to the queue to be paid on another schedule.${s.status === "downloaded" ? " Don't upload the bank file already downloaded." : ""} This can't be undone.`}
          label="Why it is cancelled"
          placeholder="e.g. Wrong bank account chosen"
          tone="danger"
          confirmLabel="Cancel schedule"
          busyLabel="Cancelling…"
          onClose={() => setCancelling(false)}
          onConfirm={async (reason) => {
            await spend.schedules.cancel(s.id, reason);
            setCancelling(false);
            setNotice(`${s.reference} cancelled. Its payments are back in the queue.`);
            load();
          }}
        />
      )}
      {askCode && (
        <StepUpDialog
          title={`Approve ${s.reference} with your code`}
          summary={`${live.length} ${live.length === 1 ? "payment" : "payments"} · ${amount(s.total)}${s.bankAccount ? ` from ${s.bankAccount}` : ""}`}
          actionLabel="Approve schedule"
          enrolled={enrolled}
          onCancel={() => setAskCode(false)}
          onSubmit={async (code) => {
            try {
              await spend.schedules.approve(s.id, code);
            } catch (e) {
              if (stepUpReason(e) !== null) throw e;
              setAskCode(false);
              setActionError(plainError(e));
              return;
            }
            setAskCode(false);
            approved();
          }}
        />
      )}
      {dialog?.kind === "failed" && (
        <ReasonDialog
          title={`Record a failed payment for ${dialog.voucher.pvNo}?`}
          subtitle="The voucher goes back to the queue to be paid, off this schedule. The failed attempt stays on its record."
          label="What went wrong"
          placeholder="e.g. Beneficiary account dormant, returned by the bank"
          tone="danger"
          confirmLabel="Record failed payment"
          busyLabel="Recording…"
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            await spend.schedules.failed(dialog.voucher.id, reason);
            setDialog(null);
            setNotice(`${dialog.voucher.pvNo} recorded as failed. It is back in the queue to be paid.`);
            load();
          }}
        />
      )}
    </div>
  );
}
