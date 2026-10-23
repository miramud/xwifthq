import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyPolicies from "./MyPolicies";
import MyDocuments from "./MyDocuments";
import { doc, policy } from "@/suite/operations/components/documents/fixtures";

/** Staff: the policies to read, confirmed one by one; and searching the repository. */

const api = vi.hoisted(() => ({ policies: vi.fn(), acknowledge: vi.fn(), search: vi.fn() }));

vi.mock("@/lib/api/repository-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/repository-client")>();
  return { ...actual, myRepository: { ...actual.myRepository, policies: api.policies, acknowledge: api.acknowledge, search: api.search } };
});

beforeEach(() => {
  for (const f of [api.policies, api.acknowledge, api.search]) f.mockReset();
});

describe("MyPolicies", () => {
  it("puts what I must read first and records that I have read it, after asking", async () => {
    const user = userEvent.setup();
    api.policies.mockResolvedValue({
      toRead: 1,
      policies: [
        policy(),
        policy({ id: "c-travel", code: "OPS-SOP-002", title: "Travel booking SOP", versionId: "v-t", acknowledgedAt: "2026-09-02T10:00:00Z" }),
        policy({ id: "c-brand", code: "MKT-TPL-001", title: "Letterhead template", kind: "template", kindLabel: "Template", versionId: "v-b", assigned: false }),
      ],
    });
    api.acknowledge.mockResolvedValue({ versionId: "v-2-0", acknowledgedAt: "2026-10-06T09:00:00Z" });
    render(<MyPolicies />);
    const toRead = await screen.findByRole("region", { name: /To read/ });
    expect(within(toRead).getByText("Leave policy")).toBeInTheDocument();
    expect(within(toRead).getByRole("link", { name: /Open/ })).toHaveAttribute("href", "/api/repository/policies/v-2-0/file");
    expect(screen.getByText("For reference")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 of 2 read" })).toBeInTheDocument();

    await user.click(within(toRead).getByRole("button", { name: "I have read it" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "I have read it" }));
    expect(api.acknowledge).toHaveBeenCalledWith("v-2-0");
    await waitFor(() => expect(screen.queryByRole("region", { name: /To read/ })).not.toBeInTheDocument());
    expect(screen.getByText(/You are up to date/)).toBeInTheDocument();
  });

  it("records nothing when I back out", async () => {
    const user = userEvent.setup();
    api.policies.mockResolvedValue({ toRead: 1, policies: [policy()] });
    render(<MyPolicies />);
    await user.click(await screen.findByRole("button", { name: "I have read it" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(api.acknowledge).not.toHaveBeenCalled();
  });
});

describe("MyDocuments", () => {
  it("searches what I may see and downloads it", async () => {
    const user = userEvent.setup();
    api.search.mockResolvedValue({ documents: [doc({ confidentiality: "public_internal" })], categories: { contracts: "Contracts" } });
    render(<MyDocuments />);
    expect(await screen.findByRole("link", { name: "Download Abuja office lease" })).toHaveAttribute("href", "/api/repository/d-lease/download");
    await user.type(screen.getByRole("searchbox", { name: "Search documents" }), "lease");
    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith({ q: "lease", category: "" }));
  });

  it("says when nothing is found", async () => {
    api.search.mockResolvedValue({ documents: [], categories: {} });
    render(<MyDocuments />);
    expect(await screen.findByText("No documents to show")).toBeInTheDocument();
  });
});
