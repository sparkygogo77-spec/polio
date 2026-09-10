import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Claude, on the site: every kind of prompt the Builder can make.
 *
 * The blueprint goes with every call — the canvas in words, self-contained.
 * When the server can open the site in a browser, a screenshot of each page
 * goes too, so Claude sees the site the way the author does and not only a
 * description of it. Seven things can be asked: a plan, a critique, the
 * missing prompts, what it would take to finish, ideas, anything at all in
 * the author's own words, or the code.
 *
 * This is optional: with no API key the Builder still works and you copy the
 * blueprint into whatever agent you like. A missing key is a configuration
 * state, not a failure, so it comes back as HTTP 200 with `ok: false` and a
 * reason the UI can explain.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

export type Mode = "plan" | "critique" | "expand" | "finish" | "ideas" | "ask" | "build";

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
  finish:
    "Say what it would take to finish this site, as a checklist in the order it should be done. Start from what is " +
    "on the canvas and in the pictures: what is missing that the idea needs (pages, parts, states, copy, data), what " +
    "is there but underspecified, what is there and should go. For each item say which page and which part, and " +
    "write the prompt that would fix it, ready to paste onto that part. Finish with the three things that matter most.",
  ideas:
    "Give ideas for this site: ten of them, specific to this idea and this canvas, not generic. Each one in two or " +
    "three sentences: what it is, where on which page it goes, why it fits the central idea, and roughly what it " +
    "costs to build (small / medium / large). Rank them by value against cost. Ideas that would change the site's " +
    "character go last, marked as such.",
  ask: "Answer the author's question or do what they ask, about this site, using the blueprint and the pictures as the facts.",
  build:
    "Write the code. Produce the site described by the blueprint as files for this repository (details below). " +
    "Start with a short list of the files and what each is for, then every file, complete, as a fenced code block " +
    "whose info string is the language and then the path, like ```tsx src/features/site/Home.tsx — one block per file, " +
    "no elisions, no placeholders. Keep to what the blueprint says; where it is silent, choose plainly and say so in a comment.",
};

const SYSTEM = `You are helping turn a visual website blueprint into a real site.

The blueprint comes from a canvas where the author placed feature icons, drew regions and arrows, grouped elements, and wrote a prompt for each one. Read it with these rules:

- Vertical position is reading order; horizontal position is arrangement within a row.
- An element listed inside a region belongs to that region.
- An arrow from A to B is a real relationship the author drew deliberately.
- An element's own prompt is the most specific instruction available and overrides anything more general.
- Priorities are load-bearing: "must" ships first, "nice" if it fits, "idea" is exploratory.
- Format options that appear were deliberately changed from their defaults; ones that do not appear are at their defaults and are not worth discussing.
- When pictures are given, they are the pages as the live preview draws them right now, top to bottom, in the same order as the blueprint. They show what is actually there; the blueprint says what it is for. Where they disagree, say so.

Write for a competent developer who will implement this. Be concrete and specific, never generic. Do not pad, do not restate the blueprint back at length, and do not produce a wall of boilerplate advice that would apply to any website.`;

const REPO_CONTRACT = `The repository the files are for:
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 with design tokens (bg-panel, bg-elevated, text-fg, text-fg-muted, border-border, bg-accent, text-accent-fg; no raw hex).
- Every feature is a module at src/features/<id>/index.ts exporting defineFeature({ id, name, description, icon, routes: [{ path, component, title }], nav: [{ label, href, icon, order }] }) from "@/core/types", registered by adding it to the modules array in src/features/index.ts.
- Route components are "use client" React components taking { path, params }. UI primitives come from "@/core/ui": Button, Input, Textarea, Select, Switch, Segmented, Badge, Card, CardHeader, CardTitle, CardContent, Tabs, Separator, ScrollArea, EmptyState. Icons from "lucide-react". Class merging with cn from "@/core/lib/cn".
- No new dependencies. Data the site needs goes in a plain TypeScript file beside the component.
- The site's own document is also rendered by the app at /site from site/document.json; code you write is for what the document cannot express.`;

interface PictureIn { data?: string; mediaType?: string; label?: string }

/**
 * The key to use: the server's if it has one, otherwise whatever the browser
 * offered on this request. A supplied key is used for the call and nothing
 * else — never stored, never logged, never echoed back.
 */
function keyFor(request: Request): string | null {
  const own = process.env.ANTHROPIC_API_KEY?.trim();
  if (own) return own;
  const supplied = request.headers.get("x-anthropic-key")?.trim();
  return supplied && supplied.length > 8 ? supplied : null;
}

export async function POST(request: Request) {
  const apiKey = keyFor(request);
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      reason: "no-key",
      message:
        "No Claude key. Put ANTHROPIC_API_KEY on the server, or hold one in this browser under the key button in the top bar. Without either, copy the blueprint into Claude, Claude Code, or any agent — it is designed to be self-contained.",
    });
  }

  let body: { markdown?: string; mode?: Mode; prompt?: string; pictures?: PictureIn[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }

  const markdown = (body.markdown ?? "").slice(0, 200_000);
  const mode: Mode = body.mode && body.mode in MODE_INSTRUCTIONS ? body.mode : "plan";
  const prompt = (body.prompt ?? "").trim().slice(0, 20_000);
  if (!markdown.trim()) {
    return NextResponse.json({ ok: false, reason: "empty", message: "The blueprint is empty — add something to the canvas first." }, { status: 400 });
  }
  if (mode === "ask" && !prompt) {
    return NextResponse.json({ ok: false, reason: "empty", message: "Ask something first." }, { status: 400 });
  }

  const pictures = (Array.isArray(body.pictures) ? body.pictures : [])
    .filter((p): p is Required<PictureIn> => !!p && typeof p.data === "string" && p.data.length > 0 && p.data.length < 6_000_000 && /^[A-Za-z0-9+/=]+$/.test(p.data) && ["image/png", "image/jpeg", "image/webp"].includes(p.mediaType ?? ""))
    .slice(0, 12)
    .map((p) => ({ data: p.data, mediaType: p.mediaType as "image/png" | "image/jpeg" | "image/webp", label: typeof p.label === "string" ? p.label.slice(0, 200) : "" }));

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (pictures.length) {
    content.push({ type: "text", text: `The site as the live preview shows it right now, ${pictures.length} picture${pictures.length === 1 ? "" : "s"}:` });
    for (const p of pictures) {
      if (p.label) content.push({ type: "text", text: p.label });
      content.push({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } });
    }
  }
  const ask = mode === "ask" ? prompt : prompt ? `${MODE_INSTRUCTIONS[mode]}\n\nThe author adds: ${prompt}` : MODE_INSTRUCTIONS[mode];
  content.push({ type: "text", text: `${ask}${mode === "build" ? `\n\n${REPO_CONTRACT}` : ""}\n\n---\n\n${markdown}` });

  const client = new Anthropic({ apiKey });

  try {
    // Streaming keeps a long answer from hitting the request timeout; the
    // helper hands back the assembled message once the stream completes.
    const stream = client.beta.messages.stream({
      model: "claude-opus-5",
      max_tokens: mode === "build" ? 64000 : 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: mode === "ideas" ? "medium" : "high" },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, reason: "refusal", message: "Claude declined this request. Adjust the blueprint and try again." });
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
      pictures: pictures.length,
      truncated: message.stop_reason === "max_tokens",
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens, model: message.model },
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
    return NextResponse.json({ ok: false, reason: "unknown", message: error instanceof Error ? error.message : "Something went wrong calling Claude." });
  }
}
