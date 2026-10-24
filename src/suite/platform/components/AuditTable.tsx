"use client";

import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Card, Empty } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { FaceAvatar } from "@/suite/lms/components/ui/ws";
import type { PlatformAuditEntry } from "@/lib/api/platform-client";
import { SeverityChip, When } from "./ui";

/** `course.created_by_admin` → "Course created by admin". */
export function humaniseAction(action: string): string {
  const s = action.replace(/[._]/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The audit record, as a table: when, who, what, to what, where, how serious.
 * Shared by the platform-wide log and one organisation's trail, which only
 * differ in whether the organisation column is worth showing.
 */
export default function AuditTable({
  rows,
  showOrganisation = true,
  empty,
}: {
  rows: PlatformAuditEntry[];
  showOrganisation?: boolean;
  empty?: React.ReactNode;
}) {
  const columns: Column<PlatformAuditEntry>[] = [
    {
      key: "at",
      header: "When",
      sortable: true,
      value: (r) => r.at,
      render: (r) => <When at={r.at} className="whitespace-nowrap text-neutral-600" />,
    },
    {
      key: "action",
      header: "Action",
      primary: true,
      value: (r) => r.action,
      render: (r) => (
        <span className="min-w-0">
          <span className="block font-semibold text-neutral-900">{humaniseAction(r.action)}</span>
          {r.subject?.label && <span className="block truncate text-xs text-neutral-500">{r.subject.label}</span>}
        </span>
      ),
    },
    {
      key: "actor",
      header: "By",
      value: (r) => r.actor?.name ?? "System",
      render: (r) =>
        r.actor ? (
          <span className="flex items-center gap-2">
            <FaceAvatar name={r.actor.name} size={26} />
            <span className="truncate">{r.actor.name}</span>
          </span>
        ) : (
          <span className="text-neutral-500">System</span>
        ),
    },
    ...(showOrganisation
      ? [
          {
            key: "organisation",
            header: "Organisation",
            hideOnMobile: true,
            value: (r: PlatformAuditEntry) => r.organisation?.name ?? "Platform",
            render: (r: PlatformAuditEntry) =>
              r.organisation ? (
                <Link
                  href={`/suite/platform/organisations/${encodeURIComponent(r.organisation.slug)}`}
                  className="text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  {r.organisation.name}
                </Link>
              ) : (
                <span className="text-neutral-500">Platform</span>
              ),
          } satisfies Column<PlatformAuditEntry>,
        ]
      : []),
    {
      key: "severity",
      header: "Severity",
      value: (r) => r.severity,
      render: (r) => <SeverityChip severity={r.severity} />,
    },
    {
      key: "ip",
      header: "IP",
      hideOnMobile: true,
      value: (r) => r.ip ?? "",
      render: (r) => <span className="font-mono text-xs text-neutral-500">{r.ip ?? "-"}</span>,
    },
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      views={["table", "list"]}
      storageKey="platform.audit"
      caption="Audit log"
      searchable={false}
      empty={
        empty ?? (
          <Card>
            <Empty icon={ScrollText} hue="sky" title="Nothing recorded yet" hint="Changes to organisations, people, money and settings show up here." />
          </Card>
        )
      }
    />
  );
}
