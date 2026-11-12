// Skills: instructions the agents follow (CONNECTORS_SKILLS.md §2, §3). Agents can't add or change skills; only the
// owner can, here or by asking VAIC. Yours lists what's installed, with + Add for writing or uploading one; Discover
// (decision 188) is the catalog: the AI City catalog and the departments' built-in skills, searched and filtered by
// department, each added in one tap through the same path as an upload (POST /skills/catalog/<name>).
import { DeptLine } from "./DeptPicker.tsx";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api.ts";
import { matches, skillMarkdown } from "../lib/catalog.ts";
import {
  addCatalogSkill,
  checkSkill,
  editSkill,
  filesFromPicker,
  filterCatalog,
  getCatalogSkill,
  listSkillCatalog,
  listSkills,
  readFrontmatter,
  removeSkill,
  ROLE_LABEL,
  ROLES,
  uploadSkill,
  type CatalogSkill,
  type Role,
  type Skill,
  type SkillFile,
} from "../lib/connect.ts";
import { Banner, Button, Confirm, errorText, Loading, PlusIcon, toast } from "./ui.tsx";

export function RolePicker(p: { value: Role[]; onChange: (r: Role[]) => void; legend: string }) {
  return (
    <fieldset className="roles">
      <legend>{p.legend}</legend>
      {ROLES.map((r) => (
        <label key={r} className="switch">
          <input
            type="checkbox"
            checked={p.value.includes(r)}
            onChange={(e) => p.onChange(e.target.checked ? [...p.value, r] : p.value.filter((x) => x !== r))}
          />{" "}
          {ROLE_LABEL[r]}
        </label>
      ))}
    </fieldset>
  );
}

