// The EventBridge implementation of the city bus. Events are validated before they leave.
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { CityEvent, type CityEventInput, type EventBus } from "./events.ts";

export const EVENT_SOURCE = "aic.city";

export class EventBridgeBus implements EventBus {
  constructor(
    private client: Pick<EventBridgeClient, "send">,
    private busName: string,
  ) {}
  async put(event: CityEventInput): Promise<void> {
    const e = CityEvent.parse({ ...event, at: new Date().toISOString() });
    const r = await this.client.send(
      new PutEventsCommand({
        Entries: [{ EventBusName: this.busName, Source: EVENT_SOURCE, DetailType: e.type, Detail: JSON.stringify(e) }],
      }),
    );
    if (r.FailedEntryCount) throw new Error(`event bus refused ${e.type}: ${r.Entries?.[0]?.ErrorCode ?? "unknown"}`);
  }
}
