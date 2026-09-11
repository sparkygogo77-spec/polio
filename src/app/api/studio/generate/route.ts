import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Claude, on the site: every kind of prompt the Builder can make.
 *
 * The blueprint goes with every call — the canvas in words, self-contained —
 * or, when the trail has vined pieces to this thread, the brief alone as a
 * cached prefix with those pieces after it.
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

/**
 * How long this route may spend before it must answer, in milliseconds.
 *
 * `maxDuration` is what the platform grants, and when the wall clock reaches
 * it the function is killed where it stands: no response, no status, nothing
 * for the browser to show. So the route keeps a budget of its own, a few
 * seconds short of that, and answers itself when it runs out. An answer that
 * says "this took too long" is worth more than a spinner that never stops.
 *
 * Lower it with STUDIO_ANSWER_BUDGET_MS where the plan allows less than
 * `maxDuration` says — a Vercel hobby deployment stops a function at 60
 * seconds whatever this file asks for, and a budget above the real ceiling
 * never gets to fire.
 */
const ANSWER_BUDGET_MS = (() => {
  const asked = Number(process.env.STUDIO_ANSWER_BUDGET_MS);
  const budget = Number.isFinite(asked) && asked > 5_000 ? asked : maxDuration * 1000;
  return Math.max(5_000, budget - 5_000);
})();

/** Long enough for a slow answer, short enough that the retry still fits the budget. */
const UPSTREAM_TIMEOUT_MS = Math.max(5_000, ANSWER_BUDGET_MS - 3_000);

export type Mode = "plan" | "critique" | "expand" | "finish" | "ideas" | "ask" | "build";

const MODE_INSTRUCTIONS: Record<Mode, string> = {
  plan:
    "Turn the blueprint into a concrete implementation plan. Work in the order the pages and rows are listed. " +
    "For each page give the section-by-section structure, the components to build, and the specific decisions the " +
    "blueprint implies. Call out anything the blueprint leaves genuinely ambiguous rather than inventing a resolution silently. " +
    "End with a build order grouped by priority (must / nice / idea).",
  critique:
    "Review the blueprint as an experienced designer and engineer would before any code is written. Identify: " +
    "the one thing that blocks everything else, contradictions between elements, missing pieces the stated idea implies " +
    "but the canvas omits, places where two features will fight each other, and anything that will be expensive relative " +
    "to its value. Be specific and reference elements by the names the brief prints in bold. Do not rewrite the whole " +
    "thing — critique it. Then, for every finding that a better prompt would settle, write that prompt: the element's " +
    "whole prompt as it should now read, not a diff, keeping everything in the current one that still holds.",
  expand:
    "Write the missing prompts. For every element that has no prompt of its own, propose one or two sentences that " +
    "are specific to that element's placement, its neighbours, and the central idea. Leave already-written prompts alone.",
  finish:
    "Say what it would take to finish this site, as a checklist in the order it should be done. Start from what is " +
    "on the canvas and in the pictures: what is missing that the idea needs (pages, parts, states, copy, data), what " +
    "is there but underspecified, what is there and should go. For each item say which page and which part, and " +
    "write the prompt that would fix it — the part's whole prompt as it should now read. Finish with the three things that matter most.",
  ideas:
    "Give ideas for this site: ten of them, specific to this idea and this canvas, not generic. Each one in two or " +
    "three sentences: what it is, where on which page it goes, why it fits the central idea, and roughly what it " +
    "costs to build (small / medium / large). Rank them by value against cost. Ideas that would change the site's " +
    "character go last, marked as such.",
  ask: "Answer the author's question or do what they ask, about this site, using the blueprint and the pictures as the facts.",
  build:
    "Fill in the parts of this codebase a document cannot hold. The site's looks are NOT your job and are already written: " +
    "the scaffold listed below was generated from the document itself — design tokens taken from the palette, one component " +
    "per part carrying the markup that part actually renders, and pages that place them exactly where the board places them. " +
    "Do not rewrite those files, do not restate their styles, and do not produce a second version of the site. " +
    "Write only what is genuinely missing: a body for each Idea part that has none, where the data each part reads comes from, " +
    "and the behaviour that follows an interaction. Start with a short list of what you are adding and why, then every file " +
    "you add or change, complete, as a fenced code block whose info string is the language and then the path, like " +
    "```tsx src/features/site/Home.tsx — one block per file, no elisions, no placeholders. A file you name that the scaffold " +
    "already wrote replaces it, so name one only when you mean to change it, and say in a comment what you changed and why.",
};

