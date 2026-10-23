import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuiteSwitcher } from "./SuiteSwitcher";

let currentUser: Record<string, unknown> | null = null;

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

const allActive = ["lms", "hrm", "projects"].map((key) => ({ key, label: key, status: "active" }));

function openMenu() {
  render(<SuiteSwitcher current="home" />);
  fireEvent.click(screen.getByRole("button", { name: /suites/i }));
}

/**
 * An organisation's users don't get Learning, My learning or Organisation in
 * the Suites menu (the owner's ruling of 26 September 2026). Admins keep them.
 */
describe("SuiteSwitcher", () => {
  beforeEach(() => {
    currentUser = null;
  });

  it("hides Learning, My learning and Organisation from an organisation's user", () => {
    currentUser = {
      id: "u1",
      name: "Ruth",
      role: "user",
      organisationId: "org",
      modules: allActive,
    };
    openMenu();

    expect(screen.queryByText("My learning")).toBeNull();
    expect(screen.queryByText("Learning")).toBeNull();
    expect(screen.queryByText("Organisation")).toBeNull();
    expect(screen.getByText("People")).toBeTruthy();
  });

  it("offers Learning to whoever runs the LMS console, e.g. the HR Manager (O12)", () => {
    currentUser = {
      id: "u2",
      name: "Adaeze",
      role: "user",
      organisationId: "org",
      capabilities: { lmsAdmin: true },
      modules: allActive,
    };
    openMenu();

    expect(screen.getByText("Learning")).toBeTruthy();
    expect(screen.queryByText("My learning")).toBeNull();
    expect(screen.queryByText("Organisation")).toBeNull();
  });

  it("offers Organisation to a member a custom role admits to it (S8)", () => {
    currentUser = {
      id: "u3",
      name: "Femi",
      role: "user",
      organisationId: "org",
      permissions: ["core.audit_log.view"],
      modules: allActive,
    };
    openMenu();

    expect(screen.getByText("Organisation")).toBeTruthy();
    expect(screen.queryByText("Learning")).toBeNull();
  });

  it("still offers them to an organisation's admin", () => {
    currentUser = { id: "a1", name: "Adaeze", role: "admin", organisationId: "org", modules: allActive };
    openMenu();

    expect(screen.getByText("My learning")).toBeTruthy();
    expect(screen.getByText("Learning")).toBeTruthy();
    expect(screen.getByText("Organisation")).toBeTruthy();
  });
});
