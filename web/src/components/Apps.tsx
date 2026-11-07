// Apps: the games and small tools the city built and the owner published (docs/APPS.md).
// Every app runs only in AppFrame: a sandboxed iframe on the isolated apps origin. Since v2 the frame
// may ask the HUD for data through lib/bridge.ts, which answers only that mounted frame, only with what
// the owner granted (a preview gets nothing), and never hands it a token or config. Titles, descriptions
// and capability names are agent text: plain text, capped.
import { useEffect, useRef, useState } from "react";
import type { CityApp } from "../city/city-state.js";
import {
  appList,
  capKey,
  capLabel,
  capped,
  FRAME,
  loadApps,
  MAX_PINS,
  onAppsOrigin,
  pinnedApps,
  removeApp,
  rollbackApp,
  updateApp,
  type Capability,
} from "../lib/apps.ts";
import { registerFrame } from "../lib/bridge.ts";
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

/**
 * The one way an app is shown. A URL off the apps origin is never framed. `appId` names the published app
 * the bridge answers for; without it the frame is a preview and every data request gets `preview`.
 */
export function AppFrame({
  src,
  title,
  className,
  appId = null,
}: {
  src: string | null | undefined;
  title: string;
  className?: string;
  appId?: string | null;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const framed = onAppsOrigin(src, appsUrl());
  useEffect(() => (framed && ref.current ? registerFrame(ref.current, appId) : undefined), [framed, appId]);
  if (!framed) return <p className="mute appframe-none">This app can't be shown here: it isn't on the apps address.</p>;
  return (
    <iframe
      ref={ref}
      className={`appframe ${className ?? ""}`}
      src={src!}
      title={title}
      sandbox={FRAME.sandbox}
      referrerPolicy={FRAME.referrerPolicy}
      allow={FRAME.allow}
    />
  );
}

function AppIcon({ app, size = 64 }: { app: CityApp; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (app.icon_url && !broken && onAppsOrigin(app.icon_url, appsUrl()))
    return (
      <img
        className="appicon"
        src={app.icon_url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  // An original pixel arcade cabinet, drawn here.
  return (
    <svg
      className="appicon"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
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
        <div className="emptystate">
          <p className="empty">No apps yet. Ask AIC for a game or a tool, and it lands here when it's ready.</p>
          <a
            className="btn btn-primary"
            href="#/"
            onClick={() => {
              try {
                if (!localStorage.getItem("aic.draft")) localStorage.setItem("aic.draft", "Build me a small app that ");
              } catch {
                /* the link still opens AIC */
              }
            }}
          >
            Ask AIC for an app
          </a>
        </div>
      )}
    </section>
  );
}

export function AppPage({ slug, go }: { slug: string; go: (view: string) => void }) {
  const appsMap = useHud((s) => s.city.apps);
  const loaded = useHud((s) => s.loaded);
  const app = Object.values(appsMap).find((a) => a.slug === slug);
  const [asking, setAsking] = useState(false);
  const [goingBack, setGoingBack] = useState(false);
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
  const version = app.version ?? 1;
  const previous = app.history?.[0];
  return (
    <section className="apppage" aria-labelledby="app-title">
      <header className="apphead">
        {back}
        <h1 id="app-title">{title}</h1>
        {version > 1 ? <span className="mute appversion">{`Version ${version}`}</span> : null}
        <PinButton app={app} />
        <details className="appperms">
          <summary>{`Allowed (${(app.grants ?? []).length})`}</summary>
          <div className="appperms-body">
            <GrantList app={app} />
          </div>
        </details>
        {previous ? (
          <Button variant="quiet" onClick={() => setGoingBack(true)}>
            {`Back to version ${previous.version ?? version - 1}`}
          </Button>
        ) : null}
        <Button variant="quiet" onClick={() => setAsking(true)}>
          Remove
        </Button>
      </header>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      <AppFrame src={app.url} title={`${title} (app built by the city)`} appId={app.app_id} />
      {goingBack && previous ? (
        <Confirm
          title={`Go back to version ${previous.version ?? version - 1}?`}
          what={`Version ${version} is deleted and ${title} opens as it was before. Its saved data (such as scores) stays.`}
          cost={`Nothing to pay. Version ${version} can't be brought back, but you can ask AIC for the change again.`}
          confirmLabel="Go back"
          onCancel={() => setGoingBack(false)}
          onConfirm={async () => {
            setGoingBack(false);
            setError(null);
            try {
              await rollbackApp(app.app_id);
              toast({ text: `${title} is back to version ${previous.version ?? version - 1}.`, tone: "good" });
            } catch (e) {
              setError(problem(e));
            }
          }}
        />
      ) : null}
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

const problem = (e: unknown) =>
  e instanceof ApiError
    ? `${e.message}${e.fix ? ` ${e.fix}` : ""}`
    : e instanceof Error && e.message
      ? e.message
      : "That did not go through. Nothing changed. Try again.";

/** ☆ / ★: pin the app to the top bar (at most six). */
export function PinButton({ app }: { app: CityApp }) {
  const title = capped(app.title, 40);
  return (
    <Button
      variant="quiet"
      className="pinbtn"
      label={app.pinned ? `Unpin ${title} from the top bar` : `Pin ${title} to the top bar`}
      onClick={async () => {
        try {
          await updateApp(app.app_id, { pinned: !app.pinned });
          toast({ text: app.pinned ? `${title} left the top bar.` : `${title} is in the top bar.`, tone: "good" });
        } catch (e) {
          toast({ text: problem(e), tone: "bad" });
        }
      }}
    >
      <span aria-hidden="true">{app.pinned ? "★" : "☆"}</span>
    </Button>
  );
}

/** What the app may read, each with Stop. Grants only shrink here; a new one needs a new publish. */
export function GrantList({ app }: { app: CityApp }) {
  const [revoking, setRevoking] = useState<Capability | null>(null);
  const grants = (app.grants ?? []) as Capability[];
  const title = capped(app.title, 40);
  if (!grants.length) return <p className="mute">It may not read any of your data.</p>;
  return (
    <>
      <ul className="grants">
        {grants.map((g) => (
          <li key={capKey(g)}>
            <span>{capLabel(g) ?? capped(g.id, 40)}</span>
            <Button variant="quiet" onClick={() => setRevoking(g)} label={`Stop: ${capLabel(g) ?? g.id}`}>
              Stop
            </Button>
          </li>
        ))}
      </ul>
      {revoking ? (
        <Confirm
          title={`Stop ${title} from this?`}
          what={`${capLabel(revoking) ?? revoking.id}. It stops with its next request. To allow it again, ask AIC to build the app again.`}
          cost="Nothing to pay; the app may show less."
          confirmLabel="Stop it"
          onCancel={() => setRevoking(null)}
          onConfirm={async () => {
            const k = capKey(revoking);
            setRevoking(null);
            try {
              await updateApp(app.app_id, { grants: grants.filter((g) => capKey(g) !== k) });
              toast({ text: `${title} can no longer do that.`, tone: "good" });
            } catch (e) {
              toast({ text: problem(e), tone: "bad" });
            }
          }}
        />
      ) : null}
    </>
  );
}

/** Settings → Apps: pin and permissions for every app. */
export function SettingsApps() {
  const appsMap = useHud((s) => s.city.apps);
  useEffect(() => {
    loadApps().catch(() => undefined); // the snapshot's list is shown meanwhile
  }, []);
  const apps = appList(appsMap);
  return (
    <>
      <h2>Apps</h2>
      {apps.length ? (
        <ul className="settings-apps">
          {apps.map((a) => (
            <li key={a.app_id} className="card">
              <div className="row-between">
                <a href={`#/apps/${encodeURIComponent(a.slug)}`}>{capped(a.title, 40)}</a>
                <PinButton app={a} />
              </div>
              <GrantList app={a} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mute">No apps yet. Ask AIC for one.</p>
      )}
      <p className="mute">{`Up to ${MAX_PINS} apps fit in the top bar.`}</p>
    </>
  );
}

/** Pinned apps' icons for the top bar; `inNav` is the phone copy inside the scrolling nav row. */
export function PinnedApps({ inNav = false }: { inNav?: boolean }) {
  const appsMap = useHud((s) => s.city.apps);
  const pins = pinnedApps(appsMap);
  if (!pins.length) return null;
  const links = pins.map((a) => (
    <a
      key={a.app_id}
      className={`pin ${inNav ? "pin-nav" : ""}`}
      href={`#/apps/${encodeURIComponent(a.slug)}`}
      aria-label={capped(a.title, 40)}
      title={capped(a.title, 40)}
    >
      <AppIcon app={a} size={28} />
    </a>
  ));
  return inNav ? (
    <>{links}</>
  ) : (
    <nav className="pins" aria-label="Pinned apps">
      {links}
    </nav>
  );
}
