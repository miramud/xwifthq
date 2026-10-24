"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCheck, FileStack, Forward, Hash, Mail, MailCheck, ScrollText, Truck, UserRound } from "lucide-react";
import { Button, CalloutStrip, PageHeader, Panel } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Field, InfoRow, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { myCorrespondence, opsError, opsFieldErrors, type LetterFull } from "@/lib/api/operations-correspondence-client";
import { ActionDialog, ConfidentialChip, DueChip, FileList, LetterStatusChip, MinuteSheet, NoteBox, RefStamp } from "@/suite/operations/components/correspondence/parts";
import { channelLabel, dayText } from "@/suite/operations/components/correspondence/labels";
import { RichTextView } from "@/components/workspace/RichTextView";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * A letter routed to me: read it and its papers, acknowledge it, minute
 * it, forward it to a colleague, file my reply and mark it responded. The
 * registry closes it, or dispatching the outgoing reply does.
 */
export default function MyCorrespondenceDetail({ id }: { id: string }) {
  const router = useRouter();
  const [l, setL] = useState<LetterFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    let alive = true;
    myCorrespondence.get(id).then(
      (d) => {
        if (!alive) return;
        setL(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`This letter didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  if (error && !l) {
    return (
      <div>
        <BackLink href="/suite/operations/my/correspondence" label="Letters for my action" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!l) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the letter…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const acting = l.status === "assigned" || l.status === "in_progress";

  const acknowledge = async () => {
    setBusy("ack");
    setActionError(null);
    try {
      setL(await myCorrespondence.acknowledge(l.id));
      setNotice("Acknowledged. The registry can see you have it.");
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <BackLink href="/suite/operations/my/correspondence" label="Letters for my action" />
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span>For your action</span>
            <RefStamp reference={l.reference} />
          </span>
        }
        title={l.subject}
        subtitle={
          <span className="mt-1 inline-flex flex-wrap items-center gap-2">
            <LetterStatusChip status={l.status} />
            {l.confidentiality === "confidential" && <ConfidentialChip />}
            <DueChip letter={l} />
          </span>
        }
        actions={
          acting && (
            <>
              <Button icon={Forward} disabled={busy !== null} onClick={() => setForwarding(true)}>
                Forward
              </Button>
              {l.status === "assigned" ? (
                <Button variant="primary" icon={CheckCheck} disabled={busy !== null} onClick={() => void acknowledge()}>
                  {busy === "ack" ? "Saving…" : "Acknowledge"}
                </Button>
              ) : (
                <Button variant="primary" icon={MailCheck} disabled={busy !== null} onClick={() => setResponding(true)}>
                  Mark responded
                </Button>
              )}
            </>
          )
        }
      />
      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title="The letter" icon={Mail} hue="mint">
            <div className="grid gap-x-6 sm:grid-cols-2">
              <InfoRow icon={UserRound} label="From">
                {l.party ?? "-"}
                {l.partyOrganisation && <span className="block text-xs text-neutral-500">{l.partyOrganisation}</span>}
              </InfoRow>
              <InfoRow icon={Hash} label="Their reference">
                <span className="font-mono text-sm">{l.partyReference ?? "-"}</span>
              </InfoRow>
              <InfoRow icon={CalendarClock} label="Received">
                {dayText(l.receivedOn)}
                {l.letterDate && <span className="block text-xs text-neutral-500">Dated {dayText(l.letterDate)}</span>}
              </InfoRow>
              <InfoRow icon={Truck} label="How it came">
                {channelLabel(l.channel)}
              </InfoRow>
            </div>
            {l.summary && <RichTextView value={l.summary} size="sm" className="mt-4 border-t border-neutral-100 pt-4 text-neutral-800" />}
            {l.status === "assigned" && <CalloutStrip icon={CheckCheck} hue="sky" title="Acknowledge it so the registry knows you have it." className="mt-4" />}
          </Panel>

          <Panel title="Papers" icon={FileStack} hue="sky" subtitle="The scan, and your reply once you file it.">
            <FileList
              files={l.files}
              hrefFor={(f) => myCorrespondence.fileUrl(l.id, f.id)}
              onUpload={
                acting || l.status === "responded"
                  ? async (file) => {
                      try {
                        setL(await myCorrespondence.uploadReply(l.id, file));
                        setNotice(`${file.name} filed with the letter.`);
                      } catch (e) {
                        throw new Error(opsError(e));
                      }
                    }
                  : undefined
              }
              uploadLabel="Upload my reply"
            />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Minute sheet" icon={ScrollText} hue="sun">
            <div className="space-y-5">
              <MinuteSheet actions={l.actions} />
              {l.status !== "closed" && (
                <NoteBox
                  onAdd={async (body) => {
                    try {
                      setL(await myCorrespondence.note(l.id, body));
                      setNotice("Minute added.");
                    } catch (e) {
                      throw new Error(opsError(e));
                    }
                  }}
                />
              )}
            </div>
          </Panel>
        </div>
      </div>

      {forwarding && (
        <ForwardDialog
          letter={l}
          onClose={() => setForwarding(false)}
          onDone={() => {
            setForwarding(false);
            router.push("/suite/operations/my/correspondence");
          }}
        />
      )}
      {responding && (
        <RespondDialog
          hasReply={l.files.some((f) => f.kind === "reply")}
          onClose={() => setResponding(false)}
          onSubmit={async (note) => {
            const next = await myCorrespondence.respond(l.id, note).catch((e: unknown) => {
              throw new Error(opsError(e));
            });
            setL(next);
            setResponding(false);
            setNotice("Marked responded. The registry has been told and will close it.");
          }}
        />
      )}
    </div>
  );
}

function ForwardDialog({ letter, onClose, onDone }: { letter: LetterFull; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const [staff, setStaff] = useState<{ value: string; label: string }[] | null>(null);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  // Blank keeps the current due date; a new one cannot be in the past.
  const [due, setDue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    myCorrespondence.colleagues().then(
      (s) => alive && setStaff(s.map((p) => ({ value: p.id, label: p.name }))),
      () => alive && setStaff([]),
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ActionDialog
      title={`Forward ${letter.reference ?? "the letter"}`}
      subtitle="Hand it to a colleague with a minute. They are told, and it leaves your list."
      confirmLabel="Forward it"
      onClose={onClose}
      onSubmit={async () => {
        const next: Record<string, string> = {};
        if (!to) next.assigneeId = "Choose who it goes to.";
        if (!note.trim()) next.note = "Write a minute: what they should do with it.";
        setErrors(next);
        if (Object.keys(next).length) throw new Error(Object.values(next)[0]);
        try {
          await myCorrespondence.forward(letter.id, { assigneeId: to, note: note.trim(), dueOn: due || null });
        } catch (e) {
          setErrors(opsFieldErrors(e));
          throw new Error(opsError(e));
        }
        onDone();
      }}
    >
      <Field id={`${uid}-to`} label="To">
        <SearchableSelect id={`${uid}-to`} value={to} onChange={setTo} options={staff ?? []} placeholder="Choose a colleague" noOptionsText={staff ? "No colleagues" : "Loading…"} aria-invalid={errors.assigneeId ? true : undefined} />
        <FieldError message={errors.assigneeId} />
      </Field>
      <Field id={`${uid}-n`} label="Minute">
        <textarea id={`${uid}-n`} rows={3} className={textareaClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="You hold the programme files; please prepare the list." aria-invalid={errors.note ? true : undefined} />
        <FieldError message={errors.note} />
      </Field>
      <Field id={`${uid}-d`} label="Due by" hint={letter.dueOn ? `Blank keeps ${dayText(letter.dueOn)}` : "Optional"}>
        <input id={`${uid}-d`} type="date" className={inputClass} value={due} min={today()} onChange={(e) => setDue(e.target.value)} />
        <FieldError message={errors.dueOn} />
      </Field>
    </ActionDialog>
  );
}

function RespondDialog({ hasReply, onClose, onSubmit }: { hasReply: boolean; onClose: () => void; onSubmit: (note: string | null) => Promise<void> }) {
  const uid = useId();
  const [note, setNote] = useState("");
  return (
    <ActionDialog
      title="Mark responded?"
      subtitle={hasReply ? "Your reply is filed with the letter. The registry closes it, or dispatches the reply." : "No reply is filed yet. Say how you responded, or upload the reply first."}
      confirmLabel="Mark responded"
      onClose={onClose}
      onSubmit={() => onSubmit(note.trim() || null)}
    >
      <Field id={`${uid}-n`} label="How you responded" hint="Optional">
        <textarea id={`${uid}-n`} rows={3} className={textareaClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Documents list sent by email on 8 October." />
      </Field>
    </ActionDialog>
  );
}
