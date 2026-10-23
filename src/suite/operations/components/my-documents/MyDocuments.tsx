"use client";

import { useEffect, useState } from "react";
import { Download, FileSearch } from "lucide-react";
import { Card, Chip, Empty, PageHeader, SearchField, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE } from "@/components/workspace/modules";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { myRepository, repoError, type RepoDocument } from "@/lib/api/repository-client";
import { LevelChip, docCategoryHue, FileTypeIcon, fileSize } from "@/suite/operations/components/documents/parts";

/**
 * The organisation's documents as a member of staff sees them: search by
 * title, reference or what a document says, and download. Restricted
 * documents somebody is not named on are never found.
 */
export default function MyDocuments() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [data, setData] = useState<{ documents: RepoDocument[]; categories: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    myRepository.search({ q: query, category }).then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Documents didn't load. ${repoError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [query, category, reload]);

  return (
    <div>
      <PageHeader title="Documents" subtitle="Find the organisation's documents by title, reference or what they say, and download them." />

      <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <SearchField value={q} onChange={setQ} label="Search documents" placeholder="Search titles, references and contents" className="w-full sm:flex-1" />
        <SearchableSelect
          aria-label="Category"
          className="w-full sm:w-56"
          value={category}
          onChange={setCategory}
          clearable
          clearLabel="Every category"
          placeholder="Every category"
          searchPlaceholder="Search categories"
          options={Object.entries(data?.categories ?? {}).map(([value, label]) => ({ value, label }))}
        />
      </Card>

      {error && !data ? (
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      ) : !data ? (
        <div aria-busy="true" className="space-y-3">
          <p className="sr-only">Searching…</p>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : data.documents.length === 0 ? (
        <Card>
          <Empty
            icon={FileSearch}
            title={query || category ? "Nothing found" : "No documents to show"}
            hint={query || category ? "Try fewer words, or another category." : "Documents filed for everyone in the organisation appear here."}
          />
        </Card>
      ) : (
        <Card>
          <p className="border-b border-neutral-100 px-5 py-3 text-xs text-neutral-500" aria-live="polite">
            {data.documents.length === 100 ? "The first 100 documents found" : `${data.documents.length} ${data.documents.length === 1 ? "document" : "documents"}`}
          </p>
          <ul className="divide-y divide-neutral-100">
            {data.documents.map((d) => {
              return (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[docCategoryHue(d.category)].soft)}>
                    <FileTypeIcon mime={d.mime} name={d.fileName} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{d.title}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {[d.reference, d.categoryLabel, d.project?.name, day(d.documentDate ?? d.uploadedAt?.slice(0, 10) ?? null), fileSize(d.size)].filter((x) => x && x !== "—").join(" · ")}
                    </span>
                  </span>
                  <span className="hidden shrink-0 sm:block">{d.confidentiality === "public_internal" ? <Chip hue={docCategoryHue(d.category)}>{d.categoryLabel}</Chip> : <LevelChip level={d.confidentiality} />}</span>
                  <a
                    href={myRepository.downloadHref(d.id)}
                    aria-label={`Download ${d.title}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-600 outline-none hover:bg-primary-50 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <Download size={18} aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
