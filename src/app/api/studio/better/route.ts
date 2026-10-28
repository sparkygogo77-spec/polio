import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { keyFor } from "@/app/api/keyFor";
import { answerCeiling } from "../budget";
import { ANSWER_SCHEMA, SYSTEM, askText, parseJson, readAnswer, type BetterAsk } from "@/features/studio/better/prompt";
import { AIMS, LAYERS, type Aim, type Layer, type SiteShape } from "@/features/studio/variations/model";

/**
 * Variations from Claude (`features/studio/variations/`): one call with the
 * original site's pages as pictures, its sections, its layout tree and its
 * System in short, the aims ticked, the layers locked and the site named to
 * be like. Claude answers with four named directions at once
 * (`better/prompt.ts`), each read strictly: a choice off the rules lands on
 * them or is dropped, a locked layer is kept, two directions too close are
 * pushed apart.
 *
 * The key is J's, picked the way every route picks it (`keyFor`): the one
 * typed into Keys, else the server's. It is used for this call and nothing
 * else: never stored, never logged, never sent back.
 *
 * Fails softly like the other Claude routes: HTTP 200 with `ok: false` and
 * a reason, and the Builder carries on with the free local roll.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

// One rule for every route (`budget.ts`); five seconds short of it, so it answers before the platform kills it.
const budget = answerCeiling(process.env, maxDuration);
const ANSWER_BUDGET_MS = Math.max(5_000, budget - 5_000);
const UPSTREAM_TIMEOUT_MS = Math.max(5_000, ANSWER_BUDGET_MS - 3_000);

interface Body {
  effort?: string;
  pictures?: { data?: string; label?: string }[];
  ask?: Partial<BetterAsk>;
  /** The page's shape, so directions too close can be pushed apart on this site. */
  shape?: Partial<SiteShape>;
}

const MAX_PICTURES = 4;
const MAX_PICTURE_BYTES = 4_500_000;

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }
  const got = keyFor(request, "x-anthropic-key");
  if (!got) return NextResponse.json({ ok: false, reason: "no-key", message: "No Claude key: put ANTHROPIC_API_KEY on the server, or paste one under Keys." });

  const a = body.ask ?? {};
  const sections = Array.isArray(a.site?.sections) ? a.site!.sections.slice(0, 40) : [];
  const ask: BetterAsk = {
    aims: (Array.isArray(a.aims) ? a.aims : []).filter((x): x is Aim => AIMS.includes(x as Aim)),
    like: typeof a.like === "string" ? a.like.slice(0, 200) : null,
    count: Math.max(1, Math.min(6, Math.round(Number(a.count) || 4))),
    locks: (Array.isArray(a.locks) ? a.locks : []).filter((x): x is Layer => LAYERS.includes(x as Layer)),
    site: {
      name: String(a.site?.name ?? "the site").slice(0, 120),
      sections: sections.map((s, i) => ({ index: i, words: String(s?.words ?? "").slice(0, 240), height: Number(s?.height) || 0 })),
      system: String(a.site?.system ?? "").slice(0, 6000),
      layout: String(a.site?.layout ?? "").slice(0, 6000),
    },
    words: (Array.isArray(a.words) ? a.words : []).slice(0, 40).filter((w) => w && typeof w.part === "string" && typeof w.now === "string").map((w) => ({ part: w.part.slice(0, 80), now: w.now.slice(0, 300) })),
  };

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const p of (body.pictures ?? []).slice(0, MAX_PICTURES)) {
    if (typeof p?.data !== "string" || !p.data || p.data.length > MAX_PICTURE_BYTES) continue;
    content.push({ type: "text", text: String(p.label ?? "A page of the site:").slice(0, 200) });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: p.data } });
  }
  content.push({ type: "text", text: askText(ask) });

  const EFFORTS = ["low", "medium", "high"] as const;
  const effort: (typeof EFFORTS)[number] = EFFORTS.includes(body.effort as never) ? (body.effort as (typeof EFFORTS)[number]) : "medium";
  const client = new Anthropic({ apiKey: got.key, timeout: UPSTREAM_TIMEOUT_MS, maxRetries: 0 });
  const started = Date.now();
  const deadline = new AbortController();
  const ran = setTimeout(() => deadline.abort(), ANSWER_BUDGET_MS);
  try {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort, format: { type: "json_schema", schema: ANSWER_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    }, { signal: deadline.signal });
    const message = await stream.finalMessage();
    const usage = {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cached: message.usage.cache_read_input_tokens ?? 0,
      written: message.usage.cache_creation_input_tokens ?? 0,
      model: message.model,
    };
    if (message.stop_reason === "refusal") return NextResponse.json({ ok: false, reason: "refusal", message: "Claude declined to make variations of this site.", usage });
    const text = message.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    const shape: SiteShape = { sections: ask.site.sections.length, hue: typeof body.shape?.hue === "number" ? body.shape.hue : null };
    const variants = readAnswer(parseJson(text), ask, ask.site.sections.length, shape);
    if (!variants.length) {
      return NextResponse.json({ ok: false, reason: message.stop_reason === "max_tokens" ? "truncated" : "unreadable", message: message.stop_reason === "max_tokens" ? "Claude ran out of room before it answered." : "Claude's answer held no variants.", usage });
    }
    return NextResponse.json({ ok: true, variants, usage });
  } catch (error) {
    const seconds = Math.round((Date.now() - started) / 1000);
    if (deadline.signal.aborted) return NextResponse.json({ ok: false, reason: "timeout", message: `Claude did not answer within ${Math.round(ANSWER_BUDGET_MS / 1000)}s, so the server stopped waiting.`, seconds });
    if (error instanceof Anthropic.APIConnectionTimeoutError) return NextResponse.json({ ok: false, reason: "timeout", message: `The Claude call timed out after ${seconds}s.`, seconds });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ ok: false, reason: "auth", message: "The API key was rejected.", seconds });
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ ok: false, reason: "rate-limit", message: "Rate limited, try again in a moment.", seconds });
    if (error instanceof Anthropic.APIError) {
      const id = error.requestID ? ` (request ${error.requestID})` : "";
      return NextResponse.json({ ok: false, reason: "api", message: `Couldn't make variations (${error.status}: ${error.message}${id}).`, status: error.status, seconds });
    }
    return NextResponse.json({ ok: false, reason: "error", message: `Couldn't make variations (${error instanceof Error ? error.message : "unknown error"}).`, seconds });
  } finally {
    clearTimeout(ran);
  }
}
