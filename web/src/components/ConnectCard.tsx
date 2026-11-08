// The connect cards under AIC's chat, shared by connectors and mail accounts (MAIL_CALENDAR.md §7):
// a sign-in button, a secure key field, the app-password form, and the add-connector approval.
// Keys and passwords go straight to the API in their own request; they never enter the chat or the store.
import { useState, type FormEvent } from "react";
import { decideApproval } from "../lib/actions.ts";
import { api, ApiError } from "../lib/api.ts";
import { IMAP_PRESETS, sendConnectorKey, sendImapForm, type ImapForm } from "../lib/connect.ts";
import { rememberConnect } from "../lib/connectReturn.ts";
import { store, type ConnectCardState } from "../lib/store.ts";
import { Button } from "./ui.tsx";

export type SignInCardProps = {
  kind: "mail" | "connector";
  id: string;
  title: string;
  signinPath: string;
  completePath: string;
  status: "pending" | "connected" | "failed";
  /** A connector whose sign-in is at github.com: the owner may paste a GitHub token instead (PUT …/key). */
  tokenInstead?: string;
};

/** Starts a provider's sign-in in a new tab; returns the problem in plain words, or null. */
export async function openSignIn(p: Pick<SignInCardProps, "kind" | "id" | "signinPath" | "completePath">) {
  // Opened at once, inside the tap, so the browser doesn't block it; the address comes a moment later.
  const tab = window.open("about:blank", "_blank");
  try {
    const r = await api<{ url: string; state?: string }>(p.signinPath, { method: "POST" });
    rememberConnect({ kind: p.kind, id: p.id, state: r.state ?? "", completePath: p.completePath });
    if (tab) {
      tab.opener = null;
      tab.location.href = r.url;
    } else location.assign(r.url);
    return null;
  } catch (e) {
    tab?.close();
    return e instanceof ApiError ? e.message : "The sign-in didn't start. Try again.";
  }
}

export function SignInCard(p: SignInCardProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [withToken, setWithToken] = useState(false);
  if (withToken && p.tokenInstead)
    return (
      <KeyCard
        targetId={p.tokenInstead}
        title={`Paste a GitHub token for ${p.title.replace(/^Sign in to /, "")}`}
        onDone={() => setWithToken(false)}
      />
    );
  if (p.status === "connected")
    return (
      <div className="connect-card connect-done" role="status">
        <p>{p.title.replace(/^Sign in to /, "")}: connected ✓</p>
      </div>
    );
  const go = async () => {
    setProblem(null);
    setProblem(await openSignIn(p));
  };
  return (
    <div className="connect-card" role="group" aria-label={p.title}>
      <p>{p.status === "failed" ? `${p.title} didn't finish.` : `${p.title} to finish connecting.`}</p>
      {problem ? (
        <p className="field-error" role="alert">
          {problem}
        </p>
      ) : null}
      <Button variant="secondary" onClick={go}>
        {p.status === "failed" ? "Try again" : p.title}
      </Button>
      {p.tokenInstead ? (
        <Button variant="quiet" onClick={() => setWithToken(true)}>
          I have a token instead
        </Button>
      ) : null}
    </div>
  );
}

