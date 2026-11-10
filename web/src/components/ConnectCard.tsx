// The connect cards under VAIC's chat, shared by connectors and mail accounts (MAIL_CALENDAR.md §7):
// a sign-in button, a secure key field, the app-password form, and the add-connector approval.
// Keys and passwords go straight to the API in their own request; they never enter the chat or the store.
import { useState, type FormEvent } from "react";
import { decideApproval } from "../lib/actions.ts";
import { api, ApiError } from "../lib/api.ts";
import { APP_PASSWORD_HOWTO, IMAP_PRESETS, sendConnectorKey, sendImapForm, type ImapForm } from "../lib/connect.ts";
import { rememberConnect } from "../lib/connectReturn.ts";
import { serviceFor, useCatalog } from "../lib/catalog.ts";
import { store, type ConnectCardState } from "../lib/store.ts";
import { Button, errorText, LiveDot } from "./ui.tsx";
import { Select } from "./Select.tsx";

/** "No account yet?": the service's own sign-up page, checked by scripts/check-signup-links.mjs, in a new tab. */
export function SignupLink(p: { href?: string; service: string }) {
  if (!p.href) return null;
  return (
    <p className="mute signup-link">
      {`No ${p.service} account yet? `}
      <a href={p.href} target="_blank" rel="noopener noreferrer">
        {`Create one on ${p.service}'s site`}
      </a>
      {", then come back here: this updates by itself."}
    </p>
  );
}

export type SignInCardProps = {
  kind: "mail" | "connector";
  id: string;
  title: string;
  signinPath: string;
  completePath: string;
  status: "pending" | "connected" | "failed";
  /** A connector whose sign-in is at github.com: the owner may paste a GitHub token instead (PUT …/key). */
  tokenInstead?: string;
  /** The service's own sign-up page, for an owner without an account yet. */
  signup?: string;
};

/** Starts a provider's sign-in in a new tab; returns the problem in plain words, or null. */
export async function openSignIn(
  p: Pick<SignInCardProps, "kind" | "id" | "signinPath" | "completePath"> & {
    onAppPassword?: (preset: string) => void;
  },
) {
  // Opened at once, inside the tap, so the browser doesn't block it; the address comes a moment later.
  const tab = window.open("about:blank", "_blank");
  try {
    const r = await api<{ url: string; state?: string; app_password?: boolean; preset?: string; message?: string }>(
      p.signinPath,
      { method: "POST" },
    );
    if (r.app_password) {
      // Sign-in isn't switched on for this provider here: the mailbox connects with an app password instead.
      tab?.close();
      if (p.onAppPassword) {
        p.onAppPassword(r.preset ?? "");
        return null;
      }
      return r.message ?? "This mailbox connects with an app password: open Settings → Connectors.";
    }
    rememberConnect({ kind: p.kind, id: p.id, state: r.state ?? "", completePath: p.completePath });
    if (tab) {
      tab.opener = null;
      tab.location.href = r.url;
    } else location.assign(r.url);
    return null;
  } catch (e) {
    tab?.close();
    return errorText(e, "The sign-in didn't start. Try again.");
  }
}

export function SignInCard(p: SignInCardProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [withToken, setWithToken] = useState(false);
  const [appPreset, setAppPreset] = useState<string | null>(null);
  if (appPreset !== null)
    return (
      <ImapCard
        targetId={p.id}
        title={`Add the app password for ${p.title.replace(/^Sign in to /, "")}`}
        status="pending"
        preset={appPreset || undefined}
      />
    );
  if (withToken && p.tokenInstead)
    return (
      <KeyCard
        targetId={p.tokenInstead}
        title={`Paste a GitHub token for ${p.title.replace(/^Sign in to /, "")}`}
        onDone={() => setWithToken(false)}
      />
    );
  const service = p.title.replace(/^Sign in to /, "");
  if (p.status === "connected") return <DoneCard title={service} />;
  const go = async () => {
    setProblem(null);
    setProblem(await openSignIn({ ...p, onAppPassword: p.kind === "mail" ? setAppPreset : undefined }));
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
      <SignupLink href={p.signup} service={service.replace(/ \(.*\)$/, "")} />
    </div>
  );
}

/** A service that is live now: the green dot, and nothing left to do. */
export function DoneCard(p: { title: string }) {
  return (
    <div className="connect-card connect-done" role="status" aria-label={`${p.title} is connected`}>
      <p>
        <LiveDot label="Connected" /> {`${p.title} is connected.`}
      </p>
    </div>
  );
}

/** Why a service didn't connect, in full, with a way to try again in Settings. */
function ProblemCard(p: { title: string; text: string }) {
  return (
    <div className="connect-card" role="alert" aria-label={`${p.title} didn't connect`}>
      <p>{`${p.title} didn't connect: ${p.text}`}</p>
      <a href="#/settings/connectors">Open Settings → Connectors</a>
    </div>
  );
}

