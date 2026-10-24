"use client";

import { useState } from "react";
import { CalendarRange, Timer } from "lucide-react";
import { Button, CalloutStrip } from "@/components/workspace/kit";
import { ApiError, sprints as sprintsApi, type Sprint } from "@/lib/api/projects-client";
import { Modal, Notice, fmtRange, hintCls, inputCls, labelCls } from "./ui/pkit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Editing a sprint: its name, its goal, and its dates.
 *
 * **This existed on the API from the first commit and nothing called it.** The
 * dates were the point, the brief was explicit that a sprint's dates come
 * from the document *or* are set by hand, and the product shipped with the
 * 14-day default and no way to change it. A sprint that slipped by three days
 * could be started, closed, and reported on, and never say the right dates.
 *
 * The goal matters nearly as much and was read-only in the same way: the
 * header rendered `sprint.goal` and there was no screen anywhere that could
 * put one there.
 *
 * **Dates stay editable on an active sprint, deliberately.** Moving the end
 * date of a sprint that is running is the single most common thing a delivery
 * team does, and refusing it would push people into closing early and opening
 * a replacement, which throws away the commitment snapshot that makes
 * velocity mean anything. The snapshots are frozen; the dates are not.
 */
export default function SprintDialog({
  sprint,
  onClose,
  onSaved,
}: {
  sprint: Sprint;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [startsOn, setStartsOn] = useState(sprint.startsOn);
  const [endsOn, setEndsOn] = useState(sprint.endsOn);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving || name.trim() === "") return;

    setSaving(true);
    setError(null);

    try {
      await sprintsApi.update(sprint.id, {
        name: name.trim(),
        /* Cleared means cleared, not "unchanged", so null, not omitted. */
        goal: goal.trim() === "" ? null : goal.trim(),
        startsOn,
        endsOn,
      });

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
      setSaving(false);
    }
  };

  const closed = sprint.status === "closed";

  return (
    <Modal
      title={`Sprint ${sprint.sequence}`}
      titleId="sprint-dialog-title"
      subtitle={`${sprint.statusLabel} · ${fmtRange(sprint.startsOn, sprint.endsOn)}`}
      icon={CalendarRange}
      hue={closed ? "slate" : "blue"}
      onClose={onClose}
      onSubmit={submit}
      bodyClassName="space-y-4 px-6 py-5"
      footer={
        <>
          <Button className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || name.trim() === ""}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <Notice tone={closed ? "warn" : "info"}>
        {closed
          ? "This sprint is closed. Its record of what was committed and finished cannot change."
          : "Dates can move. What was committed and finished is already frozen."}
      </Notice>

      {error !== null && <Notice tone="error">{error}</Notice>}

      <div>
        <label htmlFor="sp-name" className={labelCls}>
          Name
        </label>
        <input
          id="sp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="sp-goal" className={labelCls}>
          Goal
        </label>
        <RichTextEditor
          id="sp-goal"
          minHeight={64}
          value={goal}
          onChange={setGoal}
          placeholder="One sentence the team can hold in their head"
        />
        {/*
          A sprint with no goal is a list of tasks that happen to share a
          fortnight, which is the thing sprints were invented to stop being.
        */}
        <p className={hintCls}>What this fortnight is for. Optional, and worth writing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sp-start" className={labelCls}>
            Starts
          </label>
          <input
            id="sp-start"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            required
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="sp-end" className={labelCls}>
            Ends
          </label>
          <input
            id="sp-end"
            type="date"
            value={endsOn}
            min={startsOn || undefined}
            onChange={(e) => setEndsOn(e.target.value)}
            required
            className={inputCls}
          />
        </div>
      </div>

      <CalloutStrip icon={Timer} hue="sky" title={`${sprint.lengthInDays} days as it stands`}>
        A new sprint runs for 14 days, counted from the day after the last one ended.
      </CalloutStrip>
    </Modal>
  );
}
