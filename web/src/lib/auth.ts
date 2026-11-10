// Sign-in with our own screens, straight against Cognito (no hosted pages). The Amplify Auth library does
// the SRP exchange (the password itself is never sent), the first-login "choose your own password" step,
// the authenticator-app (TOTP) setup and code steps, "forgot password", and token refresh. Tokens stay in
// sessionStorage, so they are gone when the tab closes.
//
// Everything goes through the small AuthClient interface below. Tests (and the Playwright journeys) put a
// fake on window.__vaicAuth; production uses Amplify.
import { config } from "./config.ts";

/** What the owner has to do next. */
export type SignInStep =
  | { kind: "done" }
  | { kind: "new_password" }
  | { kind: "totp_setup"; secret: string; uri: string }
  | { kind: "totp_code" };

export interface AuthClient {
  signIn(email: string, password: string): Promise<SignInStep>;
  /** First login: replace the temporary password with the owner's own. */
  setNewPassword(password: string): Promise<SignInStep>;
  /** Confirms the authenticator app (setup) or a sign-in code with a 6-digit code. */
  confirmCode(code: string): Promise<SignInStep>;
  /** Sends a reset code by email. */
  forgotPassword(email: string): Promise<void>;
  confirmForgotPassword(email: string, code: string, password: string): Promise<void>;
  /** A sign-in was stored on this device before this check (it may since have expired or been revoked). */
  hadSession?(): boolean;
  /** A valid ID token (refreshed when needed, or always with fresh=true), or null: sign in again. */
  idToken(fresh?: boolean): Promise<string | null>;
  signOut(): Promise<void>;
}

/** Plain words for Cognito's errors. Never the raw message (it can name the user pool). */
export function authProblem(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAuthorizedException":
      return "That email or password is not right. Check both and try again.";
    case "UserNotFoundException":
      return "That email or password is not right. Check both and try again.";
    case "CodeMismatchException":
    case "EnableSoftwareTokenMFAException":
      return "That code is not right. Use the newest 6-digit code from your authenticator app.";
    case "ExpiredCodeException":
      return "That code has expired. Ask for a new one and try again.";
    case "InvalidPasswordException":
    case "InvalidParameterException":
      return "The new password does not meet the rules below.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "Too many tries. Wait a few minutes, then try again.";
    case "PasswordResetRequiredException":
      return "Your password must be reset. Use “Forgot your password?” below.";
    default:
      return "Signing in did not work. Check your connection and try again.";
  }
}

export const PASSWORD_RULES =
  "At least 14 characters, with an uppercase letter, a lowercase letter, a number and a symbol.";

export function passwordProblem(p: string): string | null {
  if (p.length < 14) return "Use at least 14 characters.";
  if (!/[a-z]/.test(p)) return "Add a lowercase letter.";
  if (!/[A-Z]/.test(p)) return "Add an uppercase letter.";
  if (!/[0-9]/.test(p)) return "Add a number.";
  if (!/[^A-Za-z0-9]/.test(p)) return "Add a symbol, like ! or #.";
  return null;
}

// ---------- the Amplify implementation ----------
type AmplifyAuth = typeof import("aws-amplify/auth");

