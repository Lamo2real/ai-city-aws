// Skills: SKILL.md folders the owner adds, and which agents may use them (CONNECTORS_SKILLS.md §2, §3).
// Agents can't add or change skills; only this screen can.
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api.ts";
import {
  checkSkill,
  editSkill,
  filesFromPicker,
  listSkills,
  readFrontmatter,
  removeSkill,
  ROLE_LABEL,
  ROLES,
  uploadSkill,
  type Role,
  type Skill,
  type SkillFile,
} from "../lib/connect.ts";
import { Banner, Button, Confirm, Loading, toast } from "./ui.tsx";

function RolePicker(p: { value: Role[]; onChange: (r: Role[]) => void; legend: string }) {
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

function AddSkill(p: { onAdded: () => void; onCancel: () => void; replacing?: string }) {
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

export function SkillsScreen() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<null | { replacing?: string }>(null);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const load = () =>
    listSkills().then(
      (r) => {
        setSkills(r.skills);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  useEffect(() => {
    void load();
  }, []);
  const change = async (s: Skill, patch: { roles?: Role[]; enabled?: boolean }) => {
    setSkills((xs) => xs?.map((x) => (x.name === s.name ? { ...x, ...patch } : x)) ?? null); // shown at once
    try {
      const r = await editSkill(s.name, patch);
      setSkills((xs) => xs?.map((x) => (x.name === s.name ? r.skill : x)) ?? null);
    } catch (e) {
      setSkills((xs) => xs?.map((x) => (x.name === s.name ? s : x)) ?? null);
      toast({ text: e instanceof ApiError ? e.message : "Not saved. Try again.", tone: "bad" });
    }
  };
  return (
    <section className="screen" aria-labelledby="skills-title">
      <h1 id="skills-title">Skills</h1>
      <p className="lede">Instructions your agents follow. Only you can add or change them.</p>
      {error ? (
        <Banner
          tone="bad"
          action={{ label: "Try again", onClick: () => void load() }}
        >{`Skills did not load: ${error}`}</Banner>
      ) : null}
      {adding ? (
        <AddSkill
          replacing={adding.replacing}
          onCancel={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            void load();
          }}
        />
      ) : (
        <Button variant="primary" onClick={() => setAdding({})}>
          Add skill
        </Button>
      )}
      {!skills && !error ? <Loading what="skills" /> : null}
      {skills && !skills.length ? <p className="empty">No skills yet.</p> : null}
      {skills?.map((s) => (
        <article key={s.name} className="card" aria-label={`Skill ${s.name}`}>
          <h2>{s.name}</h2>
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
          <div className="row-end">
            <Button variant="quiet" onClick={() => setAdding({ replacing: s.name })}>
              Replace…
            </Button>
            <Button variant="danger" onClick={() => setDeleting(s)}>
              Delete…
            </Button>
          </div>
        </article>
      ))}
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
            setSkills((xs) => xs?.filter((x) => x.name !== deleting.name) ?? null);
            toast({ text: `Skill ${deleting.name} deleted.`, tone: "good" });
          }}
        />
      ) : null}
    </section>
  );
}
