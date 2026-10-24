"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Building2,
  CalendarClock,
  CheckCheck,
  CircleCheck,
  FileStack,
  FolderKanban,
  Hash,
  Link2,
  Lock,
  Mail,
  PackageCheck,
  PenLine,
  RotateCcw,
  ScrollText,
  Send,
  Signature,
  Truck,
  UserCheck,
  UserRound,
} from "lucide-react";
import { Button, Chip, PageHeader, Panel, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Field, InfoRow, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import {
  CHANNELS,
  correspondence,
  opsError,
  opsFieldErrors,
  type Channel,
  type LetterFull,
  type RegisterOptions,
  type RelatedLetter,
} from "@/lib/api/operations-correspondence-client";
import { ActionDialog, ConfidentialChip, DirectionMark, DueChip, FileList, LetterStatusChip, MinuteSheet, NoteBox, RefStamp } from "./parts";
import { IN_OPEN, OUT_OPEN, channelLabel, dayText } from "./labels";
import LetterDialog from "./LetterDialog";
import { stampText } from "@/suite/operations/components/desk/labels";
import { RichTextView } from "@/components/workspace/RichTextView";

type Pending = "close" | "reopen" | "cancel" | "dispatch" | "delivered" | "acknowledged" | "edit" | "reply" | null;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * One letter on the register desk: what it is and who it is from or to,
 * its papers, its minute sheet; routing for a letter received, approval,
 * dispatch and delivery for one sent; the letters it answers or that
 * answer it.
 */
export default function CorrespondenceDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const [l, setL] = useState<LetterFull | null>(null);
  const [options, setOptions] = useState<RegisterOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  useEffect(() => {
    let alive = true;
    correspondence.get(id).then(
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

  useEffect(() => {
    let alive = true;
    correspondence.options().then(
      (o) => alive && setOptions(o),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  if (error && !l) {
    return (
      <div>
        <BackLink href="/suite/operations/correspondence" label="Correspondence" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!l) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the letter…</p>
        <Skeleton className="h-24" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[420px] lg:col-span-2" />
          <Skeleton className="h-[420px]" />
        </div>
      </div>
    );
  }

  const can = (a: string) => mayDoOps(user, "correspondence", a);
  const incoming = l.direction === "incoming";
  const open = incoming ? IN_OPEN.includes(l.status) : OUT_OPEN.includes(l.status);
  const registry = can("classify");

  const act = async (key: string, run: () => Promise<LetterFull>, done: string) => {
    setBusy(key);
    setActionError(null);
    try {
      setL(await run());
      setNotice(done);
      setPending(null);
    } catch (e) {
      setActionError(opsError(e));
      throw new Error(opsError(e));
    } finally {
      setBusy(null);
    }
  };
  /** The same, from a button: the error shows on the page. */
  const tap = (key: string, run: () => Promise<LetterFull>, done: string) => void act(key, run, done).catch(() => undefined);

  const submit = async () => {
    const ok = await confirm({
      title: "Send for approval?",
      body: `“${l.subject}” is numbered now and goes to its approvers. You can't edit it while it is with them.`,
      confirmLabel: "Send for approval",
      tone: "primary",
    });
    if (ok) tap("submit", () => correspondence.submit(l.id), "Numbered and sent for approval.");
  };

  const headerActions: React.ReactNode[] = [];
  if (incoming) {
    if (can("create") && l.status !== "cancelled")
      headerActions.push(
        <Button key="reply" icon={PenLine} disabled={busy !== null} onClick={() => setPending("reply")}>
          Draft the reply
        </Button>,
      );
    if (can("reopen") && (l.status === "closed" || l.status === "responded"))
      headerActions.push(
        <Button key="reopen" icon={RotateCcw} disabled={busy !== null} onClick={() => setPending("reopen")}>
          Reopen
        </Button>,
      );
    if (can("close") && l.status !== "closed" && l.status !== "cancelled")
      headerActions.push(
        <Button key="close" variant="primary" icon={CircleCheck} disabled={busy !== null} onClick={() => setPending("close")}>
          Close it
        </Button>,
      );
  } else {
    if (can("update") && (l.status === "draft" || l.status === "rejected"))
      headerActions.push(
        <Button key="edit" icon={PenLine} disabled={busy !== null} onClick={() => setPending("edit")}>
          Edit
        </Button>,
      );
    if (can("submit") && (l.status === "draft" || l.status === "rejected"))
      headerActions.push(
        <Button key="submit" variant="primary" icon={Send} disabled={busy !== null} onClick={() => void submit()}>
          {busy === "submit" ? "Sending…" : "Send for approval"}
        </Button>,
      );
    if (can("dispatch") && l.status === "approved")
      headerActions.push(
        <Button key="dispatch" variant="primary" icon={Truck} disabled={busy !== null} onClick={() => setPending("dispatch")}>
          Dispatch it
        </Button>,
      );
    if (can("deliver") && l.status === "dispatched")
      headerActions.push(
        <Button key="delivered" icon={PackageCheck} disabled={busy !== null} onClick={() => setPending("delivered")}>
          Record delivery
        </Button>,
      );
    if (can("deliver") && (l.status === "dispatched" || l.status === "delivered"))
      headerActions.push(
        <Button key="ack" variant={l.status === "delivered" ? "primary" : "secondary"} icon={CheckCheck} disabled={busy !== null} onClick={() => setPending("acknowledged")}>
          Record acknowledgement
        </Button>,
      );
  }
  if (can("cancel") && open)
    headerActions.push(
      <Button key="cancel" variant="danger" icon={Ban} disabled={busy !== null} onClick={() => setPending("cancel")}>
        Cancel
      </Button>,
    );

  const kinds = incoming ? (["scan", "reply", "enclosure"] as const) : (["copy", "acknowledgement", "enclosure"] as const);

  return (
    <div>
      <BackLink href="/suite/operations/correspondence" label="Correspondence" />
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span>{incoming ? "Received" : "Sent"}</span>
            <RefStamp reference={l.reference} />
          </span>
        }
        title={l.subject}
        subtitle={
          <span className="mt-1 inline-flex flex-wrap items-center gap-2">
            <LetterStatusChip status={l.status} />
            {l.confidentiality === "confidential" && <ConfidentialChip />}
            <DueChip letter={l} />
            <span className="text-neutral-500">
              {incoming ? "From" : "To"} {l.party ?? "-"}
            </span>
          </span>
        }
        actions={headerActions.length ? headerActions : undefined}
      />
      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title="The letter" icon={Mail} hue={incoming ? "mint" : "grape"} actions={<DirectionMark direction={l.direction} size={32} />}>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <InfoRow icon={UserRound} label={incoming ? "From" : "To"}>
                {l.party ?? "-"}
                {l.partyOrganisation && <span className="block text-xs text-neutral-500">{l.partyOrganisation}</span>}
              </InfoRow>
              <InfoRow icon={Hash} label="Their reference">
                <span className="font-mono text-sm">{l.partyReference ?? "-"}</span>
              </InfoRow>
              <InfoRow icon={CalendarClock} label={incoming ? "Received" : "Sent"}>
                {dayText(incoming ? l.receivedOn : l.sentOn)}
                {l.letterDate && <span className="block text-xs text-neutral-500">Dated {dayText(l.letterDate)}</span>}
              </InfoRow>
              <InfoRow icon={Truck} label={incoming ? "How it came" : "How it went"}>
                {channelLabel(l.channel)}
                {l.trackingRef && <span className="block font-mono text-xs text-neutral-500">{l.trackingRef}</span>}
              </InfoRow>
              <InfoRow icon={Building2} label={incoming ? "Addressed to" : "From unit"}>
                {[l.addressee, l.unit].filter(Boolean).join(" · ") || "-"}
              </InfoRow>
              <InfoRow icon={FolderKanban} label="Project">
                {l.project ? `${l.project.code ? `${l.project.code} · ` : ""}${l.project.name}` : "-"}
              </InfoRow>
              {!incoming && (
                <InfoRow icon={Signature} label="Signed by">
                  {l.signatory ?? "-"}
                </InfoRow>
              )}
              <InfoRow icon={PenLine} label={incoming ? "Logged by" : "Drafted by"}>
                {l.registeredBy ?? "-"} · {stampText(l.createdAt)}
              </InfoRow>
            </div>
            {l.summary && <RichTextView value={l.summary} size="sm" className="mt-4 border-t border-neutral-100 pt-4 text-neutral-800" />}
            {l.closeNote && (
              <p className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                <span className="font-semibold">{l.status === "cancelled" ? "Cancelled: " : "Closed: "}</span>
                {l.closeNote}
              </p>
            )}
          </Panel>

          <Panel title="Papers" icon={FileStack} hue="sky" subtitle="Filed once in the document repository.">
            <FileList
              files={l.files}
              hrefFor={(f) => correspondence.fileUrl(l.id, f.id)}
              kinds={[...kinds]}
              onUpload={
                can("file") && l.status !== "cancelled"
                  ? async (file, kind) => {
                      try {
                        setL(await correspondence.upload(l.id, file, kind));
                        setNotice(`${file.name} filed.`);
                      } catch (e) {
                        throw new Error(opsError(e));
                      }
                    }
                  : undefined
              }
              onRemove={
                can("remove_file")
                  ? (f) =>
                      void confirm({ title: `Remove ${f.name}?`, body: "It comes off this letter. The repository keeps the file until its retention ends.", confirmLabel: "Remove" }).then(async (ok) => {
                        if (!ok) return;
                        try {
                          await correspondence.removeFile(l.id, f.id);
                          setL(await correspondence.get(l.id));
                          setNotice("File removed.");
                        } catch (e) {
                          setActionError(opsError(e));
                        }
                      })
                  : undefined
              }
              uploadLabel={incoming ? "File a scan or reply" : "File a copy or acknowledgement"}
            />
          </Panel>

          <Panel title="Minute sheet" icon={ScrollText} hue="sun" subtitle="Every hand it passed through, oldest first.">
            <div className="space-y-5">
              <MinuteSheet actions={l.actions} />
              {can("comment") && (
                <NoteBox
                  onAdd={async (body) => {
                    try {
                      setL(await correspondence.note(l.id, body));
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

        <div className="min-w-0 space-y-6">
          {incoming && <RoutingPanel letter={l} options={options} canAssign={can("assign") && IN_OPEN.includes(l.status)} busy={busy} onRoute={(input) => act("assign", () => correspondence.assign(l.id, input), "Routed. The officer has been told.")} />}

          <Panel title="Linked letters" icon={Link2} hue="grape">
            {incoming ? (
              l.replies.length === 0 ? (
                <p className="text-sm text-neutral-500">No reply drafted yet.</p>
              ) : (
                <ul className="space-y-2">
                  {l.replies.map((r) => (
                    <RelatedRow key={r.id} r={r} />
                  ))}
                </ul>
              )
            ) : l.inReplyTo ? (
              <ul>
                <RelatedRow r={l.inReplyTo} label="Answers" />
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">Not a reply to a letter received.</p>
            )}
          </Panel>

          {registry && open && (
            <Panel title="Confidentiality" icon={Lock} hue="rose">
              <Segmented
                label="Confidentiality"
                value={l.confidentiality}
                onChange={(v) => tap("classify", () => correspondence.classify(l.id, v), v === "confidential" ? "Marked confidential." : "Marked normal.")}
                options={[
                  { key: "normal", label: "Normal" },
                  { key: "confidential", label: "Confidential" },
                ]}
              />
              <p className="mt-2 text-xs text-neutral-500">Confidential: only the registry and the action officer see it, and its papers are restricted in the repository.</p>
            </Panel>
          )}

          <Panel title="Key dates" icon={CalendarClock} hue="slate">
            <div className="divide-y divide-neutral-100">
              {incoming ? (
                <>
                  <InfoRow icon={UserCheck} label="Routed">
                    {l.assignedAt ? `${stampText(l.assignedAt)}${l.assignedBy ? ` by ${l.assignedBy}` : ""}` : "Not yet"}
                  </InfoRow>
                  <InfoRow icon={CheckCheck} label="Acknowledged">
                    {l.acknowledgedAt ? stampText(l.acknowledgedAt) : "Not yet"}
                  </InfoRow>
                  <InfoRow icon={Send} label="Responded">
                    {l.respondedAt ? stampText(l.respondedAt) : "Not yet"}
                  </InfoRow>
                </>
              ) : (
                <>
                  <InfoRow icon={Truck} label="Dispatched">
                    {l.sentOn ? dayText(l.sentOn) : "Not yet"}
                  </InfoRow>
                  <InfoRow icon={PackageCheck} label="Delivered">
                    {l.deliveredAt ? stampText(l.deliveredAt) : "Not yet"}
                  </InfoRow>
                  <InfoRow icon={CheckCheck} label="Acknowledged">
                    {l.receiptAcknowledgedAt ? stampText(l.receiptAcknowledgedAt) : "Not yet"}
                  </InfoRow>
                </>
              )}
              {l.closedAt && (
                <InfoRow icon={l.status === "cancelled" ? Ban : CircleCheck} label={l.status === "cancelled" ? "Cancelled" : "Closed"}>
                  {stampText(l.closedAt)}
                </InfoRow>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {(pending === "edit" || pending === "reply") && (
        <LetterDialog
          direction={pending === "reply" ? "outgoing" : l.direction}
          options={options}
          registry={registry}
          initial={pending === "edit" ? l : undefined}
          presetReplyTo={pending === "reply" ? l.id : undefined}
          replyTargets={incoming ? [{ value: l.id, label: `${l.reference ?? ""} · ${l.subject}` }] : l.inReplyTo ? [{ value: l.inReplyTo.id, label: `${l.inReplyTo.reference ?? ""} · ${l.inReplyTo.subject}` }] : []}
          onClose={() => setPending(null)}
          onDone={(saved) => {
            setPending(null);
            if (pending === "reply") router.push(`/suite/operations/correspondence/${saved.id}`);
            else {
              setL(saved);
              setNotice("Saved.");
            }
          }}
        />
      )}
      {pending === "close" && (
        <NoteAction title={`Close ${l.reference ?? "this letter"}?`} subtitle="It leaves the list of letters awaiting action." label="Closing note" optional confirmLabel="Close it" onClose={() => setPending(null)} onSubmit={(note) => act("close", () => correspondence.close(l.id, note), "Closed.")} />
      )}
      {pending === "reopen" && (
        <NoteAction title={`Reopen ${l.reference ?? "this letter"}?`} subtitle={l.assignee ? `${l.assignee} is told it needs more action.` : undefined} label="Why" optional confirmLabel="Reopen" onClose={() => setPending(null)} onSubmit={(note) => act("reopen", () => correspondence.reopen(l.id, note), "Reopened.")} />
      )}
      {pending === "cancel" && (
        <NoteAction
          title={`Cancel ${l.reference ?? "this draft"}?`}
          subtitle={l.reference ? "It keeps its number, marked void, so the register has no gaps." : "The draft is withdrawn."}
          label="Reason"
          confirmLabel="Cancel the letter"
          tone="danger"
          onClose={() => setPending(null)}
          onSubmit={(reason) => act("cancel", () => correspondence.cancel(l.id, reason ?? ""), "Cancelled.")}
        />
      )}
      {pending === "dispatch" && <DispatchDialog letter={l} onClose={() => setPending(null)} onSubmit={(input) => act("dispatch", () => correspondence.dispatch(l.id, input), l.inReplyTo ? `Dispatched. ${l.inReplyTo.reference ?? "The letter it answers"} is closed.` : "Dispatched.")} />}
      {(pending === "delivered" || pending === "acknowledged") && (
        <DeliveryDialog stage={pending} onClose={() => setPending(null)} onSubmit={(input) => act(pending, () => correspondence.deliver(l.id, { stage: pending, ...input }), pending === "delivered" ? "Delivery recorded." : "Acknowledgement recorded. File the stamped copy under Papers.")} />
      )}
    </div>
  );
}

function RelatedRow({ r, label }: { r: RelatedLetter; label?: string }) {
  return (
    <li>
      <Link href={`/suite/operations/correspondence/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 p-3 outline-none transition hover:border-primary-300 hover:bg-primary-50/40 focus-visible:ring-2 focus-visible:ring-primary-300">
        <DirectionMark direction={r.direction} size={32} />
        <span className="min-w-0 flex-1">
          {label && <span className="block text-xs text-neutral-500">{label}</span>}
          <span className="block truncate text-sm font-semibold text-neutral-900">{r.subject}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <RefStamp reference={r.reference} />
            <LetterStatusChip status={r.status} />
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Who acts on a letter received: a person, or a unit (its head), by when. */
function RoutingPanel({
  letter: l,
  options,
  canAssign,
  busy,
  onRoute,
}: {
  letter: LetterFull;
  options: RegisterOptions | null;
  canAssign: boolean;
  busy: string | null;
  onRoute: (input: { assigneeId: string | null; assignedUnitId: string | null; dueOn: string | null; note: string | null }) => Promise<void>;
}) {
  const uid = useId();
  const [assignee, setAssignee] = useState("");
  const [unit, setUnit] = useState("");
  // Blank keeps the current due date (which may already be past); a new one cannot be.
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const route = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignee && !unit) {
      setErrors({ assigneeId: "Choose a person, or a unit." });
      return;
    }
    setErrors({});
    try {
      await onRoute({ assigneeId: assignee || null, assignedUnitId: unit || null, dueOn: due || null, note: note.trim() || null });
      setAssignee("");
      setUnit("");
      setNote("");
    } catch {
      /* the page shows the error */
    }
  };

  return (
    <Panel title="Action officer" icon={UserCheck} hue="mint">
      {l.assignee ? (
        <div className="mb-4 rounded-2xl bg-neutral-50 p-3">
          <p className="text-sm font-semibold text-neutral-900">{l.assignee}</p>
          <p className="text-xs text-neutral-600">
            {[l.assignedUnit, l.dueOn ? `due ${dayText(l.dueOn)}` : null].filter(Boolean).join(" · ") || "No due date"}
          </p>
          {l.overdue && (
            <Chip hue="rose" className="mt-2">
              Overdue
            </Chip>
          )}
        </div>
      ) : (
        <p className="mb-4 text-sm text-neutral-600">{IN_OPEN.includes(l.status) ? "Nobody has it yet." : "-"}</p>
      )}
      {canAssign && (
        <form className="space-y-3" onSubmit={(e) => void route(e)}>
          <Field id={`${uid}-p`} label={l.assignee ? "Re-route to" : "Route to"}>
            <SearchableSelect id={`${uid}-p`} value={assignee} onChange={setAssignee} options={(options?.staff ?? []).map((s) => ({ value: s.id, label: s.name }))} clearable placeholder="Choose a person" noOptionsText={options ? "No staff" : "Loading staff…"} aria-invalid={errors.assigneeId ? true : undefined} />
            <FieldError message={errors.assigneeId} />
          </Field>
          <Field id={`${uid}-u`} label="Or a unit" hint="Its head gets it">
            <SearchableSelect id={`${uid}-u`} value={unit} onChange={setUnit} options={(options?.units ?? []).map((u) => ({ value: u.id, label: u.name, hint: u.code ?? undefined }))} clearable placeholder="None" noOptionsText={options ? "No units" : "Loading…"} />
          </Field>
          <Field id={`${uid}-d`} label="Due by" hint={l.dueOn ? `Blank keeps ${dayText(l.dueOn)}` : "A week if left blank"}>
            <input id={`${uid}-d`} type="date" className={inputClass} value={due} min={today()} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field id={`${uid}-n`} label="Minute" hint="Optional">
            <textarea id={`${uid}-n`} rows={2} className={textareaClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Please treat and advise." />
          </Field>
          <Button type="submit" variant="primary" size="sm" icon={Send} disabled={busy !== null}>
            {busy === "assign" ? "Routing…" : l.assignee ? "Re-route" : "Route it"}
          </Button>
        </form>
      )}
    </Panel>
  );
}

function NoteAction({
  title,
  subtitle,
  label,
  optional = false,
  confirmLabel,
  tone = "primary",
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  label: string;
  optional?: boolean;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onClose: () => void;
  onSubmit: (note: string | null) => Promise<void>;
}) {
  const uid = useId();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | undefined>();
  return (
    <ActionDialog
      title={title}
      subtitle={subtitle}
      confirmLabel={confirmLabel}
      tone={tone}
      onClose={onClose}
      onSubmit={async () => {
        if (!optional && !text.trim()) {
          setErr(`${label} is needed.`);
          throw new Error(`${label} is needed.`);
        }
        setErr(undefined);
        await onSubmit(text.trim() || null);
      }}
    >
      <Field id={`${uid}-t`} label={label} hint={optional ? "Optional" : undefined}>
        <textarea id={`${uid}-t`} rows={3} className={textareaClass} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} aria-invalid={err ? true : undefined} />
        <FieldError message={err} />
      </Field>
    </ActionDialog>
  );
}

function DispatchDialog({ letter, onClose, onSubmit }: { letter: LetterFull; onClose: () => void; onSubmit: (input: { channel: Channel; sentOn: string | null; trackingRef: string | null }) => Promise<void> }) {
  const uid = useId();
  const [channel, setChannel] = useState<string>(letter.channel ?? "");
  const [sentOn, setSentOn] = useState(today());
  const [tracking, setTracking] = useState(letter.trackingRef ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <ActionDialog
      title={`Dispatch ${letter.reference ?? "the letter"}`}
      subtitle={letter.inReplyTo ? `It answers ${letter.inReplyTo.reference ?? "a letter received"}, which closes when this goes out.` : "Record how and when it went out."}
      confirmLabel="Dispatch it"
      onClose={onClose}
      onSubmit={async () => {
        if (!channel) {
          setErrors({ channel: "Say how it went." });
          throw new Error("Say how it went.");
        }
        try {
          await onSubmit({ channel: channel as Channel, sentOn: sentOn || null, trackingRef: tracking.trim() || null });
        } catch (e) {
          setErrors(opsFieldErrors(e));
          throw e;
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-c`} label="How it went">
          <SearchableSelect id={`${uid}-c`} value={channel} onChange={setChannel} options={Object.entries(CHANNELS).map(([value, label]) => ({ value, label }))} placeholder="Choose" aria-invalid={errors.channel ? true : undefined} />
          <FieldError message={errors.channel} />
        </Field>
        <Field id={`${uid}-s`} label="Sent on">
          <input id={`${uid}-s`} type="date" className={inputClass} value={sentOn} max={today()} onChange={(e) => setSentOn(e.target.value)} />
          <FieldError message={errors.sentOn} />
        </Field>
      </div>
      <Field id={`${uid}-t`} label="Courier or tracking reference" hint="Optional">
        <input id={`${uid}-t`} className={inputClass} value={tracking} maxLength={100} onChange={(e) => setTracking(e.target.value)} placeholder="GIG-55102" />
      </Field>
    </ActionDialog>
  );
}

function DeliveryDialog({ stage, onClose, onSubmit }: { stage: "delivered" | "acknowledged"; onClose: () => void; onSubmit: (input: { on: string | null; note: string | null }) => Promise<void> }) {
  const uid = useId();
  const [on, setOn] = useState(today());
  const [note, setNote] = useState("");
  return (
    <ActionDialog
      title={stage === "delivered" ? "Record delivery" : "Record acknowledgement"}
      subtitle={stage === "delivered" ? "The recipient has the letter." : "The recipient has acknowledged it. File the stamped or signed copy under Papers."}
      confirmLabel={stage === "delivered" ? "Record delivery" : "Record acknowledgement"}
      onClose={onClose}
      onSubmit={() => onSubmit({ on: on || null, note: note.trim() || null })}
    >
      <Field id={`${uid}-o`} label="On">
        <input id={`${uid}-o`} type="date" className={inputClass} value={on} max={today()} onChange={(e) => setOn(e.target.value)} />
      </Field>
      <Field id={`${uid}-n`} label="Note" hint="Optional">
        <input id={`${uid}-n`} className={inputClass} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Received by the front desk, stamped" />
      </Field>
    </ActionDialog>
  );
}
