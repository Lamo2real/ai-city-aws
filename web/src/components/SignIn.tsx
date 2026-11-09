// AI City's own sign-in screens (no Cognito hosted pages). One task per screen, one primary button,
// plain words, and every step of the first login spelled out:
//   1. sign in with the temporary password from the email
//   2. choose your own password
//   3. connect an authenticator app (scan the QR code, type the 6-digit code)
// Later sign-ins: email + password, then the 6-digit code. There is no "register": only the owner exists.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { PASSWORD_RULES, auth, authProblem, passwordProblem, type SignInStep } from "../lib/auth.ts";
import { config } from "../lib/config.ts";
import { Eyes } from "./Eyes.tsx";
import { Banner, Button } from "./ui.tsx";

type Screen =
  | { s: "signin" }
  | { s: "new_password" }
  | { s: "totp_setup"; secret: string; uri: string }
  | { s: "totp_code" }
  | { s: "forgot" }
  | { s: "forgot_confirm" }
  | { s: "invite" };

const FIRST_LOGIN_STEPS = 3;

function Field(p: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  inputMode?: "numeric" | "email" | "text";
  hint?: string;
  autoFocus?: boolean;
  id: string;
}) {
  return (
    <label className="field" htmlFor={p.id}>
      {p.label}
      <input
        id={p.id}
        type={p.type ?? "text"}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        autoComplete={p.autoComplete}
        inputMode={p.inputMode}
        autoFocus={p.autoFocus}
        spellCheck={false}
        autoCapitalize="none"
        required
      />
      {p.hint ? <span className="mute small">{p.hint}</span> : null}
    </label>
  );
}

function PasswordRules({ password }: { password: string }) {
  const rules: Array<[string, boolean]> = [
    ["At least 14 characters", password.length >= 14],
    ["An uppercase letter", /[A-Z]/.test(password)],
    ["A lowercase letter", /[a-z]/.test(password)],
    ["A number", /[0-9]/.test(password)],
    ["A symbol, like ! or #", /[^A-Za-z0-9]/.test(password)],
  ];
  return (
    <ul className="rules" aria-label="Password rules">
      {rules.map(([text, ok]) => (
        <li key={text} className={ok ? "ok" : ""}>
          <span aria-hidden="true">{ok ? "✓" : "○"}</span> {text}
          <span className="sr-only">{ok ? " (done)" : " (not yet)"}</span>
        </li>
      ))}
    </ul>
  );
}

function Card(p: { title: string; step?: number; children: ReactNode }) {
  return (
    <main className="signin" aria-labelledby="signin-title">
      <div className="signin-card">
        <div className="signin-brand">
          <Eyes presence="idle" small />
          <span className="wordmark">
            <span className="wm-mark">AI</span> <span className="wm-word">City</span>
          </span>
        </div>
        {p.step ? (
          <p className="mute small" aria-label={`Step ${p.step} of ${FIRST_LOGIN_STEPS}`}>
            {`First sign-in · step ${p.step} of ${FIRST_LOGIN_STEPS}`}
          </p>
        ) : null}
        <h1 id="signin-title">{p.title}</h1>
        {p.children}
      </div>
    </main>
  );
}

