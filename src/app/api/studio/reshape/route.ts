import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { describeSketch, isBlankSketch, normaliseSketch, sketchToText } from "@/features/studio/sketch";

/**
 * Reads what was drawn on the Builder's drawing board and says what the part
 * should become.
 *
 * The board sends the drawing two ways — a small picture of the strokes and
 * the strokes as numbers — beside the part as it is now, the words typed
 * under the drawing, the width of the page frame and the whole library of
 * parts. Claude answers with one JSON object: a size in the drawing's
 * proportion, the kind of part if the drawing is plainly something else, and
 * whatever the drawing shows inside the shape as contents and options.
 *
 * Optional, like the blueprint route: with no `ANTHROPIC_API_KEY` this comes
 * back as HTTP 200 with `ok: false` and a reason, and the board reshapes the
 * part from the drawing's proportion on its own. The key is never
 * load-bearing.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

interface OptionAllowed {
  id: string;
  label: string;
  values: string[];
  kind: "one" | "set";
}

interface NodeIn {
  featureId: string;
  feature: string;
  label: string;
  w: number;
  h: number;
  prompt: string;
  content: string;
  data: string;
  options: Record<string, string>;
  optionsAllowed: OptionAllowed[];
  contentLabel: string | null;
}

interface Candidate {
  id: string;
  name: string;
  category: string;
  w: number;
  h: number;
  blurb: string;
}

interface Body {
  sketch?: unknown;
  picture?: string | null;
  frameWidth?: number;
  node?: NodeIn | null;
  candidates?: Candidate[];
}

/**
 * What comes back. Every field is optional; the board checks each one against
 * the catalog.
 *
 * Structured output only takes `additionalProperties: false` on an object, so
 * the options are a list of id–value pairs here and folded into the record the
 * board expects before the answer goes back. A map with open keys was rejected
 * by the API with a 400, which read on the board as the drawing doing nothing.
 */
const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    featureId: { type: "string", description: "The id of the part this should be, from the library. Keep the current one unless the drawing is plainly a different kind of part." },
    label: { type: "string", description: "A short plain name for the part, only if it should change." },
    w: { type: "number", description: "Width in pixels inside the page frame, in the drawing's proportion." },
    h: { type: "number", description: "Height in pixels, in the drawing's proportion." },
    content: { type: "string", description: "What the part contains, as a comma-separated list or a line of text, if the drawing shows it (three boxes in a row, a list of lines, a field and a button)." },
    prompt: { type: "string", description: "One or two sentences for the builder about this part's shape and what the drawing shows, in the author's terms. Keep what the current prompt says unless the drawing contradicts it." },
    options: {
      type: "array",
      description: "Option values to set, only ids and values the part offers.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "The option's id, from the list the part offers." },
          value: { type: "string", description: "One of the values that option offers; for an option that takes any number, the picked values separated by commas." },
        },
        required: ["id", "value"],
        additionalProperties: false,
      },
    },
    note: { type: "string", description: "One short sentence saying what you read in the drawing." },
  },
  required: ["w", "h", "note"],
  additionalProperties: false,
} as const;

