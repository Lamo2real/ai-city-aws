// The owner's "start over" (Settings): the server empties the city, this device forgets its conversation, and the
// page reloads into an empty town. The server refuses anything but an explicit confirm.
import { api } from "./api.ts";
import { store } from "./store.ts";

export interface ResetResult {
  gone: Record<string, number>;
  records: number;
}

export async function startOver(reload: () => void = () => location.reload()): Promise<ResetResult> {
  const r = await api<ResetResult>("/city/reset", { method: "POST", body: { confirm: true } });
  store.set({ chat: [] });
  reload();
  return r;
}
