// The AgentCore Runtime container: plain HTTP on port 8080 (TLS ends at AgentCore), ARM64.
// GET /ping reports Healthy or HealthyBusy (an async worker job is still running).
// POST /invocations runs one turn; worker jobs are accepted at once and run in the background.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { LambdaClient } from "@aws-sdk/client-lambda";
import {
  CAPS_CONFIG,
  LambdaFactoryClient,
  awsCity,
  log,
  requireEnv,
  startupGuard,
  type Invocation,
  type Role,
} from "@aic/shared";
import { sdkEngine } from "./engine.ts";
import { AgentHost } from "./host.ts";

export function createRuntimeServer(host: Pick<AgentHost, "runTurn">) {
  let running = 0;
  let lastUpdate = Math.floor(Date.now() / 1000);
  const json = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const read = (req: IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      let b = "";
      req.on("data", (c: Buffer) => {
        b += c.toString("utf8");
        if (b.length > 1_000_000) reject(new Error("payload too large"));
      });
      req.on("end", () => resolve(b));
      req.on("error", reject);
    });
  const track = async (p: Promise<unknown>) => {
    running++;
    lastUpdate = Math.floor(Date.now() / 1000);
    try {
      await p;
    } finally {
      running--;
      lastUpdate = Math.floor(Date.now() / 1000);
    }
  };
  return createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/ping")
      return json(res, 200, { status: running ? "HealthyBusy" : "Healthy", time_of_last_update: lastUpdate });
    if (req.method !== "POST" || req.url !== "/invocations") return json(res, 404, { error: "not found" });
    let inv: Invocation;
    try {
      inv = JSON.parse(await read(req)) as Invocation;
      if (!inv?.id || !inv.role || !inv.agentId) throw new Error("bad invocation");
    } catch {
      return json(res, 400, { status: "error", error: "invalid invocation" });
    }
    if (inv.async) {
      void track(host.runTurn(inv)).catch((e: unknown) =>
        log("error", "turn.failed", { agent: inv.agentId, ticket: inv.ticketId, error: (e as Error).name }),
      );
      return json(res, 202, { status: "accepted" });
    }
    try {
      let response = "";
      await track(host.runTurn(inv).then((t) => (response = t)));
      return json(res, 200, { status: "success", response });
    } catch (e) {
      log("error", "turn.failed", { agent: inv.agentId, ticket: inv.ticketId, error: (e as Error).name });
      return json(res, 500, { status: "error", error: (e as Error).name });
    }
  });
}

/** Entry point inside the container. */
export function main(env: NodeJS.ProcessEnv = process.env) {
  startupGuard(env); // refuse to start without Bedrock, or with any other credential
  const role = requireEnv("AIC_ROLE", env) as Role;
  const city = awsCity(env);
  const factory = new LambdaFactoryClient(new LambdaClient({ region: city.region }), env.AIC_FACTORY_FUNCTION ?? "");
  const host = new AgentHost(
    {
      ledger: city.ledger,
      bus: city.bus,
      queue: city.queue,
      factory,
      settings: city.settings,
      maxReviewRounds: CAPS_CONFIG.max_review_rounds,
    },
    {
      engine: sdkEngine,
      role,
      timeoutMs:
        (role === "worker" ? CAPS_CONFIG.async_job_soft_limit_minutes : CAPS_CONFIG.turn_timeout_minutes) * 60_000,
    },
  );
  createRuntimeServer(host).listen(Number(env.PORT ?? 8080), "0.0.0.0");
  log("info", "runtime.started", { role });
}

if (process.env.AIC_RUNTIME_MAIN === "1") main();
