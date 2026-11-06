// The HUD shell: sign-in, the live connection, navigation and the always-visible spend pill.
import { useCallback, useEffect, useState } from "react";
import { flushOutbox, loadCity, saveSettings } from "./lib/actions.ts";
import { api } from "./lib/api.ts";
import { finishLogin, idToken, loginUrl } from "./lib/auth.ts";
import { loadConfig } from "./lib/config.ts";
import { store, useHud, waitingCount } from "./lib/store.ts";
import { live } from "./lib/ws.ts";
import { AceScreen } from "./components/AceScreen.tsx";
import { CityView } from "./components/CityView.tsx";
import { FirstRun } from "./components/FirstRun.tsx";
import { Inbox } from "./components/Inbox.tsx";
import { CostsScreen, SettingsScreen, Tickets } from "./components/Screens.tsx";
import { SpendPill } from "./components/SpendPill.tsx";
import { Banner, Button, Toaster } from "./components/ui.tsx";
import { Eyes } from "./components/Eyes.tsx";

const VIEWS = ["ace", "city", "inbox", "tickets", "costs", "settings"] as const;
type View = (typeof VIEWS)[number];
const LABEL: Record<View, string> = {
  ace: "Ace",
  city: "City",
  inbox: "Needs you",
  tickets: "Tickets",
  costs: "Costs",
  settings: "Settings",
};
const viewFromHash = (): View => {
  const v = location.hash.replace(/^#\/?/, "") as View;
  return VIEWS.includes(v) ? v : "ace";
};
const GUIDE = "aic.guide.done";

type Boot = "starting" | "signing_in" | "ready" | "failed";

export function App() {
  const [boot, setBoot] = useState<Boot>("starting");
  const [bootError, setBootError] = useState<string | null>(null);
  const [view, setView] = useState<View>(viewFromHash);
  const [guide, setGuide] = useState(false);
  const waiting = useHud(waitingCount);
  const presence = useHud((s) => s.presence);

  const go = useCallback((v: string) => {
    location.hash = `/${v}`;
  }, []);
  useEffect(() => {
    const on = () => setView(viewFromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadConfig();
        await finishLogin();
        if (!(await idToken())) {
          setBoot("signing_in");
          location.assign(await loginUrl());
          return;
        }
        setBoot("ready");
        live.onEvent((e) => store.event(e));
        live.onStatus((s) => {
          const was = store.get().live;
          store.set({ live: s });
          if (s === "online" && was !== "online") {
            void loadCity(); // events may have been missed: start again from a fresh snapshot
            void flushOutbox();
          }
        });
        void live.start();
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
    })();
  }, []);

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
  if (boot !== "ready")
    return (
      <main className="center" aria-busy="true">
        <Eyes presence="idle" />
        <p>{boot === "signing_in" ? "Taking you to sign in…" : "Starting…"}</p>
      </main>
    );

  return (
    <div className={`app view-${view}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <button type="button" className="brand" onClick={() => go("ace")} aria-label="AI City — talk to Ace">
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
        </nav>
        <SpendPill onOpen={() => go("costs")} />
      </header>
      <main id="main" tabIndex={-1}>
        {view === "ace" ? <AceScreen go={go} /> : null}
        {view === "city" ? <CityView go={go} /> : null}
        {view === "inbox" ? <Inbox /> : null}
        {view === "tickets" ? <Tickets /> : null}
        {view === "costs" ? <CostsScreen /> : null}
        {view === "settings" ? <SettingsScreen reopenGuide={() => setGuide(true)} /> : null}
      </main>
      {guide ? <FirstRun onDone={finishGuide} /> : null}
      <Toaster />
      {view !== "ace" && view !== "city" ? (
        <div className="fab">
          <Button variant="quiet" onClick={() => go("ace")} label="Talk to Ace">
            Talk to Ace
          </Button>
        </div>
      ) : null}
    </div>
  );
}
