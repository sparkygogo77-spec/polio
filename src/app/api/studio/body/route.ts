import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { cleanSnippet, SNIPPET_LIMIT } from "@/features/studio/snippet";

/**
 * Writes the body of a part that no part in the library is.
 *
 * A drawing that says "a helix of sentences" cannot become a heading or a
 * card: there is no such entry, and cutting an empty Idea box to a helix is
 * a helix-shaped hole. So the drawing goes up as the path it was reduced to
 * (`outlinePath`), a picture of the strokes, and the author's words, and
 * what comes back is a self-contained fragment — SVG, or HTML with inline
 * CSS — that fills that outline and *is* the thing.
 *
 * It is written to be rendered in a frame with no permissions: no scripts,
 * nothing fetched, inline styles and data: images only. That is not a
 * suggestion in the prompt, it is enforced twice more — cleaned here
 * (`cleanSnippet`) before it is ever returned, and rendered under
 * `sandbox=""` with a content policy that allows nothing else.
 *
 * The loop that judges it is the caller's: it renders what comes back,
 * compares the silhouette against the drawing, and calls this again with
 * the overlap and what is wrong. `critique` is that second call, and it
 * carries the previous attempt so this is a revision rather than a fresh
 * guess.
 *
 * Optional, like every other Claude route here: with no key it is HTTP 200
 * with `ok: false` and a reason, and the part keeps its shape and its
 * prompt without a body.
 */

export const runtime = "nodejs";
export const maxDuration = 180;

/*
 * A deadline at both ends (docs/DESIGN.md, rule 8b). `maxDuration` is what
 * the platform grants; at the wall clock it kills the function where it
 * stands, no response, no status, and the browser's spinner runs until a
 * reload. So the route keeps a budget of its own a few seconds short of
 * that and answers itself when it runs out, the SDK gets one try with a
 * timeout inside the budget, and the browser keeps a longer deadline of
 * its own for the case where nothing arrives at all. This is the same
 * arrangement the generate route has had; this route had none of it.
 */
const ANSWER_BUDGET_MS = (() => {
  const asked = Number(process.env.STUDIO_ANSWER_BUDGET_MS);
  const budget = Number.isFinite(asked) && asked > 5_000 ? asked : maxDuration * 1000;
  return Math.max(5_000, budget - 5_000);
})();
const UPSTREAM_TIMEOUT_MS = Math.max(5_000, ANSWER_BUDGET_MS - 3_000);

interface Body {
  /** What the part should be, in the author's words. */
  prompt?: string;
  /** The backend's effort setting: low, medium or high. Anything else falls back to medium. */
  effort?: string;
  /** The label on the part. */
  label?: string;
  /** The outline the body has to fill, as a path in a 0..1 box. */
  path?: string;
  closed?: boolean;
  /** The part's real size, so the body is written for the box it will be in. */
  w?: number;
  h?: number;
  /** A picture of the drawing: PNG, base64, no data-URL head. */
  picture?: string;
  /** A picture of the last attempt as it rendered, for a second go. */
  shot?: string;
  /** The last attempt's code, when this is a revision. */
  previous?: string;
  /** What was wrong with it: the overlap, and in words. */
  critique?: string;
  /** The site's colours, so the body belongs to the site rather than to itself. */
  palette?: { bg?: string; text?: string; accent?: string; muted?: string };
}

const SCHEMA = {
  type: "object",
  properties: {
    code: {
      type: "string",
      description:
        "The body: one self-contained fragment of SVG, or HTML with inline CSS. No <script>, no <link>, no <iframe>, nothing fetched from anywhere, no data going out. It is dropped into a body that is exactly the part's box.",
    },
    note: { type: "string", description: "One line: what this draws, and how it fills the outline." },
  },
  required: ["code", "note"],
  additionalProperties: false,
} as const;

