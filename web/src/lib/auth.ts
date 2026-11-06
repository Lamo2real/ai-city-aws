// Cognito managed login with the authorization code flow and PKCE. MFA (TOTP) and the first-login
// password change happen on Cognito's own pages. Tokens stay in sessionStorage (gone when the tab
// closes); the refresh token renews them before they expire.
import { config } from "./config.ts";

const KEY = "aic.tokens";
const VERIFIER = "aic.pkce";

export interface Tokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export function readTokens(): Tokens | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Tokens | null;
    return t?.idToken ? t : null;
  } catch {
    return null;
  }
}
function saveTokens(t: Tokens) {
  sessionStorage.setItem(KEY, JSON.stringify(t));
}
export function signOutLocally() {
  sessionStorage.removeItem(KEY);
}

export async function loginUrl(): Promise<string> {
  const c = config();
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.setItem(VERIFIER, verifier);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const p = new URLSearchParams({
    response_type: "code",
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    scope: "openid email profile",
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  return `https://${c.cognitoDomain}/oauth2/authorize?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const c = config();
  const r = await fetch(`https://${c.cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, ...body }),
  });
  if (!r.ok) throw new Error("Sign-in did not finish.");
  const j = (await r.json()) as { id_token: string; access_token: string; refresh_token?: string; expires_in: number };
  return {
    idToken: j.id_token,
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? body.refresh_token,
    expiresAt: Date.now() + j.expires_in * 1000,
  };
}

/** Completes the redirect back from Cognito, if this page load is one. */
export async function finishLogin(): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  if (!code) return false;
  const verifier = sessionStorage.getItem(VERIFIER) ?? "";
  sessionStorage.removeItem(VERIFIER);
  saveTokens(
    await tokenRequest({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: config().redirectUri,
    }),
  );
  history.replaceState(null, "", location.pathname + location.hash);
  return true;
}

/** A valid ID token, refreshed if it expires within two minutes. Null means: sign in again. */
export async function idToken(): Promise<string | null> {
  const t = readTokens();
  if (!t) return null;
  if (t.expiresAt - Date.now() > 120_000) return t.idToken;
  if (!t.refreshToken) return null;
  try {
    const next = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refreshToken });
    saveTokens(next);
    return next.idToken;
  } catch {
    signOutLocally();
    return null;
  }
}

export function logoutUrl(): string {
  const c = config();
  return `https://${c.cognitoDomain}/logout?${new URLSearchParams({ client_id: c.clientId, logout_uri: c.redirectUri })}`;
}
