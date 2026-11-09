// Settings → Connectors (decision 129): the business's departments and the tools each one works with. Connected
// is a table of every tool in use (logo, type, which departments use it, status; a row opens its settings) and, per
// department, what it knows how to do (its skills). Browse is the catalog (config/departments.json via
// GET /departments/presets), department by department: connecting is one click on the same POST /connectors the
// department switches use, and sign-in or the key appear on the card. Keys go only into the secure fields of
// ConnectCard.tsx, straight to AWS.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  builtInSkills,
  catalogFor,
  catalogOf,
  connectedAs,
  connectorType,
  kitProgress,
  kitsOf,
  logoSrc,
  matches,
  rowStatus,
  settling,
  skillMarkdown,
  type CatalogItem,
  type Kit,
} from "../lib/catalog.ts";
import {
  addConnectorByUrl,
  checkSkill,
  editConnector,
  editSkill,
  fillUrl,
  githubSignIn,
  listConnectors,
  listMailAccounts,
  listPresets,
  listSkills,
  PROVIDER_LABEL,
  refreshConnector,
  removeConnector,
  removeSkill,
  ROLE_LABEL,
  ROLES,
  uploadSkill,
  type Connector,
  type MailAccount,
  type PresetConnector,
  type Presets,
  type Role,
  type Skill,
} from "../lib/connect.ts";
import { KeyCard, SignInCard } from "./ConnectCard.tsx";
import { loadGitHub, type GitHubStatus } from "./GitHubSettings.tsx";
import { AddMailAccount, MailAccountCard, MailSettings } from "./MailAccounts.tsx";
import { AddSkill, RolePicker } from "./SkillsScreen.tsx";
import { Banner, Button, Confirm, errorText, LiveDot, PlusIcon, toast } from "./ui.tsx";
import { Select } from "./Select.tsx";

const ALL = "All departments";
type View = "connected" | "browse";
const APPROVAL: Record<NonNullable<Connector["approval"]>, string> = {
  destructive: "Ask me before anything destructive",
  writes: "Ask me before any change",
  none: "Don't ask",
};
const MAIL_STATUS: Record<MailAccount["status"], string> = {
  connected: "Connected",
  signing_in: "Sign in",
  needs_sign_in: "Sign in again",
  error: "Problem",
  removed: "Removed",
};
type Adding = "link" | "mail" | "skill-upload" | "skill-write";

