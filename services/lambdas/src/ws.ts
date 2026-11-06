// WebSocket API: a Lambda authorizer that validates the Cognito token on $connect, connection
// bookkeeping in DynamoDB with a TTL, and a broadcaster that pushes every city event to the HUD.
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { CityEvent, DynamoTable, log, requireEnv, type Table } from "@aic/shared";

export const CONNECTION_TTL_SECONDS = 2 * 3600;

// ---------- authorizer ----------
export interface TokenVerifier {
  verify(token: string): Promise<{ sub: string; "cognito:groups"?: string[] }>;
}
export interface AuthorizerEvent {
  methodArn: string;
  queryStringParameters?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
}
export async function authorize(event: AuthorizerEvent, verifier: TokenVerifier) {
  // Browsers cannot set headers on a WebSocket, so the token travels as a subprotocol or query value.
  const proto = event.headers?.["Sec-WebSocket-Protocol"] ?? event.headers?.["sec-websocket-protocol"];
  const token =
    event.queryStringParameters?.token ??
    proto
      ?.split(",")
      .map((s) => s.trim())
      .find((s) => s.split(".").length === 3);
  const deny = {
    principalId: "anonymous",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [{ Action: "execute-api:Invoke", Effect: "Deny", Resource: event.methodArn }],
    },
  };
  if (!token) return deny;
  try {
    const claims = await verifier.verify(token);
    if (!claims["cognito:groups"]?.includes("owner")) return deny;
    return {
      principalId: claims.sub,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [{ Action: "execute-api:Invoke", Effect: "Allow", Resource: event.methodArn }],
      },
      context: { sub: claims.sub },
    };
  } catch {
    return deny;
  }
}

// ---------- connect / disconnect / default ----------
export interface WsEvent {
  requestContext: { routeKey: string; connectionId: string; authorizer?: { sub?: string } };
  body?: string;
}
export async function onConnection(event: WsEvent, table: Table, now = Date.now()) {
  const id = event.requestContext.connectionId;
  switch (event.requestContext.routeKey) {
    case "$connect":
      await table.put({
        pk: `CONN#${id}`,
        sk: "META",
        gsi1pk: "CONN",
        gsi1sk: id,
        connected_at: new Date(now).toISOString(),
        ttl: Math.floor(now / 1000) + CONNECTION_TTL_SECONDS,
      });
      return { statusCode: 200 };
    case "$disconnect":
      await table.delete(`CONN#${id}`, "META");
      return { statusCode: 200 };
    default:
      // Keep-alive: the HUD pings every few minutes; refreshing the TTL keeps the connection listed.
      await table.update(`CONN#${id}`, "META", {
        set: { ttl: Math.floor(now / 1000) + CONNECTION_TTL_SECONDS },
        mustExist: true,
      });
      return { statusCode: 200, body: JSON.stringify({ type: "pong" }) };
  }
}

// ---------- broadcast ----------
export interface Poster {
  post(connectionId: string, data: string): Promise<"ok" | "gone">;
}
export async function broadcast(
  detail: unknown,
  table: Table,
  poster: Poster,
): Promise<{ sent: number; gone: number }> {
  const parsed = CityEvent.safeParse(detail);
  if (!parsed.success) return { sent: 0, gone: 0 };
  const data = JSON.stringify(parsed.data);
  let sent = 0,
    gone = 0;
  const conns = await table.queryIndex("gsi1", "CONN");
  await Promise.all(
    conns.map(async (c) => {
      const id = String(c.gsi1sk);
      if ((await poster.post(id, data)) === "gone") {
        gone++;
        await table.delete(`CONN#${id}`, "META");
      } else sent++;
    }),
  );
  return { sent, gone };
}

// ---------- wiring ----------
let table: Table | undefined;
const connections = () =>
  (table ??= new DynamoTable(
    DynamoDBDocumentClient.from(new DynamoDBClient({ region: requireEnv("AWS_REGION") })),
    requireEnv("AIC_CONNECTIONS_TABLE"),
  ));

let verifier: TokenVerifier | undefined;
export const authorizerHandler = (event: AuthorizerEvent) =>
  authorize(
    event,
    (verifier ??= CognitoJwtVerifier.create({
      userPoolId: requireEnv("AIC_USER_POOL_ID"),
      clientId: requireEnv("AIC_USER_POOL_CLIENT_ID"),
      tokenUse: "id",
    }) as unknown as TokenVerifier),
  );

export const connectionHandler = (event: WsEvent) => onConnection(event, connections());

let poster: Poster | undefined;
export const broadcastHandler = async (event: { detail: unknown }) => {
  poster ??= (() => {
    const client = new ApiGatewayManagementApiClient({
      region: requireEnv("AWS_REGION"),
      endpoint: requireEnv("AIC_WS_ENDPOINT"),
    });
    return {
      async post(id: string, data: string) {
        try {
          await client.send(new PostToConnectionCommand({ ConnectionId: id, Data: new TextEncoder().encode(data) }));
          return "ok" as const;
        } catch (e) {
          if ((e as { name?: string }).name === "GoneException") return "gone" as const;
          throw e;
        }
      },
    };
  })();
  const r = await broadcast(event.detail, connections(), poster);
  log("info", "ws.broadcast", r);
  return r;
};