const SYSTEM = `You are helping turn a visual website blueprint into a real site.

The blueprint comes from a canvas where the author placed feature icons, drew regions and arrows, grouped elements, and wrote a prompt for each one. Read it with these rules:

- Vertical position is reading order; horizontal position is arrangement within a row.
- An element listed inside a region belongs to that region.
- An arrow from A to B is a real relationship the author drew deliberately.
- An element's own prompt is the most specific instruction available and overrides anything more general.
- Priorities are load-bearing: "must" ships first, "nice" if it fits, "idea" is exploratory.
- Every Format value in the brief is binding. Ones marked * were set by the author by hand; the rest are defaults, and a default is a decision too — read it, rely on it, and flag it only when it fights the idea.
- Heights in the brief are minimums, widths are shares of the frame, and the frame is the desktop layout: narrower screens stack each row in reading order unless a prompt says otherwise. Do not report a fixed-height or a fixed-width problem the brief has already answered this way.
- A part whose "links to" says "nowhere yet" is not a bug to report: it is a placeholder the author knows about.
- When pictures are given, they are the pages as the live preview draws them right now, top to bottom, in the same order as the blueprint. They show what is actually there; the blueprint says what it is for. Where they disagree, say so.

Write for a competent developer who will implement this. Be concrete and specific, never generic. Do not pad, do not restate the blueprint back at length, and do not produce a wall of boilerplate advice that would apply to any website.`;

const REPO_CONTRACT = `The repository the files are for:
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 with design tokens (bg-panel, bg-elevated, text-fg, text-fg-muted, border-border, bg-accent, text-accent-fg; no raw hex).
- Every feature is a module at src/features/<id>/index.ts exporting defineFeature({ id, name, description, icon, routes: [{ path, component, title }], nav: [{ label, href, icon, order }] }) from "@/core/types", registered by adding it to the modules array in src/features/index.ts.
- Route components are "use client" React components taking { path, params }. UI primitives come from "@/core/ui": Button, Input, Textarea, Select, Switch, Segmented, Badge, Card, CardHeader, CardTitle, CardContent, Tabs, Separator, ScrollArea, EmptyState. Icons from "lucide-react". Class merging with cn from "@/core/lib/cn".
- No new dependencies. Data the site needs goes in a plain TypeScript file beside the component.
- The site's own document is also rendered by the app at /site from site/document.json; code you write is for what the document cannot express.`;

/**
 * What Build is now: the looks come from the document, deterministically,
 * and only the gaps are asked for.
 *
 * The blueprint is words, and words are lossy about looks — every
 * re-generation drifted, and what came back was a cousin of the site on
 * the board. The scaffold (`scaffold.ts`) is written from the document
 * instead, byte for byte the same every time, and this is how the model is
 * told where its half of the work starts.
 */
function scaffoldContract(files: { path: string; bytes: number }[], gaps: string[], stats: Record<string, number> | null): string {
  const listed = files.slice(0, 120).map((f) => `- ${f.path} (${f.bytes} bytes)`).join("\n");
  return `THE SCAFFOLD IS ALREADY WRITTEN. These files were generated from the document, not from the brief, and they are exact:

${listed}${files.length > 120 ? `\n- …and ${files.length - 120} more` : ""}

${stats ? `That is ${stats.parts ?? 0} parts across ${stats.pages ?? 0} pages, ${stats.clipped ?? 0} of them cut to a drawn line and ${stats.bodies ?? 0} with a written body.` : ""}

The colours, type, spacing, shape, texture and light in those files are the document's own values. They are not a description to improve on and not a starting point to re-derive: if you rewrite them the site stops matching the board.

WHAT IS ACTUALLY MISSING, and all you are being asked for:
${gaps.map((g) => `- ${g}`).join("\n")}

The brief below is the narrative — what the site is for, what each part is meant to do — and the pictures are the reference for anything that has to look like something. Use both to fill the gaps, not to redo the scaffold.`;
}

