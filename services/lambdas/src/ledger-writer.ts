// EventBridge rule → this Lambda: every city event is appended to its ticket's trace in the ledger,
// so a ticket's full story survives. Events are validated; anything else is ignored.
import { CityEvent, awsCity, type Ledger } from "@aic/shared";

export interface BridgeEvent {
  "detail-type": string;
  detail: unknown;
}

export function ticketOf(e: CityEvent): string | null {
  switch (e.type) {
    case "ticket.status":
      return e.ticket.id;
    case "review.result":
    case "signoff.result":
    case "result":
    case "instruction":
      return e.ticket_id;
    case "question.asked":
      return e.question.ticket_id;
    default:
      return null;
  }
}

export async function writeEvent(raw: BridgeEvent, ledger: Ledger): Promise<boolean> {
  const parsed = CityEvent.safeParse(raw.detail);
  if (!parsed.success) return false;
  const ticket = ticketOf(parsed.data);
  if (ticket) await ledger.appendEvent(ticket, parsed.data);
  return Boolean(ticket);
}

let ledger: Ledger | undefined;
export const handler = async (raw: BridgeEvent) => writeEvent(raw, (ledger ??= awsCity().ledger));
