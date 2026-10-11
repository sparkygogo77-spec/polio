import { allowed } from "../../../features/studio/siteFetch.ts";
import { safeFetch } from "../../../features/studio/siteResolve.ts";
import { FONT_FILE_MAX } from "../../../features/studio/look/fonts.ts";

/** The longest one face may take to arrive, budget or no budget. */
export const FONT_WAIT_MS = 8_000;

/** Less than this left of the budget is no time to start a fetch. */
const TOO_LATE_MS = 1_000;

/**
 * A font file, fetched by this server. The same bounds as the page: public
 * https only, with the name resolved and every redirect checked before it
 * is followed (`safeFetch`), so a page cannot point this server at
 * something inside its own network. Refused past the size a face may weigh,
 * and after eight seconds, with the reason said rather than a silent
 * fallback.
 *
 * And never past `until`, the moment the element route must answer by
 * (rule 8b). Faces are fetched one after another, and two hosts that each
 * stalled for their eight seconds took the read past the route's minute,
 * so the platform killed it with no answer. Now each wait is cut to what
 * is left, and once less than a second is left a face is not fetched at
 * all: it is kept by its address, "out of time", and the read answers.
 */
export async function fetchFont(url: string, until: number): Promise<{ bytes: Uint8Array } | { error: string }> {
  const gate = allowed(url);
  if (!gate.ok) return { error: gate.says };
  const left = Math.min(FONT_WAIT_MS, until - Date.now());
  if (left < TOO_LATE_MS) return { error: "out of time" };
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), left);
  try {
    const r = await safeFetch(gate.url, { signal: stop.signal, headers: { accept: "font/woff2,font/woff,font/ttf,font/otf,*/*;q=0.5" } });
    if (!(r instanceof Response)) return { error: r.says };
    if (!r.ok) return { error: `it answered ${r.status}` };
    const said = Number(r.headers.get("content-length") ?? 0);
    if (said > FONT_FILE_MAX) return { error: `its file is ${Math.round(said / 1024)}KB, past the ${Math.round(FONT_FILE_MAX / 1024)}KB a face may weigh` };
    const buf = new Uint8Array(await r.arrayBuffer());
    return { bytes: buf };
  } catch (err) {
    return {
      error: err instanceof Error && err.name === "AbortError"
        ? left < FONT_WAIT_MS ? "out of time" : "no answer within eight seconds"
        : err instanceof Error ? err.message.split("\n")[0] ?? "no answer" : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
