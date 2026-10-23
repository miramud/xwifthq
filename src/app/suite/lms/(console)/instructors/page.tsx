"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Users, UserCheck, GraduationCap, Wallet, UserPlus, Eye, Pencil, Ban, BookOpen } from "lucide-react";
import { formatCompact, formatCompactNaira } from "@/lib/console-data";
import {
  instructors as instructorsApi,
  ApiError,
  type AdminInstructor,
} from "@/lib/api/admin-client";
import { useCategoryNames } from "@/lib/api/categories-client";
import { ActionMenu } from "@/components/dashboard/ui";
import { Button, Chip, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { hueFor } from "@/components/workspace/modules";
import {
  ErrorNote,
  FaceAvatar,
  PersonCard,
  Rating,
  StatCard,
  StatusChip,
} from "@/suite/lms/components/ui/ws";

type StatusFilter = "All" | "Active" | "Pending" | "Suspended";

const STATUS_FILTERS: readonly StatusFilter[] = [
  "All",
  "Active",
  "Pending",
  "Suspended",
];

export default function AdminInstructorsPage() {
  // Category taxonomy comes from the database, not a hardcoded list.
  const categoryNames = useCategoryNames();
  const [status, setStatus] = useState<StatusFilter>("All");
  const [category, setCategory] = useState("All");

  const [items, setItems] = useState<AdminInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await instructorsApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load instructors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSuspend = useCallback(
    async (i: AdminInstructor) => {
      const next = i.status === "Suspended" ? "active" : "suspended";
      try {
        await instructorsApi.update(i.id, { status: next });
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not update the instructor.");
      }
    },
    [load],
  );

  const counts = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((i) => i.status === "Active").length,
      pending: items.filter((i) => i.status === "Pending").length,
      suspended: items.filter((i) => i.status === "Suspended").length,
      students: items.reduce((s, i) => s + i.students, 0),
      payoutPending: items.reduce((s, i) => s + i.payoutPending, 0),
    };
  }, [items]);

  // Revenue first, as the list always opened; column headers re-sort from there.
  const rows = useMemo(
    () =>
      items
        .filter((i) => (status === "All" || i.status === status) && (category === "All" || i.category === category))
        .sort((a, b) => b.revenue - a.revenue),
    [items, status, category],
  );

  function clearFilters() {
    setStatus("All");
    setCategory("All");
  }

  const actions = (i: AdminInstructor) => (
    <ActionMenu
      label={`Actions for ${i.name}`}
      items={[
        { label: "View profile", href: `/suite/lms/instructors/${i.id}`, icon: Eye },
        { label: "Edit instructor", href: `/suite/lms/instructors/${i.id}/edit`, icon: Pencil },
        {
          label: i.status === "Suspended" ? "Reinstate" : "Suspend",
          icon: Ban,
          danger: i.status !== "Suspended",
          onClick: () => toggleSuspend(i),
        },
      ]}
    />
  );

  const columns: Column<AdminInstructor>[] = [
    {
      key: "name",
      header: "Instructor",
      primary: true,
      sortable: true,
      value: (i) => i.name,
      render: (i) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={i.name} size={38} />
          <span className="min-w-0">
            <span className="block max-w-[200px] truncate font-semibold text-neutral-900">{i.name}</span>
            <span className="block max-w-[200px] truncate text-xs text-neutral-500">{i.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      sortable: true,
      hideOnMobile: true,
      value: (i) => i.title ?? "",
      render: (i) => <span className="block max-w-[180px] truncate text-neutral-600">{i.title}</span>,
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      hideOnMobile: true,
      value: (i) => i.category ?? "",
      render: (i) => (i.category ? <Chip hue={hueFor(i.category)}>{i.category}</Chip> : <span className="text-neutral-400">-</span>),
    },
    { key: "courses", header: "Courses", align: "right", sortable: true, value: (i) => i.courses },
    {
      key: "students",
      header: "Students",
      align: "right",
      sortable: true,
      value: (i) => i.students,
      render: (i) => formatCompact(i.students),
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      sortable: true,
      value: (i) => i.revenue,
      render: (i) => <span className="font-semibold text-neutral-900">{formatCompactNaira(i.revenue)}</span>,
    },
    { key: "avgRating", header: "Rating", sortable: true, value: (i) => i.avgRating, render: (i) => <Rating value={i.avgRating} /> },
    {
      key: "payoutPending",
      header: "Payout pending",
      align: "right",
      sortable: true,
      tableOnly: true,
      value: (i) => i.payoutPending,
      render: (i) => formatCompactNaira(i.payoutPending),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (i) => i.status,
      render: (i) => <StatusChip status={i.status} />,
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instructors"
        subtitle={`${counts.total} instructors · ${counts.active} active · ${counts.pending} pending · ${counts.suspended} suspended`}
        actions={
          <Button variant="primary" icon={UserPlus}>
            Invite instructor
          </Button>
        }
        tabs={STATUS_FILTERS.map((s) => ({
          key: s,
          label: s,
          count:
            s === "All" ? counts.total : s === "Active" ? counts.active : s === "Pending" ? counts.pending : counts.suspended,
        }))}
        activeTab={status}
        onTab={(k) => setStatus(k as StatusFilter)}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* mini stats */}
      <StatGrid>
        <StatCard featured featuredHue="grape" icon={Users} label="Total instructors" value={`${counts.total}`} />
        <StatCard icon={UserCheck} label="Active instructors" value={`${counts.active}`} hue="mint" />
        <StatCard icon={GraduationCap} label="Students taught" value={formatCompact(counts.students)} hue="sky" />
        <StatCard icon={Wallet} label="Payout pending" value={formatCompactNaira(counts.payoutPending)} hue="sun" />
      </StatGrid>

      <DataView
        rows={rows}
        columns={columns}
        rowKey={(i) => i.id}
        rowHref={(i) => `/suite/lms/instructors/${i.id}`}
        storageKey="lms.instructors"
        defaultView="grid"
        caption="Instructors"
        searchPlaceholder="Search name, email or role…"
        matches={(i, q) =>
          i.name.toLowerCase().includes(q) ||
          (i.email ?? "").toLowerCase().includes(q) ||
          (i.title ?? "").toLowerCase().includes(q)
        }
        toolbar={
          <SearchableSelect
            value={category}
            onChange={setCategory}
            size="sm"
            className="w-48"
            aria-label="Filter by category"
            options={[
              { value: "All", label: "All categories" },
              ...categoryNames.map((c) => ({ value: c, label: c })),
            ]}
          />
        }
        renderCard={(i) => (
          <PersonCard
            name={i.name}
            subtitle={i.title ?? i.email}
            trailing={<StatusChip status={i.status} />}
            chips={
              <>
                {i.category && <Chip hue={hueFor(i.category)}>{i.category}</Chip>}
                <Chip hue="slate" icon={BookOpen}>
                  {i.courses} courses
                </Chip>
              </>
            }
            footer={
              <>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Users size={13} aria-hidden />
                  {formatCompact(i.students)} students
                </span>
                <Rating value={i.avgRating} />
              </>
            }
          />
        )}
        renderListItem={(i) => (
          <div className="flex items-center gap-4 px-5 py-3.5">
            <FaceAvatar name={i.name} size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{i.name}</p>
              <p className="truncate text-xs text-neutral-500">
                {[i.title, i.category, `${i.courses} courses`, `${formatCompact(i.students)} students`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="hidden sm:block">
              <Rating value={i.avgRating} />
            </span>
            <StatusChip status={i.status} />
          </div>
        )}
        empty={
          <Empty
            icon={Users}
            hue="grape"
            title={loading ? "Loading instructors…" : "No instructors match your filters."}
            hint={loading ? undefined : "Try a different search term, status or category."}
            action={
              !loading && (
                <Button size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        }
      />
    </div>
  );
}