const SYSTEM = `You write the body of one part of a website, from a drawing of it.

WHAT YOU ARE GIVEN
- The outline the author drew, as an SVG path in a 0..1 box: this is the part's exact edge. The part is clipped to it, so anything you draw outside it is cut off.
- A picture of the drawing as it was drawn.
- The author's words for what it should be, and the part's real size in pixels.

WHAT YOU RETURN
One fragment that renders the thing the drawing asks for — a helix of sentences is a helix of sentences, not a box with the word "helix" in it.

THE RULES, AND THEY ARE HARD
1. Self-contained. SVG, or HTML with a <style> block and inline styles. NOTHING is fetched: no <script>, no <link>, no @import, no external images, no web fonts, no URLs of any kind. A data: URI is the only src allowed. Anything else is stripped before it renders and the part will be broken.
2. It fills the outline. The body is the part's box exactly; use width:100%/height:100% or an SVG with viewBox="0 0 100 100" and preserveAspectRatio="none" so it stretches to the box. Draw to the edges of the outline you were given — the silhouette of what you draw is compared against that outline, and a small thing floating in the middle of a big outline fails.
3. It stays inside the box. No fixed pixel sizes that could overflow, no position:fixed, no negative margins that escape, and nothing that scrolls.
4. It is the content, not a description of it. Real words if words are asked for — write them — real curves if curves are asked for. Never a placeholder, never lorem ipsum, never a caption saying what would go here.
5. Colour: use currentColor and the palette values you are given so it belongs to the site. Transparent background unless the drawing plainly is a filled shape.
6. Keep it under ${SNIPPET_LIMIT} characters. Prefer one clean SVG over a pile of divs.

WHEN YOU ARE GIVEN A CRITIQUE
You are revising your own last attempt, which is included with a picture of how it actually rendered and an overlap number: how much of the drawing's silhouette your render covered. Fix that specifically — usually it means drawing bigger, reaching into the corners of the outline, or filling where you only stroked. Return the whole body again, not a diff.`;

/**
 * The key to use: the server's if it has one, otherwise whatever the browser
 * offered on this request. Never stored, never logged, never echoed back.
 */
function keyFor(request: Request): string | null {
  const own = process.env.ANTHROPIC_API_KEY?.trim();
  if (own) return own;
  const supplied = request.headers.get("x-anthropic-key")?.trim();
  return supplied && supplied.length > 8 ? supplied : null;
}

const png = (v: unknown): string | null =>
  typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 700_000 ? v : null;

