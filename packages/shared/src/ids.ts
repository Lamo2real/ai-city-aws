// Session and record IDs. AgentCore session IDs must be at least 33 characters, so short ones are padded.
import { randomUUID } from "node:crypto";

const slug = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "x";
export const departmentKey = (name: string): string => slug(name);
const pad = (s: string): string => (s.length >= 33 ? s : `${s}-${"0".repeat(33 - s.length - 1)}`);

export const sessionIds = {
  ace: (owner: string, conversation: string) => pad(`ace-${slug(owner)}-${slug(conversation)}`),
  orchestrator: (taskId: string) => pad(`orch-${slug(taskId)}`),
  manager: (department: string, taskId: string) => pad(`mgr-${slug(department)}-${slug(taskId)}`),
  worker: (department: string, hireId: string) => pad(`wkr-${slug(department)}-${slug(hireId)}`),
};

export const newId = (prefix: string): string => `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
export const managerId = (department: string): string => `mgr-${departmentKey(department)}`;
