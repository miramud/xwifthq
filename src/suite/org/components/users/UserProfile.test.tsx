import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import UserProfile from "./UserProfile";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { OrgUserDetail } from "@/lib/api/users-client";

/**
 * A user's profile. Recent activity is the regression: an audit event's
 * `meta` is an object, and rendering it as a React child crashed the whole
 * page for anybody who had done anything.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), remove: vi.fn(), resendInvite: vi.fn() }));

vi.mock("@/lib/api/users-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/users-client")>();
  return { ...actual, users: { ...actual.users, ...api } };
});

vi.mock("@/lib/api/roles-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/roles-client")>();
  return { ...actual, permissions: { ...actual.permissions, catalogue: vi.fn().mockResolvedValue({ modules: [] }) } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/users/u-ruth",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "u-me", role: "admin", name: "Adaeze", organisationId: "org-1" }, loading: false }),
}));

function detail(over: Partial<OrgUserDetail> = {}): OrgUserDetail {
  return {
    id: "u-ruth",
    name: "Ruth Akande",
    email: "ruth@meridian.test",
    avatarUrl: null,
    role: "user",
    roleLabel: "User",
    roles: [{ id: "system:user", name: "User", kind: "system", systemKey: "user" }],
    jobTitle: "QA Engineer",
    status: "active",
    createdAt: "2026-09-01T09:00:00Z",
    lastActiveAt: "2026-09-25T09:00:00Z",
    stats: { enrolments: 0, completed: 0, averageProgress: 0, certificates: 0 },
    permissions: [],
    employee: null,
    instructorProfileId: null,
    learning: { enrolments: [], certificates: [], points: null },
    projects: [],
    recentActivity: [
      { action: "hrm.leave.requested", at: "2026-09-25T09:00:00Z", meta: { leaveType: "Annual", days: 3 } },
      { action: "course.created", at: "2026-09-24T09:00:00Z", meta: { title: "Fire safety" } },
      { action: "account.updated", at: "2026-09-23T09:00:00Z", meta: null },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a user's recent activity", () => {
  it("renders object meta as a short subject, without crashing", async () => {
    api.get.mockResolvedValue(detail());
    render(
      <ConfirmProvider>
        <UserProfile id="u-ruth" />
      </ConfirmProvider>,
    );

    expect(await screen.findByText("Requested leave")).toBeInTheDocument();
    expect(screen.getByText("Created course")).toBeInTheDocument();
    expect(screen.getByText(/Fire safety/)).toBeInTheDocument();
    expect(screen.getByText("Updated their account")).toBeInTheDocument();
  });

  it("calls an empty permission list self-service", async () => {
    api.get.mockResolvedValue(detail());
    render(
      <ConfirmProvider>
        <UserProfile id="u-ruth" />
      </ConfirmProvider>,
    );

    expect(await screen.findByText(/Self-service only/)).toBeInTheDocument();
  });
});
