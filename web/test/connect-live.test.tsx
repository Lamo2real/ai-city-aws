// Connecting any tool end to end (decision 141): checked sign-up links that open in a new tab, the status that turns
// connected by itself when the owner comes back, VAIC's "… is connected, Sir." line, the green live dot, the token
// option for sign-ins without self-registration, and every error in full.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api.ts", () => ({
  api: vi.fn(async () => ({ ok: true })),
  ApiError: class extends Error {
    constructor(
      message: string,
      readonly status = 400,
      readonly fix: string | null = null,
    ) {
      super(message);
    }
  },
}));
import { api, ApiError } from "../src/lib/api.ts";
import { refreshFollowed } from "../src/lib/actions.ts";
import { placeCards, store } from "../src/lib/store.ts";
import { ChatCards, KeyCard, SignupLink } from "../src/components/ConnectCard.tsx";
import { errorText } from "../src/components/ui.tsx";

const FILE = JSON.parse(readFileSync(`${import.meta.dirname}/../../config/departments.json`, "utf8")) as {
  connectors: Record<string, { label: string; url: string; signup?: string; setup?: string; ask?: unknown }>;
};
const CSS = readFileSync(`${import.meta.dirname}/../src/styles.css`, "utf8");

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.mocked(api).mockReset();
  store.set({ cards: [], chat: [] });
});

describe("sign-up links", () => {
  // Services that need no account of their own (public docs, open data, a free diagram tool).
  const NO_ACCOUNT = new Set([
    "aws-knowledge",
    "context7",
    "microsoft-learn",
    "cloudflare-docs",
    "shopify-dev",
    "openalex",
    "product-hunt",
    "drawio",
  ]);
  it("every service that needs an account has an https sign-up link, checked live by scripts/check-signup-links.mjs", () => {
    for (const [id, c] of Object.entries(FILE.connectors)) {
      if (NO_ACCOUNT.has(id)) continue;
      expect(c.signup, id).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/);
      expect(c.signup, id).not.toMatch(/[?&](token|key|secret)=/i);
    }
  });
  it("opens the service's own page in a new tab, without telling it where the owner came from", () => {
    render(<SignupLink href="https://higgsfield.ai/auth/signup" service="Higgsfield" />);
    const a = screen.getByRole("link", { name: "Create one on Higgsfield's site" });
    expect(a.getAttribute("href")).toBe("https://higgsfield.ai/auth/signup");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText(/come back here: this updates by itself/)).toBeTruthy();
  });
  it("only sign-ins without self-registration are marked as needing the owner's own app", () => {
    const own = Object.entries(FILE.connectors).filter(([, c]) => c.setup);
    expect(own.map(([id]) => id).sort()).toEqual([
      "artlist",
      "asana",
      "box",
      "crunchbase",
      "docusign",
      "elevenlabs",
      "github",
      "hubspot",
      "pagerduty",
      "slack",
      "unsplash",
      "xero",
    ]);
    expect(own.every(([, c]) => c.setup === "own_app")).toBe(true);
  });
});

describe("coming back after signing up and in", () => {
  const follow = () => {
    store.event({
      type: "connector.updated",
      id: "higgsfield",
      label: "Higgsfield",
      status: "needs_login",
      auth: "oauth",
    });
    expect(store.following().connectors).toEqual(["higgsfield"]);
  };

  it("the card turns connected, VAIC says so once, and nothing is followed any more", async () => {
    follow();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === "/connectors")
        return { connectors: [{ id: "higgsfield", label: "Higgsfield", status: "ready", tools: [] }] };
      throw new Error(path);
    });
    await refreshFollowed();
    expect(store.get().cards).toMatchObject([{ kind: "signin", status: "connected" }]);
    expect(store.get().chat.map((l) => [l.who, l.text])).toEqual([["ace", "Higgsfield is connected, Sir."]]);
    expect(store.following().connectors).toEqual([]);
    store.event({ type: "connector.updated", id: "higgsfield", label: "Higgsfield", status: "ready" });
    expect(store.get().chat).toHaveLength(1); // once
  });

  it("looks again when the tab is back in view, and asks nothing when nothing is followed", async () => {
    vi.mocked(api).mockResolvedValue({ connectors: [] });
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    expect(api).not.toHaveBeenCalled();
    follow();
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/connectors"));
  });

  it("a mailbox signed in elsewhere turns connected the same way", async () => {
    store.event({ type: "connect.signin", provider: "google", label: "Work", account_id: "ma-1" });
    vi.mocked(api).mockResolvedValue({
      accounts: [{ id: "ma-1", provider: "google", label: "Work", address: "me@x.test", status: "connected" }],
    });
    await refreshFollowed();
    expect(store.get().cards).toMatchObject([{ kind: "signin", status: "connected" }]);
    expect(store.get().chat.at(-1)?.text).toBe("Work is connected, Sir.");
  });

  it("a key card becomes a live card, and an error shows in full", () => {
    store.event({ type: "connector.updated", id: "tavily", label: "Tavily", status: "needs_key", auth: "api_key" });
    store.event({ type: "connector.updated", id: "tavily", label: "Tavily", status: "ready" });
    render(<ChatCards cards={store.get().cards} />);
    expect(screen.getByRole("status", { name: "Tavily is connected" }).querySelector(".live-dot")).toBeTruthy();
    cleanup();
    store.set({ cards: [] });
    store.event({ type: "connector.updated", id: "acme", label: "Acme", status: "needs_login" });
    store.event({
      type: "connector.updated",
      id: "acme",
      label: "Acme",
      status: "error",
      error: "The server at mcp.acme.test answered 503 Service Unavailable three times.",
    });
    render(<ChatCards cards={store.get().cards} />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Acme didn't connect: The server at mcp.acme.test answered 503 Service Unavailable three times.",
    );
  });
});

