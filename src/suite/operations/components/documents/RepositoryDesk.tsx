"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCheck, CalendarClock, CalendarX2, FileStack, FolderArchive, Gavel, Link2, LockKeyhole, Upload } from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel, SearchField, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut } from "@/components/workspace/charts";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE } from "@/components/workspace/modules";
import { todayYmd } from "@/components/workspace/Calendar";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { day } from "@/suite/finance/lib/format";
import { repoError, repository, type RepoDocument, type RepositoryMeta } from "@/lib/api/repository-client";
import { DocumentDialog } from "./DocumentDialog";
import { LEVEL, LevelChip, docCategoryHue, FileTypeIcon, fileSize } from "./parts";

/**
 * The document repository: search everything the organisation has filed by
 * what it says, narrow by category, confidentiality and expiry, and file
 * something new with what it is, what it belongs to and how long it is kept.
 */

type Expiry = "" | "60" | "expired";

export default function RepositoryDesk() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [expiry, setExpiry] = useState<Expiry>("");
  const [data, setData] = useState<{ documents: RepoDocument[]; meta: RepositoryMeta } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [uploading, setUploading] = useState(false);
  const listView = useListView("ops-repository");
  const today = todayYmd();

  // Search as they type, a moment after they stop.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    repository.list({ q: query, category, confidentiality: level, expiring: expiry ? 60 : undefined }).then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`The repository didn't load. ${repoError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [query, category, level, expiry, reload]);

  const rows = useMemo(() => {
    const docs = data?.documents ?? [];
    return expiry === "expired" ? docs.filter((d) => d.expiresOn && d.expiresOn < today) : docs;
  }, [data, expiry, today]);

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Document repository" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the repository…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-14" />
        <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
          <Skeleton className="h-[320px]" />
          <Skeleton className="h-[420px]" />
        </div>
      </div>
    );
  }

  const m = data.meta;
  const categories = Object.entries(m.categories);
  const filtered = Boolean(query || category || level || expiry);

  const columns: Column<RepoDocument>[] = [
    {
      key: "title",
      header: "Document",
      primary: true,
      sortable: true,
      value: (d) => `${d.title} ${d.fileName} ${d.reference ?? ""}`,
      render: (d) => {
        return (
          <span className="flex min-w-0 items-center gap-3">
            <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[docCategoryHue(d.category)].soft)}>
              <FileTypeIcon mime={d.mime} name={d.fileName} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-semibold text-neutral-900">{d.title}</span>
                {d.legalHold && <Gavel size={13} className="shrink-0 text-grape-600" aria-label="On legal hold" />}
              </span>
              <span className="block truncate text-xs text-neutral-500">{[d.fileName, fileSize(d.size)].filter(Boolean).join(" · ")}</span>
            </span>
          </span>
        );
      },
    },
    { key: "type", header: "Type", sortable: true, hideOnMobile: true, value: (d) => d.docType ?? "" },
    { key: "reference", header: "Reference", sortable: true, hideOnMobile: true, value: (d) => d.reference ?? "", render: (d) => (d.reference ? <span className="font-mono text-xs">{d.reference}</span> : <span className="text-neutral-400">—</span>) },
    {
      key: "category",
      header: "Category",
      sortable: true,
      value: (d) => d.categoryLabel,
      render: (d) => (
        <Chip hue={docCategoryHue(d.category)} dot>
          {d.categoryLabel}
        </Chip>
      ),
    },
    { key: "level", header: "Access", sortable: true, value: (d) => LEVEL[d.confidentiality]?.label ?? d.confidentiality, render: (d) => <LevelChip level={d.confidentiality} /> },
    {
      key: "links",
      header: "Linked to",
      align: "right",
      sortable: true,
      hideOnMobile: true,
      value: (d) => d.links ?? 0,
      render: (d) => (
        <span className="inline-flex items-center gap-1 tabular-nums text-neutral-700">
          <Link2 size={13} className="text-neutral-400" aria-hidden />
          {d.links ?? 0}
          <span className="sr-only">{d.links === 1 ? "record" : "records"}</span>
        </span>
      ),
    },
    {
      key: "uploaded",
      header: "Uploaded",
      sortable: true,
      hideOnMobile: true,
      value: (d) => d.uploadedAt ?? "",
      render: (d) => (
        <span className="block whitespace-nowrap">
          <span className="block tabular-nums text-neutral-800">{day(d.uploadedAt?.slice(0, 10) ?? null)}</span>
          <span className="block text-xs text-neutral-500">{d.uploadedBy ?? ""}</span>
        </span>
      ),
    },
  ];

  const kpis: { key: string; label: string; value: number; icon: typeof FileStack; hue: keyof typeof HUE; onClick?: () => void; on?: boolean }[] = [
    { key: "total", label: "Documents", value: m.total, icon: FileStack, hue: "blue", onClick: () => {
        setCategory("");
        setLevel("");
        setExpiry("");
      }, on: !filtered },
    { key: "hold", label: "On legal hold", value: m.onHold, icon: Gavel, hue: "grape" },
    { key: "soon", label: "Expiring in 60 days", value: m.expiringSoon, icon: CalendarClock, hue: m.expiringSoon ? "sun" : "slate", onClick: () => setExpiry(expiry === "60" ? "" : "60"), on: expiry === "60" },
    { key: "expired", label: "Expired", value: m.expired, icon: CalendarX2, hue: m.expired ? "rose" : "slate", onClick: () => setExpiry(expiry === "expired" ? "" : "expired"), on: expiry === "expired" },
    { key: "restricted", label: "Restricted", value: m.restricted, icon: LockKeyhole, hue: "rose", onClick: () => setLevel(level === "restricted" ? "" : "restricted"), on: level === "restricted" },
  ];

  const donut = categories.map(([key, label]) => ({ label, value: m.byCategory[key]?.count ?? 0, hue: docCategoryHue(key) })).filter((s) => s.value > 0);

  return (
    <div>
      <PageHeader
        title="Document repository"
        subtitle="Every contract, certificate, policy and record the organisation keeps: found by what it says, kept as long as it must be."
        actions={
          <>
            <ButtonLink href="/suite/operations/documents/controlled" icon={BookCheck}>
              Policies and SOPs
            </ButtonLink>
            <Button variant="primary" icon={Upload} onClick={() => setUploading(true)}>
              Upload document
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        <Card className="p-4 sm:p-5">
          <SearchField value={q} onChange={setQ} label="Search the repository" placeholder="Search titles, references and what documents say" />
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="The repository at a glance">
            {kpis.map((k) => {
              const Icon = k.icon;
              const inner = (
                <>
                  <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[k.hue].soft)}>
                    <Icon size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-xl font-bold leading-tight tabular-nums text-neutral-900">{k.value}</span>
                    <span className="block truncate text-xs text-neutral-500">{k.label}</span>
                  </span>
                </>
              );
              const cls = cx("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5", k.on ? "border-primary-400 bg-primary-50/60" : "border-neutral-200");
              return (
                <li key={k.key}>
                  {k.onClick ? (
                    <button type="button" aria-pressed={k.on} onClick={k.onClick} className={cx(cls, "cursor-pointer outline-none transition hover:border-neutral-300 focus-visible:ring-2 focus-visible:ring-primary-300")}>
                      {inner}
                    </button>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="space-y-5">
            <Panel title="Categories" icon={FolderArchive} hue="blue" bodyClassName="p-3">
              <ul className="space-y-0.5">
                {[["", "Everything"] as [string, string], ...categories].map(([key, label]) => {
                  const on = category === key;
                  const n = key ? (m.byCategory[key]?.count ?? 0) : m.total;
                  return (
                    <li key={key || "all"}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setCategory(key)}
                        className={cx(
                          "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                          on ? "bg-primary-50 font-semibold text-primary-800" : "text-neutral-700 hover:bg-neutral-50",
                        )}
                      >
                        <span className={cx("h-2 w-2 shrink-0 rounded-full", key ? HUE[docCategoryHue(key)].dot : "bg-neutral-400")} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <span className={cx("tabular-nums text-xs", on ? "text-primary-700" : "text-neutral-500")}>{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            {donut.length > 1 && (
              <Panel title="What is filed" subtitle="Documents by category" hue="grape">
                <Donut data={donut} total={m.total} centerLabel="documents" caption="Documents by category" legend="none" size={160} />
              </Panel>
            )}
          </div>

          <div className="min-w-0">
            {m.total === 0 && !filtered ? (
              <Card>
                <Empty
                  icon={FolderArchive}
                  title="Nothing filed yet"
                  hint="Upload contracts, certificates and records with what they belong to. Documents attached elsewhere in the suite are filed here too."
                  action={
                    <Button variant="primary" icon={Upload} onClick={() => setUploading(true)}>
                      Upload the first document
                    </Button>
                  }
                />
              </Card>
            ) : (
              <DataView
                rows={rows}
                columns={columns}
                rowKey={(d) => d.id}
                rowHref={(d) => `/suite/operations/documents/${d.id}`}
                {...listView}
                searchable={false}
                caption="Documents"
                gridCols={2}
                toolbar={
                  <div className="flex flex-wrap gap-2">
                    <SearchableSelect
                      size="sm"
                      aria-label="Access"
                      className="w-40"
                      value={level}
                      onChange={setLevel}
                      clearable
                      clearLabel="Any access"
                      placeholder="Any access"
                      searchPlaceholder="Search"
                      options={Object.entries(m.levels).map(([value, label]) => ({ value, label }))}
                    />
                    <SearchableSelect
                      size="sm"
                      aria-label="Expiry"
                      className="w-44"
                      value={expiry}
                      onChange={(v) => setExpiry(v as Expiry)}
                      clearable
                      clearLabel="Any expiry"
                      placeholder="Any expiry"
                      searchPlaceholder="Search"
                      options={[
                        { value: "60", label: "Expiring in 60 days" },
                        { value: "expired", label: "Already expired" },
                      ]}
                    />
                  </div>
                }
                empty={
                  <div className="px-5 py-10 text-center text-sm text-neutral-500">
                    {query ? `Nothing found for “${query}”.` : "Nothing matches these filters."} Clear one to see more.
                  </div>
                }
              />
            )}
          </div>
        </div>
      </div>

      {uploading && (
        <DocumentDialog
          lists={{ categories: m.categories, retention: m.retention }}
          onClose={() => setUploading(false)}
          onDone={(d) => {
            setUploading(false);
            router.push(`/suite/operations/documents/${d.id}`);
          }}
        />
      )}
    </div>
  );
}
