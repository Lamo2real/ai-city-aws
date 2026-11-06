// The Agent Factory Lambda, invoked by manager runtimes. It owns hire validation and the agent records.
import { Factory, awsCity, log, type FactoryClient, type HireSpec } from "@aic/shared";

export type FactoryRequest =
  | { action: "hire"; spec: HireSpec; managerId: string; department: string }
  | { action: "release"; workerId: string; managerId: string };

export async function handleFactory(req: FactoryRequest, factory: FactoryClient) {
  try {
    const agent =
      req.action === "hire"
        ? await factory.hire(req.spec, req.managerId, req.department)
        : await factory.release(req.workerId, req.managerId);
    log("info", `factory.${req.action}`, { agent: agent.id, department: agent.department });
    return { ok: true, agent };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

let cached: Factory | undefined;
export const handler = (req: FactoryRequest) => {
  if (!cached) {
    const city = awsCity();
    cached = new Factory(city.ledger, city.bus, city.settings);
  }
  return handleFactory(req, cached);
};
