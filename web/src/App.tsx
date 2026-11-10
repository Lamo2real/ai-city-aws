// The HUD shell: sign-in, the live connection, navigation and the always-visible spend pill.
import { useCallback, useEffect, useRef, useState } from "react";
import { flushOutbox, loadCity, saveSettings } from "./lib/actions.ts";
import { api } from "./lib/api.ts";
import { bootAuth } from "./lib/auth.ts";
import { loadConfig } from "./lib/config.ts";
import { store } from "./lib/store.ts";
import { trackSeen } from "./lib/away.ts";
import { chief } from "./lib/chief.ts";
import { live } from "./lib/ws.ts";
import { route } from "./lib/apps.ts";
import { visitOf } from "./lib/visit.ts";
import { forwardEvent } from "./lib/bridge.ts";
import { PinnedApps } from "./components/Apps.tsx";
import { ProjectPage, ProjectsScreen } from "./components/Projects.tsx";
import { VaicScreen } from "./components/VaicScreen.tsx";
import { CityView } from "./components/CityView.tsx";
import { FeaturesScreen } from "./components/Features.tsx";
import { FirstRun } from "./components/FirstRun.tsx";
import { KnowledgeScreen } from "./components/Knowledge.tsx";
import { FilesScreen } from "./components/Files.tsx";
import { files } from "./lib/files.ts";
import { knowledge } from "./lib/knowledge.ts";
import { projects } from "./lib/projects.ts";
import { workflows } from "./lib/workflows.ts";
import { CostsScreen, SettingsScreen, Tickets } from "./components/Screens.tsx";
import { SkillsScreen } from "./components/SkillsScreen.tsx";
import { Banner, Button, Toaster, toast } from "./components/ui.tsx";
import { connectReturn } from "./lib/connectReturn.ts";
import { Eyes } from "./components/Eyes.tsx";
import { SignIn } from "./components/SignIn.tsx";
import { Wordmark } from "./components/Wordmark.tsx";

const VIEWS = ["vaic", "city", "tickets", "apps", "files", "knowledge", "skills", "costs", "settings"] as const;
type View = (typeof VIEWS)[number];
const LABEL: Record<View, string> = {
  vaic: "Chat",
  city: "City",
  tickets: "Work",
  apps: "Projects",
  files: "Files",
  knowledge: "Knowledge",
  costs: "Costs",
  skills: "Skills",
  settings: "Settings",
};
const GUIDE = "vaic.guide.done";

type Boot = "starting" | "signed_out" | "ready" | "failed";

