"use client";

import { useId } from "react";
import { Ban, CheckCheck, CircleDot, ListPlus, Plus, Trash2, Undo2 } from "lucide-react";
import type { Condition } from "@/lib/api/org-foundations-client";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { inputClass } from "@/suite/lms/components/ui/ws";
import {
  FLAG_PREFIX,
  OP_LABEL,
  coerceValue,
  defaultValue,
  errorAt,
  groupItems,
  groupKind,
  isFlag,
  flagLabel,
  makeGroup,
  newComparison,
  opsFor,
  type BuilderField,
  type FieldErrors,
  type FieldType,
  type Op,
} from "./policy-logic";
import { lookupForField } from "./lookups";
import { FieldError, LookupSelect, MoneyInput, MultiLookup, NumberInput, TagInput } from "./parts";

/*
  The condition builder: a rule's "applies when" as a sentence you can edit.

  A condition is one of four things: always, a group (every one of / at least
  one of), "none of" (a negated condition), or a comparison: field, operator,
  value. Groups nest. Each level gets a coloured rail and the words for what it
  does, so the logic reads without knowing what `all`/`any`/`not` mean.

  It edits the API's Condition JSON in place; money is typed in naira and
  stored as kobo.
*/

const GROUP_STYLE = {
  all: { rail: "border-primary-300", chip: "bg-primary-50 text-primary-700", words: "Every one of these is true" },
  any: { rail: "border-grape-300", chip: "bg-grape-50 text-grape-700", words: "At least one of these is true" },
  not: { rail: "border-coral-300", chip: "bg-coral-50 text-coral-700", words: "This is not true" },
} as const;

export interface ConditionBuilderProps {
  value: Condition;
  onChange: (c: Condition) => void;
  fields: BuilderField[];
  /** The error path of this condition, e.g. "rules.0.when". */
  path: string;
  errors?: FieldErrors | null;
  readOnly?: boolean;
  /** Offer "always" at the top level (a rule); a bypass must say when. */
  allowAlways?: boolean;
  depth?: number;
  onRemove?: () => void;
}

export function ConditionBuilder(props: ConditionBuilderProps) {
  const { value, onChange, fields, path, errors, readOnly, allowAlways = true, depth = 0 } = props;

  if ("always" in value) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-neutral-700">
          <CheckCheck size={16} className="text-mint-600" aria-hidden />
          {value.always ? "Applies to every request." : "Never applies."}
        </p>
        {!readOnly && (
          <Button size="sm" icon={Plus} onClick={() => onChange({ all: [newComparison(fields)] })}>
            Add a condition
          </Button>
        )}
        <FieldError message={errorAt(errors, path)} />
      </div>
    );
  }

  const kind = groupKind(value);
  if (kind) {
    return <Group {...props} kind={kind} />;
  }

  if ("not" in value) {
    const style = GROUP_STYLE.not;
    return (
      <div className={cx("rounded-2xl border-l-4 bg-white pl-3", style.rail)}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", style.chip)}>
            <Ban size={12} aria-hidden /> {style.words}
          </span>
          {!readOnly && (
            <>
              <Button size="sm" variant="ghost" icon={Undo2} onClick={() => onChange(value.not)}>
                Remove “not”
              </Button>
              {props.onRemove && (
                <Button size="sm" variant="ghost" icon={Trash2} onClick={props.onRemove} aria-label="Remove this condition">
                  Remove
                </Button>
              )}
            </>
          )}
        </div>
        <ConditionBuilder
          value={value.not}
          onChange={(c) => onChange({ not: c })}
          fields={fields}
          path={`${path}.not`}
          errors={errors}
          readOnly={readOnly}
          allowAlways={false}
          depth={depth + 1}
        />
      </div>
    );
  }

  // A single comparison at the top: show it inside an "every one of" group so there is somewhere to add a second.
  if (depth === 0) {
    return (
      <Group
        {...props}
        kind="all"
        value={{ all: [value] }}
        onChange={(c) => {
          const items = groupItems(c);
          onChange(items.length === 1 && groupKind(c) === "all" ? items[0] : c);
        }}
        pathOverride={(i) => (i === 0 ? path : `${path}.all.${i}`)}
        allowAlways={allowAlways}
      />
    );
  }

  return <Comparison {...props} value={value as { field: string; op: string; value: unknown }} />;
}

