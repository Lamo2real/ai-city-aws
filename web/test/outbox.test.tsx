// What happens when something the owner does is refused: it is said in full, and nothing gets stuck behind it.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/api.ts", async (orig) => ({ ...(await orig<typeof import("../src/lib/api.ts")>()), api }));

import { ApiError } from "../src/lib/api.ts";
import { flushOutbox, keyBlocked, sendMessage } from "../src/lib/actions.ts";
import { store } from "../src/lib/store.ts";
import { Button, Toaster } from "../src/components/ui.tsx";

beforeEach(() => {
  api.mockReset();
  store.set({ chat: [] });
});
afterEach(cleanup);

describe("a message the server refuses", () => {
  it("says why in full, and is not sent again while later lines still go", async () => {
    render(<Toaster />);
    api.mockRejectedValueOnce(new ApiError("That message is too long.", 413, "Shorten it and send again."));
    await sendMessage("a very long message");
    expect(await screen.findByText("That message is too long. Shorten it and send again.")).toBeTruthy();
    expect(store.get().chat[0]).toMatchObject({ state: "failed", refused: true });

    api.mockRejectedValueOnce(new ApiError("No connection.", 0)); // offline: this one waits in the outbox
    await sendMessage("second");
    expect(store.get().chat[1]).toMatchObject({ state: "failed" });
    expect(store.get().chat[1]!.refused).toBeUndefined();

    api.mockReset();
    api.mockResolvedValue({});
    await flushOutbox();
    expect(api).toHaveBeenCalledTimes(1); // only the one that never arrived
    expect((api.mock.calls[0]![1] as { body: { text: string } }).body.text).toBe("second");
    expect(store.get().chat[1]!.state).toBe("sent");
  });

  it("keeps a key out of the chat and tells the caller, so the box keeps the words", () => {
    render(<Toaster />);
    expect(keyBlocked("sk-ant-api03-" + "a".repeat(40))).toBe(true);
    expect(keyBlocked("hello there")).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });
});

describe("a button whose action fails", () => {
  it("shows the error in full and can be pressed again", async () => {
    const press = vi.fn().mockRejectedValue(new ApiError("The mailbox said no.", 409, "Sign in to it again."));
    render(
      <>
        <Toaster />
        <Button onClick={press}>Remove</Button>
      </>,
    );
    fireEvent.click(screen.getByText("Remove"));
    expect(await screen.findByText("The mailbox said no. Sign in to it again.")).toBeTruthy();
    expect((screen.getByText("Remove") as HTMLButtonElement).disabled).toBe(false);
  });
});
