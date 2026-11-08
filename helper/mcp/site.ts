/**
 * THE SITE TOOLS AN AGENT GETS FOR THE OPEN SITE (AGENTS-PANEL-PROPOSAL.md,
 * "Where the work happens", site requests).
 *
 * A small MCP server (the standard way to give Claude Code tools) over
 * stdio, with these tools:
 *
 *   site.outline  every part in short: id, kind, box, first words
 *   site.read     the parts, pages, look and System of the site J has open, or chosen parts in full
 *   site.picked   what J has picked on the board
 *   site.at       the parts under a point, topmost first
 *   site.select   pick parts on the board
 *   site.shot     a picture reference of a page or a part (the helper shoots it)
 *   site.apply    a named list of board steps → one undo step on J's board
 *
 * The server holds nothing of the site. Every call is relayed to the helper
 * (`SITE_RELAY`, loopback), which hands it to the paired dock frame, which
 * posts it to the Builder page (`src/features/agents/bridge.ts`) and brings
 * the answer back. The agent sees neither the pairing token nor the dock: it
 * gets a lane ticket in its environment (`POLIO_SITE_TICKET`), good for
 * these calls and for its own lane only.
 *
 * Hand-rolled JSON-RPC rather than the MCP SDK: the helper has no
 * dependencies of its own, and the protocol here is five methods. Node 24
 * runs this file straight (`node helper/mcp/site.ts`).
 *
 * The pure parts (`SITE_TOOLS`, `toRequest`, `handle`) are what
 * `tests/agents-site-bridge.mjs` imports.
 */

export const SITE_RELAY = process.env.POLIO_SITE_RELAY ?? "http://127.0.0.1:47821/site";

/** The tools, as `tools/list` lists them. */
export const SITE_TOOLS = [
  {
    name: "site.read",
    description: "The site J has open in the Builder: its pages, every part (id, page, kind, label, words, box, colour, font, System links) and its System, with the board's `version`. A whole site is large: start from site.outline, and send `ids` for the parts you need in full. A part's `drawnPx` is the size its words are drawn at; `font.px` on a captured part is only the size its page set.",
    inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "string" }, description: "Only these parts, in full, without the look and the System." } }, additionalProperties: false },
  },
  {
    name: "site.outline",
    description: "Every part of the open site in short, page by page: id, kind, box [x, y, w, h] and first words, with the groups and the board's `version`. About a tenth of site.read. Read this first.",
    inputSchema: { type: "object", properties: { page: { type: "string", description: "Only this page." } }, additionalProperties: false },
  },
  {
    name: "site.picked",
    description: "What J has picked on the board now: each part's id, kind, box, words, name and drawn size.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "site.at",
    description: "The parts under a point on the open page, topmost first, as they are drawn now. x and y are the page's own pixels, the same as a part's box. `clicks` is false for a part a click passes through.",
    inputSchema: { type: "object", required: ["x", "y"], properties: { x: { type: "number" }, y: { type: "number" } }, additionalProperties: false },
  },
  {
    name: "site.select",
    description: "Pick parts on the board, as J's click would, so J sees which ones you mean. It changes nothing on the site and takes no undo step. The parts must be on the open page; an empty list lets go.",
    inputSchema: { type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string" } } }, additionalProperties: false },
  },
  {
    name: "site.shot",
    description: "A picture reference of a page, or of one part on it, as the board shows it now. Returns the board reference the helper shoots, the part's box, and where it is on screen.",
    inputSchema: { type: "object", properties: { page: { type: "string", description: "A page id from site.read; the open page when left out." }, part: { type: "string", description: "A part id from site.read." } }, additionalProperties: false },
  },
  {
    name: "site.apply",
    description: "Change the open site. One call is one undo step on J's board, named after `name` (\"calmer hero\" shows as \"Agent: calmer hero\"). Steps run through the Builder's own actions: updateNode {id, patch}, updatePage {id, patch}, setLook {patch}, removeNodes {ids}, setToken {id, value}, addNode {featureId, x, y, patch?, page?, as?} (later steps may use `as` as its id; the answer gives the real `added` ids), group {ids, label?}, ungroup {group}, reorder {id, to} where to is front, back, forward or backward in the stack, or earlier or later down the page, or reorder {id, above} or {id, below} another part, and setFont {id, px?, face?, weight?}, where px is the size the words are drawn at. Change a font with setFont, not patch.font.px. A step on a part that is not on the open site, or on keys, the Account or publishing, refuses the whole call, as does a call that would change nothing. Send `base` so a change written against an older copy of the board is refused; the answer gives the new `version` for the next call. More than 20 parts makes a copy of the site first and offers Compare.",
    inputSchema: {
      type: "object",
      required: ["site", "name", "steps"],
      properties: {
        site: { type: "string", description: "The site id from site.read. The call is refused for any other site." },
        name: { type: "string", description: "What this change is, in J's words: \"calmer hero\"." },
        base: { type: "string", description: "The `version` from the site.read or site.apply this change was written against." },
        steps: {
          type: "array", minItems: 1,
          items: {
            type: "object", required: ["op"],
            properties: {
              op: { type: "string", enum: ["updateNode", "updatePage", "setLook", "removeNodes", "setToken", "addNode", "group", "ungroup", "reorder", "setFont"] },
              id: { type: "string" }, ids: { type: "array", items: { type: "string" } },
              patch: { type: "object" }, value: { type: ["string", "number"] },
              featureId: { type: "string" }, x: { type: "number" }, y: { type: "number" }, page: { type: "string" }, as: { type: "string" },
              label: { type: "string" }, group: { type: "string" },
              to: { type: "string", enum: ["front", "back", "forward", "backward", "earlier", "later"] }, above: { type: "string" }, below: { type: "string" },
              px: { type: "number" }, face: { type: "string" }, weight: { type: "number" },
            },
          },
        },
      },
      additionalProperties: false,
    },
  },
] as const;