export function AddSkill(p: { onAdded: () => void; onCancel: () => void; replacing?: string }) {
  const [files, setFiles] = useState<SkillFile[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([...ROLES]);
  const [name, setName] = useState(p.replacing ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const folder = useRef<HTMLInputElement>(null);
  useEffect(() => {
    folder.current?.setAttribute("webkitdirectory", "");
  }, []);
  const pick = async (list: FileList | null) => {
    setProblem(null);
    if (list?.length) setFiles(await filesFromPicker(list));
  };
  const md = files?.find((f) => f.path === "SKILL.md");
  const fm = md ? readFrontmatter(new TextDecoder().decode(md.bytes)) : null;
  const problems = files ? checkSkill(files, name || undefined) : [];
  if (files && !roles.length) problems.push("Pick at least one role that may use it.");
  const save = async () => {
    if (!files) return;
    setProblem(null);
    try {
      const r = await uploadSkill(files, roles, fm?.name ? undefined : name || undefined);
      toast({
        text: r.removed_frontmatter.length
          ? `Skill ${r.skill.name} saved. These settings in it were removed, because only the policy decides what agents may do: ${r.removed_frontmatter.join(", ")}.`
          : `Skill ${r.skill.name} saved. Agents can use it from their next turn.`,
        tone: "good",
      });
      p.onAdded();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Not saved. Try again.");
    }
  };
  return (
    <article className="card" aria-labelledby="add-skill">
      <h2 id="add-skill">{p.replacing ? `Replace ${p.replacing}` : "Add a skill"}</h2>
      <p className="mute">
        A skill is a folder with a SKILL.md file (a name, a description, then instructions), or just the SKILL.md.
      </p>
      <div className="row">
        <label className="btn btn-secondary file-pick">
          Choose a folder
          <input ref={folder} type="file" multiple className="sr" onChange={(e) => void pick(e.target.files)} />
        </label>
        <label className="btn btn-secondary file-pick">
          Choose a SKILL.md
          <input type="file" accept=".md,text/markdown" className="sr" onChange={(e) => void pick(e.target.files)} />
        </label>
      </div>
      {files ? (
        <>
          <p>
            {files.length} file{files.length === 1 ? "" : "s"}
            {fm?.name ? `: ${fm.name}` : ""}
          </p>
          {md && !fm?.name ? (
            <label className="field">
              Name (lowercase, dashes)
              <input value={name} onChange={(e) => setName(e.target.value.trim())} placeholder="pdf-report" />
            </label>
          ) : null}
          {fm?.description ? <p className="mute">{fm.description}</p> : null}
          {fm?.dropped.length ? (
            <Banner tone="warn">{`These settings in SKILL.md will be removed: ${fm.dropped.join(", ")}. Only the city's policy decides what agents may do.`}</Banner>
          ) : null}
          {fm ? (
            <details>
              <summary>Preview SKILL.md</summary>
              <pre className="skill-preview">{fm.body.slice(0, 20_000)}</pre>
            </details>
          ) : null}
          <RolePicker value={roles} onChange={setRoles} legend="Who may use it" />
        </>
      ) : null}
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
        <Button variant="primary" onClick={save} disabled={!files || problems.length > 0}>
          Save skill
        </Button>
      </div>
    </article>
  );
}

export function WriteSkill(p: { onAdded: () => void; onCancel: () => void }) {
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

// ---------- small pieces ----------
type Tab = "yours" | "discover";
type Adding = { kind: "upload"; replacing?: string } | { kind: "write" };
const ALL = "All";

/** A skill's tile: its first letter on a colour that follows its first department, so a department's skills match. */
function SkillIcon(p: { s: { title: string; departments: string[] }; size?: number }) {
  const size = p.size ?? 40;
  let h = 0;
  for (const ch of p.s.departments[0] ?? p.s.title) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="hub-logo skill-icon" style={{ width: size, height: size }} aria-hidden="true">
      <span className="hub-mono" style={{ background: `hsl(${h} 42% 36%)` }}>
        {p.s.title.trim().charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

const forWho = (s: CatalogSkill) => (s.builtin ? s.source : `${s.source} · for ${s.departments.join(", ")}`);

function AddedMark() {
  return (
    <span className="hub-status status-good">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Added
    </span>
  );
}

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
  const items: Array<{ a: Adding; label: string; hint: string }> = [
    { a: { kind: "write" }, label: "Write a skill", hint: "Teach every team how you want something done" },
    { a: { kind: "upload" }, label: "Upload a skill", hint: "A folder or a SKILL.md" },
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
              key={it.label}
              ref={i === 0 ? first : undefined}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                p.onPick(it.a);
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

/** One skill in Discover: tile, name, what it does, where it's from, and Add (or Added). */
function SkillCard(p: { s: CatalogSkill; onOpen: () => void; onAdd: () => Promise<void> }) {
  const { s } = p;
  return (
    <li className="hub-card skill-card" aria-label={s.title}>
      <div className="hub-card-head">
        <SkillIcon s={s} />
        <div>
          <button type="button" className="skill-name" onClick={p.onOpen} aria-label={`About ${s.title}`}>
            {s.title}
          </button>
          <p className="mute hub-what">{s.description}</p>
        </div>
      </div>
      <p className="mute skill-from">{forWho(s)}</p>
      <div className="hub-card-foot">
        {s.added ? (
          <AddedMark />
        ) : (
          <>
            <span />
            <Button variant="secondary" label={`Add ${s.title}`} onClick={p.onAdd}>
              <PlusIcon size={16} /> Add
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/** What a catalog skill does, who it's for, and its SKILL.md, with Add or Remove. */
function SkillDetail(p: { s: CatalogSkill; onClose: () => void; onAdd: () => Promise<void>; onRemove: () => void }) {
  const { s } = p;
  const [md, setMd] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    getCatalogSkill(s.name).then(
      (r) => setMd(readFrontmatter(r.skill_md).body.trim()),
      (e: unknown) => setProblem(errorText(e, "Its instructions did not load.")),
    );
  }, [s.name]);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [p]);
  return (
    <div className="scrim" role="presentation" onClick={(e) => e.target === e.currentTarget && p.onClose()}>
      <div className="dialog panel skill-detail" role="dialog" aria-modal="true" aria-labelledby="skill-dlg" ref={ref}>
        <div className="hub-card-head">
          <SkillIcon s={s} size={48} />
          <div>
            <h2 id="skill-dlg">{s.title}</h2>
            <p className="mute skill-from">{forWho(s)}</p>
          </div>
        </div>
        <h3>What it does</h3>
        <p>{s.description}</p>
        {s.builtin ? (
          <p className="mute">
            {`Already part of ${s.departments.join(", ")}. Adding it lets every team use it, and you choose who under Yours.`}
          </p>
        ) : (
          <p className="mute">
            Adding it lets every agent use it from their next turn. You can change who under Yours.
          </p>
        )}
        <h3>Instructions (SKILL.md)</h3>
        {problem ? <Banner tone="bad">{problem}</Banner> : null}
        {md === null && !problem ? <Loading what="its instructions" /> : null}
        {md !== null ? (
          <pre className="skill-preview" tabIndex={0} aria-label="SKILL.md">
            {md}
          </pre>
        ) : null}
        <div className="row-end">
          <Button variant="quiet" onClick={p.onClose}>
            Close
          </Button>
          {s.added ? (
            <>
              <AddedMark />
              <Button variant="danger" onClick={p.onRemove}>
                Remove…
              </Button>
            </>
          ) : (
            <Button variant="primary" label={`Add ${s.title}`} onClick={p.onAdd}>
              Add skill
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- the screen ----------
export function SkillsScreen() {
  const [tab, setTab] = useState<Tab | null>(/\/discover\b/.test(location.hash) ? "discover" : null);
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogSkill[] | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [dept, setDept] = useState(ALL);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const fail = (what: string) => (e: unknown) => setErrors((x) => ({ ...x, [what]: errorText(e, "It did not load.") }));
  const ok = (what: string) => setErrors(({ [what]: _, ...x }) => x);

  const loadSkills = () =>
    listSkills().then((r) => {
      setSkills(r.skills);
      ok("Your skills");
      // First visit: nothing installed yet → start in Discover, where the ready-made ones are.
      setTab((t) => t ?? (r.skills.length ? "yours" : "discover"));
    }, fail("Your skills"));
  const loadCatalog = () =>
    listSkillCatalog().then((r) => {
      setCatalog(r.skills);
      setDepartments(r.departments);
      ok("Discover");
    }, fail("Discover"));
  useEffect(() => {
    void loadSkills();
    void loadCatalog();
  }, []);
  const view: Tab = tab ?? "yours";

  const mark = (name: string, added: boolean) =>
    setCatalog((xs) => xs?.map((x) => (x.name === name ? { ...x, added } : x)) ?? null);
  const dropMine = (name: string) => setSkills((xs) => xs?.filter((x) => x.name !== name) ?? null);
  const putMine = (s: Skill) =>
    setSkills((xs) => [...(xs ?? []).filter((x) => x.name !== s.name), s].sort((a, b) => a.name.localeCompare(b.name)));

  /** One tap: install it, show Added at once, and offer Undo for a while. */
  const add = async (s: CatalogSkill, roles?: Role[]) => {
    try {
      const r = await addCatalogSkill(s.name, roles);
      mark(s.name, true);
      putMine(r.skill);
      toast({
        text: `Added ${s.title}. Your agents can use it from their next turn.`,
        tone: "good",
        undo: async () => {
          await removeSkill(s.name);
          mark(s.name, false);
          dropMine(s.name);
        },
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        mark(s.name, true); // it is already there (added elsewhere): show it as added
        void loadSkills();
      }
      throw e;
    }
  };
  const fromCatalog = (name: string) => catalog?.find((c) => c.name === name);

  const change = async (s: Skill, patch: { roles?: Role[]; enabled?: boolean }) => {
    setSkills((xs) => xs?.map((x) => (x.name === s.name ? { ...x, ...patch } : x)) ?? null); // shown at once
    try {
      const r = await editSkill(s.name, patch);
      setSkills((xs) => xs?.map((x) => (x.name === s.name ? r.skill : x)) ?? null);
    } catch (e) {
      setSkills((xs) => xs?.map((x) => (x.name === s.name ? s : x)) ?? null);
      toast({ text: errorText(e, "Not saved. Try again."), tone: "bad" });
    }
  };

  const shown = catalog ? filterCatalog(catalog, q, dept === ALL ? null : dept) : [];
  const featured = !q && dept === ALL ? catalog?.find((c) => c.featured) : undefined;
  const fromCity = shown.filter((s) => !s.builtin && s !== featured);
  const builtIn = shown.filter((s) => s.builtin);
  const mine = (skills ?? []).filter((s) => matches(q, s.name, s.description));
  const openSkill = open ? fromCatalog(open) : undefined;

  const showTab = (t: Tab) => {
    setTab(t);
    setOpen(null);
  };
  const grid = (list: CatalogSkill[], label: string) => (
    <ul className="hub-grid" aria-label={label}>
      {list.map((s) => (
        <SkillCard key={s.name} s={s} onOpen={() => setOpen(s.name)} onAdd={() => add(s)} />
      ))}
    </ul>
  );
  const done = () => {
    setAdding(null);
    showTab("yours");
    void loadSkills();
  };

  return (
    <section className="screen skills-screen" aria-labelledby="skills-title">
      <h1 id="skills-title">Skills</h1>
      <p className="lede">
        Instructions your agents follow. Add ready-made ones from Discover, or write your own. Only you can add or
        change them.
      </p>
      <div className="hub-top">
        <div className="hub-switch" role="group" aria-label="Show">
          <button type="button" aria-pressed={view === "yours"} onClick={() => showTab("yours")}>
            Yours
          </button>
          <button type="button" aria-pressed={view === "discover"} onClick={() => showTab("discover")}>
            Discover
          </button>
        </div>
        <label className="hub-search">
          <span className="sr">Search skills</span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills" />
        </label>
        <AddMenu onPick={setAdding} />
      </div>

      {Object.entries(errors).map(([k, v]) => (
        <Banner
          key={k}
          tone="bad"
          action={{ label: "Try again", onClick: () => void (k === "Discover" ? loadCatalog() : loadSkills()) }}
        >{`${k} did not load: ${v}`}</Banner>
      ))}

      {adding?.kind === "upload" ? (
        <AddSkill replacing={adding.replacing} onCancel={() => setAdding(null)} onAdded={done} />
      ) : null}
      {adding?.kind === "write" ? <WriteSkill onCancel={() => setAdding(null)} onAdded={done} /> : null}

      {view === "discover" ? (
        <>
          {departments.length ? (
            <div className="hub-chips" role="group" aria-label="Department">
              {[ALL, ...departments].map((g) => (
                <button key={g} type="button" aria-pressed={dept === g} onClick={() => setDept(g)}>
                  {g}
                </button>
              ))}
            </div>
          ) : null}
          {!catalog && !errors.Discover ? <Loading what="the catalog" /> : null}
          {featured ? (
            <article className="skill-feature" aria-label={`Featured: ${featured.title}`}>
              <div>
                <p className="skill-feature-kicker">Featured · {featured.source}</p>
                <h2>{featured.title}</h2>
                <p>{featured.description}</p>
                <div className="row">
                  {featured.added ? (
                    <AddedMark />
                  ) : (
                    <Button variant="primary" label={`Add ${featured.title}`} onClick={() => add(featured)}>
                      Add
                    </Button>
                  )}
                  <Button variant="quiet" onClick={() => setOpen(featured.name)}>
                    See what it does
                  </Button>
                </div>
              </div>
              <SkillIcon s={featured} size={88} />
            </article>
          ) : null}
          {fromCity.length ? (
            <section className="hub-section" aria-labelledby="skills-catalog">
              <h3 id="skills-catalog">{dept === ALL ? "From the AI City catalog" : `For ${dept}`}</h3>
              {grid(fromCity, "AI City catalog")}
            </section>
          ) : null}
          {builtIn.length ? (
            <section className="hub-section" aria-labelledby="skills-builtin">
              <h3 id="skills-builtin">Built into your departments</h3>
              <p className="mute hub-note">Their departments already use these. Add one to let every team use it.</p>
              {grid(builtIn, "Built-in skills")}
            </section>
          ) : null}
          {catalog && !shown.length ? (
            <div className="hub-empty">
              <p className="mute">
                {q ? `No skill matches "${q}"${dept === ALL ? "" : ` in ${dept}`}.` : `No skills for ${dept} yet.`} You
                can write your own: it takes a minute.
              </p>
              <div className="row">
                {q || dept !== ALL ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQ("");
                      setDept(ALL);
                    }}
                  >
                    Show all skills
                  </Button>
                ) : null}
                <Button variant="quiet" onClick={() => setAdding({ kind: "write" })}>
                  Write a skill
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {!skills && !errors["Your skills"] ? <Loading what="skills" /> : null}
          {skills && !skills.length ? (
            <div className="hub-empty">
              <p className="mute">
                No skills yet. Discover has ready-made ones for every department: add one in a tap. Or write or upload
                your own with + Add.
              </p>
              <Button variant={adding ? "secondary" : "primary"} onClick={() => showTab("discover")}>
                Discover skills
              </Button>
            </div>
          ) : null}
          {skills?.length && q && !mine.length ? (
            <div className="hub-empty">
              <p className="mute">{`None of your skills matches "${q}".`}</p>
              <Button variant="secondary" onClick={() => showTab("discover")}>
                Search Discover instead
              </Button>
            </div>
          ) : null}
          {mine.map((s) => (
            <article key={s.name} className="card" aria-label={`Skill ${s.name}`}>
              <h2>
                {fromCatalog(s.name)?.title ?? s.name}
                {s.source === "catalog" ? <span className="hub-badge">From Discover</span> : null}
              </h2>
              <p>{s.description}</p>
              <p className="mute">
                {s.files.length} file{s.files.length === 1 ? "" : "s"} · updated{" "}
                {new Date(s.updated_at).toLocaleDateString()}
              </p>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => void change(s, { enabled: e.target.checked })}
                />{" "}
                On
              </label>
              <RolePicker
                value={s.roles}
                legend="Who may use it"
                onChange={(roles) =>
                  roles.length
                    ? void change(s, { roles })
                    : toast({ text: "Keep at least one role, or turn it off.", tone: "bad" })
                }
              />
              <DeptLine
                what={s.name}
                keys={s.departments}
                onSave={async (keys, every) => {
                  try {
                    const r = await editSkill(s.name, { departments: every ? "all" : keys });
                    setSkills((xs) => xs?.map((x) => (x.name === s.name ? r.skill : x)) ?? null);
                  } catch (e) {
                    toast({ text: errorText(e, "Not saved. Try again."), tone: "bad" });
                    throw e;
                  }
                }}
              />
              <div className="row-end">
                {s.source !== "catalog" ? (
                  <Button variant="quiet" onClick={() => setAdding({ kind: "upload", replacing: s.name })}>
                    Replace…
                  </Button>
                ) : null}
                <Button variant="danger" onClick={() => setDeleting(s)}>
                  Remove…
                </Button>
              </div>
            </article>
          ))}
        </>
      )}

      {openSkill ? (
        <SkillDetail
          s={openSkill}
          onClose={() => setOpen(null)}
          onAdd={() => add(openSkill)}
          onRemove={() => {
            const s = skills?.find((x) => x.name === openSkill.name);
            setOpen(null);
            if (s) setDeleting(s);
          }}
        />
      ) : null}
      {deleting ? (
        <Confirm
          title={`Remove the skill ${fromCatalog(deleting.name)?.title ?? deleting.name}?`}
          what={
            fromCatalog(deleting.name)
              ? "Your agents stop using it from their next turn. You can add it again from Discover any time."
              : "It is removed for every agent at their next turn. This can't be undone; you can add it again from its files."
          }
          cost="Cost: nothing."
          confirmLabel="Remove skill"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const gone = deleting;
            await removeSkill(gone.name);
            setDeleting(null);
            dropMine(gone.name);
            mark(gone.name, false);
            const cat = fromCatalog(gone.name);
            toast({
              text: `Removed ${cat?.title ?? gone.name}.`,
              tone: "good",
              // A catalog skill comes back exactly as it was, with the same roles.
              undo: cat ? () => add({ ...cat, added: false }, gone.roles) : undefined,
            });
          }}
        />
      ) : null}
    </section>
  );
}
