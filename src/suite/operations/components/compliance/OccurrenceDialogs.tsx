"use client";

import { useId, useState } from "react";
import { Button } from "@/components/workspace/kit";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { amount, amountInput, parseAmount } from "@/suite/finance/lib/format";
import { compliance, opsError, opsFieldErrors, type OccurrenceDetail } from "@/lib/api/operations-compliance-client";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/* The three things done to an occurrence in a form: submit it, complete it, raise the fee's memo. */

function Footer({ onClose, busy, label, busyLabel }: { onClose: () => void; busy: boolean; label: string; busyLabel: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}

function useRun(onDone: () => void) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setErrors(opsFieldErrors(e));
      setError(opsError(e));
      setBusy(false);
    }
  };
  return { errors, setErrors, error, busy, run };
}

/** Filed with the authority: the reference they gave and a note. */
export function SubmitDialog({ occ, onClose, onDone }: { occ: OccurrenceDetail; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const [reference, setReference] = useState(occ.reference ?? "");
  const [note, setNote] = useState("");
  const { error, busy, run } = useRun(onDone);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => compliance.submit(occ.id, { reference: reference.trim() || null, note: note.trim() || null }));
      }}
      titleId={`${uid}-title`}
      title="Mark it submitted"
      subtitle={`${occ.obligation.name}${occ.period ? `, ${occ.period}` : ""} is with ${occ.obligation.authority ?? "the authority"}. Complete it when the acknowledgement or certificate comes back.`}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Mark submitted" busyLabel="Saving…" />}
    >
      <Field id={`${uid}-ref`} label="Reference" hint="Optional: RRR, filing or receipt number">
        <input id={`${uid}-ref`} className={inputClass} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="RRR 2905-1234-5678" />
      </Field>
      <Field id={`${uid}-note`} label="Note" hint="Optional">
        <RichTextEditor id={`${uid}-note`} minHeight={102} value={note} onChange={setNote} placeholder="Filed on the portal; acknowledgement expected in 5 working days." />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/** Done, with evidence on file. A certificate records its dates. */
export function CompleteDialog({ occ, onClose, onDone }: { occ: OccurrenceDetail; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const cert = occ.obligation.isCertificate;
  const [reference, setReference] = useState(occ.reference ?? "");
  const [issuedOn, setIssuedOn] = useState(occ.issuedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(occ.expiresOn ?? "");
  const [notes, setNotes] = useState(occ.notes ?? "");
  const { errors, setErrors, error, busy, run } = useRun(onDone);
  const noEvidence = occ.evidence.length === 0;
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (cert && !expiresOn) {
          setErrors({ expiresOn: "Enter the certificate's expiry date." });
          return;
        }
        if (cert && issuedOn && expiresOn && expiresOn <= issuedOn) {
          setErrors({ expiresOn: "It expires after the day it was issued." });
          return;
        }
        void run(() =>
          compliance.complete(occ.id, {
            reference: reference.trim() || null,
            issuedOn: cert ? issuedOn || null : null,
            expiresOn: cert ? expiresOn || null : null,
            notes: notes.trim() || null,
          }),
        );
      }}
      titleId={`${uid}-title`}
      title={cert ? "Record the new certificate" : "Mark it completed"}
      subtitle={
        occ.obligation.frequency === "once" || occ.obligation.frequency === "on_change"
          ? "It closes with the evidence on file."
          : "It closes with the evidence on file, and the next one goes on the calendar."
      }
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={cert ? "Record certificate" : "Mark completed"} busyLabel="Saving…" />}
    >
      {noEvidence && (
        <ErrorNote>Attach the evidence first. An obligation is not completed without it{occ.obligation.evidenceRequired ? `: ${occ.obligation.evidenceRequired.replace(/\.$/, "")}` : ""}.</ErrorNote>
      )}
      <Field id={`${uid}-ref`} label={cert ? "Certificate number" : "Reference"} hint="Optional">
        <input id={`${uid}-ref`} className={inputClass} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
      </Field>
      {cert && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-iss`} label="Issued on">
            <input id={`${uid}-iss`} type="date" className={inputClass} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
            <FieldError message={errors.issuedOn} />
          </Field>
          <Field id={`${uid}-exp`} label="Expires on" hint="Required">
            <input id={`${uid}-exp`} type="date" className={inputClass} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} aria-invalid={errors.expiresOn ? true : undefined} />
            <FieldError message={errors.expiresOn} />
          </Field>
        </div>
      )}
      <Field id={`${uid}-notes`} label="Notes" hint="Optional">
        <RichTextEditor id={`${uid}-notes`} minHeight={102} value={notes} onChange={setNotes} />
      </Field>
      {error && !(noEvidence && errors.evidence) && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/** The fee as a draft payment memo for the owner to send through Finance. */
export function MemoDialog({ occ, onClose, onDone }: { occ: OccurrenceDetail; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const [text, setText] = useState(amountInput(occ.amount ?? occ.obligation.typicalFee));
  const { errors, setErrors, error, busy, run } = useRun(onDone);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        const kobo = parseAmount(text);
        if (!kobo) {
          setErrors({ amount: "Enter the amount to pay, like 25,000." });
          return;
        }
        void run(() => compliance.raiseMemo(occ.id, kobo));
      }}
      titleId={`${uid}-title`}
      title="Raise a payment memo"
      subtitle="A draft memo in Finance, payable to the authority, for you to check and send."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Raise memo" busyLabel="Raising…" />}
    >
      <Field id={`${uid}-amt`} label="Amount (₦)" hint={occ.obligation.typicalFee ? `Usually ${amount(occ.obligation.typicalFee)}` : undefined}>
        <input id={`${uid}-amt`} inputMode="decimal" className={inputClass} value={text} onChange={(e) => setText(e.target.value)} placeholder="25,000" aria-invalid={errors.amount ? true : undefined} />
        <FieldError message={errors.amount} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