// ---------- small pieces ----------
/** The service's logo on a light tile, or its first letter when there is no logo. */
export function Logo(p: { id?: string; label: string; size?: number }) {
  const src = logoSrc(p.id);
  const size = p.size ?? 32;
  let h = 0;
  for (const ch of p.label) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="hub-logo" style={{ width: size, height: size }} aria-hidden="true">
      {src ? (
        <img src={src} alt="" width={size - 10} height={size - 10} loading="lazy" decoding="async" />
      ) : (
        <span className="hub-mono" style={{ background: `hsl(${h} 45% 38%)` }}>
          {p.label.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </span>
  );
}

interface Row {
  key: string;
  name: string;
  sub?: string;
  logo?: string;
  type: string;
  badge?: string;
  /** The departments that work with it. */
  teams?: string;
  status: { text: string; tone: string; ok: boolean };
  detail: ReactNode;
}

/** Connected: name with logo, type with a badge, who uses it, status. A row's name opens its settings underneath. */
function Table(p: { rows: Row[]; label: string; open: string | null; onOpen: (k: string | null) => void }) {
  const teams = p.rows.some((r) => r.teams);
  return (
    <table className="hub-table" aria-label={p.label}>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Type</th>
          {teams ? <th scope="col">Used by</th> : null}
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {p.rows.map((r) => {
          const isOpen = p.open === r.key;
          const toggle = () => p.onOpen(isOpen ? null : r.key);
          const id = `hub-d-${r.key.replace(/[^a-z0-9-]/gi, "-")}`;
          return (
            <Fragment key={r.key}>
              <tr className={`hub-row${isOpen ? " open" : ""}`}>
                <td>
                  <button
                    type="button"
                    className="hub-name"
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? id : undefined}
                    onClick={toggle}
                  >
                    <Logo id={r.logo} label={r.name} />
                    <span className="hub-name-text">
                      <b>{r.name}</b>
                      {r.sub ? <span className="mute">{r.sub}</span> : null}
                    </span>
                  </button>
                </td>
                <td className="hub-type">
                  {r.type}
                  {r.badge ? <span className="hub-badge">{r.badge}</span> : null}
                </td>
                {teams ? <td className="hub-teams">{r.teams}</td> : null}
                <td>
                  {r.status.ok ? (
                    <span className="hub-status status-good">
                      <LiveDot label="Live" /> {r.status.text}
                    </span>
                  ) : (
                    <button type="button" className={`hub-status link status-${r.status.tone}`} onClick={toggle}>
                      {r.status.text}
                    </button>
                  )}
                </td>
              </tr>
              {isOpen ? (
                <tr className="hub-detail">
                  <td colSpan={teams ? 4 : 3} id={id}>
                    {r.detail}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------- the page ----------
export function ConnectorsHub(p: {
  mailAccess: Record<string, string>;
  onMailAccess: (a: Record<string, string>) => void;
}) {
  const [view, setView] = useState<View>("connected");
  const [dept, setDept] = useState(ALL);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState<Adding | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Connector | null>(null);
  const [deleting, setDeleting] = useState<Skill | null>(null);

  const [connectors, setConnectors] = useState<Connector[] | null>(null);
  const [mail, setMail] = useState<MailAccount[] | null>(null);
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [presets, setPresets] = useState<Presets | null>(null);
  const [github, setGithub] = useState<GitHubStatus | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fail = (what: string) => (e: Error) => setErrors((x) => ({ ...x, [what]: e.message }));
  const ok = (what: string) => setErrors(({ [what]: _, ...x }) => x);

  const loadConnectors = () =>
    listConnectors().then((r) => {
      setConnectors(r.connectors);
      ok("Tools");
    }, fail("Tools"));
  const loadMail = () =>
    listMailAccounts().then((r) => {
      setMail(r.accounts);
      ok("Mail and calendar");
    }, fail("Mail and calendar"));
  const loadSkills = () =>
    listSkills().then((r) => {
      setSkills(r.skills);
      ok("Skills");
    }, fail("Skills"));
  useEffect(() => {
    void loadConnectors();
    void loadMail();
    void loadSkills();
    listPresets().then(setPresets, fail("Departments"));
    loadGitHub().then(setGithub, () => undefined);
  }, []);
  // Back from a service's own page (signing up or in): look again at once, so it shows connected (decision 141).
  useEffect(() => {
    const again = () => {
      if (document.visibilityState !== "visible") return;
      void loadConnectors();
      void loadMail();
      loadGitHub().then(setGithub, () => undefined);
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, []);
  // A tool that is being set up or removed changes by itself in a few seconds: look again until it settles.
  useEffect(() => {
    if (!connectors?.some(settling)) return;
    const t = setTimeout(() => void loadConnectors(), 2500);
    return () => clearTimeout(t);
  }, [connectors]);

  const catalog = useMemo(() => (presets ? catalogOf(presets) : []), [presets]);
  const kits = useMemo(() => (presets ? kitsOf(presets) : []), [presets]);
  const builtIns = useMemo(() => (presets ? builtInSkills(presets) : []), [presets]);
  const kit = kits.find((k) => k.name === dept);

  const put = (c: Connector) => setConnectors((xs) => xs?.map((x) => (x.id === c.id ? c : x)) ?? null);
  const change = async (c: Connector, patch: Parameters<typeof editConnector>[1]) => {
    put({ ...c, ...patch }); // shown at once
    try {
      put((await editConnector(c.id, patch)).connector);
    } catch (e) {
      put(c);
      toast({ text: errorText(e, "Not saved."), tone: "bad" });
    }
  };
  const changeSkill = async (s: Skill, patch: { roles?: Role[]; enabled?: boolean }) => {
    setSkills((xs) => xs?.map((x) => (x.name === s.name ? { ...x, ...patch } : x)) ?? null);
    try {
      const r = await editSkill(s.name, patch);
      setSkills((xs) => xs?.map((x) => (x.name === s.name ? r.skill : x)) ?? null);
    } catch (e) {
      setSkills((xs) => xs?.map((x) => (x.name === s.name ? s : x)) ?? null);
      toast({ text: errorText(e, "Not saved. Try again."), tone: "bad" });
    }
  };
  /** One click from the catalog: the same add as Settings → Departments; sign-in or the key then show on the card. */
  const connect = async (c: PresetConnector, answer = "") => {
    try {
      await addConnectorByUrl(fillUrl(c, answer), c.label);
      await loadConnectors();
      toast({ text: `${c.label} is being connected. Sign in when it asks.`, tone: "info" });
    } catch (e) {
      toast({ text: errorText(e, `${c.label} could not be added.`), tone: "bad" });
    }
  };
  const show = (v: View) => {
    setView(v);
    setOpen(null);
  };

  // ---------- Connected ----------
  const forDept = (teams: string[]) => dept === ALL || teams.includes(dept) || teams.includes("Every department");
  const toolRows: Row[] = [
    ...(connectors ?? []).map((c): Row & { groups: string[] } => {
      const cat = catalogFor(c, catalog);
      const groups = cat?.groups ?? ["Every department"];
      return {
        key: `c:${c.id}`,
        name: c.label ?? c.id,
        sub: c.package ? `${c.package.name}@${c.package.version}` : cat?.what,
        logo: cat?.id,
        type: connectorType(c),
        badge: cat ? undefined : "Your own",
        teams: groups.join(", "),
        groups,
        status: rowStatus(c),
        detail: (
          <ConnectorDetail
            c={c}
            onChange={(patch) => change(c, patch)}
            onRemove={() => setRemoving(c)}
            reload={loadConnectors}
            signup={cat?.signup}
          />
        ),
      };
    }),
    ...(mail ?? []).map((a): Row & { groups: string[] } => ({
      key: `m:${a.id}`,
      name: a.label,
      sub: a.address || PROVIDER_LABEL[a.provider],
      logo: a.provider === "google" ? "gmail" : a.provider === "microsoft" ? "microsoft" : undefined,
      type: "Mail & calendar",
      teams: "VAIC",
      groups: [],
      status: {
        text: a.status === "error" && a.error ? `Problem: ${a.error}` : MAIL_STATUS[a.status],
        tone: a.status === "error" ? "bad" : "warn",
        ok: a.status === "connected",
      },
      detail: (
        <MailAccountCard
          a={a}
          onChange={(n) =>
            setMail((xs) => (n ? xs?.map((x) => (x.id === a.id ? n : x)) : xs?.filter((x) => x.id !== a.id)) ?? null)
          }
        />
      ),
    })),
    ...(github
      ? [
          {
            key: "github-token",
            name: "GitHub",
            sub: github.login ? `The city's token, as ${github.login}` : "Repositories and code for the whole city",
            logo: "github-token",
            type: "Code",
            badge: "Built-in",
            teams: "Application, IT Infrastructure",
            groups: ["Application", "IT Infrastructure"],
            status: github.configured
              ? { text: github.error ? "Check the token" : "Connected", tone: "warn", ok: !github.error }
              : { text: "Add a token", tone: "warn", ok: false },
            detail: (
              <p>
                One token for the whole city, kept in AWS. Change it in{" "}
                <a href="#/settings/github">Settings → GitHub</a>.
              </p>
            ),
          },
        ]
      : []),
  ]
    .filter((r) => (dept === ALL ? true : r.groups.length > 0 && forDept(r.groups)))
    .filter((r) => matches(q, r.name, r.sub, r.type, r.badge, r.teams));

  const skillRows: Row[] = (skills ?? [])
    .map((s): Row => ({
      key: `s:${s.name}`,
      name: s.name,
      sub: s.description,
      type: "Skill",
      badge: "Your own",
      status: s.enabled ? { text: "On", tone: "good", ok: true } : { text: "Off", tone: "info", ok: false },
      detail: (
        <SkillDetail
          s={s}
          onChange={(patch) => changeSkill(s, patch)}
          onReplace={() => {
            setReplacing(s.name);
            setAdding("skill-upload");
          }}
          onDelete={() => setDeleting(s)}
        />
      ),
    }))
    .filter((r) => matches(q, r.name, r.sub));
  const deptSkills = (kit?.skills ?? []).filter((s) => matches(q, s.name, s.description));
  const missing = kit
    ? kit.connectors.filter((c) => c.essential && !connectedAs(c, connectors) && matches(q, c.label, c.what))
    : [];

  // ---------- Browse ----------
  const shownKits = (kit ? [kit] : kits)
    .map((k) => ({
      k,
      tools: k.connectors
        .filter((c) => matches(q, c.label, c.what, c.id, ...(c.aka ?? []), k.name))
        .sort((a, b) => Number(b.essential) - Number(a.essential)),
    }))
    .filter((x) => x.tools.length || (!q && x.k === kit));

  const empty = (text: string, action?: ReactNode) => (
    <div className="hub-empty">
      <p className="mute">{text}</p>
      {action}
    </div>
  );
  const browse = (label: string) => (
    <Button variant="secondary" onClick={() => show("browse")}>
      {label}
    </Button>
  );
  const skillList = (list: Array<{ name: string; description: string }>) => (
    <ul className="hub-skill-list">
      {list.map((s) => (
        <li key={s.name}>
          <b>{s.name}</b> <span className="mute">{s.description}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="hub">
      <p className="mute hub-lede">
        The tools each department works with, and what it knows how to do. Connect a tool once and every team that uses
        it can work with it. Passwords and keys go straight to AWS and are never shown again or typed in the chat.
      </p>
      <div className="hub-top">
        <div className="hub-switch" role="group" aria-label="Show">
          <button type="button" aria-pressed={view === "connected"} onClick={() => show("connected")}>
            Connected
          </button>
          <button type="button" aria-pressed={view === "browse"} onClick={() => show("browse")}>
            Browse
          </button>
        </div>
        <label className="hub-search">
          <span className="sr">Search tools and skills</span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </label>
        <AddMenu
          onPick={(a) => {
            setReplacing(null);
            setAdding(a);
          }}
        />
      </div>
      {presets ? (
        <div className="hub-chips" role="group" aria-label="Department">
          {[ALL, ...kits.map((k) => k.name)].map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={dept === g}
              onClick={() => {
                setDept(g);
                setOpen(null);
              }}
            >
              {g}
            </button>
          ))}
        </div>
      ) : null}

      {Object.entries(errors).map(([k, v]) => (
        <Banner key={k} tone="info">{`${k}: ${v}`}</Banner>
      ))}

      {adding === "link" ? <AddByLink onDone={() => setAdding(null)} reload={loadConnectors} /> : null}
      {adding === "mail" ? (
        <AddMailAccount
          onCancel={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            show("connected");
            void loadMail();
          }}
        />
      ) : null}
      {adding === "skill-upload" ? (
        <AddSkill
          replacing={replacing ?? undefined}
          onCancel={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            show("connected");
            void loadSkills();
          }}
        />
      ) : null}
      {adding === "skill-write" ? (
        <WriteSkill
          onCancel={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            show("connected");
            void loadSkills();
          }}
        />
      ) : null}

      {view === "connected" ? (
        <>
          {kit ? (
            <p className="hub-mission">
              <b>{kit.name}.</b> <span className="mute">{kit.mission}</span>
            </p>
          ) : null}
          {connectors === null && mail === null ? <p className="mute">Loading…</p> : null}
          {toolRows.length ? <Table rows={toolRows} label="Connected tools" open={open} onOpen={setOpen} /> : null}
          {connectors !== null && !q && !toolRows.some((r) => r.key.startsWith("c:"))
            ? empty(
                kit
                  ? `${kit.name} has no tools connected yet.`
                  : "No tools connected yet. Browse the tools each department uses and connect one in one click, or add your own with + Add.",
                browse(kit ? `Browse ${kit.name} tools` : "Browse tools"),
              )
            : null}
          {q && !toolRows.length
            ? empty(`Nothing connected matches "${q}".`, browse("Search the catalog instead"))
            : null}
          {missing.length ? (
            <section className="hub-section" aria-labelledby="hub-missing">
              <h3 id="hub-missing">{`What ${kit!.name} still needs`}</h3>
              <ul className="hub-grid" aria-label={`${kit!.name} essentials not connected`}>
                {missing.map((c) => (
                  <CatalogCard key={c.id} c={c} on={undefined} onConnect={connect} reload={loadConnectors} />
                ))}
              </ul>
            </section>
          ) : null}
          <section className="hub-section" aria-labelledby="hub-skills">
            <h3 id="hub-skills">{kit ? `What ${kit.name} knows how to do` : "What your teams know how to do"}</h3>
            {kit && deptSkills.length ? skillList(deptSkills) : null}
            {skillRows.length ? (
              <Table rows={skillRows} label="Your skills" open={open} onOpen={setOpen} />
            ) : skills !== null && !q ? (
              <p className="mute">
                {"Skills of your own (your way of writing a report, your brand's voice) teach every team. "}
                <button type="button" className="link" onClick={() => setAdding("skill-write")}>
                  Write a skill
                </button>
              </p>
            ) : null}
            {!kit && builtIns.length ? (
              <p className="mute hub-note">{`Plus ${builtIns.length} skills built into the departments: pick a department to see its own.`}</p>
            ) : null}
          </section>
          {dept === ALL && !q && mail !== null ? (
            <section className="hub-section" aria-labelledby="hub-mail">
              <h3 id="hub-mail">Mail &amp; calendar</h3>
              {!mail.length ? (
                <p className="mute">
                  No mailboxes or calendars yet. Ask VAIC ("connect my work Outlook"), or use + Add → Mailbox or
                  calendar.
                </p>
              ) : null}
              <MailSettings accounts={mail} access={p.mailAccess} onAccess={p.onMailAccess} />
            </section>
          ) : null}
        </>
      ) : (
        <>
          {!presets && !errors.Departments ? <p className="mute">Loading the departments…</p> : null}
          {shownKits.map(({ k, tools }) => (
            <section key={k.key} className="hub-dept" aria-label={`${k.name} tools`}>
              <DeptHead k={k} connectors={connectors} onConnect={connect} />
              <ul className="hub-grid" aria-label={`${k.name} catalog`}>
                {tools.map((c) => (
                  <CatalogCard
                    key={c.id}
                    c={c}
                    on={connectedAs(c, connectors)}
                    onConnect={connect}
                    reload={loadConnectors}
                  />
                ))}
              </ul>
              {kit && k.skills.length ? (
                <details className="hub-knows">
                  <summary>{`What ${k.name} knows how to do (${k.skills.length} skills, included)`}</summary>
                  {skillList(k.skills)}
                </details>
              ) : null}
            </section>
          ))}
          {presets && !shownKits.length ? empty(`No tool in the catalog matches "${q}".`) : null}
          <div className="card hub-own">
            <p>
              <b>Don't see yours?</b> Ask VAIC in plain words ("I need my Zendesk"): it finds the right one and helps you
              sign in. Or add any tool by its link.
            </p>
            <Button variant="secondary" onClick={() => setAdding("link")}>
              Add by link
            </Button>
          </div>
        </>
      )}

      {removing ? (
        <Confirm
          title={`Remove ${removing.label ?? removing.id}?`}
          what="Its tools stop working for every agent, and its sign-in or key is deleted from AWS. You can add it again later."
          cost="Cost: nothing."
          confirmLabel="Remove tool"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await removeConnector(removing.id);
            setRemoving(null);
            setOpen(null);
            setConnectors((xs) => xs?.filter((x) => x.id !== removing.id) ?? null);
            toast({ text: "Removed.", tone: "good" });
          }}
        />
      ) : null}
      {deleting ? (
        <Confirm
          title={`Delete the skill ${deleting.name}?`}
          what="It is removed for every agent at their next turn. This can't be undone; you can add it again from its files."
          cost="Cost: nothing."
          confirmLabel="Delete skill"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await removeSkill(deleting.name);
            setDeleting(null);
            setOpen(null);
            setSkills((xs) => xs?.filter((x) => x.name !== deleting.name) ?? null);
            toast({ text: `Skill ${deleting.name} deleted.`, tone: "good" });
          }}
        />
      ) : null}
    </div>
  );
}

/** A department's heading in Browse: its name, what it's for, how far it's set up, and one button for its essentials. */
function DeptHead(p: {
  k: Kit;
  connectors: Connector[] | null;
  onConnect: (c: PresetConnector, answer?: string) => Promise<void>;
}) {
  const { k } = p;
  const pr = kitProgress(k, p.connectors);
  const missing = k.connectors.filter((c) => c.essential && !c.ask && !connectedAs(c, p.connectors));
  return (
    <div className="hub-dept-head">
      <div>
        <h3>{k.name}</h3>
        <p className="mute">{k.mission}</p>
        {pr.total ? <p className="hub-progress">{`${pr.done} of ${pr.total} essential tools connected`}</p> : null}
      </div>
      {missing.length ? (
        <Button
          variant="secondary"
          onClick={async () => {
            for (const c of missing) await p.onConnect(c);
          }}
        >
          {`Connect the ${missing.length} essential${missing.length === 1 ? "" : "s"}`}
        </Button>
      ) : null}
    </div>
  );
}

// ---------- + Add ----------
function AddMenu(p: { onPick: (a: Adding) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const items: Array<{ key: Adding; label: string; hint: string }> = [
    { key: "link", label: "Tool by link", hint: "Its MCP server or OpenAPI 3 link" },
    { key: "mail", label: "Mailbox or calendar", hint: "Gmail, Outlook or any IMAP mailbox" },
    { key: "skill-write", label: "Write a skill", hint: "Teach every team how you want something done" },
    { key: "skill-upload", label: "Upload a skill", hint: "A folder or a SKILL.md" },
  ];
  return (
    <div className="hub-add" ref={box}>
      <button
        type="button"
        className="btn btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
      >
        <PlusIcon size={18} /> Add
      </button>
      {open ? (
        <div className="hub-menu" role="menu" aria-label="Add">
          {items.map((it, i) => (
            <button
              key={it.key}
              ref={i === 0 ? first : undefined}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                p.onPick(it.key);
              }}
            >
              <b>{it.label}</b>
              <span className="mute">{it.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AddByLink(p: { onDone: () => void; reload: () => Promise<unknown> }) {
  const [url, setUrl] = useState("");
  return (
    <div className="card" role="group" aria-label="Add a tool by its link">
      <h3>Add a tool by its link</h3>
      <label className="field">
        The server's https link (or an OpenAPI 3 link)
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://mcp.example.com/mcp"
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
        />
      </label>
      <div className="row-end">
        <Button variant="quiet" onClick={p.onDone}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          disabled={!/^https:\/\/\S+$/.test(url.trim())}
          onClick={async () => {
            try {
              await addConnectorByUrl(url.trim());
              await p.reload();
              toast({ text: "Added. Sign in or add its key on its row under Connected.", tone: "info" });
              p.onDone();
            } catch (e) {
              toast({ text: errorText(e, "Not added."), tone: "bad" });
            }
          }}
        >
          Add tool
        </Button>
      </div>
    </div>
  );
}

function WriteSkill(p: { onAdded: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [roles, setRoles] = useState<Role[]>([...ROLES]);
  const [problem, setProblem] = useState<string | null>(null);
  const bytes = new TextEncoder().encode(skillMarkdown(name, description, body));
  const touched = !!(name || description || body);
  const problems = touched ? checkSkill([{ path: "SKILL.md", bytes }]) : [];
  if (touched && !body.trim()) problems.push("Write the instructions the agents should follow.");
  if (touched && !roles.length) problems.push("Pick at least one role that may use it.");
  return (
    <article className="card" aria-labelledby="write-skill">
      <h3 id="write-skill">Write a skill</h3>
      <label className="field">
        Name (lowercase, dashes)
        <input
          value={name}
          onChange={(e) => setName(e.target.value.trim().toLowerCase())}
          placeholder="weekly-report"
        />
      </label>
      <label className="field">
        When to use it (one sentence)
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Use when writing the Friday report for the team"
        />
      </label>
      <label className="field">
        Instructions
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="1. Start with…" />
      </label>
      <RolePicker value={roles} onChange={setRoles} legend="Who may use it" />
      {problems.map((x) => (
        <p key={x} className="field-error" role="alert">
          {x}
        </p>
      ))}
      {problem ? <Banner tone="bad">{problem}</Banner> : null}
      <div className="row-end">
        <Button variant="quiet" onClick={p.onCancel}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          disabled={!touched || problems.length > 0}
          onClick={async () => {
            setProblem(null);
            try {
              const r = await uploadSkill([{ path: "SKILL.md", bytes }], roles);
              toast({ text: `Skill ${r.skill.name} saved. Agents can use it from their next turn.`, tone: "good" });
              p.onAdded();
            } catch (e) {
              setProblem(errorText(e, "Not saved. Try again."));
            }
          }}
        >
          Save skill
        </Button>
      </div>
    </article>
  );
}

// ---------- details ----------
function ConnectorDetail(p: {
  c: Connector;
  onChange: (patch: Parameters<typeof editConnector>[1]) => Promise<void>;
  onRemove: () => void;
  reload: () => Promise<unknown>;
  signup?: string;
}) {
  const { c } = p;
  return (
    <article className="hub-detail-body" aria-label={`Connector ${c.label ?? c.id}`}>
      <p className="mute hub-url">{c.package ? `${c.package.name}@${c.package.version}` : c.url}</p>
      {c.status === "ready" ? <p className="status status-good">{`On · ${c.tools?.length ?? 0} tools`}</p> : null}
      {c.status === "error" ? (
        <Banner tone="bad">{`It didn't connect: ${c.error ?? "no reason was given."}`}</Banner>
      ) : null}
      {c.status === "needs_login" || c.status === "login_expired" ? (
        <SignInCard
          kind="connector"
          id={c.id}
          title={`Sign in to ${c.label ?? c.id}`}
          signinPath={`/connectors/${c.id}/login`}
          completePath={`/connectors/${c.id}/login/complete`}
          status="pending"
          tokenInstead={githubSignIn(c) ? c.id : undefined}
          signup={p.signup}
        />
      ) : null}
      {c.status === "needs_key" ? (
        <KeyCard
          targetId={c.id}
          title={`Add the key for ${c.label ?? c.id}`}
          needs={c.needs}
          names={c.package?.secrets?.map((s) => s.name)}
          onDone={() => void p.reload()}
          signup={p.signup}
        />
      ) : null}
      <fieldset className="roles">
        <legend>Who may use it</legend>
        {ROLES.map((r: Role) => (
          <label key={r} className="field inline">
            {ROLE_LABEL[r]}
            <Select
              value={c.roles?.[r] ?? "none"}
              onChange={(e) => {
                const roles = { ...(c.roles ?? {}) };
                if (e.target.value === "none") delete roles[r];
                else roles[r] = e.target.value as "read" | "all";
                void p.onChange({ roles });
              }}
            >
              <option value="none">No</option>
              <option value="read">Read only</option>
              <option value="all">Everything</option>
            </Select>
          </label>
        ))}
      </fieldset>
      <label className="field">
        Approvals
        <Select
          value={c.approval ?? "destructive"}
          onChange={(e) => void p.onChange({ approval: e.target.value as Connector["approval"] })}
        >
          {Object.entries(APPROVAL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </label>
      <div className="row-end">
        {c.status === "ready" ? (
          <Button
            variant="quiet"
            onClick={async () => {
              await refreshConnector(c.id);
              toast({ text: "Refreshing its tools.", tone: "info" });
              await p.reload();
            }}
          >
            Refresh tools
          </Button>
        ) : null}
        <Button variant="danger" onClick={p.onRemove}>
          Remove…
        </Button>
      </div>
    </article>
  );
}

function SkillDetail(p: {
  s: Skill;
  onChange: (patch: { roles?: Role[]; enabled?: boolean }) => Promise<void>;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const { s } = p;
  return (
    <article className="hub-detail-body" aria-label={`Skill ${s.name}`}>
      <p>{s.description}</p>
      <p className="mute">
        {s.files.length} file{s.files.length === 1 ? "" : "s"} · updated {new Date(s.updated_at).toLocaleDateString()}
      </p>
      <label className="switch">
        <input type="checkbox" checked={s.enabled} onChange={(e) => void p.onChange({ enabled: e.target.checked })} />{" "}
        On
      </label>
      <RolePicker
        value={s.roles}
        legend="Who may use it"
        onChange={(roles) =>
          roles.length
            ? void p.onChange({ roles })
            : toast({ text: "Keep at least one role, or turn it off.", tone: "bad" })
        }
      />
      <div className="row-end">
        <Button variant="quiet" onClick={p.onReplace}>
          Replace…
        </Button>
        <Button variant="danger" onClick={p.onDelete}>
          Delete…
        </Button>
      </div>
    </article>
  );
}

/** One catalog service: logo, what it does, and Connect; once added, its status and any sign-in or key. */
function CatalogCard(p: {
  c: CatalogItem | PresetConnector;
  on: Connector | undefined;
  onConnect: (c: PresetConnector, answer?: string) => Promise<void>;
  reload: () => Promise<unknown>;
}) {
  const { c, on } = p;
  const [answer, setAnswer] = useState("");
  const answerOk = !c.ask || new RegExp(c.ask.pattern).test(answer.trim().toLowerCase());
  const st = on ? rowStatus(on) : null;
  return (
    <li className="hub-card" aria-label={c.label}>
      <div className="hub-card-head">
        <Logo id={c.id} label={c.label} />
        <div>
          <b>{c.label}</b>
          {c.essential ? <span className="hub-badge">Essential</span> : null}
          <p className="mute hub-what">{c.what}</p>
        </div>
      </div>
      {!on && c.setup === "own_app" ? (
        <p className="mute hub-setup">
          A few extra steps: it asks for an app you create on its site, or an access token. The card walks you through.
        </p>
      ) : null}
      {!on && c.ask ? (
        <label className="field">
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
      <div className="hub-card-foot">
        {st ? (
          st.ok ? (
            <span className="hub-status status-good">
              <LiveDot label="Live" /> Connected
            </span>
          ) : (
            <span className={`hub-status status-${st.tone}`}>{st.text}</span>
          )
        ) : (
          <>
            {c.signup ? (
              <a href={c.signup} target="_blank" rel="noopener noreferrer">
                {`Create a ${c.label.replace(/ \(.*\)$/, "")} account`}
              </a>
            ) : (
              <span />
            )}
            <Button
              variant="secondary"
              label={`Connect ${c.label}`}
              disabled={!answerOk}
              onClick={() => p.onConnect(c, answer)}
            >
              Connect
            </Button>
          </>
        )}
      </div>
      {on && (on.status === "needs_login" || on.status === "login_expired") ? (
        <SignInCard
          kind="connector"
          id={on.id}
          title={`Sign in to ${on.label ?? c.label}`}
          signinPath={`/connectors/${on.id}/login`}
          completePath={`/connectors/${on.id}/login/complete`}
          status="pending"
          tokenInstead={githubSignIn(on) ? on.id : undefined}
          signup={c.signup}
        />
      ) : null}
      {on?.status === "needs_key" ? (
        <KeyCard
          targetId={on.id}
          title={`Add the key for ${on.label ?? c.label}`}
          needs={on.needs}
          names={on.package?.secrets?.map((s) => s.name)}
          onDone={() => void p.reload()}
          signup={c.signup}
        />
      ) : null}
    </li>
  );
}
