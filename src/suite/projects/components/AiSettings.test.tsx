import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AiSettings from "./AiSettings";
import type { AiProviderSettings } from "@/lib/api/projects-client";

/**
 * The institution's provider keys, and what they have spent.
 *
 * **The key is never shown.** Four characters come back, and the field shows a
 * mask — sending the mask back means "leave it alone", which is the difference
 * between changing a model and destroying a working key.
 *
 * **Their key, our software spending it**, said on the screen because it is
 * the first question anybody asks when a product offers to run a model.
 *
 * **A key is not trusted until it has been used.** "Wrong key", "wrong model"
 * and "works" are indistinguishable without a real call.
 */

const { providers, saveProvider, verify, removeProvider, usage } = vi.hoisted(() => ({
  providers: vi.fn(),
  saveProvider: vi.fn(),
  verify: vi.fn(),
  removeProvider: vi.fn(),
  usage: vi.fn(),
}));

/* The spend is a DataView, which reads the app router for row links. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/ai",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    ai: { ...actual.ai, providers, saveProvider, verify, removeProvider, usage },
  };
});

function provider(over: Partial<AiProviderSettings> = {}): AiProviderSettings {
  return {
    provider: "anthropic",
    label: "Anthropic",
    keysUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-opus-5", "claude-sonnet-5"],
    defaultModel: "claude-opus-5",
    id: null,
    keyHint: null,
    hasKey: false,
    model: "claude-opus-5",
    isDefault: false,
    monthlyTokenBudget: null,
    verifiedAt: null,
    lastError: null,
    tokensThisMonth: 0,
    ...over,
  } as AiProviderSettings;
}

const SUMMARY = {
  tokensThisMonth: 12_400,
  callsThisMonth: 9,
  failuresThisMonth: 0,
  monthStartedOn: "2026-09-01",
  byFeature: { stories: { calls: 5, tokens: 8000 } },
};

function payload(list: AiProviderSettings[]) {
  return {
    data: list,
    meta: {
      note: "Generation runs on your own provider account. There is no shared key, and nothing is billed to XwiftHQ.",
      usage: SUMMARY,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  providers.mockResolvedValue(
    payload([
      provider({ provider: "openai", label: "OpenAI" }),
      provider(),
      provider({ provider: "gemini", label: "Google Gemini" }),
    ]),
  );
  usage.mockResolvedValue({ data: [], meta: SUMMARY });
  saveProvider.mockResolvedValue(payload([provider()]));
});

describe("AiSettings", () => {
  /** The first question anybody asks. Said once, plainly. */
  it("says whose account the generation runs on", async () => {
    render(<AiSettings />);

    expect(
      await screen.findByText(/nothing is billed to XwiftHQ/i),
    ).toBeInTheDocument();
  });

  it("warns when no provider is configured at all", async () => {
    render(<AiSettings />);

    expect(
      await screen.findByText(/No provider is set up yet, so nothing can be generated/i),
    ).toBeInTheDocument();
  });

  it("shows the four-character hint and never the key", async () => {
    providers.mockResolvedValue(
      payload([provider({ id: "c-1", hasKey: true, keyHint: "9999", tokensThisMonth: 600 })]),
    );

    render(<AiSettings />);

    expect(await screen.findByText(/Key ending 9999/i)).toBeInTheDocument();
    /* The field shows a mask, not a key. */
    expect(screen.getByLabelText(/API key/i)).toHaveValue("••••••••");
  });

  /**
   * A form sends the mask back for a field nobody edited. Treating that as a
   * new value would overwrite a working key the first time somebody changed a
   * model — so the mask goes back untouched and the API leaves it alone.
   */
  it("sends the mask back when only the model changed", async () => {
    providers.mockResolvedValue(
      payload([provider({ id: "c-1", hasKey: true, keyHint: "9999" })]),
    );

    render(<AiSettings />);

    const model = await screen.findByLabelText(/^Model$/i);

    await userEvent.clear(model);
    await userEvent.type(model, "claude-sonnet-5");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(saveProvider).toHaveBeenCalledTimes(1));

    expect(saveProvider).toHaveBeenCalledWith({
      provider: "anthropic",
      apiKey: "••••••••",
      model: "claude-sonnet-5",
      monthlyTokenBudget: null,
    });
  });

  it("saves a new key, a model and a budget", async () => {
    render(<AiSettings />);

    const keys = await screen.findAllByLabelText(/API key/i);

    /* The second card is Anthropic. */
    await userEvent.type(keys[1], "sk-ant-brand-new-1234");
    await userEvent.type(screen.getAllByLabelText(/Monthly token budget/i)[1], "500000");
    await userEvent.click(screen.getAllByRole("button", { name: /^Save$/i })[1]);

    await waitFor(() => expect(saveProvider).toHaveBeenCalledTimes(1));

    expect(saveProvider.mock.calls[0][0]).toMatchObject({
      provider: "anthropic",
      apiKey: "sk-ant-brand-new-1234",
      monthlyTokenBudget: 500_000,
    });
  });

  /** Empty means no ceiling, which is a decision rather than a gap. */
  it("sends null for an empty budget", async () => {
    providers.mockResolvedValue(
      payload([provider({ id: "c-1", hasKey: true, keyHint: "9999", monthlyTokenBudget: 1000 })]),
    );

    render(<AiSettings />);

    await userEvent.clear(await screen.findByLabelText(/Monthly token budget/i));
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(saveProvider).toHaveBeenCalledTimes(1));

    expect(saveProvider.mock.calls[0][0].monthlyTokenBudget).toBeNull();
  });

  /** A saved key is unproven until it has actually been used. */
  it("offers a test for a saved key, and marks an untested one", async () => {
    providers.mockResolvedValue(
      payload([provider({ id: "c-1", hasKey: true, keyHint: "9999" })]),
    );
    verify.mockResolvedValue({ verified: true, verifiedAt: "2026-09-25T10:00:00Z", error: null });

    render(<AiSettings />);

    expect(await screen.findByText("Not tested")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Test it/i }));

    await waitFor(() => expect(verify).toHaveBeenCalledWith("c-1"));
  });

  it("shows a verified key as working", async () => {
    providers.mockResolvedValue(
      payload([
        provider({ id: "c-1", hasKey: true, keyHint: "9999", verifiedAt: "2026-09-25T10:00:00Z" }),
      ]),
    );

    render(<AiSettings />);

    expect(await screen.findByText("Working")).toBeInTheDocument();
    expect(screen.queryByText("Not tested")).toBeNull();
  });

  /**
   * The provider's own words. "model not found" is fixable by the person
   * reading it; "something went wrong" is not.
   */
  it("shows the provider's own error", async () => {
    providers.mockResolvedValue(
      payload([
        provider({
          id: "c-1",
          hasKey: true,
          keyHint: "9999",
          lastError: 'Anthropic returned 404: model "claude-4" not found',
        }),
      ]),
    );

    render(<AiSettings />);

    expect(await screen.findByText(/model "claude-4" not found/i)).toBeInTheDocument();
  });

  it("switches which provider is used", async () => {
    providers.mockResolvedValue(
      payload([
        provider({ provider: "openai", label: "OpenAI", id: "c-0", hasKey: true, isDefault: true }),
        provider({ id: "c-1", hasKey: true, keyHint: "9999" }),
      ]),
    );

    render(<AiSettings />);

    await userEvent.click(await screen.findByRole("button", { name: /Use this one/i }));

    await waitFor(() =>
      expect(saveProvider).toHaveBeenCalledWith({ provider: "anthropic", isDefault: true }),
    );
  });

  it("offers no switch on the one already in use", async () => {
    providers.mockResolvedValue(
      payload([provider({ id: "c-1", hasKey: true, isDefault: true })]),
    );

    render(<AiSettings />);

    expect(await screen.findByText("Default")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Use this one/i })).toBeNull();
  });

  it("removes a key", async () => {
    providers.mockResolvedValue(
      payload([provider({ id: "c-1", hasKey: true, keyHint: "9999" })]),
    );
    removeProvider.mockResolvedValue(payload([provider()]));

    render(<AiSettings />);

    await userEvent.click(
      await screen.findByRole("button", { name: /Remove the Anthropic key/i }),
    );
    expect(removeProvider).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Remove key" }));

    await waitFor(() => expect(removeProvider).toHaveBeenCalledWith("c-1"));
  });

  /* ------------------------------------------------------------------ */
  /*  Spend                                                             */
  /* ------------------------------------------------------------------ */

  it("reports the month's tokens, calls and failures", async () => {
    render(<AiSettings />);

    expect(await screen.findByText("12,400")).toBeInTheDocument();
    expect(screen.getByText("Tokens this month")).toBeInTheDocument();
    expect(screen.getByText("Since 2026-09-01")).toBeInTheDocument();
  });

  /** A run of failures is a rotated key, not a token total that stopped. */
  it("calls out failed calls as something to look at", async () => {
    providers.mockResolvedValue({
      data: [provider()],
      meta: {
        note: "n",
        usage: { ...SUMMARY, failuresThisMonth: 4 },
      },
    });

    render(<AiSettings />);

    expect(await screen.findByText(/Check the key is still valid/i)).toBeInTheDocument();
  });

  it("lists recent generations, failures included", async () => {
    usage.mockResolvedValue({
      data: [
        {
          id: "u-1",
          provider: "anthropic",
          model: "claude-sonnet-5",
          feature: "stories",
          project: "Acme Rebuild",
          user: "Ada Lead",
          promptTokens: 400,
          completionTokens: 200,
          totalTokens: 600,
          durationMs: 3200,
          succeeded: false,
          error: "invalid x-api-key",
          at: "2026-09-25T10:00:00Z",
        },
      ],
      meta: SUMMARY,
    });

    render(<AiSettings />);

    expect(await screen.findByText("Acme Rebuild")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("600")).toBeInTheDocument();
  });
});
