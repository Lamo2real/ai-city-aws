// Settings → GitHub (docs/GITHUB_ACCESS.md): the token goes to the API once and is never shown back; the section
// says who it belongs to; a sign-in card at github.com offers a token instead.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api.ts", () => ({
  api: vi.fn(),
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
import { GitHubSettings, githubWords } from "../src/components/GitHubSettings.tsx";
import { stepWords } from "../src/lib/steps.ts";
import { store } from "../src/lib/store.ts";

const TOKEN = "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
  store.set({ cards: [] });
});

describe("what the owner reads about the token", () => {
  it("says no token, whose it is, or why it stopped working", () => {
    expect(githubWords({ configured: false, login: null, saved_at: null, error: null }).text).toMatch(/No token yet/);
    const ok = githubWords({ configured: true, login: "lamo2real", saved_at: new Date().toISOString(), error: null });
    expect(ok).toMatchObject({ tone: "good" });
    expect(ok.text).toMatch(/^Connected as lamo2real · saved just now\.$/);
    expect(githubWords({ configured: true, login: null, saved_at: null, error: "GitHub rejected the token." })).toEqual(
      {
        text: "GitHub rejected the token.",
        tone: "warn",
      },
    );
  });
});

describe("Settings → GitHub", () => {
  it("stores the token once, shows Connected as, never shows the token back", async () => {
    const state = { configured: false, login: null as string | null, saved_at: null as string | null, error: null };
    vi.mocked(api).mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      if (path === "/github") return { ...state };
      if (path === "/github/token" && init?.method === "PUT") {
        expect(init.body).toEqual({ token: TOKEN });
        Object.assign(state, { configured: true, login: "lamo2real", saved_at: new Date().toISOString() });
        return { ok: true, saved_at: state.saved_at, login: "lamo2real" };
      }
      if (path === "/github/token" && init?.method === "DELETE") {
        Object.assign(state, { configured: false, login: null, saved_at: null });
        return { ok: true };
      }
      throw new Error(`unexpected ${path}`);
    });
    const { container } = render(<GitHubSettings />);
    await screen.findByText(/No token yet/);
    fireEvent.click(screen.getByRole("button", { name: "Add a GitHub token" }));
    const field = screen.getByLabelText("GitHub token");
    expect(field).toHaveProperty("type", "password");
    fireEvent.change(field, { target: { value: TOKEN } });
    fireEvent.click(screen.getByRole("button", { name: "Save the GitHub token" }));
    await screen.findByText(/^Connected as lamo2real/);
    expect(screen.queryByLabelText("GitHub token")).toBeNull(); // the field closes
    expect(container.innerHTML).not.toContain(TOKEN);
    expect(vi.mocked(api).mock.calls.map((c) => [c[0], c[1]?.method ?? "GET"])).toEqual([
      ["/github", "GET"],
      ["/github/token", "PUT"],
      ["/github", "GET"],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Remove the GitHub token…" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove the token" }));
    await screen.findByText(/No token yet/);
  });
  it("a refused token stays in the field with GitHub's words", async () => {
    vi.mocked(api).mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/github") return { configured: false, login: null, saved_at: null, error: null };
      if (init?.method === "PUT")
        throw new ApiError("GitHub rejected the token. Make a new one and paste it again.", 400);
      throw new Error(`unexpected ${path}`);
    });
    render(<GitHubSettings />);
    await screen.findByText(/No token yet/);
    fireEvent.click(screen.getByRole("button", { name: "Add a GitHub token" }));
    fireEvent.change(screen.getByLabelText("GitHub token"), { target: { value: TOKEN } });
    fireEvent.click(screen.getByRole("button", { name: "Save the GitHub token" }));
    await screen.findByText(/GitHub rejected the token/);
    expect(screen.getByLabelText("GitHub token")).toHaveProperty("value", TOKEN);
  });
});

describe("AIC's terminal in the chat", () => {
  it("shows the running command as the step, and a github.com sign-in card offers a token instead", () => {
    expect(stepWords("running", "Running: git push origin main")).toBe("Running: git push origin main");
    expect(stepWords("running", "run_command")).toBe("Working on it");
    store.event({
      type: "connector.updated",
      id: "github",
      label: "GitHub",
      status: "needs_login",
      auth: "oauth",
      oauth_host: "github.com",
    });
    store.event({ type: "connector.updated", id: "hf", label: "Higgsfield", status: "needs_login", auth: "oauth" });
    expect(store.get().cards).toMatchObject([
      { kind: "signin", targetId: "github", tokenOk: true },
      { kind: "signin", targetId: "hf", tokenOk: false },
    ]);
  });
});
