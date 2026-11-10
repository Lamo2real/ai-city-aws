// The GitHub token (docs/GITHUB_ACCESS.md): one token for the whole city, pasted once into a secure field. It lives
// on the GitHub card in Settings → Connectors, the one place for it (decision 194). The token goes straight to AWS
// and is never shown again; the card only says who it belongs to.
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api.ts";
import { ago } from "../lib/format.ts";
import { Banner, Button, Confirm, toast } from "./ui.tsx";

export interface GitHubStatus {
  configured: boolean;
  login: string | null;
  saved_at: string | null;
  error: string | null;
}
export const loadGitHub = () => api<GitHubStatus>("/github");

/** What the owner reads about the stored token, in plain words. */
export function githubWords(st: GitHubStatus): { text: string; tone: "good" | "warn" | "info" } {
  if (!st.configured)
    return { text: "No token yet. Your agents can't push to GitHub until you add one.", tone: "info" };
  if (st.error) return { text: st.error, tone: "warn" };
  if (st.login)
    return {
      text: `Connected as ${st.login}${st.saved_at ? ` · saved ${ago(Date.parse(st.saved_at))}` : ""}.`,
      tone: "good",
    };
  return { text: "A token is saved; GitHub hasn't said whose it is yet.", tone: "info" };
}

export function GitHubSettings(p: { onSaved?: () => void } = {}) {
  const [st, setSt] = useState<GitHubStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const load = () =>
    loadGitHub().then(
      (s) => {
        setSt(s);
        setLoadError(null);
      },
      (e: Error) => setLoadError(e.message),
    );
  useEffect(() => {
    void load();
  }, []);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (busy || !token.trim()) return;
    setBusy(true);
    setProblem(null);
    api<{ ok: boolean; login: string | null }>("/github/token", { method: "PUT", body: { token: token.trim() } })
      .then(async (r) => {
        setToken("");
        setOpen(false);
        await load();
        p.onSaved?.();
        toast({
          tone: "good",
          text: r.login
            ? `GitHub token saved. Your agents now work as ${r.login}.`
            : "GitHub token saved. Your agents can use GitHub now.",
        });
      })
      .catch((err: unknown) => setProblem(err instanceof ApiError ? err.message : "The token could not be saved."))
      .finally(() => setBusy(false));
  };
  const words = st ? githubWords(st) : null;
  return (
    <>
      <p className="mute">
        One token for the whole city: your agents clone, push, open pull requests, create repositories and call the
        GitHub API as you, and this connector uses it too. Make a classic token with every scope ticked (see
        docs/GITHUB_ACCESS.md); it goes straight to AWS and is never shown again.
      </p>
      {loadError ? <Banner tone="info">{`GitHub: ${loadError}`}</Banner> : null}
      {words ? (
        <p className={`status status-${words.tone}`} role="status">
          {words.text}
        </p>
      ) : null}
      {!open ? (
        <div className="row-end">
          <Button variant="quiet" onClick={() => setOpen(true)}>
            {st?.configured ? "Replace the GitHub token" : "Add a GitHub token"}
          </Button>
          {st?.configured ? (
            <Button variant="danger" onClick={() => setRemoving(true)}>
              Remove the GitHub token…
            </Button>
          ) : null}
        </div>
      ) : (
        <form onSubmit={save} autoComplete="off">
          {problem ? <Banner tone="bad">{problem}</Banner> : null}
          <label className="field">
            GitHub token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="ghp_… or github_pat_…"
              required
            />
          </label>
          <div className="actions">
            <Button variant="secondary" type="submit" label="Save the GitHub token" disabled={busy}>
              Save the GitHub token
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setToken("");
                setOpen(false);
              }}
              label="Cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {removing ? (
        <Confirm
          title="Remove the GitHub token?"
          what="Your agents lose GitHub until you paste a new one. The token itself stays valid on GitHub; revoke it there too if you want it dead."
          cost="Cost: nothing."
          confirmLabel="Remove the token"
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            try {
              await api("/github/token", { method: "DELETE" });
              setRemoving(false);
              await load();
              p.onSaved?.();
              toast({ text: "GitHub token removed.", tone: "good" });
            } catch (e) {
              setRemoving(false);
              toast({ text: e instanceof ApiError ? e.message : "Not removed.", tone: "bad" });
            }
          }}
        />
      ) : null}
    </>
  );
}