export async function POST(request: Request) {
  const apiKey = keyFor(request);
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      reason: "no-key",
      message: "No Claude key, so a body can't be written here. The part keeps its shape and its prompt, and the blueprint says what it should be.",
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim().slice(0, 4000);
  const label = (body.label ?? "").trim().slice(0, 120);
  const path = (body.path ?? "").trim().slice(0, 12_000);
  if (!prompt && !path) {
    return NextResponse.json({ ok: false, reason: "empty", message: "Nothing to write a body from." }, { status: 400 });
  }
  const w = Math.round(Math.max(24, Math.min(4000, Number(body.w) || 320)));
  const h = Math.round(Math.max(24, Math.min(4000, Number(body.h) || 320)));

  const lines: string[] = [];
  lines.push(`The part is ${w} × ${h} px.`);
  if (label) lines.push(`It is called "${label}".`);
  if (prompt) lines.push("", `What it should be, in the author's words: ${prompt}`);
  if (path) {
    lines.push("", `The outline it is clipped to, as a path in a 0..1 box (${body.closed === false ? "an open line, so the part is a band along it" : "closed, so the part is the inside of it"}):`);
    lines.push(path);
  }
  if (body.palette) {
    const p = body.palette;
    lines.push("", "The site's colours:", [p.bg && `background ${p.bg}`, p.text && `text ${p.text}`, p.accent && `accent ${p.accent}`, p.muted && `muted ${p.muted}`].filter(Boolean).join(", "));
  }
  if (body.critique) {
    lines.push("", "This is a revision. What was wrong with your last attempt:", body.critique.slice(0, 4000));
  }
  if (body.previous) {
    lines.push("", "Your last attempt, in full:", body.previous.slice(0, SNIPPET_LIMIT));
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  // The rules are the same on every call and every retry: cached prefix.
  content.push({ type: "text", text: "You are writing one part's body. The rules are in the system prompt and they do not change between attempts.", cache_control: { type: "ephemeral" } });
  const picture = png(body.picture);
  const shot = png(body.shot);
  if (picture) {
    content.push({ type: "text", text: "The drawing, as it was drawn:" });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: picture } });
  }
  if (shot) {
    content.push({ type: "text", text: "Your last attempt, as it actually rendered:" });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: shot } });
  }
  content.push({ type: "text", text: lines.join("\n") });

  // The effort the backend surface is set to rides with the call; only the
  // three the API takes are accepted, and this route's old constant is the
  // fallback for anything else.
  const EFFORTS = ["low", "medium", "high"] as const;
  const effort: (typeof EFFORTS)[number] = EFFORTS.includes(body.effort as never) ? (body.effort as (typeof EFFORTS)[number]) : "medium";
  const client = new Anthropic({ apiKey, timeout: UPSTREAM_TIMEOUT_MS, maxRetries: 0 });
  const started = Date.now();
  const deadline = new AbortController();
  const ran = setTimeout(() => deadline.abort(), ANSWER_BUDGET_MS);
  try {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5",
      max_tokens: 24000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort, format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    }, { signal: deadline.signal });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, reason: "refusal", message: "Claude declined to write this body." });
    }
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const answer = parseAnswer(text);
    const raw = typeof answer?.code === "string" ? answer.code : "";
    if (!raw.trim()) {
      return NextResponse.json({
        ok: false,
        reason: message.stop_reason === "max_tokens" ? "truncated" : "unreadable",
        message: message.stop_reason === "max_tokens" ? "Claude ran out of room before the body was finished." : "Claude's answer had no body in it.",
      });
    }
    // Cleaned before it is handed back, so nothing that reaches off the page
    // is ever written into the document.
    const { html, stripped } = cleanSnippet(raw);
    if (!html) {
      return NextResponse.json({ ok: false, reason: "empty-body", message: "Everything in that body had to be stripped." });
    }
    return NextResponse.json({
      ok: true,
      html,
      stripped,
      note: typeof answer?.note === "string" ? answer.note.slice(0, 400) : "",
      usage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cached: message.usage.cache_read_input_tokens ?? 0,
        model: message.model,
      },
    });
  } catch (error) {
    // Every branch answers HTTP 200 with a reason and the seconds it took:
    // the one outcome this route must never have is no outcome.
    const seconds = Math.round((Date.now() - started) / 1000);
    if (deadline.signal.aborted) {
      return NextResponse.json({ ok: false, reason: "timeout", message: `Claude did not write the body within ${Math.round(ANSWER_BUDGET_MS / 1000)}s, so the server stopped waiting.`, seconds });
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return NextResponse.json({ ok: false, reason: "timeout", message: `The Claude call timed out after ${seconds}s.`, seconds });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ ok: false, reason: "auth", message: "The API key was rejected.", seconds });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ ok: false, reason: "rate-limit", message: "Rate limited, try again in a moment.", seconds });
    }
    if (error instanceof Anthropic.APIError) {
      const id = error.requestID ? ` (request ${error.requestID})` : "";
      return NextResponse.json({ ok: false, reason: "api", message: `Couldn't write the body (${error.status}: ${error.message}${id}).`, status: error.status, requestId: error.requestID ?? null, seconds });
    }
    return NextResponse.json({ ok: false, reason: "error", message: `Couldn't write the body (${error instanceof Error ? error.message : "unknown error"}).`, seconds });
  } finally {
    clearTimeout(ran);
  }
}

/** The answer is JSON, but a fence or a stray word round it should not lose it. */
function parseAnswer(text: string): Record<string, unknown> | null {
  const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
