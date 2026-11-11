// VAIC for Mac and Windows: one window onto the live HUD (docs/DESKTOP.md, decision in docs/DECISIONS.md).
// It loads the site rather than a copy of it, so every deploy reaches the app at once and the HUD's own address,
// sign-in and allowed origins work unchanged. The rules for what the window may do are in policy.js.
import { app, BrowserWindow, session, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { appUrl, navigateAction, newWindowAction, permissionAllowed, plainUserAgent } from "./policy.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_ = appUrl(app.isPackaged, process.env.VAIC_DESKTOP_URL);

/** No Node.js, no preload, sandboxed, isolated: the page has the same powers as a browser tab, nothing more. */
const WEB_PREFERENCES = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  nodeIntegrationInSubFrames: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: false,
  spellcheck: true,
};

if (!app.requestSingleInstanceLock()) app.quit();

let main = null;

function openExternal(url) {
  shell.openExternal(url).catch(() => undefined);
}

/** The rules every window follows; `signIn` windows may visit a provider's https pages. */
function guard(win, { signIn }) {
  const wc = win.webContents;
  const onNavigate = (e, url) => {
    const action = navigateAction(url, { signIn, app: URL_ });
    if (action === "allow") return;
    e.preventDefault();
    if (action === "external") openExternal(url);
  };
  wc.on("will-navigate", onNavigate);
  wc.on("will-redirect", (e, url) => {
    // A redirect in the main window that leaves the HUD is stopped (a sign-in window may follow the provider's).
    if (navigateAction(url, { signIn, app: URL_ }) === "allow") return;
    e.preventDefault();
  });
  wc.on("will-attach-webview", (e) => e.preventDefault());
  wc.setWindowOpenHandler(({ url }) => {
    const action = newWindowAction(url, URL_);
    if (action === "external") openExternal(url);
    if (action !== "window") return { action: "deny" };
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        width: 520,
        height: 720,
        autoHideMenuBar: true,
        backgroundColor: "#0b0d10",
        webPreferences: WEB_PREFERENCES,
      },
    };
  });
  wc.on("did-create-window", (child) => guard(child, { signIn: true }));
}

function showOffline(win) {
  const page = path.join(HERE, "offline.html");
  win.loadFile(page, { query: { to: URL_ } }).catch(() => undefined);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 380,
    minHeight: 560,
    title: "VAIC",
    backgroundColor: "#0b0d10",
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: WEB_PREFERENCES,
  });
  guard(win, { signIn: false });
  // The offline page may go back to the HUD, nowhere else (it is a local file, so it is checked here too).
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 /* aborted */ && !url.startsWith("file:")) showOffline(win);
  });
  win.loadURL(URL_).catch(() => showOffline(win));
  win.on("closed", () => {
    if (main === win) main = null;
  });
  return win;
}

function lockSession() {
  const s = session.defaultSession;
  s.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(permissionAllowed(permission, details.requestingUrl ?? wc.getURL(), details, URL_));
  });
  s.setPermissionCheckHandler((_wc, permission, origin, details) =>
    permissionAllowed(permission, details?.requestingUrl ?? origin, details, URL_),
  );
  // Sign-in pages (Google and others) refuse browsers that call themselves Electron.
  s.setUserAgent(plainUserAgent(s.getUserAgent()));
}

/** Windows only: new versions from GitHub Releases. The Mac app updates only when signed (docs/DESKTOP.md). */
async function checkForUpdates() {
  if (!app.isPackaged || process.platform !== "win32") return;
  try {
    const { default: updater } = await import("electron-updater");
    await updater.autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.warn("update check failed", e?.message ?? e);
  }
}

app.on("second-instance", () => {
  if (!main) return;
  if (main.isMinimized()) main.restore();
  main.focus();
});

app.on("web-contents-created", (_e, wc) => {
  // Belt and braces: no window may be created with Node or without the sandbox, whoever asks.
  wc.on("will-attach-webview", (e) => e.preventDefault());
});

app.whenReady().then(async () => {
  app.setName("VAIC");
  lockSession();
  // The microphone: macOS and Windows ask once, the first time the voice button is used (NSMicrophoneUsageDescription).
  main = createWindow();
  checkForUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) main = createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
