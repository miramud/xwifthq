"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarClock, ClipboardCheck, FileCheck2, FileStack, Hash, Info, Landmark, Link2, ListOrdered, Receipt, SearchX } from "lucide-react";
import { Button, ButtonLink, Card, Chip, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { BackLink, ErrorNote, InfoList, InfoRow, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { errorCode, spend, spendError, type CandidateLine, type VoucherFull } from "@/lib/api/finance-spend-client";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, day } from "@/suite/finance/lib/format";
import { Money } from "@/suite/finance/components/banking/ui";
import { DocumentList, ReviewList, UploadZone, when } from "@/suite/finance/components/requests/ui";
import { voucherStatus } from "@/suite/finance/components/requests/labels";
import { MarkList, dutiesText, toMarkInput, type Marks } from "./ReviewChecklist";
import { VoucherFacts, VoucherFigures, VoucherLinesTable, useChecklist } from "./FcuReviews";

/**
 * FCU checkpoint 3: confirm a payment that has gone out against the bank's
 * evidence. A statement line is final; the bank's transaction receipt
 * confirms it provisionally, until the statement line arrives and is
 * matched here. Confirming posts the cash and settles the memos.
 */

type Evidence = "statement_line" | "cib_receipt";

/** Principal, fee and VAT of a candidate line, worked out when the API didn't split it. */
export function splitOf(line: CandidateLine, net: number): { principal: number; fee: number; vat: number; exact: boolean } {
  if (line.exact || line.amount === net) return { principal: line.amount, fee: 0, vat: 0, exact: true };
  const s = line.feeSplit;
  if (s && s.principal != null) return { principal: s.principal, fee: s.fee ?? 0, vat: s.vat ?? 0, exact: false };
  return { principal: net, fee: line.amount - net, vat: 0, exact: false };
}

function CandidateList({
  lines,
  net,
  currency,
  value,
  onChange,
  name,
}: {
  lines: CandidateLine[];
  net: number;
  currency: string;
  value: string;
  onChange: (id: string) => void;
  name: string;
}) {
  if (lines.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-sm text-neutral-600">
        <SearchX size={18} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
        <p>
          No line on the paying account&apos;s statement matches this payment yet. Import the statement that covers the day it went out, or confirm on the bank&apos;s receipt for now.
        </p>
      </div>
    );
  }
  return (
    <fieldset>
      <legend className="sr-only">Statement lines that could be this payment</legend>
      <ul className="space-y-3">
        {lines.map((l) => {
          const s = splitOf(l, net);
          const on = value === l.id;
          return (
            <li key={l.id}>
              <label
                className={cx(
                  "flex cursor-pointer gap-3 rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-primary-300",
                  on ? "border-primary-500 bg-primary-50/60" : "border-neutral-200 bg-white hover:border-neutral-300",
                )}
              >
                <input type="radio" name={name} value={l.id} checked={on} onChange={() => onChange(l.id)} className="mt-1 h-4 w-4 shrink-0 accent-primary-600" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-900">{day(l.date)}</span>
                      <span className="block break-words text-xs text-neutral-500">{l.narration ?? "No narration"}</span>
                    </span>
                    <Money value={l.amount} currency={currency} className="text-[15px] font-bold text-neutral-900" />
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {s.exact ? (
                      <Chip hue="mint" icon={BadgeCheck}>
                        Exact amount
                      </Chip>
                    ) : (
                      <>
                        <Chip hue="sky">With transfer fee</Chip>
                        <span className="tabular-nums text-neutral-600">
                          {amount(s.principal)} principal + {amount(s.fee)} fee + {amount(s.vat)} VAT
                        </span>
                      </>
                    )}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export default function PaymentConfirm({ id }: { id: string }) {
  const { user } = useAuth();
  const checklist = useChecklist(3);
  const [pv, setPv] = useState<VoucherFull | null>(null);
  const [lines, setLines] = useState<CandidateLine[] | null>(null);
  // A failed lookup is said as such, never shown as "nothing matches".
  const [linesError, setLinesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [evidence, setEvidence] = useState<Evidence>("statement_line");
  const [lineId, setLineId] = useState("");
  const [docId, setDocId] = useState("");
  const [marks, setMarks] = useState<Marks>({});
  const [busy, setBusy] = useState<"confirm" | "upload" | "match" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      spend.vouchers.get(id),
      spend.fcu.candidates(id).then(
        (c) => {
          if (alive) setLinesError(null);
          return c;
        },
        (e: unknown) => {
          if (alive) setLinesError(`The statement lines didn't load. ${spendError(e)}`);
          return [] as CandidateLine[];
        },
      ),
    ]).then(
      ([v, c]) => {
        if (!alive) return;
        setPv(v);
        setLines(c);
        setError(null);
        // One candidate, exactly the amount: chosen for you.
        if (c.length === 1) setLineId(c[0].id);
      },
      (e: unknown) => alive && setError(`This payment didn't load. ${spendError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);
  const back = "/suite/finance/fcu?tab=payments";

  if (error && !pv) {
    return (
      <div>
        <BackLink href={back} label="FCU queues" />
        <LoadError text={error} onRetry={refresh} />
      </div>
    );
  }
  if (!pv || lines === null) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the payment…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const st = voucherStatus(pv.provisional && pv.status === "paid_confirmed" ? "provisional" : pv.status);
  const toConfirm = pv.status === "payment_initiated";
  const toMatch = pv.status === "paid_confirmed" && pv.provisional;
  const may = mayDo(user, "fcu", toMatch ? "match_provisional" : "confirm");
  const items = checklist.items ?? [];
  const allMarked = items.length > 0 && items.every((i) => marks[i.code]?.result);
  const evidenceChosen = evidence === "statement_line" ? Boolean(lineId) : Boolean(docId);

  const failText = (e: unknown) => {
    const t = spendError(e);
    const code = errorCode(e);
    if (code === "SOD_VIOLATION") return dutiesText(t);
    if (code === "PAYMENT_DISCREPANCY") return `${t} Don't confirm it: record the difference and escalate it.`;
    return t;
  };

  const confirmPayment = async () => {
    setBusy("confirm");
    setActionError(null);
    try {
      const next = await spend.fcu.confirm(pv.id, {
        evidence,
        statementLineId: evidence === "statement_line" ? lineId : null,
        documentId: evidence === "cib_receipt" ? docId : null,
        items: toMarkInput(marks),
      });
      setPv(next);
      setDone(evidence === "statement_line" ? "Payment confirmed against the statement and posted. The memo is settled." : "Payment confirmed provisionally on the bank's receipt. Match the statement line here when it arrives.");
    } catch (e) {
      setActionError(failText(e));
    } finally {
      setBusy(null);
    }
  };

  const matchLine = async () => {
    setBusy("match");
    setActionError(null);
    try {
      setPv(await spend.fcu.match(pv.id, lineId));
      setDone("Matched. The payment now rests on the bank statement, and any transfer fee is posted.");
    } catch (e) {
      setActionError(failText(e));
    } finally {
      setBusy(null);
    }
  };

  const uploadReceipt = async (file: File) => {
    setBusy("upload");
    setUploadError(null);
    try {
      const docs = await spend.vouchers.upload(pv.id, file, "cib_receipt");
      setPv({ ...pv, documents: docs });
      const newest = docs[docs.length - 1];
      if (newest) setDocId(newest.id);
    } catch (e) {
      setUploadError(`${spendError(e)} If your role can't attach files to vouchers, ask the voucher's preparer or Treasury to attach the receipt.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <BackLink href={back} label="FCU queues" />
      <PageHeader
        eyebrow="Payment confirmation"
        title={`${pv.pvNo ?? "Voucher"} · ${pv.payee}`}
        subtitle={
          <Chip hue={st.hue} dot>
            {st.label}
          </Chip>
        }
      />
      <VoucherFigures pv={pv} />

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="min-w-0 space-y-5 xl:col-span-3">
          <Panel title="How it went out" icon={Landmark} hue="coral">
            <InfoList cols={2}>
              <InfoRow icon={Hash} label="Bank reference" hue="coral">
                {pv.cibReference ?? "-"}
              </InfoRow>
              <InfoRow icon={CalendarClock} label="Went out" hue="sun">
                {pv.initiatedAt ? when(pv.initiatedAt) : "-"}
              </InfoRow>
            </InfoList>
            <div className="mt-2 border-t border-neutral-100 pt-2">
              <VoucherFacts pv={pv} />
            </div>
          </Panel>
          <Panel title="Lines" icon={ListOrdered} hue="grape">
            <VoucherLinesTable pv={pv} />
          </Panel>
          <Panel title="Documents on the voucher" icon={FileStack} hue="sky">
            <DocumentList documents={pv.documents} />
          </Panel>
          {pv.reviews.length > 0 && (
            <Panel title="Earlier reviews" icon={ClipboardCheck} hue="mint">
              <ReviewList reviews={pv.reviews} />
            </Panel>
          )}
        </div>

        <aside className="min-w-0 xl:col-span-2" aria-label="Confirmation">
          <div className="space-y-5 xl:sticky xl:top-20">
            {done ? (
              <Card className="p-6 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-100 text-mint-700">
                  <FileCheck2 size={24} aria-hidden />
                </span>
                <p role="status" className="mt-3 text-[15px] font-semibold text-neutral-900">
                  {done}
                </p>
                <div className="mt-4 flex justify-center">
                  <ButtonLink href={back} variant="primary" icon={ArrowLeft}>
                    Back to the queue
                  </ButtonLink>
                </div>
              </Card>
            ) : toMatch ? (
              <Card className="p-5">
                <h2 className="text-[15px] font-semibold text-neutral-900">Match the statement line</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Confirmed on the bank&apos;s receipt{pv.confirmedAt ? ` on ${day(pv.confirmedAt)}` : ""}. Choose the line on the statement to make it final; a transfer fee on it is posted too.
                </p>
                <div className="mt-4">
                  {linesError ? <ErrorNote>{linesError}</ErrorNote> : <CandidateList lines={lines} net={pv.net} currency={pv.currency} value={lineId} onChange={setLineId} name="match-line" />}
                </div>
                {actionError && <ErrorNote className="mt-4">{actionError}</ErrorNote>}
                <div className="mt-5 flex justify-end">
                  <Button variant="primary" icon={Link2} onClick={() => void matchLine()} disabled={!may || !lineId || busy !== null}>
                    {busy === "match" ? "Matching…" : "Match this line"}
                  </Button>
                </div>
              </Card>
            ) : toConfirm ? (
              <Card className="p-5">
                <h2 className="text-[15px] font-semibold text-neutral-900">Confirm the payment</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Net payable <Money value={pv.net} currency={pv.currency} className="font-semibold text-neutral-900" />. Choose the bank&apos;s evidence for it.
                </p>

                <div role="radiogroup" aria-label="Evidence" className="mt-4 grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "statement_line", label: "Statement line", hint: "Final", icon: ListOrdered },
                      { key: "cib_receipt", label: "Bank's receipt", hint: "Provisional", icon: Receipt },
                    ] as const
                  ).map((o) => {
                    const on = evidence === o.key;
                    const Icon = o.icon;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setEvidence(o.key)}
                        className={cx(
                          "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                          on ? "border-primary-500 bg-primary-50/60" : "border-neutral-200 bg-white hover:border-neutral-300",
                        )}
                      >
                        <Icon size={16} className={on ? "text-primary-600" : "text-neutral-500"} aria-hidden />
                        <span className="text-sm font-semibold text-neutral-900">{o.label}</span>
                        <span className="text-xs text-neutral-500">{o.hint}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  {evidence === "statement_line" ? (
                    linesError ? (
                      <ErrorNote>{linesError}</ErrorNote>
                    ) : (
                      <CandidateList lines={lines} net={pv.net} currency={pv.currency} value={lineId} onChange={setLineId} name="confirm-line" />
                    )
                  ) : (
                    <div className="space-y-3">
                      <p className="flex items-start gap-2 text-xs text-neutral-500">
                        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                        Confirmed provisionally. It shows on the exceptions board until the statement line is matched.
                      </p>
                      {pv.documents.length > 0 && (
                        <fieldset>
                          <legend className="mb-2 text-sm font-medium text-neutral-700">Which document is the receipt?</legend>
                          <ul className="space-y-2">
                            {pv.documents.map((d) => (
                              <li key={d.id}>
                                <label className={cx("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm focus-within:ring-2 focus-within:ring-primary-300", docId === d.id ? "border-primary-500 bg-primary-50/60" : "border-neutral-200")}>
                                  <input type="radio" name="receipt" checked={docId === d.id} onChange={() => setDocId(d.id)} className="h-4 w-4 accent-primary-600" />
                                  <span className="min-w-0 flex-1 truncate">{d.fileName}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </fieldset>
                      )}
                      <UploadZone compact label="Upload the bank's receipt" busy={busy === "upload"} onFile={(f) => void uploadReceipt(f)} />
                      {uploadError && <ErrorNote>{uploadError}</ErrorNote>}
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-neutral-100 pt-4">
                  <p className="text-sm font-semibold text-neutral-900">The checks</p>
                  <p className="mt-0.5 text-xs text-neutral-500">If a check fails, don&apos;t confirm: Treasury records the payment as failed, or the difference is escalated.</p>
                  <div className="mt-3">
                    {checklist.error ? <ErrorNote>{checklist.error}</ErrorNote> : <MarkList items={items} marks={marks} onChange={setMarks} allowQuery={false} disabled={busy !== null} />}
                  </div>
                </div>

                {actionError && <ErrorNote className="mt-4">{actionError}</ErrorNote>}
                <div className="mt-5 flex justify-end">
                  <Button variant="primary" icon={BadgeCheck} onClick={() => void confirmPayment()} disabled={!may || !allMarked || !evidenceChosen || busy !== null}>
                    {busy === "confirm" ? "Confirming…" : evidence === "statement_line" ? "Confirm payment" : "Confirm provisionally"}
                  </Button>
                </div>
                {!may && <p className="mt-2 text-xs text-neutral-500">Your role can see this payment but not confirm it.</p>}
              </Card>
            ) : (
              <Card className="p-5">
                <p className="text-sm text-neutral-600">
                  Nothing to confirm: this voucher is {st.label.toLowerCase()}.
                  {pv.amountPaid != null && (
                    <>
                      {" "}
                      <Money value={pv.amountPaid} currency={pv.currency} /> left the bank
                      {pv.confirmationEvidence === "statement_line" ? ", matched to the statement." : "."}
                    </>
                  )}
                </p>
              </Card>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