function Group({
  value,
  onChange,
  fields,
  path,
  errors,
  readOnly,
  allowAlways,
  depth = 0,
  onRemove,
  kind,
  pathOverride,
}: ConditionBuilderProps & { kind: "all" | "any"; pathOverride?: (i: number) => string }) {
  const items = groupItems(value);
  const style = GROUP_STYLE[kind];
  const itemPath = pathOverride ?? ((i: number) => `${path}.${kind}.${i}`);
  const setItems = (next: Condition[]) => onChange(makeGroup(kind, next));
  const legendId = useId();

  return (
    <fieldset
      aria-labelledby={legendId}
      className={cx("min-w-0 rounded-2xl border-l-4 pl-3", style.rail, depth > 0 && "bg-neutral-50/60 py-2 pr-2")}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {readOnly ? (
          <span id={legendId} className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", style.chip)}>
            <CircleDot size={12} aria-hidden /> {style.words}
          </span>
        ) : (
          <div role="radiogroup" aria-labelledby={legendId} className="inline-flex rounded-xl bg-neutral-100 p-1">
            <span id={legendId} className="sr-only">
              How these conditions combine
            </span>
            {(["all", "any"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => kind !== k && onChange(makeGroup(k, items))}
                className={cx(
                  "h-8 cursor-pointer rounded-lg px-3 text-[13px] font-semibold transition",
                  kind === k ? cx("bg-white shadow-sm", k === "all" ? "text-primary-700" : "text-grape-700") : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {k === "all" ? "Every one is true" : "Any one is true"}
              </button>
            ))}
          </div>
        )}
        {!readOnly && onRemove && (
          <Button size="sm" variant="ghost" icon={Trash2} onClick={onRemove}>
            Remove group
          </Button>
        )}
      </div>
      <FieldError message={errorAt(errors, path)} />

      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="relative">
            {i > 0 && (
              <span className={cx("mb-1 inline-block text-[11px] font-bold uppercase tracking-wider", kind === "all" ? "text-primary-600" : "text-grape-600")}>
                {kind === "all" ? "and" : "or"}
              </span>
            )}
            <ConditionBuilder
              value={item}
              onChange={(c) => setItems(items.map((x, j) => (j === i ? c : x)))}
              fields={fields}
              path={itemPath(i)}
              errors={errors}
              readOnly={readOnly}
              allowAlways={false}
              depth={depth + 1}
              onRemove={
                readOnly
                  ? undefined
                  : () => {
                      const next = items.filter((_, j) => j !== i);
                      if (next.length === 0) onChange(allowAlways ? { always: true } : makeGroup(kind, [newComparison(fields)]));
                      else setItems(next);
                    }
              }
            />
          </li>
        ))}
      </ol>

      {!readOnly && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" icon={Plus} onClick={() => setItems([...items, newComparison(fields)])}>
            Add condition
          </Button>
          {depth < 6 && (
            <Button size="sm" variant="ghost" icon={ListPlus} onClick={() => setItems([...items, makeGroup(kind === "all" ? "any" : "all", [newComparison(fields)])])}>
              Add group
            </Button>
          )}
        </div>
      )}
    </fieldset>
  );
}

