// Settings → Connectors → Mail & calendar (MAIL_CALENDAR.md §7): accounts, which roles may read mail, and the
// owner's standing rules. Sign-in and app passwords use the same cards as the chat.
import { useEffect, useState } from "react";
import { saveSettings } from "../lib/actions.ts";
import { ApiError } from "../lib/api.ts";
import {
  addMailAccount,
  addRule,
  editMailAccount,
  listMailAccounts,
  listRules,
  PROVIDER_LABEL,
  removeMailAccount,
  removeRule,
  type MailAccount,
  type MailRule,
} from "../lib/connect.ts";
import { ImapCard, SignInCard } from "./ConnectCard.tsx";
import { Banner, Button, Confirm, toast } from "./ui.tsx";

const STATUS: Record<MailAccount["status"], string> = {
  connected: "Connected",
  signing_in: "Waiting for sign-in",
  needs_sign_in: "Sign in again",
  error: "Problem",
  removed: "Removed",
};

export function MailAccounts(p: { access: Record<string, string>; onAccess: (a: Record<string, string>) => void }) {
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null);
  const [rules, setRules] = useState<MailRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ provider: MailAccount["provider"]; label: string } | null>(null);
  const [removing, setRemoving] = useState<MailAccount | null>(null);
  const [rule, setRule] = useState<{ kind: MailRule["kind"]; account_id: string; text: string } | null>(null);
  const load = () =>
    Promise.all([listMailAccounts(), listRules().catch(() => ({ rules: [] as MailRule[] }))]).then(
      ([a, r]) => {
        setAccounts(a.accounts);
        setRules(r.rules);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  useEffect(() => {
    void load();
  }, []);
  const access = async (role: string, v: string) => {
    const next = { ...p.access, [role]: v };
    await saveSettings({ mail_access: next });
    p.onAccess(next);
  };
  if (error) return <Banner tone="info">{`Mail and calendar: ${error}`}</Banner>;
  return (
    <div className="mail-accounts">
      <h3>Mail &amp; calendar</h3>
      {accounts && !accounts.length ? (
        <p className="mute">No mailboxes or calendars yet. Ask AIC ("connect my work Outlook"), or add one here.</p>
      ) : null}
      {accounts?.map((a) => (
        <article key={a.id} className="card" aria-label={`${a.label} account`}>
          <p>
            <b>{a.label}</b> · {PROVIDER_LABEL[a.provider]} {a.address ? `· ${a.address}` : ""}
          </p>
          <p className={a.status === "connected" ? "good" : "mute"}>{STATUS[a.status]}</p>
          {a.status !== "connected" && a.provider !== "imap" ? (
            <SignInCard
              kind="mail"
              id={a.id}
              title={`Sign in to ${PROVIDER_LABEL[a.provider]} (${a.label})`}
              signinPath={`/mail/accounts/${a.id}/signin`}
              completePath={`/mail/accounts/${a.id}/complete`}
              status="pending"
            />
          ) : null}
          {a.status !== "connected" && a.provider === "imap" ? (
            <ImapCard targetId={a.id} title={`Add the app password for ${a.label}`} status="pending" />
          ) : null}
          {a.calendars?.length ? (
            <fieldset className="roles">
              <legend>Calendars AIC sees</legend>
              {a.calendars.map((c) => (
                <label key={c.id} className="switch">
                  <input
                    type="checkbox"
                    checked={!c.hidden}
                    onChange={async (e) => {
                      const r = await editMailAccount(a.id, { calendars: [{ id: c.id, hidden: !e.target.checked }] });
                      setAccounts((xs) => xs?.map((x) => (x.id === a.id ? r.account : x)) ?? null);
                    }}
                  />{" "}
                  {c.name}
                </label>
              ))}
            </fieldset>
          ) : null}
          <div className="row-end">
            <Button variant="danger" onClick={() => setRemoving(a)}>
              Disconnect…
            </Button>
          </div>
        </article>
      ))}
      {adding ? (
        <div className="card">
          <label className="field">
            Provider
            <select
              value={adding.provider}
              onChange={(e) => setAdding({ ...adding, provider: e.target.value as MailAccount["provider"] })}
            >
              {Object.entries(PROVIDER_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Label
            <input
              value={adding.label}
              onChange={(e) => setAdding({ ...adding, label: e.target.value })}
              placeholder="Work"
            />
          </label>
          <div className="row-end">
            <Button variant="quiet" onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={!adding.label.trim()}
              onClick={async () => {
                try {
                  await addMailAccount(adding.provider, adding.label.trim());
                  setAdding(null);
                  await load();
                } catch (e) {
                  toast({ text: e instanceof ApiError ? e.message : "Not added. Try again.", tone: "bad" });
                }
              }}
            >
              Add account
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAdding({ provider: "google", label: "" })}>
          Add a mailbox or calendar
        </Button>
      )}
      <h4>Who may read mail</h4>
      <p className="mute">AIC always can. Workers never can, by design.</p>
      {(["orchestrator", "manager"] as const).map((role) => (
        <label key={role} className="field">
          {role === "orchestrator" ? "Orchestrator" : "Managers"}
          <select value={p.access[role] ?? "none"} onChange={(e) => void access(role, e.target.value)}>
            <option value="none">No access</option>
            <option value="read">Can read</option>
          </select>
        </label>
      ))}
      <h4>Standing rules</h4>
      <p className="mute">
        Exceptions you trust: AIC may send to these people, or accept invitations from them when nothing clashes,
        without asking each time. Everything else still waits for you.
      </p>
      {rules.map((r) => (
        <p key={r.id} className="row">
          <span>
            {r.kind === "send_to" ? "Send to" : "Accept invitations from"}{" "}
            {[...r.match.addresses, ...r.match.domains].join(", ")}
          </span>
          <Button
            variant="quiet"
            onClick={async () => {
              await removeRule(r.id);
              setRules((xs) => xs.filter((x) => x.id !== r.id));
            }}
          >
            Remove
          </Button>
        </p>
      ))}
      {rule ? (
        <div className="card">
          <label className="field">
            Kind
            <select value={rule.kind} onChange={(e) => setRule({ ...rule, kind: e.target.value as MailRule["kind"] })}>
              <option value="send_to">Send to</option>
              <option value="accept_from">Accept invitations from</option>
            </select>
          </label>
          <label className="field">
            From account
            <select value={rule.account_id} onChange={(e) => setRule({ ...rule, account_id: e.target.value })}>
              {accounts
                ?.filter((a) => a.status === "connected")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Addresses or domains, separated by commas
            <input
              value={rule.text}
              onChange={(e) => setRule({ ...rule, text: e.target.value })}
              placeholder="bo@example.com, mycompany.com"
            />
          </label>
          <div className="row-end">
            <Button variant="quiet" onClick={() => setRule(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const items = rule.text
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
                try {
                  const r = await addRule({
                    kind: rule.kind,
                    account_id: rule.account_id,
                    match: {
                      addresses: items.filter((x) => x.includes("@") && !x.startsWith("@")),
                      domains: items.filter((x) => !x.includes("@") || x.startsWith("@")),
                    },
                  });
                  setRules((xs) => [...xs, r.rule]);
                  setRule(null);
                } catch (e) {
                  toast({ text: e instanceof ApiError ? e.message : "Not added.", tone: "bad" });
                }
              }}
            >
              Add rule
            </Button>
          </div>
        </div>
      ) : accounts?.some((a) => a.status === "connected") ? (
        <Button
          variant="quiet"
          onClick={() =>
            setRule({ kind: "send_to", account_id: accounts.find((a) => a.status === "connected")!.id, text: "" })
          }
        >
          Add a standing rule
        </Button>
      ) : null}
      {removing ? (
        <Confirm
          title={`Disconnect ${removing.label}?`}
          what={`AI City stops reading and sending for ${removing.address || removing.label} and forgets its sign-in${removing.provider === "imap" ? " and app password" : ""}. Nothing in the mailbox itself is deleted.`}
          cost="Cost: nothing."
          confirmLabel="Disconnect"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const r = await removeMailAccount(removing.id);
            setRemoving(null);
            setAccounts((xs) => xs?.filter((x) => x.id !== removing.id) ?? null);
            toast({ text: r.note ? `Disconnected. ${r.note}` : "Disconnected.", tone: "good" });
          }}
        />
      ) : null}
    </div>
  );
}
