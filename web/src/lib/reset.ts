// The owner's "start over" (Settings): the server empties the city, this device forgets its conversation, and the
// page reloads into an empty town. The server refuses anything but an explicit confirm. A big city is cleared in
// rounds (each answers within the server's time limit and says whether more is left), so this keeps asking until
// the server says it is done; the first reset ever stopped halfway and left three departments standing.
import { api } from "./api.ts";
import { store } from "./store.ts";

export interface ResetResult {
  gone: Record<string, number>;
  records: number;
  /** Missing on an older server, which cleared everything in one go. */
  done?: boolean;
}

const MAX_ROUNDS = 400;

export async function startOver(
  reload: () => void = () => location.reload(),
  onProgress: (records: number) => void = () => undefined,
): Promise<ResetResult> {
  const gone: Record<string, number> = {};
  let records = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const r = await api<ResetResult>("/city/reset", { method: "POST", body: { confirm: true } });
    for (const [kind, n] of Object.entries(r.gone ?? {})) gone[kind] = (gone[kind] ?? 0) + n;
    records += r.records ?? 0;
    onProgress(records);
    if (r.done !== false) {
      store.set({ chat: [] });
      reload();
      return { gone, records, done: true };
    }
  }
  throw new Error("The city is still being cleared. Hold Start over once more to finish.");
}
