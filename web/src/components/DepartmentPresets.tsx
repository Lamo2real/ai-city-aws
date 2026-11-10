// Settings → Departments (decisions 113, 114): the setup guide, the tools every department shares, then the nine
// pre-configured departments with their teams, skills and one switch per connector. On: the connector is added
// (POST /connectors) and, when the service needs it, its sign-in or key card appears in that row. Off: asks, then
// removes it. "Essential" marks what most businesses in that field use; the guide counts those.
import { useEffect, useState } from "react";
import { ApiError } from "../lib/api.ts";
import {
  addConnectorByUrl,
  connectorStatus,
  fillUrl,
  listPresets,
  matchesPreset,
  type Connector,
  type DepartmentPreset,
  type PresetConnector,
  type Presets,
} from "../lib/connect.ts";
import { KeyCard, SignInCard } from "./ConnectCard.tsx";
import { Banner, toast } from "./ui.tsx";

type Group = Pick<DepartmentPreset, "name" | "mission" | "skills" | "connectors"> & {
  key: string;
  teams?: DepartmentPreset["teams"];
};

/** Every tool the switches stand for (patterns included), so the Connectors list can tell them apart. */
export const presetLinks = (p: Presets): PresetConnector[] => [
  ...p.shared.connectors,
  ...p.departments.flatMap((d) => d.connectors),
];

export function DepartmentPresets(p: {
  connectors: Connector[] | null;
  reload: () => Promise<unknown>;
  onRemove: (c: Connector) => void;
  onPresets?: (links: PresetConnector[]) => void;
}) {
  const [presets, setPresets] = useState<Presets | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listPresets().then(
      (r) => {
        setPresets(r);
        p.onPresets?.(presetLinks(r));
      },
      (e: Error) => setError(e.message),
    );
  }, []);
  if (error) return <Banner tone="info">{`Departments: ${error}`}</Banner>;
  if (!presets) return null;

  const find = (c: PresetConnector) => p.connectors?.find((x) => matchesPreset(c, x.url));
  const ready = (c: PresetConnector) => find(c)?.status === "ready";
  const groups: Group[] = [{ ...presets.shared, key: "shared" }, ...presets.departments];
  const essentials = [
    ...new Map(groups.flatMap((g) => g.connectors.filter((c) => c.essential)).map((c) => [c.id, c])).values(),
  ];

  return (
    <section className="presets" aria-labelledby="presets-title">
      <h2 id="presets-title">Departments</h2>
      <p className="mute">
        Ready-made teams the city staffs when you ask for that kind of work, each with its own skills and tools. Switch
        a tool on and sign in once; every agent in that department can then use it.
      </p>
      <SetupGuide groups={groups} ready={ready} done={essentials.filter(ready).length} total={essentials.length} />
      {groups.map((g) => (
        <GroupCard key={g.key} g={g} find={find} ready={ready} reload={p.reload} onRemove={p.onRemove} />
      ))}
    </section>
  );
}

function SetupGuide(p: { groups: Group[]; ready: (c: PresetConnector) => boolean; done: number; total: number }) {
  const count = (g: Group) => {
    const e = g.connectors.filter((c) => c.essential);
    return `${e.filter(p.ready).length} of ${e.length}`;
  };
  const shared = p.groups[0]!;
  return (
    <details className="card setup-guide" open={p.done < p.total}>
      <summary>
        <b>Setup guide</b> <span className="mute">{`${p.done} of ${p.total} essential tools connected`}</span>
      </summary>
      <ol className="steps">
        <li>
          <b>Teach the city your business.</b> Put your brand guide, logo, prices, policies (refunds, privacy), product
          documents and templates in <a href="#/knowledge">Knowledge</a>. Every department reads it before it writes,
          designs or decides.
        </li>
        <li>
          <b>Connect the shared tools</b> ({count(shared)} connected): one Stripe account for everything you sell,
          however many products; Jira & Confluence for tickets and the wiki; Slack; Notion.
        </li>
        <li>
          <b>Connect each department’s essential tools.</b> For each one: no account yet? Tap <i>Create an account</i>,
          sign up on their site and come back. Then switch it on and tap <i>Sign in</i>.
          <ul className="guide-counts">
            {p.groups.slice(1).map((g) => (
              <li key={g.key}>{`${g.name}: ${count(g)} connected`}</li>
            ))}
          </ul>
        </li>
        <li>
          <b>Give IT your GitHub.</b> In Settings → Connectors → <a href="#/settings/github">GitHub</a>, paste a classic
          token so the city can create repositories, push code and manage secrets.
        </li>
        <li>
          <b>Optional: VAIC’s voice.</b> In Settings → <a href="#/settings/voice">VAIC’s voice</a>, paste an OpenAI key
          for the most natural voice.
        </li>
        <li>
          <b>Ask VAIC for work.</b> “Make a launch campaign for my new product”, or “build a landing page that sells it
          with Stripe”. The right department picks it up.
        </li>
      </ol>
    </details>
  );
}

