// The HUD shell: sign-in, the live connection, navigation and the always-visible spend pill.
import { useCallback, useEffect, useState } from "react";
import { flushOutbox, loadCity, saveSettings } from "./lib/actions.ts";
import { api } from "./lib/api.ts";
import { bootAuth } from "./lib/auth.ts";
import { loadConfig } from "./lib/config.ts";
import { store, useHud, waitingCount } from "./lib/store.ts";
import { live } from "./lib/ws.ts";
import { route } from "./lib/apps.ts";
import { forwardEvent } from "./lib/bridge.ts";
import { AppPage, AppsScreen, PinnedApps } from "./components/Apps.tsx";
import { AceScreen } from "./components/AceScreen.tsx";
import { CityView } from "./components/CityView.tsx";
import { FirstRun } from "./components/FirstRun.tsx";
import { Inbox } from "./components/Inbox.tsx";
import { KnowledgeScreen } from "./components/Knowledge.tsx";
import { knowledge } from "./lib/knowledge.ts";
import { CostsScreen, SettingsScreen, Tickets } from "./components/Screens.tsx";
import { SpendPill } from "./components/SpendPill.tsx";
import { SkillsScreen } from "./components/SkillsScreen.tsx";
import { Banner, Button, Toaster, toast } from "./components/ui.tsx";
import { connectReturn } from "./lib/connectReturn.ts";
import { Eyes } from "./components/Eyes.tsx";
import { SignIn } from "./components/SignIn.tsx";

const VIEWS = ["ace", "city", "inbox", "tickets", "apps", "knowledge", "skills", "costs", "settings"] as const;
type View = (typeof VIEWS)[number];
const LABEL: Record<View, string> = {
  ace: "AIC",
  city: "City",
  inbox: "Needs you",
  tickets: "Tickets",
  apps: "Apps",
  knowledge: "Knowledge",
  costs: "Costs",
  skills: "Skills",
  settings: "Settings",
};
const GUIDE = "aic.guide.done";

type Boot = "starting" | "signed_out" | "ready" | "failed";

export function App() {
  const [boot, setBoot] = useState<Boot>("starting");
  const [bootError, setBootError] = useState<string | null>(null);
  const [signInNote, setSignInNote] = useState<string | null>(null);
  const [{ view, slug }, setRoute] = useState<{ view: View; slug: string | null }>(() => route(location.hash, VIEWS));
  const [guide, setGuide] = useState(false);
  const waiting = useHud(waitingCount);
  const presence = useHud((s) => s.presence);

  const go = useCallback((v: string) => {
    location.hash = `/${v}`;
  }, []);
  useEffect(() => {
    const on = () => setRoute(route(location.hash, VIEWS));
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
        store.event(e);
        knowledge.event(e);
        forwardEvent(e); // only calendar.changed, only to apps granted the calendar
      });
      live.onStatus((s) => {
        const was = store.get().live;
        store.set({ live: s });
        if (s === "online" && was !== "online") {
          void loadCity(); // events may have been missed: start again from a fresh snapshot
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
    <div className={`app view-${view}${slug ? " view-app" : ""}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <button type="button" className="brand" onClick={() => go("ace")} aria-label="AI City — talk to AIC">
          <Eyes presence={presence} small />
          <span className="pixel">AI CITY</span>
        </button>
        <nav aria-label="Screens">
          {VIEWS.map((v) => (
            <a
              key={v}
              href={`#/${v}`}
              aria-current={view === v ? "page" : undefined}
              className={v === "inbox" && waiting ? "has-waiting" : undefined}
            >
              {LABEL[v]}
              {v === "inbox" && waiting ? (
                <span className="badge" aria-label={`${waiting} waiting`}>
                  {waiting}
                </span>
              ) : null}
            </a>
          ))}
          <PinnedApps inNav />
        </nav>
        <PinnedApps />
        <SpendPill onOpen={() => go("costs")} />
      </header>
      <main id="main" tabIndex={-1}>
        {view === "ace" ? <AceScreen go={go} /> : null}
        {view === "city" ? <CityView go={go} /> : null}
        {view === "inbox" ? <Inbox /> : null}
        {view === "tickets" ? <Tickets /> : null}
        {view === "apps" && !slug ? <AppsScreen /> : null}
        {view === "apps" && slug ? <AppPage key={slug} slug={slug} go={go} /> : null}
        {view === "knowledge" ? <KnowledgeScreen /> : null}
        {view === "costs" ? <CostsScreen /> : null}
        {view === "skills" ? <SkillsScreen /> : null}
        {view === "settings" ? <SettingsScreen reopenGuide={() => setGuide(true)} /> : null}
      </main>
      {guide ? <FirstRun onDone={finishGuide} /> : null}
      <Toaster />
      {view !== "ace" && view !== "city" && !slug ? (
        <div className="fab">
          <Button variant="quiet" onClick={() => go("ace")} label="Talk to AIC">
            Talk to AIC
          </Button>
        </div>
      ) : null}
    </div>
  );
}
