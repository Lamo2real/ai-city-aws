// Settings → Departments (decision 113): the pre-configured departments (IT, Marketing), what they do, the skills
// that ship with them, and one switch per connector they use. On: the connector is added (POST /connectors) and,
// when the service needs it, its sign-in or key card appears right here. Off: asks, then removes it.
import { useEffect, useState } from "react";
import { ApiError } from "../lib/api.ts";
import {
  addConnectorByUrl,
  connectorStatus,
  listPresets,
  sameServer,
  type Connector,
  type DepartmentPreset,
} from "../lib/connect.ts";
import { KeyCard, SignInCard } from "./ConnectCard.tsx";
import { Banner, toast } from "./ui.tsx";

export function DepartmentPresets(p: {
  connectors: Connector[] | null;
  reload: () => Promise<unknown>;
  onRemove: (c: Connector) => void;
  /** The server links the switches stand for, so the Connectors list below can leave them out. */
  onUrls?: (urls: string[]) => void;
}) {
  const [presets, setPresets] = useState<DepartmentPreset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    listPresets().then(
      (r) => {
        setPresets(r.departments);
        p.onUrls?.(r.departments.flatMap((d) => d.connectors.map((c) => c.url)));
      },
      (e: Error) => setError(e.message),
    );
  }, []);
  if (error) return <Banner tone="info">{`Departments: ${error}`}</Banner>;
  if (!presets) return null;

  const turnOn = async (url: string, label: string) => {
    setBusy(url);
    try {
      await addConnectorByUrl(url, label);
      await p.reload();
      toast({ text: `${label} is being connected. Sign in when it asks.`, tone: "info" });
    } catch (e) {
      toast({ text: e instanceof ApiError ? e.message : `${label} could not be added.`, tone: "bad" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="presets" aria-labelledby="presets-title">
      <h2 id="presets-title">Departments</h2>
      <p className="mute">
        Ready-made teams the city staffs when you ask for that kind of work. Switch on the services each may use; a
        service that needs your account asks you to sign in right here.
      </p>
      {presets.map((d) => (
        <article key={d.key} className="card preset" aria-label={`${d.name} department`}>
          <h3>{d.name}</h3>
          <p>{d.mission}</p>
          <p className="mute preset-teams">
            <b>Teams:</b> {d.teams.map((t) => t.name).join(" · ")}
          </p>
          <details className="preset-skills">
            <summary>{`${d.skills.length} skills built in`}</summary>
            <ul>
              {d.skills.map((s) => (
                <li key={s.name}>
                  <b>{s.name}</b> <span className="mute">{s.description}</span>
                </li>
              ))}
            </ul>
          </details>
          <ul className="preset-connectors" aria-label={`${d.name} connectors`}>
            {d.connectors.map((c) => {
              const on = p.connectors?.find((x) => sameServer(x.url, c.url));
              const st = on ? connectorStatus(on) : null;
              return (
                <li key={c.id} className="preset-row">
                  <label className="switch toggle">
                    <input
                      type="checkbox"
                      checked={!!on}
                      disabled={busy === c.url || on?.status === "removing" || p.connectors === null}
                      onChange={() => (on ? p.onRemove(on) : void turnOn(c.url, c.label))}
                      aria-describedby={`what-${d.key}-${c.id}`}
                    />
                    <span className="toggle-track" aria-hidden="true">
                      <span className="toggle-knob" />
                    </span>
                    {c.label}
                  </label>
                  <span id={`what-${d.key}-${c.id}`} className="mute preset-what">
                    {c.what}
                  </span>
                  {st ? <span className={`status status-${st.tone}`}>{st.text}</span> : null}
                  {on && (on.status === "needs_login" || on.status === "login_expired") ? (
                    <SignInCard
                      kind="connector"
                      id={on.id}
                      title={`Sign in to ${on.label ?? c.label}`}
                      signinPath={`/connectors/${on.id}/login`}
                      completePath={`/connectors/${on.id}/login/complete`}
                      status="pending"
                    />
                  ) : null}
                  {on?.status === "needs_key" ? (
                    <KeyCard
                      targetId={on.id}
                      title={`Add the key for ${on.label ?? c.label}`}
                      needs={on.needs}
                      names={on.package?.secrets?.map((s) => s.name)}
                      onDone={() => void p.reload()}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </section>
  );
}
