"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  BadgeCheck,
  Building2,
  Eye,
  File as FileGlyph,
  FileImage,
  FileSpreadsheet,
  FileText,
  Hourglass,
  Lock,
  LockKeyhole,
  PenLine,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Chip } from "@/components/workspace/kit";
import type { SelectOption } from "@/components/workspace/SearchableSelect";
import type { Hue } from "@/components/workspace/modules";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { procurement } from "@/lib/api/operations-procurement-client";
import type { Confidentiality, VersionStatus } from "@/lib/api/repository-client";

/* Words, hues and pickers the repository screens share. */

export interface Meta {
  label: string;
  hue: Hue;
  icon: LucideIcon;
}

export const LEVEL: Record<Confidentiality, Meta & { hint: string }> = {
  public_internal: { label: "Internal", hue: "sky", icon: Building2, hint: "Everybody in the organisation can find it" },
  confidential: { label: "Confidential", hue: "sun", icon: Lock, hint: "The document desk only; every read is logged" },
  restricted: { label: "Restricted", hue: "rose", icon: LockKeyhole, hint: "Only the people named; others never find it" },
};

export const levelMeta = (l: string | null | undefined) => LEVEL[(l ?? "public_internal") as Confidentiality] ?? LEVEL.public_internal;

export function LevelChip({ level }: { level: string }) {
  const m = levelMeta(level);
  return (
    <Chip hue={m.hue} icon={m.icon}>
      {m.label}
    </Chip>
  );
}

export const VERSION: Record<VersionStatus, Meta> = {
  draft: { label: "Draft", hue: "slate", icon: PenLine },
  in_review: { label: "In review", hue: "sky", icon: Eye },
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  approved: { label: "Approved", hue: "mint", icon: BadgeCheck },
  superseded: { label: "Superseded", hue: "slate", icon: Archive },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
};

export const versionMeta = (s: string | null | undefined): Meta => VERSION[(s ?? "draft") as VersionStatus] ?? VERSION.draft;

export function VersionChip({ status }: { status: string }) {
  const m = versionMeta(status);
  return (
    <Chip hue={m.hue} icon={m.icon}>
      {m.label}
    </Chip>
  );
}

const CATEGORY_HUE: Record<string, Hue> = {
  corporate: "blue",
  contracts: "coral",
  clients: "mint",
  vendors: "sky",
  projects: "grape",
  finance: "sun",
  operations: "slate",
  hr: "rose",
  policies: "grape",
};

export const docCategoryHue = (c: string | null | undefined): Hue => CATEGORY_HUE[c ?? ""] ?? "slate";

/** What kind of file it is, from its type or its extension. */
export function fileKind(mime: string | null | undefined, name?: string | null): "image" | "sheet" | "text" | "other" {
  const m = (mime ?? "").toLowerCase();
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (m.includes("sheet") || m.includes("excel") || m.includes("csv") || ["xlsx", "xls", "csv"].includes(ext)) return "sheet";
  if (m.includes("pdf") || m.includes("word") || m.startsWith("text/") || ["pdf", "doc", "docx", "txt"].includes(ext)) return "text";
  return "other";
}

/** The icon a file's type suggests. Decorative: the file name beside it says what it is. */
export function FileTypeIcon({ mime, name, size = 17 }: { mime: string | null | undefined; name?: string | null; size?: number }) {
  switch (fileKind(mime, name)) {
    case "image":
      return <FileImage size={size} aria-hidden />;
    case "sheet":
      return <FileSpreadsheet size={size} aria-hidden />;
    case "text":
      return <FileText size={size} aria-hidden />;
    default:
      return <FileGlyph size={size} aria-hidden />;
  }
}

/** 2.4 MB, 820 KB. */
export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** The access log's verbs in words. */
export function accessText(action: string): string {
  return { view: "Opened", download: "Downloaded", upload: "Filed" }[action] ?? action.replace(/_/g, " ");
}

/** A module key in words: "projects" → "Projects", "core" → "Repository". */
export function moduleText(module: string): string {
  const known: Record<string, string> = { core: "Repository", admin: "Operations", operations: "Operations", finance: "Finance", hrm: "People", projects: "Projects", lms: "Learning" };
  return known[module] ?? module.charAt(0).toUpperCase() + module.slice(1);
}

/* ------------------------------ pickers ------------------------------ */

export interface RepoPickers {
  people: SelectOption[] | null;
  units: SelectOption[] | null;
  counterparties: SelectOption[] | null;
  projects: SelectOption[] | null;
}

let cache: Promise<RepoPickers> | null = null;

async function loadPickers(): Promise<RepoPickers> {
  const settle = <T,>(p: Promise<T>) => p.then((v) => v, () => null);
  const [people, units, counterparties, options] = await Promise.all([
    settle(orgFoundations.lookups.people()),
    settle(orgFoundations.lookups.units()),
    settle(orgFoundations.lookups.counterparties()),
    settle(procurement.me.options()),
  ]);
  return {
    people: (people ?? []).map((p) => ({ value: p.id, label: p.name, hint: [p.jobTitle, p.unit].filter(Boolean).join(" · ") || undefined })),
    units: (units ?? []).map((u) => ({ value: u.id, label: u.name, hint: u.code })),
    counterparties: (counterparties ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.roles.join(", ") || undefined })),
    projects: (options?.projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })),
  };
}

/** People, units, clients and vendors, and projects for the repository's pickers. Null while loading. */
export function useRepoPickers(): RepoPickers {
  const [data, setData] = useState<RepoPickers>({ people: null, units: null, counterparties: null, projects: null });
  useEffect(() => {
    let alive = true;
    cache ??= loadPickers();
    cache.then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

/** For tests: forget the cached pickers. */
export function resetRepoPickers() {
  cache = null;
}