function GroupCard(p: {
  g: Group;
  find: (c: PresetConnector) => Connector | undefined;
  ready: (c: PresetConnector) => boolean;
  reload: () => Promise<unknown>;
  onRemove: (c: Connector) => void;
}) {
  const { g } = p;
  const essential = g.connectors.filter((c) => c.essential);
  const more = g.connectors.filter((c) => !c.essential);
  const list = (items: PresetConnector[], label: string) => (
    <ul className="preset-connectors" aria-label={`${g.name} ${label}`}>
      {items.map((c) => (
        <Row key={c.id} c={c} group={g.key} find={p.find} reload={p.reload} onRemove={p.onRemove} />
      ))}
    </ul>
  );
  return (
    <details className="card preset" aria-label={`${g.name} department`}>
      <summary>
        <h3>{g.name}</h3>
        <span className="mute">{`${essential.filter(p.ready).length} of ${essential.length} essentials connected`}</span>
      </summary>
      <p>{g.mission}</p>
      {g.teams?.length ? (
        <p className="mute preset-teams">
          <b>Teams:</b> {g.teams.map((t) => t.name).join(" · ")}
        </p>
      ) : null}
      <details className="preset-skills">
        <summary>{`${g.skills.length} skills built in`}</summary>
        <ul>
          {g.skills.map((s) => (
            <li key={s.name}>
              <b>{s.name}</b> <span className="mute">{s.description}</span>
            </li>
          ))}
        </ul>
      </details>
      <h4 className="preset-sub">Essential tools</h4>
      {list(essential, "essential tools")}
      {more.length ? (
        <>
          <h4 className="preset-sub">More tools</h4>
          {list(more, "more tools")}
        </>
      ) : null}
    </details>
  );
}

function Row(p: {
  c: PresetConnector;
  group: string;
  find: (c: PresetConnector) => Connector | undefined;
  reload: () => Promise<unknown>;
  onRemove: (c: Connector) => void;
}) {
  const { c } = p;
  const on = p.find(c);
  const st = on ? connectorStatus(on) : null;
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const answerOk = !c.ask || new RegExp(c.ask.pattern).test(answer.trim().toLowerCase());
  const turnOn = async () => {
    if (!answerOk) return;
    setBusy(true);
    try {
      await addConnectorByUrl(fillUrl(c, answer), c.label);
      await p.reload();
      toast({ text: `${c.label} is being connected. Sign in when it asks.`, tone: "info" });
    } catch (e) {
      toast({ text: e instanceof ApiError ? e.message : `${c.label} could not be added.`, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };
  const id = `what-${p.group}-${c.id}`;
  return (
    <li className="preset-row">
      <label className="switch toggle">
        <input
          type="checkbox"
          checked={!!on}
          disabled={busy || on?.status === "removing" || (!on && !answerOk)}
          onChange={() => (on ? p.onRemove(on) : void turnOn())}
          aria-describedby={id}
        />
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-knob" />
        </span>
        {c.label}
      </label>
      <span id={id} className="mute preset-what">
        {c.what}
      </span>
      <span className="preset-state">
        {st ? (
          <span className={`status status-${st.tone}`}>{st.text}</span>
        ) : c.signup ? (
          <a href={c.signup} target="_blank" rel="noopener noreferrer" aria-label={`Create a ${c.label} account`}>
            Create an account
          </a>
        ) : (
          <span className="mute">No account needed</span>
        )}
      </span>
      {!on && c.ask ? (
        <label className="field preset-ask">
          {c.ask.label}
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="my-store"
          />
        </label>
      ) : null}
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
}
