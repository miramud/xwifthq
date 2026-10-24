"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, BookOpen, Check, FolderOpen, Layers, Pencil, PieChart, Plus, Trash2, Users, Wallet, X } from "lucide-react";
import { DonutChart, BarChart } from "@/components/console/Charts";
import { Button, Chip, Empty, PageHeader, Panel, Progress, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueHex } from "@/components/workspace/charts";
import { ErrorNote, Field, StatCard, inputClass } from "@/suite/lms/components/ui/ws";
import { formatCompact, formatCompactNaira } from "@/lib/console-data";
import {
  categories as categoriesApi,
  ApiError,
  type AdminCategory,
} from "@/lib/api/admin-client";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/*
  Colour choices for the category swatch picker, in the workspace palette.
  The chosen value is stored on the category and drawn wherever the category
  appears, so these are data as much as style.
*/
const SWATCHES = (["grape", "blue", "sky", "mint", "sun", "coral", "rose", "slate"] as const).map(hueHex);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCategoriesPage() {
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  /** Slug of the category being edited, or null when adding a new one. */
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  /** Categories loaded from the backend. */
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setCats(await categoriesApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Controlled form */
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);

  const totalCourses = cats.reduce((s, c) => s + c.courses, 0);
  const totalRevenue = cats.reduce((s, c) => s + c.revenue, 0);
  const maxStudents = Math.max(...cats.map((c) => c.students), 1);
  const totalStudents = cats.reduce((s, c) => s + c.students, 0) || 1;

  const handleName = (v: string) => {
    setName(v);
    // Keep the slug in sync only while adding (don't clobber an edited slug blindly).
    if (!editingSlug) setSlug(slugify(v));
  };

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setColor(SWATCHES[0]);
  };

  const openAdd = () => {
    resetForm();
    setEditingSlug(null);
    setFormOpen(true);
  };

  const openEdit = (c: AdminCategory) => {
    setName(c.name);
    setSlug(c.slug);
    setDescription("");
    setColor(c.color ?? SWATCHES[0]);
    setEditingSlug(c.slug);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingSlug(null);
    resetForm();
  };

  const saveCategory = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editingSlug) {
        await categoriesApi.update(editingSlug, { name: trimmed, color, description });
      } else {
        await categoriesApi.create({ name: trimmed, color, description });
      }
      await load();
      closeForm();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the category.");
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async (target: string) => {
    const category = cats.find((c) => c.slug === target);
    const ok = await confirm({
      title: `Delete the “${category?.name ?? target}” category?`,
      body: "Courses filed under it lose their category. It moves to the platform's recycle bin, where it can be restored.",
      confirmLabel: "Delete category",
      recoverable: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await categoriesApi.remove(target);
      await load();
      if (editingSlug === target) closeForm();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete the category.");
    }
  };

  const share = (c: AdminCategory) => Math.round((c.students / maxStudents) * 100);

  const rowActions = (c: AdminCategory) => (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => openEdit(c)}
        aria-label={`Edit ${c.name}`}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <Pencil size={16} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => removeCategory(c.slug)}
        aria-label={`Delete ${c.name}`}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </div>
  );

  const swatch = (c: AdminCategory, size = 40) => (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
      style={{ width: size, height: size, background: c.color ?? SWATCHES[0] }}
      aria-hidden
    >
      <Layers size={Math.round(size * 0.45)} />
    </span>
  );

  const columns: Column<AdminCategory>[] = [
    {
      key: "name",
      header: "Category",
      primary: true,
      sortable: true,
      value: (c) => c.name,
      render: (c) => (
        <span className="flex items-center gap-3">
          {swatch(c, 36)}
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{c.name}</span>
            <span className="block truncate text-xs text-neutral-500">{c.slug}</span>
          </span>
        </span>
      ),
    },
    { key: "courses", header: "Courses", align: "right", sortable: true, value: (c) => c.courses },
    {
      key: "students",
      header: "Students",
      align: "right",
      sortable: true,
      value: (c) => c.students,
      render: (c) => formatCompact(c.students),
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.revenue,
      render: (c) => <span className="font-semibold text-neutral-900">{formatCompactNaira(c.revenue)}</span>,
    },
    {
      key: "share",
      header: "Share",
      sortable: true,
      value: (c) => share(c),
      render: (c) => (
        <span className="flex min-w-[130px] items-center gap-2">
          <Progress value={share(c)} hue="grape" size="sm" label={`${c.name} share of students`} />
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-600">{share(c)}%</span>
        </span>
      ),
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: rowActions },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle="Group the courses in your catalogue."
        actions={
          <Button variant="primary" icon={Plus} onClick={openAdd}>
            Add category
          </Button>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && (
        <p role="status" className="text-sm text-neutral-500">
          Loading categories…
        </p>
      )}

      {/* KPI row */}
      <StatGrid cols={3}>
        <StatCard featured featuredHue="grape" label="Total categories" value={`${cats.length}`} icon={Layers} />
        <StatCard label="Total courses" value={formatCompact(totalCourses)} icon={BookOpen} hue="sky" />
        <StatCard label="Total revenue" value={formatCompactNaira(totalRevenue)} icon={Wallet} hue="mint" />
      </StatGrid>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Students by category" subtitle="Share of all enrolments" icon={PieChart} hue="grape">
          <DonutChart
            data={cats.map((c) => ({
              label: c.name,
              value: c.students,
              color: c.color ?? SWATCHES[0],
            }))}
            centerLabel="Total students"
            centerValue={formatCompact(totalStudents)}
            formatValue={formatCompact}
          />
        </Panel>

        <Panel title="Revenue by category" subtitle="Gross revenue per category" icon={BarChart3} hue="mint">
          <BarChart
            data={cats.map((c) => ({
              label: c.name.split(" ")[0],
              value: c.revenue,
              color: c.color ?? SWATCHES[0],
            }))}
            height={240}
            ariaLabel="Revenue per category"
            formatValue={formatCompactNaira}
          />
        </Panel>
      </div>

      {/* Add or edit form */}
      {formOpen && (
        <Panel
          title={editingSlug ? "Edit category" : "New category"}
          subtitle={editingSlug ? "Change the details of this category." : "Add a category to group courses under."}
          icon={editingSlug ? Pencil : Plus}
          hue="grape"
          className="ring-2 ring-primary-100"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="cat-name" label="Name">
              <input
                id="cat-name"
                type="text"
                value={name}
                onChange={(e) => handleName(e.target.value)}
                placeholder="e.g. Data Science"
                className={inputClass}
              />
            </Field>
            <Field id="cat-slug" label="Slug">
              <input
                id="cat-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="data-science"
                className={inputClass}
              />
            </Field>
            <Field id="cat-desc" label="Description" className="sm:col-span-2">
              <input
                id="cat-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short summary shown on the catalogue page"
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">Colour</span>
              <div className="flex flex-wrap items-center gap-2.5">
                {SWATCHES.map((s) => {
                  const on = color === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setColor(s)}
                      aria-label={`Select colour ${s}`}
                      aria-pressed={on}
                      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 motion-reduce:hover:scale-100 ${
                        on ? "ring-2 ring-neutral-900 ring-offset-2" : ""
                      }`}
                      style={{ background: s }}
                    >
                      {on && <Check size={15} className="text-white" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button icon={X} onClick={closeForm}>
              Cancel
            </Button>
            <Button variant="primary" icon={Check} onClick={saveCategory} disabled={!name.trim() || saving}>
              {saving ? "Saving…" : editingSlug ? "Save changes" : "Save category"}
            </Button>
          </div>
        </Panel>
      )}

      {/* All categories */}
      <DataView
        rows={cats}
        columns={columns}
        rowKey={(c) => c.slug}
        storageKey="lms.categories"
        caption="All categories"
        searchPlaceholder="Search categories"
        matches={(c, q) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)}
        renderCard={(c) => (
          <div className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              {swatch(c, 44)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-neutral-900">{c.name}</p>
                <p className="truncate text-xs text-neutral-500">{c.slug}</p>
              </div>
              {rowActions(c)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip hue="blue" icon={BookOpen}>
                {c.courses} courses
              </Chip>
              <Chip hue="grape" icon={Users}>
                {formatCompact(c.students)} students
              </Chip>
            </div>
            <div className="mt-auto">
              <Progress value={share(c)} hue="grape" label="Share of students" showValue />
            </div>
          </div>
        )}
        renderListItem={(c) => (
          <div className="flex items-center gap-4 px-5 py-3.5">
            {swatch(c, 40)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{c.name}</p>
              <p className="truncate text-xs text-neutral-500">
                {c.courses} courses · {formatCompact(c.students)} students · {formatCompactNaira(c.revenue)}
              </p>
            </div>
            <div className="hidden w-36 sm:block">
              <Progress value={share(c)} hue="grape" size="sm" label="Share" showValue />
            </div>
            {rowActions(c)}
          </div>
        )}
        empty={
          <Empty
            icon={FolderOpen}
            hue="grape"
            title="No categories found"
            hint="Try another search, or add a category."
          />
        }
      />
    </div>
  );
}
