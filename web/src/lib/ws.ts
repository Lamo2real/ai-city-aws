// The live connection: city events and Ace's streamed replies. Reconnects on its own with back-off,
// pings every 4 minutes so the connection stays listed, and tells listeners when it is up or down.
import { idToken } from "./auth.ts";
import { config } from "./config.ts";

export type LiveStatus = "connecting" | "online" | "reconnecting" | "signed_out";
type EventListener = (e: { type: string; [k: string]: unknown }) => void;
type StatusListener = (s: LiveStatus) => void;

export class Live {
  private ws: WebSocket | null = null;
  private tries = 0;
  private ping: ReturnType<typeof setInterval> | undefined;
  private events = new Set<EventListener>();
  private statuses = new Set<StatusListener>();
  status: LiveStatus = "connecting";
  private stopped = false;

  onEvent(l: EventListener) {
    this.events.add(l);
    return () => this.events.delete(l);
  }
  onStatus(l: StatusListener) {
    this.statuses.add(l);
    l(this.status);
    return () => this.statuses.delete(l);
  }
  private set(s: LiveStatus) {
    this.status = s;
    for (const l of this.statuses) l(s);
  }
  async start() {
    this.stopped = false;
    const token = await idToken();
    if (!token) return this.set("signed_out");
    const ws = new WebSocket(`${config().wsUrl}?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      this.set("online");
      clearInterval(this.ping);
      this.ping = setInterval(
        () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ action: "ping" })),
        240_000,
      );
    };
    ws.onmessage = (m) => {
      try {
        const e = JSON.parse(String(m.data)) as { type: string };
        if (e.type !== "pong") for (const l of this.events) l(e);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      clearInterval(this.ping);
      if (this.stopped) return;
      this.set("reconnecting");
      const delay = Math.min(30_000, 1000 * 2 ** this.tries++) * (0.5 + Math.random() / 2);
      setTimeout(() => void this.start(), delay);
    };
  }
  stop() {
    this.stopped = true;
    this.ws?.close();
  }
}

export const live = new Live();
