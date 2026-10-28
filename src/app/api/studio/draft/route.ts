import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { keyFor } from "@/app/api/keyFor";
import { answerCeiling } from "../budget";
import { DRAFT_MODEL, PLAN_SCHEMA, VERSIONS_SCHEMA, askForPlan, askForVersions, type Sent } from "@/features/studio/idea/ask";
import type { Idea } from "@/features/studio/idea/plan";

/**
 * A new idea's page plan (create system (b), "Start from a new idea").
 *
 * The Builder sends what J typed: the site in a sentence or more, the
 * sections wanted, and a site liked for reference. One Claude call answers
 * with a plan made only of catalogue parts, with a labelled placeholder
 * wherever nothing fits (`idea/ask.ts`, `idea/plan.ts`). The Builder lays it
 * out in the house style (`idea/planToBoard.ts`); nothing here places a part.
 *
 * With `versions: true` the same one call answers with three or four
 * clearly different versions of the site, each with the pages it needs
 * (`idea/versions.ts`): one call for all of them, never one per version.
 *
 * Optional, like every Claude route: with no key this answers HTTP 200 with
 * `ok: false, reason: "no-key"`, and the Builder makes the plain draft in the
 * house style and says why. The key is the one in Keys, else the server's
 * (`keyFor`): used for the call and nothing else, never stored, logged or
 * echoed back.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

/* A deadline at both ends (docs/DESIGN.md, rule 8b), as the reshape route keeps it. */
const budget = answerCeiling(process.env, maxDuration);
const ANSWER_BUDGET_MS = Math.max(5_000, budget - 5_000);
const UPSTREAM_TIMEOUT_MS = Math.max(5_000, ANSWER_BUDGET_MS - 3_000);

interface Body {
  effort?: string;
  name?: string;
  /** Several versions in the one call, rather than one page. */
  versions?: boolean;
  idea?: { text?: unknown; sections?: unknown; ref?: unknown };
}

/** What J typed, read strictly. */
function ideaOf(v: Body["idea"]): Idea {
  const text = typeof v?.text === "string" ? v.text.trim().slice(0, 4000) : "";
  const sections = Array.isArray(v?.sections) ? v.sections.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim().slice(0, 60)).slice(0, 12) : [];
  const ref = typeof v?.ref === "string" && v.ref.trim() ? v.ref.trim().slice(0, 300) : null;
  return { text, sections, ref };
}

export async function POST(request: Request) {
  const apiKey = keyFor(request, "x-anthropic-key")?.key ?? null;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      reason: "no-key",
      message: "No Claude key, so the draft is the plain one: your sections, in the house style. A key goes on the server, or in this browser under the key button.",
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }
  const idea = ideaOf(body.idea);
  if (!idea.text) return NextResponse.json({ ok: false, reason: "empty", message: "Say what the site is first." }, { status: 400 });

  const EFFORTS = ["low", "medium", "high"] as const;
  const effort: (typeof EFFORTS)[number] = EFFORTS.includes(body.effort as never) ? (body.effort as (typeof EFFORTS)[number]) : "medium";
  const client = new Anthropic({ apiKey, timeout: UPSTREAM_TIMEOUT_MS, maxRetries: 0 });
  const started = Date.now();
  const deadline = new AbortController();
  const ran = setTimeout(() => deadline.abort(), ANSWER_BUDGET_MS);

  const send = async (system: string, blocks: { text: string; cache?: true }[]): Promise<Sent> => {
    const stream = client.beta.messages.stream({
      model: DRAFT_MODEL,
      // Thinking counts toward this; a plan is a page of JSON, versions several pages each.
      max_tokens: body.versions ? 48000 : 24000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort, format: { type: "json_schema", schema: body.versions ? VERSIONS_SCHEMA : PLAN_SCHEMA } },
      system,
      messages: [{ role: "user", content: blocks.map((b) => ({ type: "text" as const, text: b.text, ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}) })) }],
    }, { signal: deadline.signal });
    const message = await stream.finalMessage();
    return {
      text: message.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim(),
      stop: message.stop_reason ?? null,
      usage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cached: message.usage.cache_read_input_tokens ?? 0,
        written: message.usage.cache_creation_input_tokens ?? 0,
        model: message.model,
      },
    };
  };

  try {
    const input = { idea, name: typeof body.name === "string" ? body.name.slice(0, 80) : undefined };
    return NextResponse.json(body.versions ? await askForVersions(input, send) : await askForPlan(input, send));
  } catch (error) {
    // Every branch answers HTTP 200 with a reason: the one outcome this route must never have is no outcome.
    const seconds = Math.round((Date.now() - started) / 1000);
    if (deadline.signal.aborted) return NextResponse.json({ ok: false, reason: "timeout", message: `Claude did not plan the site within ${Math.round(ANSWER_BUDGET_MS / 1000)}s, so the server stopped waiting.`, seconds });
    if (error instanceof Anthropic.APIConnectionTimeoutError) return NextResponse.json({ ok: false, reason: "timeout", message: `The Claude call timed out after ${seconds}s.`, seconds });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ ok: false, reason: "auth", message: "The API key was rejected.", seconds });
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ ok: false, reason: "rate-limit", message: "Rate limited, try again in a moment.", seconds });
    if (error instanceof Anthropic.APIError) {
      const id = error.requestID ? ` (request ${error.requestID})` : "";
      return NextResponse.json({ ok: false, reason: "api", message: `Couldn't plan the site (${error.status}: ${error.message}${id}).`, status: error.status, seconds });
    }
    return NextResponse.json({ ok: false, reason: "error", message: `Couldn't plan the site (${error instanceof Error ? error.message : "unknown error"}).`, seconds });
  } finally {
    clearTimeout(ran);
  }
}