/**
 * The asks that come back with prompts attach them in one JSON block at the
 * end, so the Builder can put each one beside the prompt it answers and the
 * author can take it with one press. The prose stays the critique; the block
 * is the part of it that is a prompt.
 */
const REVISIONS_CONTRACT = `After the prose, end with exactly one fenced block whose info string is \`json revisions\`, holding {"revisions": [...]}. Each item: "target" — "site" for the master idea, "page: <name>" for a page's own prompt, or an element's name exactly as the brief prints it in bold; "kind" — one of "blocks", "contradiction", "missing", "fights", "cost", "note"; "finding" — one or two sentences saying what is wrong or missing, in the words you used above; "prompt" — the target's complete prompt as it should now read, ready to paste, or "" when the fix is not a matter of prompting. One item per finding; nothing outside the block after it.`;

const WORDS_ONLY = "No pictures accompany this. Nothing here has been seen rendered: anything you conclude about layout, colour, overflow or type size is inferred from the words, and you say so where you rely on it.";

const REVISION_KINDS = new Set(["blocks", "contradiction", "missing", "fights", "cost", "note"]);
interface Revision { target: string; kind: string; finding: string; prompt: string }

/** The revisions block out of an answer, and the answer without it. */
function splitRevisions(text: string): { text: string; revisions: Revision[] } {
  const re = /```json\s+revisions\s*\n([\s\S]*?)\n```\s*$/i;
  const m = re.exec(text);
  if (!m) return { text, revisions: [] };
  try {
    const parsed = JSON.parse(m[1]!) as { revisions?: unknown };
    const list = Array.isArray(parsed.revisions) ? parsed.revisions : [];
    const revisions = list
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({
        target: String(r.target ?? "").slice(0, 200),
        kind: REVISION_KINDS.has(String(r.kind)) ? String(r.kind) : "note",
        finding: String(r.finding ?? "").slice(0, 2000),
        prompt: String(r.prompt ?? "").slice(0, 6000),
      }))
      .filter((r) => r.target && (r.finding || r.prompt))
      .slice(0, 80);
    return { text: text.slice(0, m.index).trimEnd(), revisions };
  } catch {
    return { text, revisions: [] };
  }
}

