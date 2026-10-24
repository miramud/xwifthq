"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LifeBuoy,
  ChevronLeft,
  Send,
} from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, PriorityChip, SearchField, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { ErrorNote, FaceAvatar, StatCard } from "@/suite/lms/components/ui/ws";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { formatCompact } from "@/lib/console-data";
import {
  tickets as ticketsApi,
  team as teamApi,
  ApiError,
  type SupportTicket,
  type TeamMember,
} from "@/lib/api/admin-client";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

const PRIORITY_DOT: Record<string, string> = {
  Urgent: "bg-rose-500",
  High: "bg-coral-500",
  Normal: "bg-sun-500",
  Low: "bg-sky-500",
};

const STATUS_HUE: Record<string, Hue> = {
  Open: "coral",
  Pending: "sky",
  Resolved: "mint",
  Closed: "slate",
};

const STATUS_FILTERS = ["All", "Open", "Pending", "Resolved", "Closed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_OPTIONS = ["Open", "Pending", "Resolved", "Closed"];

export default function AdminMessagesPage() {
  const [list, setList] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /*
    Who a ticket may be handed to. The admin team of this institution, which
    is also exactly what the API will accept, a list built from anything
    wider would offer choices that come back 422.
  */
  const [colleagues, setColleagues] = useState<TeamMember[]>([]);

  const loadList = useCallback(async () => {
    try {
      setList(await ticketsApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Tickets didn't load.");
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    let cancelled = false;

    teamApi
      .list()
      .then((members) => {
        if (!cancelled) setColleagues(members);
      })
      .catch(() => {
        /*
          Silent. Not being able to list colleagues should cost the assign
          control, not the inbox, replying to a ticket is the thing somebody
          opened this page to do.
        */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectTicket = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    try {
      setDetail(await ticketsApi.get(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That ticket didn't open.");
    }
  }, []);

  const sendReply = useCallback(async () => {
    if (!selectedId || draft.trim() === "" || sending) return;
    setSending(true);
    try {
      const updated = await ticketsApi.reply(selectedId, draft.trim());
      setDetail(updated);
      setDraft("");
      await loadList();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Your reply didn't send.");
    } finally {
      setSending(false);
    }
  }, [selectedId, draft, sending, loadList]);

  const changeStatus = useCallback(
    async (label: string) => {
      if (!selectedId) return;
      try {
        const updated = await ticketsApi.setStatus(selectedId, label.toLowerCase());
        setDetail(updated);
        await loadList();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "The ticket didn't update.");
      }
    },
    [selectedId, loadList],
  );

  const assign = useCallback(
    async (assigneeId: string | null) => {
      if (!selectedId) return;

      try {
        const updated = await ticketsApi.assign(selectedId, assigneeId);

        setDetail(updated);
        await loadList();
      } catch (e) {
        setError(
          e instanceof ApiError ? e.message : "The ticket wasn't reassigned.",
        );
      }
    },
    [selectedId, loadList],
  );

  const counts = useMemo(
    () => ({
      open: list.filter((t) => t.status === "Open").length,
      pending: list.filter((t) => t.status === "Pending").length,
      resolved: list.filter((t) => t.status === "Resolved").length,
      urgent: list.filter((t) => t.priority === "Urgent").length,
    }),
    [list],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((t) => {
      const matchesStatus = statusFilter === "All" || t.status === statusFilter;
      const matchesQuery =
        q === "" ||
        t.subject.toLowerCase().includes(q) ||
        t.requester.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [list, query, statusFilter]);

  const selected = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Support tickets"
        subtitle={`${formatCompact(counts.open)} open · ${formatCompact(counts.urgent)} urgent`}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* stat row */}
      <StatGrid>
        <StatCard featured featuredHue="sun" icon={Inbox} label="Open" value={formatCompact(counts.open)} />
        <StatCard icon={Clock} hue="sky" label="Pending" value={formatCompact(counts.pending)} />
        <StatCard icon={CheckCircle2} hue="mint" label="Resolved" value={formatCompact(counts.resolved)} />
        <StatCard icon={AlertTriangle} hue="rose" label="Urgent" value={formatCompact(counts.urgent)} />
      </StatGrid>

      {/* two-pane console */}
      <Card className="flex h-[calc(100vh-300px)] min-h-[560px] overflow-hidden">
        {/* LEFT: list */}
        <div className={cx("w-full flex-col border-r border-neutral-100 md:flex md:w-[380px]", selected ? "hidden md:flex" : "flex")}>
          <div className="flex flex-col gap-3 border-b border-neutral-100 p-4">
            <SearchField value={query} onChange={setQuery} placeholder="Search tickets…" label="Search tickets" />
            <div className="-mx-1 overflow-x-auto px-1">
              <Segmented
                label="Filter by status"
                options={STATUS_FILTERS.map((f) => ({ key: f, label: f }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <Empty icon={Inbox} title="No tickets found" hint="Tickets your learners and instructors raise show here." />
            ) : (
              <ul className="space-y-1 p-2">
                {filtered.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => selectTicket(t.id)}
                        aria-current={active ? "true" : undefined}
                        className={cx(
                          "flex w-full cursor-pointer gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300",
                          active ? "bg-primary-50 ring-1 ring-primary-100" : "hover:bg-neutral-50",
                        )}
                      >
                        <span className="relative shrink-0">
                          <FaceAvatar name={t.requester} size={36} />
                          <span
                            className={cx(
                              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white",
                              PRIORITY_DOT[t.priority] ?? "bg-neutral-300",
                            )}
                            aria-hidden
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">{t.subject}</span>
                            {t.toPlatform && <Chip hue="sky">For the platform</Chip>}
                            <Chip hue={STATUS_HUE[t.status] ?? "slate"}>{t.status}</Chip>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-neutral-600">
                            {t.requester} · {t.role} · {t.category ?? "General"}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-neutral-500">
                            {t.reference} · Updated {new Date(t.updated).toLocaleDateString()}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: detail */}
        <div className={cx("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
          {selected ? (
            <>
              {/* header */}
              <div className="border-b border-neutral-100 p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setDetail(null);
                  }}
                  className="mb-3 inline-flex h-11 items-center gap-1 rounded-lg text-sm font-medium text-neutral-500 outline-none transition-colors hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300 md:hidden"
                >
                  <ChevronLeft size={16} aria-hidden />
                  Back to tickets
                </button>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold tracking-tight text-neutral-900">{selected.subject}</h2>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {selected.reference} · {selected.category ?? "General"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <PriorityChip priority={selected.priority} />
                    <Chip hue={STATUS_HUE[selected.status] ?? "slate"} dot>
                      {selected.status}
                    </Chip>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div className="flex items-center gap-2.5">
                    <FaceAvatar name={selected.requester} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{selected.requester}</p>
                      <p className="text-xs text-neutral-500">{selected.role}</p>
                    </div>
                  </div>
                  {/*
                    A control rather than a caption. `PATCH /tickets/{id}/assign`
                    existed and nothing called it, so a ticket landed in the
                    queue unassigned and stayed there: the only way to say who
                    was dealing with it was to say so in a reply.
                  */}
                  <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                    <span id="ticket-assignee-label">Assignee</span>
                    <SearchableSelect
                      aria-labelledby="ticket-assignee-label"
                      size="sm"
                      className="w-48"
                      value={selected.assigneeId ?? ""}
                      onChange={(v) => void assign(v === "" ? null : v)}
                      searchPlaceholder="Search colleagues"
                      options={[
                        // Nobody is a real state, not a missing value.
                        { value: "", label: "Unassigned" },
                        ...colleagues.map((member) => ({
                          value: member.id,
                          label: `${member.name}${member.isYou ? " (you)" : ""}`,
                        })),
                        /*
                          Somebody who has since left the admin team still holds
                          the ticket. Kept in the list so the control shows who
                          that is rather than silently reading as Unassigned.
                        */
                        ...(selected.assigneeId !== null && !colleagues.some((m) => m.id === selected.assigneeId)
                          ? [{ value: selected.assigneeId, label: selected.assignee ?? "Someone who has left" }]
                          : []),
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* thread */}
              <div className="flex-1 space-y-4 overflow-y-auto bg-canvas/60 p-4 sm:p-5">
                {(selected.messages ?? []).map((m, i) => {
                  const isSupport = m.from === "support";
                  return (
                    <div key={i} className={cx("flex gap-2.5", isSupport ? "flex-row-reverse" : "flex-row")}>
                      <FaceAvatar name={m.author} size={30} />
                      <div className={cx("flex max-w-[80%] flex-col", isSupport ? "items-end" : "items-start")}>
                        <div
                          className={cx(
                            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            isSupport
                              ? "rounded-tr-md bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-sm shadow-primary-600/20"
                              : "rounded-tl-md border border-neutral-200/80 bg-white text-neutral-800",
                          )}
                        >
                          <RichTextView value={m.body} size="sm" inverse={isSupport} />
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-neutral-500">
                          <span className="font-medium text-neutral-600">{m.author}</span>
                          <span aria-hidden>·</span>
                          <span>{new Date(m.time).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* composer */}
              <div className="border-t border-neutral-100 p-4">
                <RichTextEditor minHeight={102} value={draft} onChange={setDraft} placeholder="Write a reply…" label="Reply" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <SearchableSelect
                    value={selected.status}
                    onChange={(v) => void changeStatus(v)}
                    aria-label="Status"
                    size="sm"
                    className="w-40"
                    options={STATUS_OPTIONS.map((st) => ({ value: st, label: st }))}
                  />
                  <div className="flex items-center gap-2">
                    <Button icon={CheckCircle2} onClick={() => changeStatus("Resolved")} className="!text-mint-700">
                      Resolve
                    </Button>
                    <Button variant="primary" icon={Send} onClick={sendReply} disabled={draft.trim() === "" || sending}>
                      {sending ? "Sending…" : "Reply"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <Empty
                icon={LifeBuoy}
                title="Select a ticket"
                hint="Choose a ticket from the list to read the conversation and reply."
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