export type ToolName = (typeof SITE_TOOLS)[number]["name"];

/** The message the dock posts to the Builder for a tool call (`bridge.ts#SiteRequest`). */
export function toRequest(name: string, args: Record<string, unknown> | undefined, id: string): Record<string, unknown> | null {
  const a = args ?? {};
  const base = { source: "polio-dock", kind: "site", v: 1, id };
  switch (name) {
    case "site.read": return { ...base, op: "read", ...(a.ids !== undefined ? { ids: a.ids } : {}) };
    case "site.outline": return { ...base, op: "outline", ...(typeof a.page === "string" ? { page: a.page } : {}) };
    case "site.picked": return { ...base, op: "picked" };
    case "site.at": return { ...base, op: "at", x: a.x, y: a.y };
    case "site.select": return { ...base, op: "select", ids: a.ids };
    case "site.shot": return { ...base, op: "shot", ...(typeof a.page === "string" ? { page: a.page } : {}), ...(typeof a.part === "string" ? { part: a.part } : {}) };
    case "site.apply": return { ...base, op: "apply", site: a.site, name: a.name, steps: a.steps, ...(a.base !== undefined ? { base: a.base } : {}) };
    default: return null;
  }
}

type Rpc = { jsonrpc: "2.0"; id?: number | string | null; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { code: number; message: string } };
/** Sends a site request to the Builder and answers with its reply (`bridge.ts#SiteReply`); the stdio server's is `relay`. */
export type Send = (request: Record<string, unknown>) => Promise<{ ok: true; result: unknown } | { ok: false; says: string }>;

let seq = 0;
const text = (v: unknown) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v) }] });

/** One JSON-RPC message in, zero or one out. Pure but for `send`. */
export async function handle(msg: Rpc, send: Send): Promise<Rpc | null> {
  if (msg.method === undefined) return null;
  const reply = (result: unknown): Rpc => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const fail = (code: number, message: string): Rpc => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  switch (msg.method) {
    case "initialize":
      return reply({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "polio-site", version: "1" }, instructions: "Tools for the site J has open in the Builder. Read it first (site.outline, then site.read with ids for what you need in full), then change it in named steps (site.apply); each call is one undo step J can take back with Ctrl+Z." });
    case "notifications/initialized": return null;
    case "ping": return reply({});
    case "tools/list": return reply({ tools: SITE_TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? undefined) as Record<string, unknown> | undefined;
      const req = toRequest(name, args, `s${++seq}-${Date.now().toString(36)}`);
      if (!req) return fail(-32602, `unknown tool ${name}`);
      const got = await send(req);
      return reply(got.ok ? text(got.result) : { ...text(got.says), isError: true });
    }
    default:
      return msg.id === undefined ? null : fail(-32601, `method not found: ${msg.method}`);
  }
}

/** The stdio server's send: the helper's relay on loopback, with this lane's ticket. */
export const relay: Send = async (request) => {
  const ticket = process.env.POLIO_SITE_TICKET ?? "";
  try {
    const res = await fetch(SITE_RELAY, { method: "POST", headers: { "content-type": "application/json", "x-polio-lane": ticket }, body: JSON.stringify(request) });
    if (!res.ok) return { ok: false, says: `the helper refused the call (${res.status}): ${(await res.text()).slice(0, 200)}` };
    const body = (await res.json()) as { ok?: boolean; result?: unknown; says?: string };
    return body.ok ? { ok: true, result: body.result } : { ok: false, says: body.says ?? "the Builder refused the call" };
  } catch (e) {
    return { ok: false, says: `the helper can't be reached: ${(e as Error).message}` };
  }
};

/** Run as an MCP server over stdio, one JSON message per line. */
export function serve(send: Send = relay, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout): void {
  let buf = "";
  input.setEncoding?.("utf8");
  input.on("data", (chunk: string) => {
    buf += chunk;
    let at: number;
    while ((at = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, at).trim();
      buf = buf.slice(at + 1);
      if (!line) continue;
      let msg: Rpc;
      try { msg = JSON.parse(line) as Rpc; } catch { output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } })}\n`); continue; }
      void handle(msg, send).then((out) => { if (out) output.write(`${JSON.stringify(out)}\n`); });
    }
  });
}

const isMain = typeof process !== "undefined" && process.argv[1] && /[\\/]site\.(ts|mjs|js)$/.test(process.argv[1]) && !process.env.POLIO_SITE_NO_MAIN;
if (isMain) serve();
