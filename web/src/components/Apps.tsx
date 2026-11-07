// Apps: the games and small tools the city built and the owner published (docs/APPS.md).
// Every app runs only in AppFrame: a sandboxed iframe on the isolated apps origin. The HUD never
// listens to or posts messages to it. Titles and descriptions are agent text: plain text, capped.
import { useEffect, useState } from "react";
import type { CityApp } from "../city/city-state.js";
import { appList, capped, FRAME, loadApps, onAppsOrigin, removeApp } from "../lib/apps.ts";
import { ApiError } from "../lib/api.ts";
import { config } from "../lib/config.ts";
import { useHud } from "../lib/store.ts";
import { Banner, Button, Confirm, toast } from "./ui.tsx";

const appsUrl = () => {
  try {
    return config().appsUrl ?? "";
  } catch {
    return "";
  }
};

/** The one way an app is shown. A URL off the apps origin is never framed. */
export function AppFrame({
  src,
  title,
  className,
}: {
  src: string | null | undefined;
  title: string;
  className?: string;
}) {
  if (!onAppsOrigin(src, appsUrl()))
    return <p className="mute appframe-none">This app can't be shown here: it isn't on the apps address.</p>;
  return (
    <iframe
      className={`appframe ${className ?? ""}`}
      src={src!}
      title={title}
      sandbox={FRAME.sandbox}
      referrerPolicy={FRAME.referrerPolicy}
      allow={FRAME.allow}
    />
  );
}

function AppIcon({ app }: { app: CityApp }) {
  const [broken, setBroken] = useState(false);
  if (app.icon_url && !broken && onAppsOrigin(app.icon_url, appsUrl()))
    return (
      <img
        className="appicon"
        src={app.icon_url}
        alt=""
        width={64}
        height={64}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  // An original pixel arcade cabinet, drawn here.
  return (
    <svg className="appicon" viewBox="0 0 16 16" width={64} height={64} aria-hidden="true" shapeRendering="crispEdges">
      <rect x="3" y="1" width="10" height="14" fill="#1d1c36" />
      <rect x="4" y="2" width="8" height="2" fill="#e0625a" />
      <rect x="4" y="5" width="8" height="5" fill="#3a4660" />
      <rect x="5" y="6" width="2" height="2" fill="#8fdcff" />
      <rect x="9" y="7" width="2" height="2" fill="#f4c63c" />
      <rect x="4" y="11" width="8" height="3" fill="#7f5aa8" />
      <rect x="6" y="11" width="1" height="2" fill="#fff6e0" />
      <rect x="9" y="12" width="2" height="1" fill="#49ad7c" />
    </svg>
  );
}

export function AppsScreen() {
  const appsMap = useHud((s) => s.city.apps);
  const apps = appList(appsMap);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadApps().catch((e: Error) => setError(e.message));
  }, []);
  return (
    <section className="screen" aria-labelledby="apps-title">
      <h1 id="apps-title">Apps</h1>
      {error ? (
        <Banner tone="bad">{`Could not refresh the apps (${error}). Showing what the city last sent.`}</Banner>
      ) : null}
      {apps.length ? (
        <ul className="appgrid">
          {apps.map((a) => (
            <li key={a.app_id}>
              <a className="apptile" href={`#/apps/${encodeURIComponent(a.slug)}`}>
                <AppIcon app={a} />
                <b>{capped(a.title, 40)}</b>
                {a.description ? <span className="mute">{capped(a.description, 200)}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          No apps yet. Ask AIC for a game: the city builds it, you try it in Needs you, and it lands here.
        </p>
      )}
    </section>
  );
}

export function AppPage({ slug, go }: { slug: string; go: (view: string) => void }) {
  const appsMap = useHud((s) => s.city.apps);
  const loaded = useHud((s) => s.loaded);
  const app = Object.values(appsMap).find((a) => a.slug === slug);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!app) loadApps().catch(() => undefined); // maybe published after the last snapshot
  }, [app]);

  const back = (
    <a className="back" href="#/apps">
      ← Apps
    </a>
  );
  if (!app)
    return (
      <section className="screen" aria-labelledby="app-title">
        {back}
        <h1 id="app-title">{loaded ? "This app is gone" : "Opening the app…"}</h1>
        {loaded ? <p className="empty">It was removed, or the link is wrong. Your other apps are under Apps.</p> : null}
      </section>
    );
  const title = capped(app.title, 40);
  return (
    <section className="apppage" aria-labelledby="app-title">
      <header className="apphead">
        {back}
        <h1 id="app-title">{title}</h1>
        <Button variant="quiet" onClick={() => setAsking(true)}>
          Remove
        </Button>
      </header>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      <AppFrame src={app.url} title={`${title} (app built by the city)`} />
      {asking ? (
        <Confirm
          title={`Remove ${title}?`}
          what="It disappears from Apps and its files are deleted. To get it back, ask AIC to build it again."
          cost="Nothing to pay; it can't be undone."
          confirmLabel="Remove"
          danger
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setAsking(false);
            setError(null);
            try {
              await removeApp(app.app_id);
              toast({ text: `${title} was removed.`, tone: "good" });
              go("apps");
            } catch (e) {
              setError(
                e instanceof ApiError
                  ? `${e.message}${e.fix ? ` ${e.fix}` : ""}`
                  : "That did not go through. Nothing changed. Try again.",
              );
            }
          }}
        />
      ) : null}
    </section>
  );
}
