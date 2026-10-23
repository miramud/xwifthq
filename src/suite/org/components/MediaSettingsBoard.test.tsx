import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MediaSettingsBoard from "./MediaSettingsBoard";
import type { MediaProviderRow } from "@/lib/api/admin-client";

/**
 * Where this institution keeps its files.
 *
 * What this screen has to get right is not the forms — those are rendered from
 * the API's own schema — but the *guard rails* around switching a provider on.
 *
 * A connection cannot be activated until a real test has passed, and the
 * button is disabled with a reason rather than hidden: an institution that
 * cannot see why it may not switch something on will assume the feature is
 * broken. The alternative failure is worse — believing files go to S3 while
 * every upload quietly lands on the local disk.
 *
 * And a test reports what it *reached*. "Connected" would not tell somebody
 * they had pasted last year's bucket.
 */

const { list, save, verify, activate, disconnect } = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  verify: vi.fn(),
  activate: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/lib/api/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin-client")>();

  return {
    ...actual,
    mediaSettings: {
      list,
      save,
      verify,
      activate,
      disconnect,
      makeDefault: vi.fn(),
    },
  };
});

const S3_FIELDS = {
  credentialFields: [
    { name: "access_key_id", label: "Access key ID", required: true, secret: false, hint: null },
    { name: "secret_access_key", label: "Secret access key", required: true, secret: true, hint: null },
  ],
  settingFields: [
    { name: "bucket", label: "Bucket", required: true, secret: false, hint: null },
    { name: "region", label: "Region", required: true, secret: false, hint: "For example eu-west-1." },
  ],
};

function rows(connection: MediaProviderRow["connection"]): MediaProviderRow[] {
  return [
    {
      provider: "s3",
      label: "Amazon S3",
      ...S3_FIELDS,
      connection,
    },
  ];
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: "mc-1",
    provider: "s3" as const,
    providerLabel: "Amazon S3",
    label: null,
    credentials: { access_key_id: "AKIAEXAMPLE", secret_access_key: "••••••••" },
    settings: { bucket: "lectures", region: "eu-west-1" },
    isActive: false,
    isDefault: false,
    isComplete: true,
    missing: [],
    lastVerifiedAt: null,
    lastError: null,
    fileCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({
    data: rows(null),
    meta: { activeProvider: null, fallback: "disk" },
  });
  save.mockResolvedValue({ data: connection() });
  verify.mockResolvedValue({
    message: "Reached bucket lectures in eu-west-1.",
    data: connection({ lastVerifiedAt: "2026-09-23T09:00:00Z" }),
  });
  activate.mockResolvedValue({ data: connection({ isActive: true }) });
  disconnect.mockResolvedValue({ message: "Disconnected." });
});

