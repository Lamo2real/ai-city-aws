// AI workflows (docs/PRODUCT.md "AI workflows"): VAIC recognises a workflow in the owner's words (a Meta Ads or
// Google Ads campaign, an App build), and once the owner says yes it walks the owner through it one page at a time (mode
// "guide") or does it (mode "do"). Missing inputs are asked one at a time in VAIC's chat. Runs come from
// `GET /workflows` and stay current through `workflow.updated` events. A 404 means the backend is not deployed
// yet: nothing to show.
import { useSyncExternalStore } from "react";
import { api, ApiError } from "./api.ts";

export type WorkflowMode = "guide" | "do";
export type RunStatus = "proposed" | "active" | "running" | "done" | "cancelled";
export interface WorkflowConnector {
  /** null: the workflow needs nothing outside the city (an app the city builds). */
  id: string | null;
  label: string | null;
  connected: boolean;
  where: string | null;
}
/** A taste question (decision 127): the team asks, goes on with `default`, and the owner's pick adjusts it later. */
export interface TasteQuestion {
  id: string;
  question: string;
  options: string[];
  default: string;
  status: "open" | "answered";
  answer: string | null;
  asked_by: string;
}
export interface RunInput {
  key: string;
  label: string;
  question: string;
  /** Display text ("300 per day"), or null while VAIC still has to ask. */
  value: string | null;
  /** The owner is away and this is the default; it is also a taste question they can change. */
  assumed?: boolean;
}
export interface RunNext {
  kind: "confirm_workflow" | "connect" | "mode" | "input" | "confirm" | "go" | "step" | "none";
  key?: string;
  question?: string;
  options?: string[];
}
export interface RunStep {
  id: string;
  title: string;
  /** The page's words, with the owner's values already filled in. */
  guide: string;
  /** Keys of the inputs on this page. */
  inputs: string[];
  done: boolean;
}
export interface RunSpend {
  daily: number;
  currency: string | null;
  start: string | null;
  end: string | null;
  days: number | null;
  total: number | null;
  text: string;
}
export interface WorkflowRun {
  id: string;
  workflow_id: string;
  name: string;
  summary: string;
  connector: WorkflowConnector;
  mode: WorkflowMode | null;
  status: RunStatus;
  inputs: RunInput[];
  next: RunNext;
  /** 0-based current page (guide mode). */
  step: number;
  steps: RunStep[];
  spend: RunSpend | null;
  task_id: string | null;
  /** True when the owner said they are here to decide; false = away (things with a default are assumed). */
  present?: boolean;
  taste?: TasteQuestion[];
  conversation: string;
  created_at: string;
  updated_at: string;
}
export interface Workflow {
  id: string;
  name: string;
  summary: string;
  connector: WorkflowConnector;
  steps: Array<{ id: string; title: string }>;
}

const path = (id: string) => `/workflows/runs/${encodeURIComponent(id)}`;
export const workflowsApi = {
  list: () => api<{ workflows: Workflow[]; runs: WorkflowRun[] }>("/workflows"),
  get: (id: string) => api<{ run: WorkflowRun }>(path(id)),
  step: (id: string, to: "next" | "back" | "done") =>
    api<{ run: WorkflowRun }>(`${path(id)}/step`, { method: "POST", body: { to } }),
  mode: (id: string, mode: WorkflowMode) =>
    api<{ run: WorkflowRun }>(`${path(id)}/mode`, { method: "POST", body: { mode } }),
  cancel: (id: string) => api<{ run: WorkflowRun }>(`${path(id)}/cancel`, { method: "POST" }),
  answerTaste: (id: string, answer: string) =>
    api<{ result: string }>(`/workflows/taste/${encodeURIComponent(id)}`, { method: "POST", body: { answer } }),
};

const OPEN: RunStatus[] = ["proposed", "active", "running"];
const newest = (a: WorkflowRun, b: WorkflowRun) =>
  (b.created_at || b.updated_at || "").localeCompare(a.created_at || a.updated_at || "");

/** The run the walkthrough card shows: the newest open one in this conversation, or null. */
export function currentRun(runs: Record<string, WorkflowRun>, conversation: string): WorkflowRun | null {
  return (
    Object.values(runs)
      .filter((r) => r.conversation === conversation && OPEN.includes(r.status))
      .sort(newest)[0] ?? null
  );
}

interface State {
  runs: Record<string, WorkflowRun>;
  /** `/workflows` answered 404: the backend isn't there yet. */
  missing: boolean;
}

type Listener = () => void;
class WorkflowStore {
  state: State = { runs: {}, missing: false };
  private listeners = new Set<Listener>();
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
  /** Adds or replaces a run, unless what we hold is newer (events and API answers can cross). */
  put(run: WorkflowRun | undefined | null) {
    if (!run?.id) return;
    const had = this.state.runs[run.id];
    if (had && had.updated_at && run.updated_at && had.updated_at > run.updated_at) return;
    this.set({ runs: { ...this.state.runs, [run.id]: run } });
  }
  async load() {
    try {
      const r = await workflowsApi.list();
      const runs: Record<string, WorkflowRun> = {};
      for (const x of r.runs ?? []) if (x?.id) runs[x.id] = x;
      this.set({ runs, missing: false });
    } catch (e) {
      // Not deployed yet (404): nothing to show. Other problems: keep what we have; events still arrive.
      if (e instanceof ApiError && e.status === 404) this.set({ runs: {}, missing: true });
    }
  }
  /** WebSocket events; only "workflow.updated" is ours. */
  event(e: { type: string; [k: string]: unknown }) {
    if (e.type !== "workflow.updated") return;
    this.put(e.run as WorkflowRun | undefined);
  }
}

export const workflows = new WorkflowStore();
export const useWorkflows = <T>(pick: (s: State) => T): T =>
  useSyncExternalStore(workflows.subscribe, () => pick(workflows.get()));