function amplifyClient(): AuthClient {
  let ready: Promise<AmplifyAuth> | null = null;
  const auth = () =>
    (ready ??= (async () => {
      const [{ Amplify }, mod, { cognitoUserPoolsTokenProvider }, { defaultStorage }] = await Promise.all([
        import("aws-amplify"),
        import("aws-amplify/auth"),
        import("aws-amplify/auth/cognito"),
        import("aws-amplify/utils"),
      ]);
      const c = config();
      Amplify.configure({ Auth: { Cognito: { userPoolId: c.userPoolId, userPoolClientId: c.clientId } } });
      // localStorage, not sessionStorage (the owner's choice, 2026-11-07): the refresh token survives closing the
      // tab or restarting the device, so the owner signs in once and stays signed in (docs/SECURITY.md).
      cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage);
      return mod;
    })());

  let email = "";
  const step = (out: Awaited<ReturnType<AmplifyAuth["signIn"]>>): SignInStep => {
    if (out.isSignedIn) return { kind: "done" };
    const n = out.nextStep;
    switch (n.signInStep) {
      case "DONE":
        return { kind: "done" };
      case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
        return { kind: "new_password" };
      case "CONTINUE_SIGN_IN_WITH_TOTP_SETUP":
        return {
          kind: "totp_setup",
          secret: n.totpSetupDetails.sharedSecret,
          uri: n.totpSetupDetails.getSetupUri("AI City", email).toString(),
        };
      case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
        return { kind: "totp_code" };
      default:
        throw Object.assign(new Error(`unsupported sign-in step ${n.signInStep}`), { name: "UnsupportedStep" });
    }
  };

  return {
    async signIn(e, password) {
      const a = await auth();
      email = e.trim().toLowerCase();
      await a.signOut().catch(() => undefined); // a half-finished earlier attempt must not get in the way
      return step(await a.signIn({ username: email, password, options: { authFlowType: "USER_SRP_AUTH" } }));
    },
    async setNewPassword(password) {
      return step(await (await auth()).confirmSignIn({ challengeResponse: password }));
    },
    async confirmCode(code) {
      return step(await (await auth()).confirmSignIn({ challengeResponse: code.trim() }));
    },
    async forgotPassword(e) {
      await (await auth()).resetPassword({ username: e.trim().toLowerCase() });
    },
    async confirmForgotPassword(e, code, password) {
      await (
        await auth()
      ).confirmResetPassword({
        username: e.trim().toLowerCase(),
        confirmationCode: code.trim(),
        newPassword: password,
      });
    },
    hadSession: storedSession,
    async idToken(fresh = false) {
      try {
        // Expired ID tokens are refreshed here with the stored refresh token (rotation stays on).
        const s = await (await auth()).fetchAuthSession({ forceRefresh: fresh });
        return s.tokens?.idToken?.toString() ?? null;
      } catch {
        return null;
      }
    },
    async signOut() {
      await (await auth()).signOut().catch(() => undefined);
    },
  };
}

/** Amplify keeps the refresh token under CognitoIdentityServiceProvider.<client>.<user>.refreshToken. */
function storedSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith("CognitoIdentityServiceProvider.") && k.endsWith(".refreshToken")) return true;
    }
  } catch {
    /* no storage */
  }
  return false;
}

export type BootAuth = { state: "ready" } | { state: "signed_out"; note: string | null } | { state: "offline" };
export const SESSION_ENDED =
  "Your sign-in on this device has ended (it expired or was signed out elsewhere). Please sign in again.";

/** On start: use the stored sign-in (refreshing it silently); only show sign-in when there is none or it was
 *  rejected. Offline with a stored sign-in is not a sign-out: try again later. */
export async function bootAuth(
  client: AuthClient = auth(),
  online: () => boolean = () => navigator.onLine,
): Promise<BootAuth> {
  const had = client.hadSession?.() ?? false;
  if (await client.idToken()) return { state: "ready" };
  if (had && !online()) return { state: "offline" };
  return { state: "signed_out", note: had ? SESSION_ENDED : null };
}

/** Sign out: Cognito tokens (Amplify revokes the refresh token) and this device's conversation and draft. */
export async function signOutHere() {
  await auth().signOut();
  try {
    for (const k of ["vaic.chat", "vaic.draft", "vaic.cards"]) localStorage.removeItem(k);
  } catch {
    /* no storage */
  }
}

let client: AuthClient | null = null;
/** The auth client: a test fake on window.__vaicAuth when present, else Amplify. */
export function auth(): AuthClient {
  const fake = (window as unknown as { __vaicAuth?: AuthClient }).__vaicAuth;
  if (fake) return fake;
  return (client ??= amplifyClient());
}

/** A valid ID token for API calls, WebSocket and voice. Null means: sign in again. */
export const idToken = (fresh = false): Promise<string | null> => auth().idToken(fresh);
