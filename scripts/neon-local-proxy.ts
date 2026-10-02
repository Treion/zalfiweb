/**
 * Local stand-in for Neon's serverless endpoints, so development runs exactly the same driver
 * code as production (including Edge functions, which cannot open TCP sockets).
 *
 * HTTP (the storefront's reads, `drizzle-orm/neon-http`):
 *   POST /sql  { query, params } | { queries: [{ query, params }] }
 *   headers:   Neon-Connection-String: postgresql://...
 *   response:  { fields: [{ name, dataTypeID }], rows: [[text, ...]], rowCount, command }
 *   Values are returned as raw Postgres text; the Neon client parses them, as it does in production.
 *
 * WebSocket (transactions, `drizzle-orm/neon-serverless` Pool; see src/server/db/pool.ts):
 *   ws://127.0.0.1:4444/v2?address=host:port   a raw Postgres wire-protocol pipe, like Neon's own
 *   WebSocket proxy, to the local server.
 *
 * Run: npm run db:proxy   (dev only; never deploy this)
 */
import http from "node:http";
import net from "node:net";
import pg from "pg";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.NEON_LOCAL_PROXY_PORT ?? 4444);
const pools = new Map<string, pg.Pool>();
const rawText = { getTypeParser: () => (v: string) => v };

function poolFor(conn: string) {
  let pool = pools.get(conn);
  if (!pool) {
    pool = new pg.Pool({ connectionString: conn, max: 5 });
    pools.set(conn, pool);
  }
  return pool;
}

type Q = { query: string; params?: unknown[] };

async function run(client: pg.PoolClient, q: Q) {
  const r = await client.query({
    text: q.query,
    values: q.params ?? [],
    rowMode: "array",
    types: rawText,
  });
  return {
    fields: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: r.rows,
    rowCount: r.rowCount,
    command: r.command,
  };
}

const server = http.createServer(async (req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  if (req.method !== "POST" || !req.url?.startsWith("/sql")) return res.writeHead(404, cors).end();

  const conn = req.headers["neon-connection-string"];
  if (typeof conn !== "string") {
    return res
      .writeHead(400, cors)
      .end(JSON.stringify({ message: "Missing Neon-Connection-String" }));
  }
  let body = "";
  for await (const chunk of req) body += chunk;

  const client = await poolFor(conn).connect();
  try {
    const payload = JSON.parse(body) as Q | { queries: Q[] };
    let out: unknown;
    if ("queries" in payload) {
      await client.query("BEGIN");
      const results = [];
      for (const q of payload.queries) results.push(await run(client, q));
      await client.query("COMMIT");
      out = { results };
    } else {
      out = await run(client, payload);
    }
    res.writeHead(200, cors).end(JSON.stringify(out));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    const err = e as pg.DatabaseError;
    res.writeHead(400, cors).end(
      JSON.stringify({
        message: err.message,
        code: err.code,
        detail: err.detail,
        constraint: err.constraint,
      }),
    );
  } finally {
    client.release();
  }
});

// WebSocket ⇄ TCP: each socket carries one Postgres connection, byte for byte
const LOCAL = new Set(["localhost", "127.0.0.1", "db.localtest.me"]);
const wss = new WebSocketServer({ server, path: "/v2" });
wss.on("connection", (socket, req) => {
  const address =
    new URL(req.url ?? "", "http://x").searchParams.get("address") ?? "localhost:5432";
  const [host, port] = address.split(":");
  if (!LOCAL.has(host)) return socket.close(1008, "local databases only");
  const tcp = net.connect(Number(port || 5432), "127.0.0.1");
  socket.binaryType = "nodebuffer";
  socket.on("message", (data) => tcp.write(data as Buffer));
  tcp.on("data", (chunk) => socket.readyState === socket.OPEN && socket.send(chunk));
  const close = () => {
    tcp.destroy();
    if (socket.readyState === socket.OPEN) socket.close();
  };
  socket.on("close", close);
  socket.on("error", close);
  tcp.on("close", close);
  tcp.on("error", close);
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`neon-local-proxy listening on http://127.0.0.1:${PORT}/sql and ws://…/v2`),
);
