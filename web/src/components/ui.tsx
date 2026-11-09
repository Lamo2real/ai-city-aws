// The one design system: the same button, dialog, banner and toast everywhere.
import { useEffect, useRef, useState, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";
export function Button(p: {
  variant?: Variant;
  onClick?: () => void | Promise<unknown>;
  children: ReactNode;
  label?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (!p.onClick || busy) return;
    const r = p.onClick();
    if (r instanceof Promise) {
      setBusy(true);
      try {
        await r;
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <button
      type={p.type ?? "button"}
      className={`btn btn-${p.variant ?? "secondary"} ${p.className ?? ""}`}
      onClick={p.type === "submit" ? undefined : click}
      disabled={p.disabled || busy}
      aria-busy={busy || undefined}
      aria-label={p.label}
    >
      {busy ? <span className="spin" aria-hidden="true" /> : null}
      {p.children}
    </button>
  );
}

/** A live connection: a small green dot with a gentle pulse (still when the owner prefers less motion). */
export function LiveDot(p: { label?: string }) {
  return <span className="live-dot" role="img" aria-label={p.label ?? "Live"} />;
}

/** An error in full, with what to do about it when the API says (the owner's rule: never hide the reason). */
export function errorText(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e && (e as Error).message) {
    const fix = (e as { fix?: string | null }).fix;
    const msg = (e as Error).message;
    return fix && !msg.includes(fix) ? `${msg} ${fix}` : msg;
  }
  return fallback;
}

export function Banner(p: {
  tone: "info" | "warn" | "bad" | "good";
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={`banner banner-${p.tone}`} role={p.tone === "bad" ? "alert" : "status"}>
      <span>{p.children}</span>
      {p.action ? (
        <Button variant="quiet" onClick={p.action.onClick}>
          {p.action.label}
        </Button>
      ) : null}
    </div>
  );
}

/** Shows a skeleton at once and a plain sentence if loading takes more than 10 seconds. */
export function Loading(p: { what: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="skeleton" aria-hidden="true" />
      <div className="skeleton short" aria-hidden="true" />
      <span className="sr">{`Loading ${p.what}`}</span>
      {slow ? (
        <p className="mute">
          Still loading {p.what}. This is taking longer than usual; it will appear as soon as AI City answers.
        </p>
      ) : null}
    </div>
  );
}

/**
 * A confirmation that says in plain words what will happen and what it costs. Destructive ones
 * need a typed word ("confirmWord") or holding the button ("hold").
 */
export function Confirm(p: {
  title: string;
  what: string;
  cost: string;
  confirmLabel: string;
  confirmWord?: string;
  hold?: boolean;
  danger?: boolean;
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [held, setHeld] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && p.onCancel();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [p]);
  const ready =
    (!p.confirmWord || typed.trim().toLowerCase() === p.confirmWord.toLowerCase()) && (!p.hold || held >= 100);
  const startHold = () => {
    clearInterval(timer.current);
    timer.current = setInterval(() => setHeld((h) => Math.min(100, h + 5)), 50);
  };
  const stopHold = () => {
    clearInterval(timer.current);
    setHeld((h) => (h >= 100 ? h : 0));
  };
  return (
    <div className="scrim" role="presentation">
      <div className="dialog panel" role="dialog" aria-modal="true" aria-labelledby="dlg-title" ref={ref}>
        <h2 id="dlg-title">{p.title}</h2>
        <p>{p.what}</p>
        <p className="cost">
          <b>Cost:</b> {p.cost}
        </p>
        {p.confirmWord ? (
          <label className="field">
            Type <b>{p.confirmWord}</b> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
        ) : null}
        <div className="row-end">
          <Button variant="quiet" onClick={p.onCancel}>
            Cancel
          </Button>
          {p.hold ? (
            <button
              type="button"
              className={`btn ${p.danger ? "btn-danger" : "btn-primary"} hold`}
              style={{ ["--held" as string]: `${held}%` }}
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && startHold()}
              onKeyUp={stopHold}
              onClick={() => ready && void p.onConfirm()}
              aria-label={`Hold to ${p.confirmLabel.toLowerCase()}`}
            >
              {held >= 100 ? `Release to ${p.confirmLabel.toLowerCase()}` : `Hold to ${p.confirmLabel.toLowerCase()}`}
            </button>
          ) : (
            <Button variant={p.danger ? "danger" : "primary"} onClick={p.onConfirm} disabled={!ready}>
              {p.confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- toasts with Undo (at least 10 seconds) ----------
export interface Toast {
  id: number;
  text: string;
  undo?: () => void | Promise<unknown>;
  tone?: "good" | "bad" | "info";
}
let push: (t: Omit<Toast, "id">) => void = () => {};
export const toast = (t: Omit<Toast, "id">) => push(t);
export const UNDO_MS = 12_000;

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { ...t, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.undo ? UNDO_MS : 5000);
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone ?? "info"}`} role="status">
          <span>{t.text}</span>
          {t.undo ? (
            <Button
              variant="quiet"
              onClick={async () => {
                await t.undo!();
                setItems((xs) => xs.filter((x) => x.id !== t.id));
              }}
            >
              Undo
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Icons: one drawn set, 2px strokes, round joins.
const icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  "aria-hidden": true,
} as const;
export function MicIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
/** Dictate: a small mic beside lines of text (the words go into the box). */
export function DictateIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round">
      <rect x="4" y="3" width="5" height="9" rx="2.5" />
      <path d="M2 10a4.5 4.5 0 0 0 9 0M6.5 14.5V17M14 7h7M14 12h7M4 20h17" />
    </svg>
  );
}
export function SendIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />
    </svg>
  );
}
export function ClearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}
/** "While you were away": a small clock. */
export function ClockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
/** Voice conversation: a small waveform (Claude's voice-mode mark). */
export function WaveIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round">
      <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />
    </svg>
  );
}
// The + menu's icons (PlusMenu.tsx).
export function PlusIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function FilesIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <path d="m20.5 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.2 3.2 0 0 1 4.5 4.5L10 17a1.4 1.4 0 0 1-2-2l7.5-7.5" />
    </svg>
  );
}
export function FolderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}
export function SlashIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m14 8-4 8" />
    </svg>
  );
}
export function PlugIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4" />
    </svg>
  );
}
export function PuzzleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 4a2 2 0 1 1 4 0v1h4v4h1a2 2 0 1 1 0 4h-1v4h-4v1a2 2 0 1 1-4 0v-1H6v-4H5a2 2 0 1 1 0-4h1V5h4V4Z" />
    </svg>
  );
}
export function BackIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...icon} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