/** A secure field: the value is sent once to AWS and then forgotten; it is never shown again. */
export function KeyCard(p: { targetId: string; title: string; needs?: string; names?: string[]; onDone?: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const fields = p.needs === "oauth_client" ? ["client_id", "client_secret"] : p.names?.length ? p.names : ["api_key"];
  const label = (f: string) => ({ api_key: "Key", client_id: "Client id", client_secret: "Client secret" })[f] ?? f;
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setProblem(null);
    const body =
      p.needs === "oauth_client"
        ? { client_id: values.client_id, client_secret: values.client_secret }
        : p.names?.length
          ? { env: values }
          : { api_key: values.api_key };
    try {
      await sendConnectorKey(p.targetId, body);
      setValues({});
      p.onDone?.();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Not saved. Try again.");
    }
  };
  const ready = fields.every((f) => (values[f] ?? "").length > 0);
  return (
    <form className="connect-card" onSubmit={submit} aria-label={p.title} autoComplete="off">
      <p>{p.title}. It goes straight to AWS and is never shown again; don't paste it in the chat.</p>
      {fields.map((f) => (
        <label key={f} className="field">
          {label(f)}
          <input
            type={f === "client_id" ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={values[f] ?? ""}
            onChange={(e) => setValues({ ...values, [f]: e.target.value })}
          />
        </label>
      ))}
      {problem ? (
        <p className="field-error" role="alert">
          {problem}
        </p>
      ) : null}
      <Button variant="secondary" type="submit" disabled={!ready}>
        Save securely
      </Button>
    </form>
  );
}

const EMPTY_IMAP: ImapForm = {
  address: "",
  password: "",
  imap_host: "",
  imap_port: 993,
  smtp_host: "",
  smtp_port: 465,
  smtp_starttls: false,
};

/** The app-password form for an IMAP/CalDAV account (MAIL_CALENDAR.md §2.2). */
export function ImapCard(p: { targetId: string; title: string; status: "pending" | "connected" }) {
  const [f, setF] = useState<ImapForm>(EMPTY_IMAP);
  const [problem, setProblem] = useState<string | null>(null);
  if (p.status === "connected")
    return (
      <div className="connect-card connect-done" role="status">
        <p>{p.title.replace(/^Add the app password for /, "")}: connected ✓</p>
      </div>
    );
  const set = (k: keyof ImapForm, v: string | number | boolean) => setF({ ...f, [k]: v });
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setProblem(null);
    try {
      await sendImapForm(p.targetId, f);
      setF(EMPTY_IMAP); // the password leaves the page's memory as soon as it's stored
    } catch (err) {
      setF({ ...f, password: "" });
      setProblem(
        err instanceof ApiError ? `${err.message}${err.fix ? ` ${err.fix}` : ""}` : "Not connected. Try again.",
      );
    }
  };
  return (
    <form className="connect-card" onSubmit={submit} aria-label={p.title} autoComplete="off">
      <p>{p.title}. Use an app password from your provider, not your normal password.</p>
      <label className="field">
        Provider
        <select
          onChange={(e) => setF({ ...f, ...(IMAP_PRESETS[e.target.value] ?? {}) })}
          defaultValue=""
          aria-label="Fill in the servers for"
        >
          <option value="">Other (type the servers)</option>
          {Object.keys(IMAP_PRESETS).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Email address
        <input type="email" value={f.address} onChange={(e) => set("address", e.target.value)} />
      </label>
      <label className="field">
        App password
        <input
          type="password"
          autoComplete="off"
          value={f.password}
          onChange={(e) => set("password", e.target.value)}
        />
      </label>
      <details>
        <summary>Servers</summary>
        <label className="field">
          IMAP server
          <input value={f.imap_host} onChange={(e) => set("imap_host", e.target.value)} />
        </label>
        <label className="field">
          SMTP server
          <input value={f.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} />
        </label>
        <label className="field">
          SMTP port
          <input type="number" value={f.smtp_port} onChange={(e) => set("smtp_port", Number(e.target.value))} />
        </label>
        <label className="switch">
          <input type="checkbox" checked={f.smtp_starttls} onChange={(e) => set("smtp_starttls", e.target.checked)} />{" "}
          SMTP uses STARTTLS
        </label>
        <label className="field">
          Calendar (CalDAV) address, optional
          <input value={f.caldav_url ?? ""} onChange={(e) => set("caldav_url", e.target.value)} />
        </label>
      </details>
      {problem ? (
        <p className="field-error" role="alert">
          {problem}
        </p>
      ) : null}
      <Button variant="secondary" type="submit" disabled={!f.address || !f.password || !f.imap_host || !f.smtp_host}>
        Connect securely
      </Button>
    </form>
  );
}

function ApproveCard(p: { approvalId: string; action: string; reason: string; id: string }) {
  const [problem, setProblem] = useState<string | null>(null);
  const decide = async (yes: boolean) => {
    setProblem(null);
    try {
      await decideApproval(p.approvalId, yes);
      store.dropCard(p.id);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    }
  };
  return (
    <div className="connect-card" role="group" aria-label="Add a connector?">
      <p className="action">{p.action}</p>
      <p className="mute">{p.reason}</p>
      {problem ? (
        <p className="field-error" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="row-end">
        <Button variant="quiet" onClick={() => decide(false)}>
          Decline
        </Button>
        <Button variant="secondary" onClick={() => decide(true)}>
          Approve
        </Button>
      </div>
    </div>
  );
}

/** Every connect card, in the order they arrived. Rendered under the chat by AceScreen. */
export function ChatCards({ cards }: { cards: ConnectCardState[] }) {
  if (!cards.length) return null;
  return (
    <div className="connect-cards">
      {cards.map((c) => {
        if (c.kind === "approve") return <ApproveCard key={c.id} {...c} />;
        if (c.kind === "key")
          return <KeyCard key={c.id} targetId={c.targetId} title={c.title} needs={c.needs} names={c.names} />;
        if (c.kind === "imap") return <ImapCard key={c.id} targetId={c.targetId} title={c.title} status={c.status} />;
        const base = c.target === "mail" ? `/mail/accounts/${c.targetId}` : `/connectors/${c.targetId}/login`;
        return (
          <SignInCard
            key={c.id}
            kind={c.target}
            id={c.targetId}
            title={c.title}
            status={c.status}
            signinPath={c.target === "mail" ? `${base}/signin` : base}
            completePath={c.target === "mail" ? `${base}/complete` : `${base}/complete`}
            tokenInstead={c.target === "connector" && c.tokenOk ? c.targetId : undefined}
          />
        );
      })}
    </div>
  );
}