export function App() {
  const [boot, setBoot] = useState<Boot>("starting");
  const [bootError, setBootError] = useState<string | null>(null);
  const [signInNote, setSignInNote] = useState<string | null>(null);
  const [{ view, slug }, setRoute] = useState<{ view: View; slug: string | null }>(() =>
    route(location.hash, VIEWS, "city"),
  );
  const visit = view === "city" ? visitOf(slug) : null; // inside a building (decision 166)
  const [guide, setGuide] = useState(false);
  // The top bar's height, as `--top-h`: on the VAIC screen the chat runs up behind the bar (decision 108).
  const top = useRef<HTMLElement>(null);
  const [topH, setTopH] = useState(64);
  useEffect(() => {
    const el = top.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setTopH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [boot]);

  const go = useCallback((v: string) => {
    location.hash = `/${v}`;
  }, []);
  useEffect(() => trackSeen(), []);
  useEffect(() => {
    // Needs you is gone (Autopilot): an old link opens what is still open from before.
    const on = () => {
      if (/^#\/?inbox\b/.test(location.hash)) return location.replace("#/settings/open-items");
      setRoute(route(location.hash, VIEWS, "city"));
    };
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const start = useCallback(async () => {
    try {
      await loadConfig();
      const a = await bootAuth();
      if (a.state === "offline")
        throw new Error("you seem to be offline, and your sign-in needs the network to refresh");
      if (a.state === "signed_out") {
        setSignInNote(a.note);
        setBoot("signed_out");
        return;
      }
      setBoot("ready");
      live.onEvent((e) => {
        chief.event(e); // before the store, so a decision can still read the item it is about
        store.event(e);
        knowledge.event(e);
        files.event(e);
        projects.event(e);
        workflows.event(e);
        forwardEvent(e); // only calendar.changed, only to apps granted the calendar
      });
      live.onStatus((s) => {
        const was = store.get().live;
        store.set({ live: s });
        if (s === "online" && was !== "online") {
          // Events may have been missed: start again from a fresh snapshot (then what the Chief of Staff decided).
          void loadCity().finally(() => void chief.load());
          void flushOutbox();
        }
      });
      void live.start();
      // Back from a provider's sign-in page (connectors and mail accounts share /?connect=return).
      void connectReturn().then((r) => r && toast({ text: r.message, tone: r.ok ? "good" : "bad" }));
      const s = await api<{ settings: Record<string, unknown> }>("/settings").catch(() => null);
      let done = false;
      try {
        done = localStorage.getItem(GUIDE) === "1";
      } catch {
        /* no storage: rely on the server flag */
      }
      if (s && !s.settings.first_run_done && !done) setGuide(true);
    } catch (e) {
      setBootError((e as Error).message);
      setBoot("failed");
    }
  }, []);
  useEffect(() => {
    void start();
  }, [start]);

  const finishGuide = () => {
    setGuide(false);
    try {
      localStorage.setItem(GUIDE, "1");
    } catch {
      /* fine */
    }
    void saveSettings({ first_run_done: true }).catch(() => undefined);
  };

  if (boot === "failed")
    return (
      <main className="center">
        <Banner
          tone="bad"
          action={{ label: "Try again", onClick: () => location.reload() }}
        >{`AI City could not start: ${bootError ?? "unknown problem"}. Nothing was lost.`}</Banner>
      </main>
    );
  if (boot === "signed_out") return <SignIn note={signInNote} onSignedIn={() => void start()} />;
  if (boot !== "ready")
    return (
      <main className="center" aria-busy="true">
        <Eyes presence="idle" />
        <p>Starting…</p>
      </main>
    );

  return (
    <div
      className={`app view-${view === "city" && slug && !visit ? "features" : view}${view === "apps" && slug ? " view-app" : ""}`}
      style={{ "--top-h": `${topH}px` } as React.CSSProperties}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top" ref={top}>
        {/* The logo is the way to the City (the owner, 2026-11-10): the City has no tab of its own. */}
        <a
          className="brand"
          href="#/city"
          aria-label="VAIC — the City"
          aria-current={view === "city" ? "page" : undefined}
        >
          <Wordmark />
        </a>
        <nav aria-label="Screens">
          {VIEWS.filter((v) => v !== "city").map((v) => (
            <a key={v} href={`#/${v}`} aria-current={view === v ? "page" : undefined}>
              {LABEL[v]}
            </a>
          ))}
          <PinnedApps inNav />
        </nav>
        <PinnedApps />
      </header>
      <main id="main" tabIndex={-1}>
        {view === "vaic" ? <VaicScreen go={go} /> : null}
        {view === "city" && (!slug || visit) ? <CityView go={go} visit={visit} /> : null}
        {view === "city" && slug && !visit ? <FeaturesScreen page={slug} go={go} /> : null}
        {view === "tickets" ? <Tickets page={slug} /> : null}
        {view === "apps" && !slug ? <ProjectsScreen /> : null}
        {view === "apps" && slug ? <ProjectPage key={slug} slug={slug} go={go} /> : null}
        {view === "files" ? <FilesScreen /> : null}
        {view === "knowledge" ? <KnowledgeScreen /> : null}
        {view === "costs" ? <CostsScreen /> : null}
        {view === "skills" ? <SkillsScreen /> : null}
        {view === "settings" ? <SettingsScreen page={slug} reopenGuide={() => setGuide(true)} /> : null}
      </main>
      {guide ? <FirstRun onDone={finishGuide} /> : null}
      <Toaster />
      {view !== "vaic" && !(view === "city" && (!slug || visit)) && !(view === "apps" && slug) ? (
        <div className="fab">
          <Button variant="quiet" onClick={() => go("vaic")} label="Talk to VAIC">
            Talk to VAIC
          </Button>
        </div>
      ) : null}
    </div>
  );
}