describe("where files go right now", () => {
  /*
    The question an administrator opens this screen to answer, before any of
    the forms.
  */
  it("says plainly that nothing is configured", async () => {
    render(<MediaSettingsBoard />);

    expect(
      await screen.findByText("Files are stored on this server"),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not scale/)).toBeInTheDocument();
  });

  it("names the provider once one is in use", async () => {
    list.mockResolvedValue({
      data: rows(connection({ isActive: true, isDefault: true })),
      meta: { activeProvider: "s3", fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    expect(await screen.findByText("Files go to Amazon S3")).toBeInTheDocument();
  });
});

describe("the guard rails", () => {
  /*
    The alternative is an institution believing its files go to S3 while every
    upload quietly lands on disk.
  */
  it("will not switch on a connection that has never been tested", async () => {
    list.mockResolvedValue({
      data: rows(connection()),
      meta: { activeProvider: null, fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    const button = await screen.findByRole("button", { name: "Switch on" });

    expect(button).toBeDisabled();
    // Disabled with a reason rather than hidden.
    expect(button).toHaveAttribute(
      "title",
      "Test the connection before switching it on.",
    );
  });

  it("names what is still missing rather than counting it", async () => {
    list.mockResolvedValue({
      data: rows(connection({ isComplete: false, missing: ["Bucket", "Region"] })),
      meta: { activeProvider: null, fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    expect(await screen.findByText("Missing Bucket, Region.")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Switch on" }),
    ).toHaveAttribute("title", "Fill in Bucket, Region first.");
  });

  it("allows switching on once a test has passed", async () => {
    list.mockResolvedValue({
      data: rows(connection({ lastVerifiedAt: "2026-09-23T09:00:00Z" })),
      meta: { activeProvider: null, fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    expect(
      await screen.findByRole("button", { name: "Switch on" }),
    ).toBeEnabled();
  });

  it("cannot test a provider that has not been saved", async () => {
    render(<MediaSettingsBoard />);

    expect(
      await screen.findByRole("button", { name: "Test connection" }),
    ).toBeDisabled();
  });
});

describe("testing a connection", () => {
  /*
    Naming the bucket back is the confirmation. "Connected" would not tell
    somebody they had pasted last year's bucket.
  */
  it("reports what it reached, not just that it worked", async () => {
    const user = userEvent.setup();

    list.mockResolvedValue({
      data: rows(connection()),
      meta: { activeProvider: null, fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    await user.click(await screen.findByRole("button", { name: "Test connection" }));

    expect(
      await screen.findByText("Reached bucket lectures in eu-west-1."),
    ).toBeInTheDocument();
  });

  /*
    The failure usually happens inside an upload at 3am, and this screen is
    where somebody looks the next morning.
  */
  it("keeps the provider's own words from the last failure", async () => {
    list.mockResolvedValue({
      data: rows(
        connection({ lastError: "S3: that bucket does not exist, or the key cannot see it" }),
      ),
      meta: { activeProvider: null, fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    expect(
      await screen.findByText(/that bucket does not exist/),
    ).toBeInTheDocument();
  });
});

describe("the form", () => {
  /* Rendered from the API's schema, so it cannot drift from the backend. */
  it("renders whatever fields the provider declares", async () => {
    render(<MediaSettingsBoard />);

    expect(await screen.findByLabelText(/Access key ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Secret access key/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bucket/)).toBeInTheDocument();
    expect(screen.getByText("For example eu-west-1.")).toBeInTheDocument();
  });

  it("masks a secret field", async () => {
    render(<MediaSettingsBoard />);

    expect(await screen.findByLabelText(/Secret access key/)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("saves what was typed and says to test it next", async () => {
    const user = userEvent.setup();

    render(<MediaSettingsBoard />);

    await user.type(await screen.findByLabelText(/Bucket/), "lectures");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "s3",
        expect.objectContaining({
          settings: expect.objectContaining({ bucket: "lectures" }),
        }),
      ),
    );

    expect(
      await screen.findByText("Saved. Test it before switching it on."),
    ).toBeInTheDocument();
  });
});

describe("disconnecting a provider", () => {
  /*
    The endpoint has existed since the settings screen was built and nothing
    ever called it, so an institution that pasted the wrong account could
    switch the connection off but never remove the credentials.
  */
  it("is offered once something is connected", async () => {
    list.mockResolvedValue({
      data: rows(connection()),
      meta: { activeProvider: null, fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    expect(
      await screen.findByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
  });

  it("is not offered when there is nothing to disconnect", async () => {
    render(<MediaSettingsBoard />);

    await screen.findByLabelText(/Bucket/);

    expect(
      screen.queryByRole("button", { name: "Disconnect" }),
    ).not.toBeInTheDocument();
  });

  it("asks first, and does nothing if the answer is no", async () => {
    const user = userEvent.setup();

    list.mockResolvedValue({
      data: rows(connection()),
      meta: { activeProvider: null, fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    await user.click(await screen.findByRole("button", { name: "Disconnect" }));

    expect(disconnect).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(disconnect).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
  });

  /*
    The API reports the orphan count in its *response*, which is too late to
    be a decision. The same number is already on this screen.
  */
  it("counts the files that will be orphaned before anybody confirms", async () => {
    const user = userEvent.setup();

    list.mockResolvedValue({
      data: rows(connection({ isActive: true, fileCount: 214 })),
      meta: { activeProvider: "s3", fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    await user.click(await screen.findByRole("button", { name: "Disconnect" }));

    expect(await screen.findByText(/214 files stored here stay/)).toBeInTheDocument();
    expect(screen.getByText(/media is missing/)).toBeInTheDocument();
  });

  it("does not claim files are at stake when none are", async () => {
    const user = userEvent.setup();

    list.mockResolvedValue({
      data: rows(connection({ fileCount: 0 })),
      meta: { activeProvider: null, fallback: "disk" },
    });

    render(<MediaSettingsBoard />);

    await user.click(await screen.findByRole("button", { name: "Disconnect" }));

    expect(await screen.findByText(/credentials are deleted/)).toBeInTheDocument();
    expect(screen.queryByText(/stay in the library/)).not.toBeInTheDocument();
  });

  it("disconnects once confirmed and repeats what the API said", async () => {
    const user = userEvent.setup();

    list.mockResolvedValue({
      data: rows(connection({ fileCount: 1 })),
      meta: { activeProvider: null, fallback: "disk" },
    });
    disconnect.mockResolvedValue({
      message: "Disconnected. 1 file stays in the library and can no longer be opened from here.",
    });

    render(<MediaSettingsBoard />);

    await user.click(await screen.findByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Disconnect Amazon S3?" });
    await user.click(within(dialog).getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(disconnect).toHaveBeenCalledWith("s3"));

    expect(await screen.findByText(/1 file stays in the library/)).toBeInTheDocument();
  });
});
