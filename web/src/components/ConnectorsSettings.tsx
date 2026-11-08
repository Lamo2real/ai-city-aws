// Settings → Connectors (CONNECTORS_SKILLS.md §3): everything the owner connected, which roles may use it,
// what needs approval, and sign-in / key / refresh / remove. Keys are typed only into secure fields.
import { useEffect, useState } from "react";
import { ApiError } from "../lib/api.ts";
import {
  addConnectorByUrl,
  connectorStatus,
  editConnector,
  githubSignIn,
  listConnectors,
  refreshConnector,
  removeConnector,
  ROLE_LABEL,
  ROLES,
  matchesPreset,
  type Connector,
  type PresetConnector,
  type Role,
} from "../lib/connect.ts";
import { KeyCard, SignInCard } from "./ConnectCard.tsx";
import { DepartmentPresets } from "./DepartmentPresets.tsx";
import { MailAccounts } from "./MailAccounts.tsx";
import { Banner, Button, Confirm, toast } from "./ui.tsx";

const APPROVAL: Record<NonNullable<Connector["approval"]>, string> = {
  destructive: "Ask me before anything destructive",
  writes: "Ask me before any change",
  none: "Don't ask",
};

export function ConnectorsSettings(p: {
  mailAccess: Record<string, string>;
  onMailAccess: (a: Record<string, string>) => void;
}) {
  const [list, setList] = useState<Connector[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Connector | null>(null);
  const [presetLinks, setPresetLinks] = useState<PresetConnector[]>([]);
  const load = () =>
    listConnectors().then(
      (r) => {
        setList(r.connectors);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  useEffect(() => {
    void load();
  }, []);
  const put = (c: Connector) => setList((xs) => xs?.map((x) => (x.id === c.id ? c : x)) ?? null);
  const change = async (c: Connector, patch: Parameters<typeof editConnector>[1]) => {
    put({ ...c, ...patch }); // shown at once
    try {
      put((await editConnector(c.id, patch)).connector);
    } catch (e) {
      put(c);
      toast({ text: e instanceof ApiError ? e.message : "Not saved.", tone: "bad" });
    }
  };
  // A connector a department's switch stands for signs in there (Settings → Departments), not a second time here.
  const inPreset = (c: Connector) => presetLinks.some((x) => matchesPreset(x, c.url));
  return (
    <div className="connectors">
      <DepartmentPresets connectors={list} reload={load} onRemove={setRemoving} onPresets={setPresetLinks} />
      <h2>Connectors</h2>
      <p className="mute">
        Outside services your agents can use. Ask AIC to add any one ("add Higgsfield as an MCP"). Keys go straight to
        AWS and are never shown again or typed in the chat.
      </p>
      {error ? <Banner tone="info">{`Connectors: ${error}`}</Banner> : null}
      {list && !list.length ? <p className="mute">No connectors yet.</p> : null}
      {list?.map((c) => {
        const st = connectorStatus(c);
        return (
          <article key={c.id} className="card" aria-label={`Connector ${c.label ?? c.id}`}>
            <p>
              <b>{c.label ?? c.id}</b>{" "}
              <span className="mute">{c.package ? `${c.package.name}@${c.package.version}` : c.url}</span>
            </p>
            <p className={`status status-${st.tone}`}>{st.text}</p>
            {(c.status === "needs_login" || c.status === "login_expired") && !inPreset(c) ? (
              <SignInCard
                kind="connector"
                id={c.id}
                title={`Sign in to ${c.label ?? c.id}`}
                signinPath={`/connectors/${c.id}/login`}
                completePath={`/connectors/${c.id}/login/complete`}
                status="pending"
                tokenInstead={githubSignIn(c) ? c.id : undefined}
              />
            ) : null}
            {c.status === "needs_key" && !inPreset(c) ? (
              <KeyCard
                targetId={c.id}
                title={`Add the key for ${c.label ?? c.id}`}
                needs={c.needs}
                names={c.package?.secrets?.map((s) => s.name)}
                onDone={() => void load()}
              />
            ) : null}
            <fieldset className="roles">
              <legend>Who may use it</legend>
              {ROLES.map((r: Role) => (
                <label key={r} className="field inline">
                  {ROLE_LABEL[r]}
                  <select
                    value={c.roles?.[r] ?? "none"}
                    onChange={(e) => {
                      const roles = { ...(c.roles ?? {}) };
                      if (e.target.value === "none") delete roles[r];
                      else roles[r] = e.target.value as "read" | "all";
                      void change(c, { roles });
                    }}
                  >
                    <option value="none">No</option>
                    <option value="read">Read only</option>
                    <option value="all">Everything</option>
                  </select>
                </label>
              ))}
            </fieldset>
            <label className="field">
              Approvals
              <select
                value={c.approval ?? "destructive"}
                onChange={(e) => void change(c, { approval: e.target.value as Connector["approval"] })}
              >
                {Object.entries(APPROVAL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="row-end">
              {c.status === "ready" ? (
                <Button
                  variant="quiet"
                  onClick={async () => {
                    await refreshConnector(c.id);
                    toast({ text: "Refreshing its tools.", tone: "info" });
                  }}
                >
                  Refresh tools
                </Button>
              ) : null}
              <Button variant="danger" onClick={() => setRemoving(c)}>
                Remove…
              </Button>
            </div>
          </article>
        );
      })}
      {url !== null ? (
        <div className="card">
          <label className="field">
            The server's https link (or an OpenAPI 3 link)
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" />
          </label>
          <div className="row-end">
            <Button variant="quiet" onClick={() => setUrl(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={!/^https:\/\//.test(url.trim())}
              onClick={async () => {
                try {
                  await addConnectorByUrl(url.trim());
                  setUrl(null);
                  await load();
                } catch (e) {
                  toast({ text: e instanceof ApiError ? e.message : "Not added.", tone: "bad" });
                }
              }}
            >
              Add connector
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setUrl("")}>
          Add by link
        </Button>
      )}
      <MailAccounts access={p.mailAccess} onAccess={p.onMailAccess} />
      {removing ? (
        <Confirm
          title={`Remove ${removing.label ?? removing.id}?`}
          what="Its tools stop working for every agent, and its sign-in or key is deleted from AWS. You can add it again later."
          cost="Cost: nothing."
          confirmLabel="Remove connector"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await removeConnector(removing.id);
            setRemoving(null);
            setList((xs) => xs?.filter((x) => x.id !== removing.id) ?? null);
            toast({ text: "Removed.", tone: "good" });
          }}
        />
      ) : null}
    </div>
  );
}
