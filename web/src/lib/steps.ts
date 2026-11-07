// AIC's visible steps while it works ("chain of thought" in the owner's words): plain phrases made from the
// activity events the runtime sends for agent "ace". The detail is the tool AIC called (see runtime/direct.py).
// Never model reasoning: only what AIC does.
const BY_TOOL: Record<string, string> = {
  get_status: "Checking the ledger",
  list_notes: "Reading your notes",
  add_note: "Saving a note",
  add_reminder: "Setting a reminder",
  delegate_to_orchestrator: "Handing this to the Orchestrator",
  instruct_agent: "Passing your instruction on",
  answer_question: "Answering a question from the team",
  pause_city: "Pausing the City",
  resume_city: "Resuming the City",
};
const BY_ACTIVITY: Record<string, string> = {
  understanding: "Understanding your message",
  answering: "Answering a question from the team",
  delegating: "Handing this to the Orchestrator",
  asking: "Asking you a question",
  reading: "Reading",
  researching: "Looking things up",
  reviewing: "Reviewing",
  reporting: "Writing a report",
};
export const FIRST_STEP = BY_ACTIVITY.understanding!;

/** The phrase for one activity event, or null for "idle" (the turn is over, not a step). */
export function stepWords(activity: string, detail?: string | null): string | null {
  if (activity === "idle") return null;
  const tool = (detail ?? "").replace(/^mcp__city__/, "");
  return BY_TOOL[tool] ?? BY_ACTIVITY[activity] ?? "Working on it";
}