interface PictureIn { data?: string; mediaType?: string; label?: string }
interface PieceIn { id?: string; label?: string; where?: string; prompt?: string; size?: { w?: number; h?: number }; neighbours?: string[]; links?: string[] }

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

  let body: {
    markdown?: string; mode?: Mode; prompt?: string; pictures?: PictureIn[]; brief?: string; pieces?: PieceIn[]; skipped?: number;
    /** What Build already wrote from the document, and what it could not. */
    scaffold?: { files?: { path?: string; bytes?: number }[]; gaps?: string[]; stats?: Record<string, number> };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }

  const markdown = (body.markdown ?? "").slice(0, 200_000);
  const mode: Mode = body.mode && body.mode in MODE_INSTRUCTIONS ? body.mode : "plan";
  const prompt = (body.prompt ?? "").trim().slice(0, 20_000);
  if (!markdown.trim() && !(body.brief ?? "").trim()) {
    return NextResponse.json({ ok: false, reason: "empty", message: "The blueprint is empty, add something to the canvas first." }, { status: 400 });
  }
  if (mode === "ask" && !prompt) {
    return NextResponse.json({ ok: false, reason: "empty", message: "Ask something first." }, { status: 400 });
  }

  const pictures = (Array.isArray(body.pictures) ? body.pictures : [])
    .filter((p): p is Required<PictureIn> => !!p && typeof p.data === "string" && p.data.length > 0 && p.data.length < 6_000_000 && /^[A-Za-z0-9+/=]+$/.test(p.data) && ["image/png", "image/jpeg", "image/webp"].includes(p.mediaType ?? ""))
    .slice(0, 12)
    .map((p) => ({ data: p.data, mediaType: p.mediaType as "image/png" | "image/jpeg" | "image/webp", label: typeof p.label === "string" ? p.label.slice(0, 200) : "" }));

  /*
   * The brief first, marked for the cache, then only the pieces this thread
   * vined to the call.
   *
   * The blueprint used to go whole on every ask: the same tens of thousands
   * of tokens each time, and no two calls sharing a prefix. Split in two,
   * the brief is the same bytes on every call of a thread — so the second
   * one reads it from the cache instead of sending it — and what changes is
   * a handful of pieces. A piece this thread has already sent unchanged is
   * left out upstream; `skipped` is only how many, so the answer knows they
   * exist and were not forgotten.
   */
  const brief = (body.brief ?? "").slice(0, 200_000);
  const pieces = (Array.isArray(body.pieces) ? body.pieces : [])
    .filter((x): x is PieceIn => !!x && typeof x.prompt === "string")
    .slice(0, 400);
  const skipped = Number.isFinite(body.skipped) ? Math.max(0, Math.min(999, Number(body.skipped))) : 0;

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (brief.trim()) content.push({ type: "text", text: brief, cache_control: { type: "ephemeral" } });
  if (pieces.length || skipped) {
    const lines = pieces.map((x) => {
      const head = [x.label ?? "A part", x.where ? `on ${x.where}` : "", x.size?.w ? `${Math.round(x.size.w)}\u00d7${Math.round(x.size.h ?? 0)}` : ""].filter(Boolean).join(" \u00b7 ");
      const near = (x.neighbours ?? []).filter((n) => typeof n === "string").slice(0, 4);
      // The chains drawn to it, each with the reason it is there. A part that
      // only appears once another has done something, or that reads what
      // another holds, is not buildable from its own prompt alone.
      const chained = (x.links ?? []).filter((l) => typeof l === "string").slice(0, 8).map((l) => `\n  chained: ${l.slice(0, 200)}`).join("");
      return `- ${head}${near.length ? ` \u00b7 between ${near.join(" and ")}` : ""}\n  prompt: ${String(x.prompt).slice(0, 4000)}${chained}`;
    });
    content.push({
      type: "text",
      text: [`The parts this question is about (${pieces.length}${skipped ? `, and ${skipped} more you already have, unchanged` : ""}):`, ...lines].join("\n"),
    });
  }
  if (pictures.length) {
    content.push({ type: "text", text: `The site as the live preview shows it right now, ${pictures.length} picture${pictures.length === 1 ? "" : "s"}:` });
    for (const p of pictures) {
      if (p.label) content.push({ type: "text", text: p.label });
      content.push({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } });
    }
  }
  if (!pictures.length) content.push({ type: "text", text: WORDS_ONLY });
  const wantsRevisions = mode === "critique" || mode === "expand" || mode === "finish";
  const ask = mode === "ask" ? prompt : prompt ? `${MODE_INSTRUCTIONS[mode]}\n\nThe author adds: ${prompt}` : MODE_INSTRUCTIONS[mode];
  // Build is told what has already been written before it is told anything
  // else: the scaffold is the ground it is adding to.
  const scaffoldFiles = (body.scaffold?.files ?? [])
    .filter((f): f is { path: string; bytes: number } => typeof f?.path === "string")
    .map((f) => ({ path: f.path.slice(0, 200), bytes: Number(f.bytes) || 0 }))
    .slice(0, 400);
  const gaps = (body.scaffold?.gaps ?? []).filter((g) => typeof g === "string").map((g) => g.slice(0, 400)).slice(0, 40);
  const scaffolded = mode === "build" && scaffoldFiles.length
    ? `\n\n${scaffoldContract(scaffoldFiles, gaps.length ? gaps : ["an Idea part with no body", "where the data comes from", "what happens after an interaction"], body.scaffold?.stats ?? null)}`
    : "";
  content.push({ type: "text", text: `${ask}${wantsRevisions ? `\n\n${REVISIONS_CONTRACT}` : ""}${mode === "build" ? `\n\n${REPO_CONTRACT}${scaffolded}` : ""}${markdown.trim() ? `\n\n---\n\n${markdown}` : ""}` });

  /*
   * The upstream gets a deadline, and so does the whole route.
   *
   * Without one the SDK waits ten minutes by default and retries twice on top
   * of that, which is far past anything the platform will keep the function
   * alive for — so the function is killed mid-call and the browser is left
   * holding a request that never gets a status. One try, one timeout, and a
   * budget the route answers within whatever the upstream does.
   */
  const client = new Anthropic({ apiKey, timeout: UPSTREAM_TIMEOUT_MS, maxRetries: 0 });
  const started = Date.now();
  const deadline = new AbortController();
  const ran = setTimeout(() => deadline.abort(), ANSWER_BUDGET_MS);

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
    }, { signal: deadline.signal });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, reason: "refusal", message: "Claude declined this request. Adjust the blueprint and try again." });
    }

    const raw = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    const { text, revisions } = wantsRevisions ? splitRevisions(raw) : { text: raw, revisions: [] };

    return NextResponse.json({
      ok: true,
      mode,
      text,
      revisions,
      pictures: pictures.length,
      truncated: message.stop_reason === "max_tokens",
      usage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        // What the brief cost this time: nothing, on the second call of a
        // thread, because the prefix in front of the pieces has not moved.
        cached: message.usage.cache_read_input_tokens ?? 0,
        written: message.usage.cache_creation_input_tokens ?? 0,
        model: message.model,
      },
      pieces: pieces.length,
      skipped,
    });
  } catch (error) {
    /*
     * Whatever went wrong, the browser hears a reason.
     *
     * Every branch here answers HTTP 200 with `ok: false`, because a spinner
     * that stops with a sentence is the whole point: the one outcome this
     * route must never have is no outcome. The seconds go in the message —
     * "it took too long" means nothing without saying how long it was given.
     */
    const secs = Math.round((Date.now() - started) / 1000);
    if (deadline.signal.aborted) {
      return NextResponse.json({
        ok: false,
        reason: "timeout",
        message: `Claude did not answer within ${Math.round(ANSWER_BUDGET_MS / 1000)}s, so the server stopped waiting. A long blueprint with pictures can take longer than the deployment allows: ask for less at once, turn the pictures off, or raise the function's own limit.`,
        seconds: secs,
      });
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return NextResponse.json({ ok: false, reason: "timeout", message: `The Claude call timed out after ${secs}s.`, seconds: secs });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ ok: false, reason: "auth", message: "The Claude key was rejected. Check the key on the server, or the one held in this browser." });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ ok: false, reason: "rate-limit", message: "Rate limited. Wait a moment and try again." });
    }
    if (error instanceof Anthropic.APIError) {
      // What the API actually said, request id included: without it a report
      // of this is a guess, and Anthropic cannot look the call up either.
      const id = error.requestID ? ` (request ${error.requestID})` : "";
      return NextResponse.json({ ok: false, reason: "api", message: `Claude API error ${error.status}: ${error.message}${id}`, status: error.status, requestId: error.requestID ?? null, seconds: secs });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json({ ok: false, reason: "network", message: `Could not reach Claude after ${secs}s: ${error.message}`, seconds: secs });
    }
    return NextResponse.json({ ok: false, reason: "unknown", message: error instanceof Error ? error.message : "Something went wrong calling Claude.", seconds: secs });
  } finally {
    clearTimeout(ran);
  }
}
