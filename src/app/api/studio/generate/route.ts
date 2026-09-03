import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Turns a Studio blueprint into something actionable.
 *
 * This is optional: with no API key the Studio still works and you copy the
 * brief into whatever agent you like. When `ANTHROPIC_API_KEY` is set, the
 * "Generate" button calls through to Claude here instead.
 *
 * A missing key is a configuration state, not a failure, so it comes back as
 * HTTP 200 with `ok: false` and a reason the UI can explain.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

type Mode = "plan" | "critique" | "expand";

const MODE_INSTRUCTIONS: Record<Mode, string> = {
  plan:
    "Turn the blueprint into a concrete implementation plan. Work in the order the pages and rows are listed. " +
    "For each page give the section-by-section structure, the components to build, and the specific decisions the " +
    "blueprint implies. Call out anything the blueprint leaves genuinely ambiguous rather than inventing a resolution silently. " +
    "End with a build order grouped by priority (must / nice / idea).",
  critique:
    "Review the blueprint as an experienced designer and engineer would before any code is written. Identify: " +
    "contradictions between elements, missing pieces the stated idea implies but the canvas omits, places where two " +
    "features will fight each other, and anything that will be expensive relative to its value. Be specific and " +
    "reference elements by name. Do not rewrite the whole thing — critique it.",
  expand:
    "Write the missing prompts. For every element that has no prompt of its own, propose one or two sentences that " +
    "are specific to that element's placement, its neighbours, and the central idea. Output a markdown list keyed by " +
    "element name so each line can be pasted straight back onto the canvas. Leave already-written prompts alone.",
};

const SYSTEM = `You are helping turn a visual website blueprint into a real site.

The blueprint comes from a canvas where the author placed feature icons, drew regions and arrows, grouped elements, and wrote a prompt for each one. Read it with these rules:

- Vertical position is reading order; horizontal position is arrangement within a row.
- An element listed inside a region belongs to that region.
- An arrow from A to B is a real relationship the author drew deliberately.
- An element's own prompt is the most specific instruction available and overrides anything more general.
- Priorities are load-bearing: "must" ships first, "nice" if it fits, "idea" is exploratory.
- Format options that appear were deliberately changed from their defaults; ones that do not appear are at their defaults and are not worth discussing.

Write for a competent developer who will implement this. Be concrete and specific, never generic. Do not pad, do not restate the blueprint back at length, and do not produce a wall of boilerplate advice that would apply to any website.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ok: false,
      reason: "no-key",
      message:
        "No ANTHROPIC_API_KEY is configured, so the Studio can't call Claude from here. Copy the brief and paste it into Claude, Claude Code, or any agent — the brief is designed to be self-contained.",
    });
  }

  let body: { markdown?: string; mode?: Mode };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }

  const markdown = (body.markdown ?? "").slice(0, 200_000);
  const mode: Mode = body.mode && body.mode in MODE_INSTRUCTIONS ? body.mode : "plan";
  if (!markdown.trim()) {
    return NextResponse.json({ ok: false, reason: "empty", message: "The blueprint is empty — add something to the canvas first." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    // Streaming keeps a long plan from hitting the request timeout; the helper
    // hands back the assembled message once the stream completes.
    const stream = client.beta.messages.stream({
      model: "claude-opus-5",
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${MODE_INSTRUCTIONS[mode]}\n\n---\n\n${markdown}`,
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return NextResponse.json({
        ok: false,
        reason: "refusal",
        message: "Claude declined this request. Adjust the blueprint and try again.",
      });
    }

    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      ok: true,
      mode,
      text,
      usage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        model: message.model,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ ok: false, reason: "auth", message: "The configured ANTHROPIC_API_KEY was rejected." });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ ok: false, reason: "rate-limit", message: "Rate limited. Wait a moment and try again." });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ ok: false, reason: "api", message: `Claude API error ${error.status}: ${error.message}` });
    }
    return NextResponse.json({
      ok: false,
      reason: "unknown",
      message: error instanceof Error ? error.message : "Something went wrong calling Claude.",
    });
  }
}
