// The one dropdown of the whole HUD (the owner, 2026-11-09, decision 149): our own glass-and-amber list instead of the
// browser's native menu, used by every screen. It takes the same props as <select> with <option> children, so a
// screen swaps `select` for `Select` and nothing else changes; onChange gets `{ target: { value } }`.
// Accessible as a combobox with a listbox: the wrapping <label> names it; arrows, Home/End, Enter, Space, Escape
// and typing the first letters work; the list opens in a portal so no card or label can clip or re-trigger it.
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Opt = { value: string; label: ReactNode; text: string; disabled: boolean };

export type SelectProps = {
  value?: string | number;
  /** Uncontrolled, like <select defaultValue>. */
  defaultValue?: string;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

function textOf(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement(n)) return textOf((n.props as { children?: ReactNode }).children);
  return "";
}

export function optionsOf(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  for (const c of Children.toArray(children)) {
    if (!isValidElement(c)) continue;
    const el = c as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === "option") {
      const label = el.props.children;
      out.push({
        value: String(el.props.value ?? textOf(label)),
        label,
        text: textOf(label),
        disabled: !!el.props.disabled,
      });
    } else if (el.props.children) {
      out.push(...optionsOf(el.props.children));
    }
  }
  return out;
}

export function Select(p: SelectProps) {
  const opts = optionsOf(p.children);
  const [own, setOwn] = useState(p.defaultValue ?? opts[0]?.value ?? "");
  const value = p.value !== undefined ? String(p.value) : own;
  const at = Math.max(
    0,
    opts.findIndex((o) => o.value === value),
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(at);
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const auto = useId();
  const listId = `${p.id ?? auto}-list`;
  const current = opts[at];

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 240 && r.top > below;
    setBox({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: r.width, up });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const on = () => place();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    if (p.disabled) return;
    setActive(at);
    setOpen(true);
  };
  const choose = (i: number) => {
    const o = opts[i];
    if (!o || o.disabled) return;
    setOpen(false);
    btn.current?.focus();
    if (o.value === value) return;
    if (p.value === undefined) setOwn(o.value);
    p.onChange({ target: { value: o.value } });
  };
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < opts.length; i += dir) if (!opts[i]!.disabled) return i;
    return from;
  };

  const key = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      setActive((i) => step(i, k === "ArrowDown" ? 1 : -1));
    } else if (k === "Home" || k === "End") {
      if (!open) return;
      e.preventDefault();
      setActive(k === "Home" ? step(-1, 1) : step(opts.length, -1));
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (open) choose(active);
      else show();
    } else if (k === "Escape" || k === "Tab") {
      if (open && k === "Escape") e.preventDefault();
      setOpen(false);
    } else if (k.length === 1 && /\S/.test(k)) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + k.toLowerCase(), at: now };
      const i = opts.findIndex((o) => !o.disabled && o.text.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) {
        if (open) setActive(i);
        else choose(i);
      }
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        id={p.id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={p["aria-label"]}
        aria-labelledby={p["aria-labelledby"]}
        data-value={value}
        disabled={p.disabled}
        className={`aselect${open ? " is-open" : ""}${p.className ? ` ${p.className}` : ""}`}
        onClick={(e) => {
          e.preventDefault();
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={key}
      >
        <span className="aselect-value">{current?.label ?? ""}</span>
        <svg className="aselect-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && box
        ? createPortal(
            <ul
              ref={list}
              id={listId}
              role="listbox"
              className={`aselect-list${box.up ? " is-up" : ""}`}
              style={{
                left: box.left,
                minWidth: box.width,
                ...(box.up ? { bottom: window.innerHeight - box.top } : { top: box.top }),
              }}
            >
              {opts.map((o, i) => (
                <li
                  key={`${o.value}-${i}`}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === at}
                  aria-disabled={o.disabled || undefined}
                  className={`aselect-opt${i === active ? " is-active" : ""}${i === at ? " is-chosen" : ""}`}
                  onPointerMove={() => !o.disabled && setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                >
                  <span>{o.label}</span>
                  {i === at ? (
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
