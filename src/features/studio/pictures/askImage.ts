/**
 * The image route, asked until it is done.
 *
 * J (2026-10-12): GPT Image 1.5 and the 3D model were stopped at 55 s, the
 * server's own minute, while Replicate would have finished them. So the
 * browser says `keep`: the route draws for as long as one answer may take,
 * and when that runs out it answers `pending` with the predictions' ids
 * rather than cancelling them. This asks again with those ids until the
 * pictures are back, or until KEEP_TRYING_MS has passed, when it cancels
 * them and says so in plain words.
 *
 * A drop-in for `fetch("/api/studio/image", init)`: the same init, and a
 * Response whose JSON is the route's final answer.
 */
export const KEEP_TRYING_MS = 5 * 60_000;

export async function askImage(init: RequestInit & { body: string }): Promise<Response> {
  const asked = JSON.parse(init.body) as Record<string, unknown>;
  const began = Date.now();
  let resume: string[] | undefined;
  for (;;) {
    const res = await fetch("/api/studio/image", { ...init, body: JSON.stringify({ ...asked, keep: true, ...(resume ? { resume } : {}) }) });
    let r: { reason?: string; pending?: unknown } | null = null;
    try { r = await res.clone().json(); } catch { return res; }
    if (r?.reason !== "pending" || !Array.isArray(r.pending)) return res;
    resume = r.pending as string[];
    if (Date.now() - began >= KEEP_TRYING_MS) {
      void fetch("/api/studio/image", { ...init, body: JSON.stringify({ cancel: resume }) }).catch(() => undefined);
      const seconds = Math.round((Date.now() - began) / 1000);
      return new Response(JSON.stringify({
        ok: false, reason: "timeout", seconds, ...(Number(asked.stage) === 2 ? { stage: 2 } : {}),
        message: `Replicate had not finished after ${seconds}s, so it was stopped and is not charged past that point. Try again, or pick a faster model.`,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  }
}
