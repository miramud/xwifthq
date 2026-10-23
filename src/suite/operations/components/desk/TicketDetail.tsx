"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Ban, Building2, CalendarClock, CircleCheck, ClipboardList, ExternalLink, Hourglass, Laptop, Link2, MessageSquare, Play, Star, UserCheck, UserRound, Wrench } from "lucide-react";
import { Button, Chip, PageHeader, Panel, PriorityChip } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Field, InfoRow, Skeleton } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { desk, opsError, type DeskStatus, type LinkableRecord, type LinkedType, type TicketFull } from "@/lib/api/operations-desk-client";
import { Stars, useOpsPickers } from "@/suite/operations/components/facilities/parts";
import { Answers, CategoryIcon, ReplyBox, SlaPill, Thread, TicketStatusChip } from "./parts";
import { LINKED_TYPES, stampText, statusMeta, useNow } from "./labels";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richToPlain } from "@/lib/richText";


/**
 * A ticket on the desk: what was asked (and the catalogue form's answers),
 * the conversation with replies and internal notes, who has it, where it
 * stands, and the record it became — linked, or raised from here as a work
 * order and linked in one go.
 */
export default function TicketDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const now = useNow();
  const { staff } = useOpsPickers();
  const [t, setT] = useState<TicketFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("");

  useEffect(() => {
    let alive = true;
    desk.get(id).then(
      (d) => {
        if (!alive) return;
        setT(d);
        setAssignee(d.assigneeId ?? "");
        setError(null);
      },
      (e: unknown) => alive && setError(`This ticket didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  if (error && !t) {
    return (
      <div>
        <BackLink href="/suite/operations/desk" label="Service desk" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!t) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the ticket…</p>
        <Skeleton className="h-24" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-[420px] lg:col-span-2" />
          <Skeleton className="h-[420px]" />
        </div>
      </div>
    );
  }

  const can = (a: string) => mayDoOps(user, "service_desk", a);
  const open = statusMeta(t.status).open;

  const act = async (key: string, run: () => Promise<TicketFull>, done: string) => {
    setBusy(key);
    setActionError(null);
    try {
      const next = await run();
      setT(next);
      setAssignee(next.assigneeId ?? "");
      setNotice(done);
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  const move = async (status: DeskStatus) => {
    if (status === "cancelled") {
      const ok = await confirm({ title: `Cancel ${t.number ?? "this ticket"}?`, body: `${t.requester ?? "The requester"} is told nothing more will be done about “${t.title}”.`, confirmLabel: "Cancel the ticket" });
      if (!ok) return;
    }
    const words: Record<DeskStatus, string> = { in_progress: "Marked in progress.", waiting: "Marked waiting.", resolved: "Resolved. The requester is asked to rate it and close it.", cancelled: "Ticket cancelled." };
    await act(status, () => desk.status(t.id, status), words[status]);
  };

  const raiseWorkOrder = async () => {
    const ok = await confirm({
      title: "Raise a work order?",
      body: `A corrective work order for “${t.title}”${t.asset ? ` on ${t.asset.tagNo ?? t.asset.name}` : t.facility ? ` at ${t.facility}` : ""} goes to maintenance, linked to this ticket.`,
      confirmLabel: "Raise the work order",
      tone: "primary",
    });
    if (!ok) return;
    await act(
      "wo",
      async () => {
        // Raised with the ticket's id, the server links the two.
        await desk.raiseWorkOrder({ assetId: t.asset?.id ?? null, facilityId: t.asset ? null : (t.facilityId ?? null), title: t.title, fault: t.description ? richToPlain(t.description) : t.description, priority: t.priority, ticketId: t.id });
        return desk.get(t.id);
      },
      "Work order raised and linked.",
    );
  };

  const statusActions: { key: DeskStatus; label: string; icon: typeof Play; variant: "primary" | "secondary" | "danger"; show: boolean }[] = [
    { key: "in_progress", label: "Start work", icon: Play, variant: "secondary", show: t.status === "new" || t.status === "assigned" || t.status === "waiting" },
    { key: "waiting", label: "Mark waiting", icon: Hourglass, variant: "secondary", show: t.status !== "waiting" },
    { key: "resolved", label: "Resolve", icon: CircleCheck, variant: "primary", show: true },
    { key: "cancelled", label: "Cancel ticket", icon: Ban, variant: "danger", show: true },
  ];

  return (
    <div>
      <BackLink href="/suite/operations/desk" label="Service desk" />
      <PageHeader
        eyebrow={t.number ?? "Ticket"}
        title={t.title}
        subtitle={
          <span className="mt-1 inline-flex flex-wrap items-center gap-2">
            <TicketStatusChip status={t.status} />
            <PriorityChip priority={t.priority} />
            <SlaPill ticket={t} now={now} />
            {t.item && <span className="text-neutral-500">{t.item}</span>}
          </span>
        }
        actions={
          open &&
          can("status") &&
          statusActions
            .filter((a) => a.show)
            .map((a) => (
              <Button key={a.key} variant={a.variant} icon={a.icon} disabled={busy !== null} onClick={() => void move(a.key)}>
                {busy === a.key ? "Saving…" : a.label}
              </Button>
            ))
        }
      />
      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="What was asked" icon={ClipboardList} hue="blue" subtitle={`${t.requester ?? "Someone"} asked ${stampText(t.createdAt)}`}>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CategoryIcon category={t.category} />
                {t.description ? <RichTextView value={t.description} size="sm" className="text-neutral-800" /> : <p className="text-sm text-neutral-800">No description given.</p>}
              </div>
              <Answers fields={t.fields} answers={t.answers} />
              {(t.facility || t.asset) && (
                <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                  {t.facility && (
                    <Chip hue="coral" icon={Building2}>
                      {t.facility}
                    </Chip>
                  )}
                  {t.asset && (
                    <Chip hue="blue" icon={Laptop}>
                      {[t.asset.tagNo, t.asset.name].filter(Boolean).join(" · ")}
                    </Chip>
                  )}
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Conversation" icon={MessageSquare} hue="grape" subtitle="Replies go to the requester. Internal notes stay on the desk.">
            <div className="space-y-5">
              <Thread comments={t.comments} requesterId={t.requesterId} />
              {can("comment") && (
                <ReplyBox
                  allowInternal
                  placeholder={`Reply to ${t.requester ?? "the requester"}`}
                  onSend={async (body, internal) => {
                    try {
                      setT(await desk.comment(t.id, body, internal));
                      setNotice(internal ? "Note added." : "Reply sent.");
                    } catch (e) {
                      throw new Error(opsError(e));
                    }
                  }}
                />
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Who has it" icon={UserCheck} hue="mint">
            {can("assign") && open ? (
              <div className="space-y-3">
                <Field id="assignee" label="Assigned to">
                  <SearchableSelect id="assignee" value={assignee} onChange={setAssignee} options={staff ?? []} clearable clearLabel="Nobody" placeholder="Nobody" noOptionsText={staff ? "No staff" : "Loading staff…"} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" disabled={busy !== null || assignee === (t.assigneeId ?? "")} onClick={() => void act("assign", () => desk.assign(t.id, assignee || null), assignee ? "Assigned." : "Unassigned.")}>
                    {busy === "assign" ? "Saving…" : "Save"}
                  </Button>
                  {user?.id && t.assigneeId !== user.id && (
                    <Button size="sm" icon={UserRound} disabled={busy !== null} onClick={() => void act("assign", () => desk.assign(t.id, user.id), "It's yours.")}>
                      Take it
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-800">{t.assignee ?? "Nobody yet"}</p>
            )}
          </Panel>

          <LinkedPanel ticket={t} canLink={can("link") && open} canRaise={can("link") && open && mayDoOps(user, "maintenance", "create") && Boolean(t.facility || t.asset)} busy={busy} onRaise={() => void raiseWorkOrder()} onLink={(type, linkedId) => act("link", () => desk.link(t.id, type, linkedId), "Record linked.")} />

          <Panel title="Timeline" icon={CalendarClock} hue="sky">
            <div className="divide-y divide-neutral-100">
              <InfoRow icon={UserRound} label="Asked by">
                {t.requester ?? "—"} · {stampText(t.createdAt)}
              </InfoRow>
              <InfoRow icon={MessageSquare} label="First response">
                {t.firstResponseAt ? stampText(t.firstResponseAt) : "Not yet"}
              </InfoRow>
              <InfoRow icon={CircleCheck} label="Resolved">
                {t.resolvedAt ? stampText(t.resolvedAt) : "Not yet"}
              </InfoRow>
              {t.closedAt && (
                <InfoRow icon={Ban} label={t.status === "cancelled" ? "Cancelled" : "Closed"}>
                  {stampText(t.closedAt)}
                </InfoRow>
              )}
              {(t.rating !== null || t.ratingComment) && (
                <InfoRow icon={Star} label="Their rating" hue="sun">
                  <Stars value={t.rating} />
                  {t.ratingComment && <span className="mt-1 block text-sm text-neutral-600">“{t.ratingComment}”</span>}
                </InfoRow>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function LinkedPanel({
  ticket: t,
  canLink,
  canRaise,
  busy,
  onRaise,
  onLink,
}: {
  ticket: TicketFull;
  canLink: boolean;
  canRaise: boolean;
  busy: string | null;
  onRaise: () => void;
  onLink: (type: LinkedType, id: string) => Promise<void>;
}) {
  const uid = useId();
  const [type, setType] = useState<LinkedType>("work_order");
  const [linkId, setLinkId] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const [found, setFound] = useState<{ type: LinkedType; rows: LinkableRecord[] } | null>(null);
  const records = found?.type === type ? found.rows : null;
  const l = t.linked;

  // The kind's records, those touching this ticket first; the picker filters them as you type.
  useEffect(() => {
    if (l || !canLink) return;
    let alive = true;
    desk.linkable(t.id, type).then(
      (rows) => alive && setFound({ type, rows }),
      () => alive && setFound({ type, rows: [] }),
    );
    return () => {
      alive = false;
    };
  }, [t.id, type, l, canLink]);

  return (
    <Panel title="The record it became" icon={Link2} hue="grape">
      {l ? (
        <Link href={l.url} className="group flex items-center gap-3 rounded-2xl border border-neutral-200/80 p-4 outline-none transition hover:border-primary-300 hover:bg-primary-50/40 focus-visible:ring-2 focus-visible:ring-primary-300">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-grape-50 text-grape-700">
            {l.type === "work_order" ? <Wrench size={18} aria-hidden /> : <ClipboardList size={18} aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-neutral-500">{LINKED_TYPES[l.type] ?? l.type}</span>
            <span className="block truncate font-mono text-sm font-semibold text-neutral-900">{l.reference ?? "Open it"}</span>
            {l.status && <span className="block text-xs capitalize text-neutral-600">{l.status.replace(/_/g, " ")}</span>}
          </span>
          <ExternalLink size={16} className="shrink-0 text-neutral-400 group-hover:text-primary-600" aria-hidden />
        </Link>
      ) : canLink ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!linkId) {
              setErr("Choose the record it became.");
              return;
            }
            setErr(undefined);
            void onLink(type, linkId).then(() => setLinkId(""));
          }}
        >
          <p className="text-sm text-neutral-600">Not linked yet. Link the record it became, so the requester can follow it.</p>
          <Field id={`${uid}-type`} label="Kind of record">
            <SearchableSelect id={`${uid}-type`} value={type} onChange={(v) => {
                setType(v as LinkedType);
                setLinkId("");
              }} options={Object.entries(LINKED_TYPES).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field id={`${uid}-id`} label="The record" hint="Related ones first">
            <SearchableSelect
              id={`${uid}-id`}
              value={linkId}
              onChange={setLinkId}
              options={(records ?? []).map((r) => ({
                value: r.id,
                label: [r.reference, r.title].filter(Boolean).join(" · ") || "Untitled",
                hint: [r.related ? "Related" : null, r.status?.replace(/_/g, " "), r.person, r.date ? r.date.slice(0, 10) : null].filter(Boolean).join(" · ") || undefined,
                group: r.related ? "Related to this ticket" : "Others",
              }))}
              placeholder={records === null ? "Loading…" : "Search by number or title"}
              noOptionsText={records === null ? "Loading…" : "None of this kind yet."}
              aria-invalid={err ? true : undefined}
            />
            <FieldError message={err} />
          </Field>
          <Button type="submit" size="sm" icon={Link2} disabled={busy !== null}>
            {busy === "link" ? "Linking…" : "Link the record"}
          </Button>
          {canRaise && (
            <div className="border-t border-neutral-100 pt-3">
              <Button className="w-full" variant="secondary" icon={Wrench} disabled={busy !== null} onClick={onRaise}>
                {busy === "wo" ? "Raising…" : "Raise a work order"}
              </Button>
              <p className="mt-1.5 text-xs text-neutral-500">For a fault at {t.asset ? (t.asset.tagNo ?? "the asset") : t.facility}. Raised and linked in one step.</p>
            </div>
          )}
        </form>
      ) : (
        <p className="text-sm text-neutral-500">Not linked to another record.</p>
      )}
    </Panel>
  );
}
