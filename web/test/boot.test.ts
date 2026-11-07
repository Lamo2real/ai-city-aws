import { describe, expect, it } from "vitest";
import { bootAuth, SESSION_ENDED, type AuthClient } from "../src/lib/auth.ts";

const client = (token: string | null, had: boolean) =>
  ({ idToken: async () => token, hadSession: () => had }) as unknown as AuthClient;

describe("starting AI City with a stored sign-in", () => {
  it("a stored sign-in that refreshes opens the app, no sign-in screen", async () => {
    expect(await bootAuth(client("id.token.sig", true), () => true)).toEqual({ state: "ready" });
  });
  it("a refresh that is rejected (expired or revoked) shows sign-in with a plain message", async () => {
    expect(await bootAuth(client(null, true), () => true)).toEqual({ state: "signed_out", note: SESSION_ENDED });
  });
  it("first visit: plain sign-in, no message", async () => {
    expect(await bootAuth(client(null, false), () => true)).toEqual({ state: "signed_out", note: null });
  });
  it("offline with a stored sign-in is not a sign-out: try again later", async () => {
    expect(await bootAuth(client(null, true), () => false)).toEqual({ state: "offline" });
  });
});
