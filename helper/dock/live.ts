/**
 * The dock's line to the real helper (helper/server/server.ts). The dock is
 * served by the helper, so every call is same-origin and the pairing token
 * never leaves this frame: it is a Bearer header, never a URL, kept in this
 * frame's own storage (the Builder page can't read another origin's).
 *
 *   pair     POST /pair/start shows a code on the PC; POST /pair {code} → token
 *   stream   GET /stream: a snapshot, then contract messages and site calls,
 *            one JSON per line (blank lines are the helper's heartbeat)
 *   request  POST /request → {ok, plan}
 *   control  POST /control (always by "j")
 *   site     POST /site/reply with the Builder's answer to a site call
 *
 * A 401 anywhere means the token is gone (the helper restarted, or J
 * pressed Unpair): it is dropped and the dock asks to pair again.
 */
import { problems, type Control, type Message, type Plan, type Request } from "../contract.ts";

const KEY = "polio-helper-token";

/** A site call the helper relays from a lane (helper/mcp/site.ts → bridge.ts). */
export type SiteCall = { kind: "site"; lane: string; request: Record<string, unknown> & { id: string } };

export type LiveEvents = {
  message(m: Message): void;
  site(call: SiteCall): void;
  /** "pair" when a token is needed, "live" once the stream is open, "down" while the helper can't be reached. */
  state(s: "pair" | "live" | "down", why?: string): void;
};

export type Live = ReturnType<typeof liveHelper>;

const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (t: string | null) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* storage blocked: the token lives in memory only */ } },
};

export function liveHelper(on: LiveEvents, { base = "", retryMs = 2000 } = {}) {
  let token = store.get();
  let stopped = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const forget = (why: string) => { token = null; store.set(null); reader?.cancel().catch(() => {}); on.state("pair", why); };
  type Reply = { status: number; ok?: boolean; error?: string; [k: string]: unknown };
  const call = async (path: string, body?: unknown): Promise<Reply> => {
    const res = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
    });
    const out = await res.json().catch(() => ({})) as { ok?: boolean; error?: string } & Record<string, unknown>;
    if (res.status === 401) forget(out.error ?? "pair again");
    return { status: res.status, ...out };
  };

  /** One line off the stream: a site call, or a contract message (checked before it is used). */
  const line = (text: string) => {
    if (!text.trim()) return;
    let m: unknown;
    try { m = JSON.parse(text); } catch { return; }
    const x = m as SiteCall;
    if (x && x.kind === "site" && typeof x.lane === "string" && x.request && typeof x.request.id === "string") return on.site(x);
    if (problems(m).length) { console.warn("dock: dropped", m, problems(m)); return; }
    on.message(m as Message);
  };

  async function stream() {
    while (!stopped) {
      if (!token) { on.state("pair"); return; }
      try {
        const res = await fetch(`${base}/stream`, { headers: { authorization: `Bearer ${token}` } });
        if (res.status === 401) { forget("pair again"); return; }
        if (!res.ok || !res.body) throw new Error(`the helper said ${res.status}`);
        on.state("live");
        reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let at: number;
          while ((at = buf.indexOf("\n")) >= 0) { line(buf.slice(0, at)); buf = buf.slice(at + 1); }
        }
      } catch (e) {
        if (!token) return;
        on.state("down", String((e as Error).message ?? e));
      }
      if (!token || stopped) return;
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }

  return {
    get paired() { return token !== null; },
    start: () => { void stream(); },
    stop: () => { stopped = true; reader?.cancel().catch(() => {}); },
    pairStart: () => call("/pair/start"),
    async pair(code: string) {
      const r = await call("/pair", { code });
      if (r.ok && typeof r.token === "string") { token = r.token; store.set(token); void stream(); }
      return r;
    },
    async request(r: Request): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> {
      const out = await call("/request", r);
      return out.ok ? { ok: true, plan: out.plan as Plan } : { ok: false, error: out.error ?? `the helper said ${out.status}` };
    },
    async control(c: Control): Promise<{ ok: boolean; error?: string }> {
      const out = await call("/control", c);
      return { ok: !!out.ok, error: out.error };
    },
    siteReply: (reply: unknown) => call("/site/reply", reply),
  };
}
