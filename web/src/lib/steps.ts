// VAIC's visible steps while it works ("chain of thought" in the owner's words): plain phrases made from the
// activity events the runtime sends for agent "vaic". The detail is the tool VAIC called (see runtime/direct.py).
// Never model reasoning: only what VAIC does.
const BY_TOOL: Record<string, string> = {
  get_status: "Checking how things are going",
  list_notes: "Reading your notes",
  add_note: "Saving a note",
  add_reminder: "Setting a reminder",
  start_job: "Passing this to my team",
  delegate_to_orchestrator: "Passing this to my team", // jobs from before decision 298
  instruct_agent: "Passing your instruction on",
  answer_question: "Answering a question from the team",
  search_knowledge: "Searching your knowledge base",
  add_to_knowledge: "Saving to your knowledge base",
  list_knowledge: "Looking through your knowledge base",
};
const BY_ACTIVITY: Record<string, string> = {
  understanding: "Understanding your message",
  answering: "Answering a question from the team",
  delegating: "Passing this to my team",
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
  if (detail?.startsWith("Running: ")) return detail; // VAIC's run_command says the command itself
  // A step the runtime already said in words ("Searched the web: …", decision 204), not a bare tool name.
  if (detail && /^[A-Z][a-z]+ /.test(detail)) return detail;
  const tool = (detail ?? "").replace(/^mcp__city__/, "");
  return BY_TOOL[tool] ?? BY_ACTIVITY[activity] ?? "Working on it";
}

/** VAIC's reply is "still running" while work it handed on (its tickets) has not finished or reported back. */
export function stepsRunning(line: { tasks?: { done: boolean }[] }): boolean {
  return !!line.tasks?.some((t) => !t.done);
}
