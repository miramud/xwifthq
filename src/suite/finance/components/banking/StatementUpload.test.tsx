import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatementUpload from "./StatementUpload";
import { detail, summary } from "./fixtures";
import { ApiError } from "@/lib/api/finance-request";

/** Upload a statement, then follow it on the queue until it has been read. */

const api = vi.hoisted(() => ({ upload: vi.fn(), get: vi.fn(), retry: vi.fn() }));

vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, statements: { ...actual.banking.statements, ...api } } };
});

const acct = { id: "ba-1", name: "UBA operating account", statementTemplate: "uba_pdf" as const };

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

describe("StatementUpload", () => {
  it("says what format it expects, uploads, and follows the import until it is ready", async () => {
    const user = userEvent.setup();
    const settled = vi.fn();
    api.upload.mockResolvedValue(summary({ status: "uploaded", verified: false, lineCount: 0, newLineCount: 0 }));
    api.get.mockResolvedValueOnce(detail({ status: "parsing", verified: false })).mockResolvedValueOnce(detail());
    render(<StatementUpload account={acct} onSettled={settled} pollMs={5} />);

    expect(screen.getByText(/Expected: UBA PDF statement/)).toBeInTheDocument();
    const file = new File(["%PDF-1.4"], "uba-sep-2026.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Statement file for UBA operating account"), file);

    expect(api.upload).toHaveBeenCalledWith("ba-1", file);
    expect(await screen.findByRole("link", { name: "Review statement" })).toHaveAttribute("href", "/suite/finance/banking/imports/imp-1");
    expect(screen.getByText(/20 lines read/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("shows the API's reason when the file is refused", async () => {
    const user = userEvent.setup();
    api.upload.mockRejectedValue(new ApiError("The given data was invalid.", 422, { file: ["This exact file was imported on 1 Oct 2026 (import imp-1). Open that import instead."] }));
    render(<StatementUpload account={acct} pollMs={5} />);
    await user.upload(screen.getByLabelText("Statement file for UBA operating account"), new File(["x"], "a.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This exact file was imported");
  });

  it("runs a failed import again without uploading it again", async () => {
    const user = userEvent.setup();
    api.upload.mockResolvedValue(summary({ status: "failed_validation", verified: false, error: "Totals don't match the printed summary." }));
    api.retry.mockResolvedValue(summary({ status: "uploaded", verified: false, lineCount: 0, newLineCount: 0 }));
    api.get.mockResolvedValue(detail());
    render(<StatementUpload account={acct} canRetry pollMs={5} />);
    await user.upload(screen.getByLabelText("Statement file for UBA operating account"), new File(["x"], "a.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("Totals don't match the printed summary.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run again" }));
    expect(api.retry).toHaveBeenCalledWith("imp-1");
    expect(await screen.findByRole("link", { name: "Review statement" })).toBeInTheDocument();
  });

  it("offers no run again without the permission", async () => {
    const user = userEvent.setup();
    api.upload.mockResolvedValue(summary({ status: "failed_validation", verified: false }));
    render(<StatementUpload account={acct} pollMs={5} />);
    await user.upload(screen.getByLabelText("Statement file for UBA operating account"), new File(["x"], "a.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("link", { name: "See what was read" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run again" })).not.toBeInTheDocument();
  });

  it("opens the file picker from the drop zone's button", async () => {
    const user = userEvent.setup();
    render(<StatementUpload account={acct} pollMs={5} />);
    const input = screen.getByLabelText("Statement file for UBA operating account") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button", { name: /Upload statement/ }));
    expect(click).toHaveBeenCalled();
  });
});