/** A secure field: the value is sent once to AWS and then forgotten; it is never shown again. */
export function KeyCard(p: {
  targetId: string;
  title: string;
  needs?: string;
  names?: string[];
  onDone?: () => void;
  signup?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  // A sign-in without self-registration: the owner's own app (id and secret), or an access token instead (decision 141).
  const [token, setToken] = useState(false);
  const client = p.needs === "oauth_client" && !token;
  const fields = client ? ["client_id", "client_secret"] : p.names?.length ? p.names : ["api_key"];
  const label = (f: string) =>
    ({ api_key: token ? "Access token" : "Key", client_id: "Client id", client_secret: "Client secret" })[f] ?? f;
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setProblem(null);
    const body = client
      ? { client_id: values.client_id, client_secret: values.client_secret }
      : p.names?.length
        ? { env: values }
        : { api_key: values.api_key };
    try {
      await sendConnectorKey(p.targetId, body);
      setValues({});
      p.onDone?.();
    } catch (err) {
      setProblem(errorText(err, "Not saved. Try again."));
    }
  };
  const ready = fields.every((f) => (values[f] ?? "").length > 0);
  return (
    <form className="connect-card" onSubmit={submit} aria-label={p.title} autoComplete="off">
      <p>
        {p.needs === "oauth_client" && !token
          ? `${p.title.replace(/^Add the key for /, "")} doesn't let new apps sign in by themselves: create a free app in its developer settings, paste its client id and secret here, then sign in. Or paste an access token instead.`
          : `${p.title}.`}{" "}
        It goes straight to AWS and is never shown again; don't paste it in the chat.
      </p>
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
      {p.needs === "oauth_client" ? (
        <Button
          variant="quiet"
          onClick={() => {
            setToken((x) => !x);
            setValues({});
          }}
        >
          {token ? "Use my app's id and secret instead" : "I have an access token instead"}
        </Button>
      ) : null}
      <SignupLink href={p.signup} service={p.title.replace(/^Add the key for /, "")} />
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
export function ImapCard(p: {
  targetId: string;
  title: string;
  status: "pending" | "connected";
  /** Fill in this provider's servers (an account standing in for Google/Microsoft sign-in). */
  preset?: string;
}) {
  const start = { ...EMPTY_IMAP, ...((p.preset && IMAP_PRESETS[p.preset]) || {}) };
  const [f, setF] = useState<ImapForm>(start);
  const [problem, setProblem] = useState<string | null>(null);
  if (p.status === "connected") return <DoneCard title={p.title.replace(/^Add the app password for /, "")} />;
  const set = (k: keyof ImapForm, v: string | number | boolean) => setF({ ...f, [k]: v });
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setProblem(null);
    try {
      await sendImapForm(p.targetId, f);
      setF(start); // the password leaves the page's memory as soon as it's stored
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
      {p.preset && APP_PASSWORD_HOWTO[p.preset] ? <p className="mute">{APP_PASSWORD_HOWTO[p.preset]}</p> : null}
      <label className="field">
        Provider
        <Select
          onChange={(e) => setF({ ...f, ...(IMAP_PRESETS[e.target.value] ?? {}) })}
          defaultValue={p.preset && IMAP_PRESETS[p.preset] ? p.preset : ""}
          aria-label="Fill in the servers for"
        >
          <option value="">Other (type the servers)</option>
          {Object.keys(IMAP_PRESETS).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
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

function ApproveCard(p: { approvalId: string; action: string; reason: string; id: string; connectorId?: string }) {
  const [problem, setProblem] = useState<string | null>(null);
  const decide = async (yes: boolean) => {
    setProblem(null);
    try {
      await decideApproval(p.approvalId, yes);
      store.dropCard(p.id);
    } catch (e) {
      setProblem(errorText(e, "That didn't go through. Try again."));
    }
  };
  return (
    <div className="connect-card" role="group" aria-label="Connect a service?">
      <p>{p.action}</p>
      <p className="mute">{p.reason}</p>
      {problem ? (
        <p className="field-error" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="row-end">
        <Button variant="quiet" onClick={() => decide(false)}>
          Not now
        </Button>
        <Button variant="secondary" onClick={() => decide(true)}>
          Connect
        </Button>
      </div>
    </div>
  );
}

/** Every connect card, in the order they arrived. Rendered under the chat by VaicScreen. */
export function ChatCards({ cards }: { cards: ConnectCardState[] }) {
  const cat = useCatalog();
  if (!cards.length) return null;
  return (
    <div className="connect-cards">
      {cards.map((c) => {
        if (c.kind === "approve") return <ApproveCard key={c.id} {...c} />;
        if (c.kind === "done") return <DoneCard key={c.id} title={c.title} />;
        if (c.kind === "problem") return <ProblemCard key={c.id} title={c.title} text={c.text} />;
        const signup = serviceFor(cat, c.targetId, c.title.replace(/^(Sign in to|Add the key for) /, ""))?.signup;
        if (c.kind === "key")
          return (
            <KeyCard key={c.id} targetId={c.targetId} title={c.title} needs={c.needs} names={c.names} signup={signup} />
          );
        if (c.kind === "imap")
          return <ImapCard key={c.id} targetId={c.targetId} title={c.title} status={c.status} preset={c.preset} />;
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
            signup={c.target === "connector" ? signup : undefined}
          />
        );
      })}
    </div>
  );
}