async function requestFirstLoginEmail(email: string): Promise<void> {
  const r = await fetch(`${config().apiUrl}/auth/first-login-email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!r.ok && r.status !== 202) throw new Error("not sent");
}

export function SignIn({ onSignedIn, note = null }: { onSignedIn: () => void; note?: string | null }) {
  const [screen, setScreen] = useState<Screen>({ s: "signin" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [firstLogin, setFirstLogin] = useState(false);

  const go = (s: Screen) => {
    setProblem(null);
    setCode("");
    setScreen(s);
  };
  const next = (step: SignInStep) => {
    if (step.kind === "done") return onSignedIn();
    if (step.kind === "new_password") setFirstLogin(true);
    if (step.kind === "totp_setup") return go({ s: "totp_setup", secret: step.secret, uri: step.uri });
    go({ s: step.kind });
  };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setProblem(authProblem(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (screen.s !== "totp_setup") return;
    let live = true;
    void import("qrcode")
      .then((q) => q.toDataURL(screen.uri, { margin: 1, width: 220 }))
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [screen]);

  const submit = (fn: () => Promise<void>) => (e: FormEvent) => {
    e.preventDefault();
    void run(fn);
  };
  const newPasswordProblem =
    newPassword && repeat && newPassword !== repeat ? "The two passwords are not the same." : null;

  const banners = (
    <>
      {note && !problem ? <Banner tone="info">{note}</Banner> : null}
      {problem ? <Banner tone="bad">{problem}</Banner> : null}
      {notice ? <Banner tone="good">{notice}</Banner> : null}
    </>
  );

  switch (screen.s) {
    case "signin":
      return (
        <Card title="Sign in to AI City">
          <p className="mute">
            Use your email and password. The first time, use the temporary password from the email “Welcome to AI City”.
          </p>
          {banners}
          <form
            onSubmit={submit(async () => {
              setNotice(null);
              next(await auth().signIn(email, password));
            })}
          >
            <Field
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={setEmail}
              autoFocus
            />
            <Field
              id="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
            <label className="switch">
              <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> Show
              password
            </label>
            <div className="signin-actions">
              <Button variant="primary" type="submit" disabled={busy || !email || !password}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </div>
          </form>
          <div className="signin-links">
            <button type="button" className="link" onClick={() => go({ s: "forgot" })}>
              Forgot your password?
            </button>
            <button type="button" className="link" onClick={() => go({ s: "invite" })}>
              First time here, or the temporary password expired?
            </button>
          </div>
        </Card>
      );

    case "new_password":
      return (
        <Card title="Choose your own password" step={2}>
          <p className="mute">
            You signed in with the temporary password. Now choose your own; you will use it from now on.
          </p>
          {banners}
          <form
            onSubmit={submit(async () => {
              const bad =
                passwordProblem(newPassword) ?? (newPassword !== repeat ? "The two passwords are not the same." : null);
              if (bad) return setProblem(bad);
              next(await auth().setNewPassword(newPassword));
            })}
          >
            <Field
              id="new-password"
              label="New password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              autoFocus
            />
            <Field
              id="repeat-password"
              label="Type it again"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={repeat}
              onChange={setRepeat}
            />
            <label className="switch">
              <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> Show
              password
            </label>
            <PasswordRules password={newPassword} />
            {newPasswordProblem ? (
              <p className="field-error" role="alert">
                {newPasswordProblem}
              </p>
            ) : null}
            <div className="signin-actions">
              <Button
                variant="primary"
                type="submit"
                disabled={busy || passwordProblem(newPassword) !== null || newPassword !== repeat}
              >
                Save my password
              </Button>
            </div>
          </form>
        </Card>
      );

    case "totp_setup":
      return (
        <Card title="Connect an authenticator app" step={firstLogin ? 3 : undefined}>
          <p className="mute">
            AI City asks for a 6-digit code from your phone every time you sign in. Set it up once:
          </p>
          {banners}
          <ol className="steps">
            <li>
              Open an authenticator app on your phone, for example Microsoft Authenticator, Google Authenticator or
              1Password.
            </li>
            <li>
              Add an account and scan this code:
              <div className="qr">
                {qr ? <img src={qr} alt="QR code for your authenticator app" width={220} height={220} /> : null}
              </div>
              <span className="mute small">Can’t scan? Type this key instead:</span>
              <code className="secret" aria-label="Setup key">
                {screen.secret.replace(/(.{4})/g, "$1 ").trim()}
              </code>
            </li>
            <li>Type the 6-digit code the app shows for AI City.</li>
          </ol>
          <form onSubmit={submit(async () => next(await auth().confirmCode(code)))}>
            <Field
              id="setup-code"
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            />
            <div className="signin-actions">
              <Button variant="primary" type="submit" disabled={busy || code.length !== 6}>
                Confirm and sign in
              </Button>
            </div>
          </form>
        </Card>
      );

    case "totp_code":
      return (
        <Card title="Enter your 6-digit code">
          <p className="mute">Open your authenticator app and type the code shown for AI City.</p>
          {banners}
          <form onSubmit={submit(async () => next(await auth().confirmCode(code)))}>
            <Field
              id="mfa-code"
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              autoFocus
            />
            <div className="signin-actions">
              <Button variant="primary" type="submit" disabled={busy || code.length !== 6}>
                Sign in
              </Button>
            </div>
          </form>
          <div className="signin-links">
            <button type="button" className="link" onClick={() => go({ s: "signin" })}>
              Start again
            </button>
          </div>
        </Card>
      );

    case "forgot":
      return (
        <Card title="Reset your password">
          <p className="mute">We email you a code. Then you choose a new password.</p>
          {banners}
          <form
            onSubmit={submit(async () => {
              await auth().forgotPassword(email);
              go({ s: "forgot_confirm" });
            })}
          >
            <Field
              id="reset-email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={setEmail}
              autoFocus
            />
            <div className="signin-actions">
              <Button variant="primary" type="submit" disabled={busy || !email}>
                Email me a code
              </Button>
            </div>
          </form>
          <div className="signin-links">
            <button type="button" className="link" onClick={() => go({ s: "signin" })}>
              Back to sign in
            </button>
          </div>
        </Card>
      );

    case "forgot_confirm":
      return (
        <Card title="Choose a new password">
          <p className="mute">{`We sent a code to ${email || "your email"}. It can take a minute to arrive.`}</p>
          {banners}
          <form
            onSubmit={submit(async () => {
              const bad =
                passwordProblem(newPassword) ?? (newPassword !== repeat ? "The two passwords are not the same." : null);
              if (bad) return setProblem(bad);
              await auth().confirmForgotPassword(email, code, newPassword);
              setPassword("");
              setNotice("Your new password is saved. Sign in with it.");
              go({ s: "signin" });
            })}
          >
            <Field
              id="reset-code"
              label="Code from the email"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 8))}
              autoFocus
            />
            <Field
              id="reset-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
            />
            <Field
              id="reset-repeat"
              label="Type it again"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={setRepeat}
            />
            <PasswordRules password={newPassword} />
            <div className="signin-actions">
              <Button
                variant="primary"
                type="submit"
                disabled={busy || !code || passwordProblem(newPassword) !== null || newPassword !== repeat}
              >
                Save new password
              </Button>
            </div>
          </form>
          <div className="signin-links">
            <button type="button" className="link" onClick={() => go({ s: "signin" })}>
              Back to sign in
            </button>
          </div>
        </Card>
      );

    case "invite":
      return (
        <Card title="Get a new first-login email">
          <p className="mute">
            We email you a new temporary password and the steps to sign in. It works only for the owner’s email, and at
            most once every 10 minutes.
          </p>
          {banners}
          <form
            onSubmit={submit(async () => {
              try {
                await requestFirstLoginEmail(email);
              } catch {
                setProblem("The email could not be requested. Check your connection and try again.");
                return;
              }
              setNotice(
                "If this is the owner’s email, a new first-login email is on its way. Check your inbox (and spam) for “Welcome to AI City”.",
              );
              go({ s: "signin" });
            })}
          >
            <Field
              id="invite-email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={setEmail}
              autoFocus
            />
            <div className="signin-actions">
              <Button variant="primary" type="submit" disabled={busy || !email}>
                Send me a new email
              </Button>
            </div>
          </form>
          <p className="mute small">Already chose your own password? Use “Forgot your password?” instead.</p>
          <div className="signin-links">
            <button type="button" className="link" onClick={() => go({ s: "signin" })}>
              Back to sign in
            </button>
          </div>
        </Card>
      );
  }
}

export { PASSWORD_RULES };
