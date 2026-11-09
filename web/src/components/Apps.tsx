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
  updateApp,
  type Capability,
} from "../lib/apps.ts";
import { registerFrame } from "../lib/bridge.ts";
import { ApiError } from "../lib/api.ts";
import { config } from "../lib/config.ts";
import { useHud } from "../lib/store.ts";
import { Button, Confirm, toast } from "./ui.tsx";

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

export function AppIcon({ app, size = 64 }: { app: CityApp; size?: number }) {
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

export const problem = (e: unknown) =>
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
          what={`${capLabel(revoking) ?? revoking.id}. It stops with its next request. To allow it again, ask VAIC to build the app again.`}
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
        <p className="mute">No apps yet. Ask VAIC for one.</p>
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