describe("after the owner approves a connector", () => {
  it("a failure while setting it up shows in the chat in full, not nothing (Canva, 2026-11-10)", async () => {
    // Long ago, so no resume is kept: only the approval itself keeps the connector followed.
    store.set({ chat: [{ who: "owner", text: "connect Canva", at: Date.now() - 10 * 3_600_000 }] as never });
    store.event({
      type: "approval.requested",
      kind: "connector.add",
      id: "ap-1",
      action: "Connect Canva?",
      reason: "r",
      connector_id: "canva",
    });
    store.dropCard("ap:ap-1"); // what the card does when the owner taps Connect
    const full =
      "AgentCore Identity refused the sign-in setup. AccessDeniedException: User: arn:aws:sts::123456789012:assumed-role/aic-prod-fn-connectors/x is not authorized to perform: bedrock-agentcore:CreateTokenVault on resource: arn:aws:bedrock-agentcore:eu-north-1:123456789012:token-vault/default";
    store.event({ type: "connector.updated", id: "canva", label: "Canva", status: "provisioning" });
    store.event({ type: "connector.updated", id: "canva", label: "Canva", status: "error", error: full });
    render(<ChatCards cards={store.get().cards} />);
    expect(screen.getByRole("alert").textContent).toContain(`Canva didn't connect: ${full}`);
  });

  it("an error for a connector nobody asked about in this session stays in Settings", () => {
    store.event({ type: "connector.updated", id: "other", label: "Other", status: "error", error: "x" });
    expect(store.get().cards).toEqual([]);
  });
});

describe("where a connect card sits in the conversation (decision 164)", () => {
  const line = (id: string, who: string) => ({ id, who });
  const card = (id: string, after?: string) => ({ kind: "done" as const, id, targetId: id, title: id, after });
  it("after VAIC's reply in the turn it came in, before the owner's next message", () => {
    const chat = [line("o1", "owner"), line("a1", "ace"), line("o2", "owner"), line("a2", "ace")];
    const { before, end } = placeCards(chat, [card("x", "o1"), card("y", "a2"), card("z", ""), card("w")]);
    expect(before.get(2)?.map((c) => c.id)).toEqual(["x"]);
    expect(before.get(0)?.map((c) => c.id)).toEqual(["z"]);
    expect(end.map((c) => c.id)).toEqual(["y", "w"]);
  });
  it("a card keeps its place when it changes, and a follow-up card takes the approval card's place", () => {
    store.set({ chat: [{ id: "o1", who: "owner", text: "add Tavily", at: Date.now(), state: "sent" }] as never });
    store.event({
      type: "approval.requested",
      kind: "connector.add",
      id: "ap-7",
      action: "a",
      reason: "r",
      connector_id: "tavily",
    });
    store.set({
      chat: [...store.get().chat, { id: "o2", who: "owner", text: "and now?", at: Date.now(), state: "sent" }] as never,
    });
    store.dropCard("ap:ap-7");
    store.event({ type: "connector.updated", id: "tavily", label: "Tavily", status: "needs_key" });
    store.event({ type: "connector.updated", id: "tavily", label: "Tavily", status: "ready" });
    expect(store.get().cards).toMatchObject([{ kind: "done", after: "o1" }]);
  });
});

describe("one card per mailbox", () => {
  it("the same account's sign-in event twice is one card", () => {
    for (let i = 0; i < 2; i++)
      store.event({ type: "connect.signin", provider: "microsoft", label: "Outlook", account_id: "ma-9" });
    expect(store.get().cards).toHaveLength(1);
  });

  it("the app-password form offers no Outlook.com: Microsoft turned app passwords off", async () => {
    const { IMAP_PRESETS, APP_PASSWORD_HOWTO } = await import("../src/lib/connect.ts");
    expect(Object.keys(IMAP_PRESETS)).not.toContain("Outlook.com");
    expect(Object.keys(APP_PASSWORD_HOWTO)).not.toContain("Outlook.com");
  });
});

describe("the live dot and full errors", () => {
  it("pulses gently and stands still when the owner prefers less motion", () => {
    expect(CSS).toMatch(/\.live-dot \{[^}]*animation: live-pulse/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.live-dot \{\s*animation: none;/);
  });
  it("an API error keeps its fix", () => {
    expect(errorText(new ApiError("The key couldn't be stored.", 502, "Try again in a moment."), "x")).toBe(
      "The key couldn't be stored. Try again in a moment.",
    );
    expect(errorText(null, "Not saved.")).toBe("Not saved.");
  });
});

describe("a sign-in without self-registration", () => {
  it("takes the owner's app id and secret, or an access token instead", async () => {
    render(
      <KeyCard
        targetId="hubspot"
        title="Add the key for HubSpot"
        needs="oauth_client"
        signup="https://app.hubspot.com/signup-hubspot/crm"
      />,
    );
    expect(screen.getByText(/create a free app in its developer settings/)).toBeTruthy();
    expect(screen.getByLabelText("Client id")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "I have an access token instead" }));
    fireEvent.change(screen.getByLabelText("Access token"), { target: { value: "pat-eu1-abcdef0123456789" } });
    fireEvent.click(screen.getByRole("button", { name: "Save securely" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/connectors/hubspot/key", {
        method: "PUT",
        body: { api_key: "pat-eu1-abcdef0123456789" },
      }),
    );
    expect(screen.getByRole("link", { name: "Create one on HubSpot's site" })).toBeTruthy();
  });
});