function Comparison({
  value,
  onChange,
  fields,
  path,
  errors,
  readOnly,
  onRemove,
}: Omit<ConditionBuilderProps, "value"> & { value: { field: string; op: string; value: unknown } }) {
  const id = useId();
  const field = fieldFor(fields, value.field);
  const ops = opsFor(field.type);
  const op = value.op as Op;
  const fieldErr = errorAt(errors, `${path}.field`);
  const opErr = errorAt(errors, `${path}.op`);
  const valueErr = errorAt(errors, `${path}.value`) ?? errorAt(errors, path);

  const fieldOptions: SelectOption[] = [
    ...fields.filter((f) => !isFlag(f.key)).map((f) => ({ value: f.key, label: f.label, group: "Request details" })),
    ...fields.filter((f) => isFlag(f.key)).map((f) => ({ value: f.key, label: flagLabel(f.key), group: "Flags" })),
  ];
  if (value.field && !fieldOptions.some((o) => o.value === value.field)) {
    fieldOptions.unshift({ value: value.field, label: isFlag(value.field) ? flagLabel(value.field) : value.field, group: isFlag(value.field) ? "Flags" : "Request details" });
  }

  if (readOnly) {
    return (
      <p className="rounded-xl bg-white px-3 py-2 text-sm text-neutral-800 ring-1 ring-neutral-200">
        <span className="font-semibold">{field.label}</span> {opPhrase(op, value.value)}{" "}
        {op !== "exists" && <span className="font-semibold">{describeValue(field, op, value.value)}</span>}
      </p>
    );
  }

  const setField = (key: string) => {
    const f = fieldFor(fields, key);
    const nextOp = opsFor(f.type)[0];
    onChange({ field: key, op: nextOp, value: defaultValue(f.type, nextOp) });
  };

  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl bg-white p-2 ring-1 ring-neutral-200 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_auto] sm:items-start">
      <div className="min-w-0">
        <SearchableSelect
          id={`${id}-field`}
          aria-label="Field"
          value={value.field}
          onChange={setField}
          options={fieldOptions}
          placeholder="Choose a field"
          aria-invalid={Boolean(fieldErr) || undefined}
          onCreate={(text) => {
            const key = `${FLAG_PREFIX}${text.trim().replace(/\s+/g, "_").toLowerCase()}`;
            setField(key);
            return { value: key, label: flagLabel(key) };
          }}
          createLabel={(text) => `Test the flag “${text}”`}
        />
        <FieldError message={fieldErr} />
      </div>
      <div className="min-w-0">
        <select
          aria-label="Comparison"
          value={op}
          onChange={(e) => {
            const nextOp = e.target.value as Op;
            onChange({ field: value.field, op: nextOp, value: coerceValue(field.type, nextOp, value.value) });
          }}
          aria-invalid={Boolean(opErr) || undefined}
          className={cx(inputClass, "cursor-pointer")}
        >
          {!ops.includes(op) && <option value={op}>{OP_LABEL[op] ?? op}</option>}
          {ops.map((o) => (
            <option key={o} value={o}>
              {o === "exists" ? "is filled in / empty" : OP_LABEL[o]}
            </option>
          ))}
        </select>
        <FieldError message={opErr} />
      </div>
      <div className="min-w-0">
        <ValueInput
          id={`${id}-value`}
          field={field}
          op={op}
          value={value.value}
          onChange={(v) => onChange({ ...value, op, value: v })}
          invalid={Boolean(valueErr)}
        />
        <FieldError message={valueErr} />
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove the condition on ${field.label}`}
          className="flex h-11 w-11 cursor-pointer items-center justify-center justify-self-end rounded-xl text-neutral-500 hover:bg-error-500/10 hover:text-error-700"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      )}
      {!onRemove && <span aria-hidden />}
      {!readOnly && (
        <div className="sm:col-span-4">
          <button
            type="button"
            onClick={() => onChange({ not: value } as Condition)}
            className="cursor-pointer text-xs font-semibold text-neutral-500 underline-offset-2 hover:text-coral-700 hover:underline"
          >
            Turn into “not”
          </button>
        </div>
      )}
    </div>
  );
}

export function fieldFor(fields: BuilderField[], key: string): BuilderField {
  const found = fields.find((f) => f.key === key);
  if (found) return found;
  if (isFlag(key)) return { key, label: flagLabel(key), type: "flag", options: [] };
  return { key, label: key || "Field", type: "text", options: [] };
}

function opPhrase(op: Op, value: unknown): string {
  if (op === "exists") return value === false ? "is empty" : "is filled in";
  return OP_LABEL[op] ?? op;
}

function describeValue(field: BuilderField, op: Op, value: unknown): string {
  const one = (v: unknown): string => {
    if (field.type === "money" && typeof v === "number") return `₦${(v / 100).toLocaleString("en-NG")}`;
    if (typeof v === "boolean") return v ? "yes" : "no";
    const opt = field.options.find((o) => o.value === String(v));
    return opt?.label ?? String(v ?? "");
  };
  if (op === "between" && Array.isArray(value)) return `${one(value[0])} and ${one(value[1])}`;
  if (Array.isArray(value)) return value.map(one).join(", ") || "(nothing chosen)";
  return one(value);
}

/** The value control for a field type and comparison. */
export function ValueInput({
  id,
  field,
  op,
  value,
  onChange,
  invalid,
}: {
  id: string;
  field: BuilderField;
  op: Op;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid?: boolean;
}) {
  const type: FieldType = field.type;
  const lookup = lookupForField(type);

  if (op === "exists") {
    return (
      <select aria-label={field.label} id={id} value={value === false ? "empty" : "filled"} onChange={(e) => onChange(e.target.value === "filled")} className={cx(inputClass, "cursor-pointer")}>
        <option value="filled">Filled in</option>
        <option value="empty">Empty</option>
      </select>
    );
  }

  if (type === "boolean" || type === "flag") {
    return (
      <select aria-label={field.label} id={id} value={value === false ? "no" : "yes"} onChange={(e) => onChange(e.target.value === "yes")} className={cx(inputClass, "cursor-pointer")}>
        <option value="yes">{type === "flag" ? "Raised" : "Yes"}</option>
        <option value="no">{type === "flag" ? "Not raised" : "No"}</option>
      </select>
    );
  }

  if (op === "between") {
    const pair = Array.isArray(value) && value.length === 2 ? value : [0, 0];
    const set = (i: 0 | 1, v: number | null) => onChange(i === 0 ? [v ?? 0, pair[1]] : [pair[0], v ?? 0]);
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {type === "money" ? (
          <MoneyInput id={id} ariaLabel="Lowest amount" value={toNum(pair[0])} onChange={(v) => set(0, v)} invalid={invalid} />
        ) : (
          <NumberInput id={id} ariaLabel="Lowest" value={toNum(pair[0])} onChange={(v) => set(0, v)} invalid={invalid} />
        )}
        <span className="text-xs font-semibold text-neutral-500">and</span>
        {type === "money" ? (
          <MoneyInput ariaLabel="Highest amount" value={toNum(pair[1])} onChange={(v) => set(1, v)} invalid={invalid} />
        ) : (
          <NumberInput ariaLabel="Highest" value={toNum(pair[1])} onChange={(v) => set(1, v)} invalid={invalid} />
        )}
      </div>
    );
  }

  if (op === "in" || op === "not_in") {
    const list = Array.isArray(value) ? value.map(String) : [];
    if (lookup) return <MultiLookup id={id} lookup={lookup} values={list} onChange={onChange} addLabel="Add one" invalid={invalid} />;
    return <TagInput id={id} values={list} onChange={onChange} options={field.options} invalid={invalid} />;
  }

  if (type === "money") {
    return <MoneyInput id={id} ariaLabel={`${field.label} in naira`} value={toNum(value)} onChange={(v) => onChange(v ?? 0)} invalid={invalid} />;
  }
  if (type === "number") {
    return <NumberInput id={id} ariaLabel="Value" value={toNum(value)} onChange={(v) => onChange(v ?? 0)} invalid={invalid} />;
  }
  if (lookup) {
    return <LookupSelect id={id} ariaLabel="Value" lookup={lookup} value={String(value ?? "")} onChange={onChange} invalid={invalid} />;
  }
  if (type === "enum" && field.options.length > 0) {
    return (
      <SearchableSelect id={id} aria-label={field.label} value={String(value ?? "")} onChange={onChange} options={field.options} placeholder="Choose" aria-invalid={invalid || undefined} />
    );
  }
  return (
    <input
      id={id}
      aria-label={field.label}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className={inputClass}
      placeholder={type === "project_list" ? "Project id" : "Value"}
    />
  );
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