const SYSTEM = `You read a rough freehand drawing made on a round drawing board and turn it into the shape of one part of a website.

The board is a disc; the picture shows it as a circle with the strokes inside it. The strokes are also given as numbers, in percent of the board's width, so the shape can be read off them when the picture is ambiguous. The author drew the shape they want the part to have — its proportion first of all, and sometimes what it holds: boxes inside a box are items in a row or a grid, a line of short marks is a list or a row of links, a small box beside a long one is a button beside a field, an arrow or a triangle at one end is a dropdown.

Rules:
- The drawing's proportion (width over height) is the part's proportion. Keep the part's area roughly what it was unless the drawing or the words say otherwise; a new part gets a size sensible for its kind, no wider than the frame.
- Keep the part's kind unless the drawing is plainly something else, in which case pick the closest id from the library list. Never invent an id.
- Only set options the part offers, with values it offers. Only write contents when the drawing or the words show what the part holds.
- The words beside the drawing win over your reading of the picture.
- Answer with the JSON object only.`;

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
      message: "No Claude key, so the drawing can't be read here. The part takes the drawing's proportion instead, and the drawing goes into the blueprint. A key goes on the server, or in this browser under the key button.",
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }

  const sketch = normaliseSketch(body.sketch);
  if (!sketch || isBlankSketch(sketch)) {
    return NextResponse.json({ ok: false, reason: "empty", message: "Nothing is drawn on the board." }, { status: 400 });
  }
  const frameWidth = Number.isFinite(body.frameWidth) ? Math.max(200, Math.min(4000, body.frameWidth as number)) : 1440;
  const node = body.node ?? null;
  const candidates = (body.candidates ?? []).slice(0, 400);
  const picture = typeof body.picture === "string" && /^[A-Za-z0-9+/=]+$/.test(body.picture) && body.picture.length < 400_000 ? body.picture : null;

  const lines: string[] = [];
  lines.push(`Page frame width: ${frameWidth}px.`);
  if (node) {
    lines.push("", "The part as it is now:");
    lines.push(`- kind: ${node.feature} (id ${node.featureId})`);
    lines.push(`- name: ${node.label}`);
    lines.push(`- size: ${Math.round(node.w)} × ${Math.round(node.h)} px`);
    if (node.content?.trim()) lines.push(`- ${node.contentLabel ?? "contains"}: ${node.content.trim()}`);
    if (node.data?.trim()) lines.push(`- data: ${node.data.trim()}`);
    if (node.prompt?.trim()) lines.push(`- prompt: ${node.prompt.trim()}`);
    const set = Object.entries(node.options ?? {}).filter(([, v]) => v);
    if (set.length) lines.push(`- options set: ${set.map(([k, v]) => `${k}=${v}`).join(", ")}`);
    if (node.optionsAllowed?.length) {
      lines.push("- options this part offers:");
      for (const o of node.optionsAllowed) lines.push(`    ${o.id} (${o.label}, ${o.kind === "set" ? "any number of" : "one of"}): ${o.values.join(" | ")}`);
    }
  } else {
    lines.push("", "There is no part yet: the drawing is a new part, to be placed where the board was opened.");
  }
  lines.push("", `The drawing, measured: ${describeSketch(sketch)}.`);
  lines.push("", "The strokes, in percent of the board:", sketchToText(sketch));
  if (sketch.words.trim()) lines.push("", `Words the author typed beside it: "${sketch.words.trim()}"`);
  if (candidates.length) {
    lines.push("", "The library (id — name · category · default size):");
    for (const c of candidates) lines.push(`${c.id} — ${c.name} · ${c.category} · ${c.w}×${c.h}`);
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (picture) content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: picture } });
  content.push({ type: "text", text: lines.join("\n") });

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.beta.messages.create({
      model: "claude-opus-5",
      // Thinking counts toward this, so it has to be roomy even though the answer is short.
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: ANSWER_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, reason: "refusal", message: "Claude declined to read this drawing." });
    }
    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    const patch = parseAnswer(text);
    if (!patch) {
      return NextResponse.json({
        ok: false,
        reason: message.stop_reason === "max_tokens" ? "truncated" : "unreadable",
        message: message.stop_reason === "max_tokens" ? "Claude ran out of room before it answered." : "Claude's answer wasn't a shape.",
      });
    }
    patch.options = optionsRecord(patch.options);
    return NextResponse.json({
      ok: true,
      patch,
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens, model: message.model },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ ok: false, reason: "auth", message: "The API key was rejected." });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ ok: false, reason: "rate-limit", message: "Rate limited — try again in a moment." });
    }
    const detail = error instanceof Anthropic.APIError ? `${error.status}: ${error.message}` : error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, reason: "error", message: `Couldn't read the drawing (${detail}).` });
  }
}

/** The options as the board reads them: a record of id → value, whichever way the answer listed them. */
function optionsRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" && typeof (item as { value?: unknown }).value === "string") {
        out[(item as { id: string }).id] = (item as { value: string }).value;
      }
    }
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** The answer is JSON, but a fence or a stray word round it should not lose the shape. */
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
