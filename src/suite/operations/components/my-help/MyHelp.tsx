"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleHelp, Clock, Inbox, MessageSquarePlus, Star, Wrench } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { ErrorNote, IconTile, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { help, opsError, type HelpCatalogue, type HelpItem, type MyWorkOrder, type Ticket } from "@/lib/api/operations-desk-client";
import { ChipFilter } from "@/suite/operations/components/facilities/parts";
import { CategoryIcon, SlaPill, TicketStatusChip } from "@/suite/operations/components/desk/parts";
import { ago, categoryLook, statusMeta, stampText, useNow } from "@/suite/operations/components/desk/labels";
import RaiseDialog from "./RaiseDialog";
import { richExcerpt } from "@/lib/richText";

/**
 * Ask for help: everything the desk offers as tiles by category, each
 * opening its own short form; repairs done on my things that wait for me to
 * say so; and what I have asked, with where each stands against its clock.
 */
export default function MyHelp() {
  const router = useRouter();
  const now = useNow();
  const [cat, setCat] = useState<HelpCatalogue | null>(null);
  const [mine, setMine] = useState<Ticket[] | null>(null);
  const [repairs, setRepairs] = useState<MyWorkOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [asking, setAsking] = useState<{ item: HelpItem | null } | null>(null);
  const [show, setShow] = useState<"open" | "all">("open");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([help.catalogue(), help.mine(), help.workOrders().catch(() => [] as MyWorkOrder[])]).then(
      ([c, t, w]) => {
        if (!alive) return;
        setCat(c);
        setMine(t);
        setRepairs(w);
        setError(null);
      },
      (e: unknown) => alive && setError(`Ask for help didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const groups = useMemo(() => {
    const by = new Map<string, HelpItem[]>();
    for (const i of cat?.items ?? []) by.set(i.category, [...(by.get(i.category) ?? []), i]);
    return [...by.entries()];
  }, [cat]);

  if (error && !cat) return <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!cat || !mine) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[240px]" />
      </div>
    );
  }

  const toConfirm = repairs.filter((w) => w.toConfirm);
  const open = mine.filter((t) => statusMeta(t.status).open || t.status === "resolved");
  const listed = show === "open" ? open : mine;

  const confirmRepair = async (w: MyWorkOrder) => {
    setBusy(w.id);
    setActionError(null);
    try {
      await help.confirmWork(w.id);
      setRepairs((list) => list.map((x) => (x.id === w.id ? { ...x, toConfirm: false, status: "closed" } : x)));
      setNotice(`Thanks. ${w.number ?? "The repair"} is confirmed done.`);
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Ask for help"
        subtitle="Something broken, something you need, somewhere to be. Pick what fits and the right people get it."
        actions={
          <Button icon={MessageSquarePlus} onClick={() => setAsking({ item: null })}>
            Something else
          </Button>
        }
      />
      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="space-y-6">
        {toConfirm.length > 0 && (
          <Panel title="Repairs to confirm" subtitle="Maintenance says these are done. Confirm once you have checked." icon={Wrench} hue="mint">
            <ul className="divide-y divide-neutral-100">
              {toConfirm.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                  <IconTile icon={Wrench} hue="mint" size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{w.title}</p>
                    <p className="truncate text-xs text-neutral-500">{[w.number, w.asset, w.completedAt ? `done ${stampText(w.completedAt)}` : null, w.resolution ? richExcerpt(w.resolution, 160) : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Button size="sm" variant="primary" disabled={busy === w.id} onClick={() => void confirmRepair(w)}>
                    {busy === w.id ? "Confirming…" : "Confirm it's fixed"}
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <section aria-labelledby="catalogue-h" className="space-y-5">
          <h2 id="catalogue-h" className="sr-only">
            What you can ask for
          </h2>
          {groups.length === 0 ? (
            <div className="ws-card">
              <Empty icon={CircleHelp} title="Nothing to pick from yet" hint="Use “Something else” and the desk will route it." />
            </div>
          ) : (
            groups.map(([category, items]) => {
              const look = categoryLook(category);
              return (
                <div key={category}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight text-neutral-800">
                    <span className={cx("h-2 w-2 rounded-full", HUE[look.hue].dot)} aria-hidden />
                    {cat.categories[category] ?? category}
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {items.map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => setAsking({ item: i })}
                          className="ws-card group flex h-full w-full cursor-pointer flex-col gap-3 p-5 text-left outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <CategoryIcon category={i.category} size={42} />
                            {i.routesTo === "work_order" && <Chip hue="coral">Goes to maintenance</Chip>}
                          </div>
                          <span className="block text-[15px] font-bold tracking-tight text-neutral-900">{i.name}</span>
                          {i.description && <span className="line-clamp-2 block text-xs text-neutral-500">{i.description}</span>}
                          <span className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} aria-hidden /> Within {i.slaHours}h
                            </span>
                            <ChevronRight size={16} className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600" aria-hidden />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>

        <Panel
          title="My requests"
          subtitle="Where each one stands, and how long the desk has left"
          icon={Inbox}
          hue="blue"
          actions={
            <ChipFilter
              label="Which requests"
              value={show}
              onChange={setShow}
              options={[
                { key: "open", label: "Open", count: open.length },
                { key: "all", label: "All", count: mine.length },
              ]}
            />
          }
        >
          {listed.length === 0 ? (
            <Empty icon={Inbox} title={show === "open" ? "Nothing open" : "You haven't asked for anything yet"} hint="Pick a tile above to ask." />
          ) : (
            <ul className="-mx-2 divide-y divide-neutral-100">
              {listed.map((t) => (
                <li key={t.id}>
                  <Link href={`/suite/operations/my/help/${t.id}`} className="flex min-h-11 flex-wrap items-center gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300 sm:flex-nowrap">
                    <CategoryIcon category={t.category} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{t.title}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        <span className="font-mono">{t.number}</span>
                        {t.item ? ` · ${t.item}` : ""} · {ago(t.createdAt, now)}
                        {t.assignee ? ` · with ${t.assignee}` : ""}
                      </span>
                    </span>
                    {t.status === "resolved" ? (
                      <Chip hue="sun" icon={Star}>
                        Rate and close
                      </Chip>
                    ) : statusMeta(t.status).open ? (
                      <SlaPill ticket={t} now={now} />
                    ) : null}
                    <TicketStatusChip status={t.status} />
                    <ChevronRight size={16} className="hidden shrink-0 text-neutral-400 sm:block" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {asking && (
        <RaiseDialog
          item={asking.item}
          catalogue={cat}
          onClose={() => setAsking(null)}
          onDone={(t) => {
            setAsking(null);
            router.push(`/suite/operations/my/help/${t.id}`);
          }}
        />
      )}
    </div>
  );
}
