import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Permission, PermissionFeature, Scope } from "@/lib/api/roles-client";
import {
  applyBundle,
  applyScope,
  featureModel,
  readState,
  sameSettings,
  toGrantMap,
  DEFAULT_SETTINGS,
} from "./permission-model";
import { SegmentedRadio } from "./SegmentedRadio";

/** The matrix's rules as plain functions, and the radio group's keyboard. */

const p = (key: string, bundle: Permission["bundle"], scopes: Scope[] = ["organisation"], confidential = false): Permission => ({
  key,
  action: key,
  label: key,
  description: null,
  bundle,
  scopes,
  confidential,
});

// Rates in Projects: the view action is organisation-wide only.
const RATES: PermissionFeature = {
  key: "rates",
  label: "Rates",
  permissions: [p("view", "view"), p("edit", "work", ["assigned", "organisation"]), p("delete", "full", ["assigned", "organisation"])],
};

describe("bundles", () => {
  it("a bundle no key of which offers the scope falls back to Organisation rather than granting nothing", () => {
    const model = featureModel(RATES, "assigned", true);
    expect(model.preferredScope).toBe("assigned");
    expect(applyBundle({}, model, "view", "assigned")).toEqual({ view: "organisation" });
    expect(applyBundle({}, model, "work", "assigned")).toEqual({ edit: "assigned" });
  });

  it("a tie between two bundles goes to the one last clicked, else the smallest", () => {
    const model = featureModel(RATES, "assigned", true);
    const grants = toGrantMap([{ key: "edit", scope: "assigned" }]);
    expect(readState(model, grants).level).toBe("work");
    const full = applyBundle({}, model, "full", "assigned");
    expect(readState(model, full, "full").level).toBe("full");
  });

  it("changing the scope of a custom set moves only the keys that offer it", () => {
    const model = featureModel(RATES, "assigned", true);
    const grants = toGrantMap([
      { key: "view", scope: "organisation" },
      { key: "delete", scope: "organisation" },
    ]);
    const state = readState(model, grants);
    expect(state.level).toBe("custom");
    expect(applyScope(grants, model, state, "assigned")).toEqual({ view: "organisation", delete: "assigned" });
  });

  it("locks confidential keys without access and leaves them out of every bundle", () => {
    const feature: PermissionFeature = { key: "off", label: "Offboarding", permissions: [p("view", "view"), p("settle", "full", ["organisation"], true)] };
    const model = featureModel(feature, "organisation", false);
    expect(model.locked.map((x) => x.key)).toEqual(["settle"]);
    expect(model.emptyLevels.has("full")).toBe(true);
    expect(applyBundle({}, model, "full", "organisation")).toEqual({ view: "organisation" });
  });

  it("compares settings regardless of module order", () => {
    expect(
      sameSettings({ ...DEFAULT_SETTINGS, confidentialModules: ["hrm", "core"] }, { ...DEFAULT_SETTINGS, confidentialModules: ["core", "hrm"] }),
    ).toBe(true);
  });
});

describe("SegmentedRadio", () => {
  it("moves and selects with the arrow keys, skipping unavailable options", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SegmentedRadio
        label="Paths access level"
        value="none"
        onChange={onChange}
        options={[
          { key: "none", label: "None" },
          { key: "view", label: "View" },
          { key: "work", label: "Work", unavailable: true, note: "Nothing more in this feature" },
          { key: "full", label: "Full" },
        ]}
      />,
    );

    const none = screen.getByRole("radio", { name: "None" });
    expect(none).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "View" })).toHaveAttribute("tabindex", "-1");

    await user.tab();
    expect(none).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("view");
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("full");
    expect(screen.getByRole("radio", { name: "Full" })).toHaveFocus();
  });
});
