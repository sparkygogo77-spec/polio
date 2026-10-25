/**
 * Lane tickets for the site relay (`POST /site`, helper/mcp/site.ts).
 *
 * A lane's agent gets its ticket in POLIO_SITE_TICKET, so the agent can read
 * it: a ticket is good for site.read, site.shot and site.apply on that one
 * lane and nothing else. It is never the pairing token, and never opens a
 * control. Only a SHA-256 of each ticket is kept, as with the pairing token.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Adapter, AgentRun, LaneSpec } from "../agents/types.ts";

const hash = (t: string) => createHash("sha256").update(t).digest("base64url");

export class SiteTickets {
  private byHash = new Map<string, string>();
  private byLane = new Map<string, string>();

  /** A new ticket for `lane`; the lane's old one stops working. */
  issue(lane: string): string {
    this.drop(lane);
    const t = randomBytes(24).toString("base64url");
    const h = hash(t);
    this.byHash.set(h, lane);
    this.byLane.set(lane, h);
    return t;
  }

  /** The lane a ticket belongs to, or null. */
  check(ticket: unknown): string | null {
    if (typeof ticket !== "string" || ticket.length < 16 || ticket.length > 128) return null;
    return this.byHash.get(hash(ticket)) ?? null;
  }

  drop(lane: string): void {
    const h = this.byLane.get(lane);
    if (h) this.byHash.delete(h);
    this.byLane.delete(lane);
  }
}

/**
 * A PC adapter whose lanes can reach the open site: each lane starts with
 * its own ticket in POLIO_SITE_TICKET (and the relay's address), and the
 * ticket is dropped when the lane ends. The site tools themselves come from
 * the `--mcp-config` file `siteMcpConfig` writes, passed on the command line.
 */
export function withSiteTickets(inner: Adapter, tickets: SiteTickets, relay: string): Adapter {
  return {
    ...inner,
    start(spec: LaneSpec): AgentRun {
      const ticket = tickets.issue(spec.lane);
      const run = inner.start({ ...spec, env: { ...spec.env, POLIO_SITE_TICKET: ticket, POLIO_SITE_RELAY: relay } });
      return {
        ...run,
        events: (async function* () {
          try { yield* run.events; } finally { tickets.drop(spec.lane); }
        })(),
      };
    },
  };
}

/** Writes the MCP config that gives a lane the site tools (helper/mcp/site.ts); answers its path. */
export function siteMcpConfig(stateDir: string): string {
  const file = join(stateDir, "site-mcp.json");
  mkdirSync(stateDir, { recursive: true });
  const server = fileURLToPath(new URL("../mcp/site.ts", import.meta.url));
  writeFileSync(file, JSON.stringify({ mcpServers: { "polio-site": { type: "stdio", command: process.execPath, args: [server] } } }, null, 2));
  return file;
}
