import { describe, expect, it } from "vitest";
import { everyWords, label, orderWords, type StandingOrder } from "../src/lib/away.ts";
import { backAction } from "../src/components/Away.tsx";

const order = (o: Partial<StandingOrder>): StandingOrder => ({
  id: "so",
  source: "jira",
  department: "Customer Support",
  every_minutes: 15,
  enabled: true,
  ...o,
});

describe("Autopilot in plain words", () => {
  it("says how often", () => {
    expect(everyWords(15)).toBe("every 15 minutes");
    expect(everyWords(60)).toBe("every hour");
    expect(everyWords(120)).toBe("every 2 hours");
    expect(everyWords(1440)).toBe("every day");
  });

  it("says a standing order as one sentence", () => {
    expect(orderWords(order({}))).toBe("Every 15 minutes, Customer Support handles new Jira tickets.");
    expect(orderWords(order({ source: "slack", department: "", every_minutes: 60 }))).toBe(
      "Every hour, the team handles new Slack messages.",
    );
    expect(orderWords(order({ what: "New Zendesk tickets." }))).toBe(
      "Every 15 minutes, Customer Support handles new Zendesk tickets.",
    );
    expect(orderWords(order({ source: "acme" }))).toBe("Every 15 minutes, Customer Support handles new Acme work.");
  });

  it("finds a line in whatever shape a job or handled item comes", () => {
    expect(label("Fixed the bug")).toBe("Fixed the bug");
    expect(label({ id: "j", name: "Build the page", status: "Done" })).toBe("Build the page");
    expect(label({ source: "jira", item: "SUP-1", summary: "Answered SUP-1" })).toBe("Answered SUP-1");
    expect(label({ id: "x" })).toBe("");
  });

  it("gives each When you're back item one button that does it", () => {
    expect(backAction({ id: "1", title: "t", why: "Slack needs you to sign in again.", service: "slack" })).toEqual({
      label: "Sign in to Slack",
      signin: { kind: "connector", id: "slack" },
    });
    expect(backAction({ id: "2", title: "t", why: "Needs a new API key.", service: "heygen" }).href).toBe(
      "#/settings/connectors",
    );
    expect(backAction({ id: "3", title: "t", why: "GitHub refused the token.", service: "github" }).href).toBe(
      "#/settings/github",
    );
    expect(backAction({ id: "4", title: "t", why: "Only you can pay the invoice.", service: "" }).href).toBe(
      "#/settings/open-items",
    );
  });
});
