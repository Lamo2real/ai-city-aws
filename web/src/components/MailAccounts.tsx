// Settings → Connectors → Mail & calendar (MAIL_CALENDAR.md §7): an account's details (a row in the Mine table),
// adding one, which roles may read mail, and the owner's standing rules. Sign-in and app passwords use the same
// cards as the chat.
import { useEffect, useState } from "react";
import { saveSettings } from "../lib/actions.ts";
import { ApiError } from "../lib/api.ts";
import {
  addMailAccount,
  addRule,
  editMailAccount,
  listRules,
  PROVIDER_LABEL,
  removeMailAccount,
  removeRule,
  type MailAccount,
  type MailRule,
} from "../lib/connect.ts";
import { ImapCard, SignInCard } from "./ConnectCard.tsx";
import { Button, Confirm, toast } from "./ui.tsx";

const STATUS: Record<MailAccount["status"], string> = {
  connected: "Connected",
  signing_in: "Waiting for sign-in",
  needs_sign_in: "Sign in again",
  error: "Problem",
  removed: "Removed",
};

/** One mailbox's details: sign-in or app password when needed, which calendars AIC sees, disconnect. */
export function MailAccountCard(p: { a: MailAccount; onChange: (a: MailAccount | null) => void }) {
  const { a } = p;
  const [removing, setRemoving] = useState(false);
  return (
    <article className="card" aria-label={`${a.label} account`}>
      <p>
        <b>{a.label}</b> · {a.preset ? a.preset.split(" (")[0] : PROVIDER_LABEL[a.provider]} {a.address ? `· ${a.address}` : ""}
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
        <ImapCard targetId={a.id} title={`Add the app password for ${a.label}`} status="pending" preset={a.preset} />
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
                  p.onChange(r.account);
                }}
              />{" "}
              {c.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="row-end">
        <Button variant="danger" onClick={() => setRemoving(true)}>
          Disconnect…
        </Button>
      </div>
      {removing ? (
        <Confirm
          title={`Disconnect ${a.label}?`}
          what={`AI City stops reading and sending for ${a.address || a.label} and forgets its sign-in${a.provider === "imap" ? " and app password" : ""}. Nothing in the mailbox itself is deleted.`}
          cost="Cost: nothing."
          confirmLabel="Disconnect"
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            const r = await removeMailAccount(a.id);
            setRemoving(false);
            p.onChange(null);
            toast({ text: r.note ? `Disconnected. ${r.note}` : "Disconnected.", tone: "good" });
          }}
        />
      ) : null}
    </article>
  );
}

/** Add a mailbox or calendar: pick the provider and a label, then the sign-in card appears on its row. */
export function AddMailAccount(p: { onAdded: () => void; onCancel: () => void }) {
  const [adding, setAdding] = useState<{ provider: MailAccount["provider"]; label: string }>({
    provider: "google",
    label: "",
  });
  return (
    <div className="card" role="group" aria-label="Add a mailbox or calendar">
      <h3>Add a mailbox or calendar</h3>
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
        <Button variant="quiet" onClick={p.onCancel}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          disabled={!adding.label.trim()}
          onClick={async () => {
            try {
              await addMailAccount(adding.provider, adding.label.trim());
              toast({ text: "Added. Sign in on its row to finish.", tone: "info" });
              p.onAdded();
            } catch (e) {
              toast({ text: e instanceof ApiError ? e.message : "Not added. Try again.", tone: "bad" });
            }
          }}
        >
          Add account
        </Button>
      </div>
    </div>
  );
}

/** Who may read mail (AIC always, workers never) and the owner's standing rules. */
export function MailSettings(p: {
  accounts: MailAccount[];
  access: Record<string, string>;
  onAccess: (a: Record<string, string>) => void;
}) {
  const { accounts } = p;
  const [rules, setRules] = useState<MailRule[]>([]);
  const [rule, setRule] = useState<{ kind: MailRule["kind"]; account_id: string; text: string } | null>(null);
  useEffect(() => {
    listRules().then(
      (r) => setRules(r.rules),
      () => undefined,
    );
  }, []);
  const access = async (role: string, v: string) => {
    const next = { ...p.access, [role]: v };
    await saveSettings({ mail_access: next });
    p.onAccess(next);
  };
  return (
    <div className="mail-accounts">
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
    </div>
  );
}
