import { NextResponse } from "next/server";
import { askSize, DEFAULT_REMAKE_MODEL, modelLabel, pickModel, REMAKE_MODELS } from "@/features/studio/pictures";

/**
 * Remake a picture from one prompt: the picture goes to OpenAI's image edit
 * call as the reference, with the prompt, and the answer comes back as a
 * picture for the browser to fit to the original's exact size
 * (`RemakePicture.tsx`).
 *
 * The key is the person's own: typed into the keys panel, held in their
 * browser, and sent with this call only (`x-openai-key`). `OPENAI_API_KEY` on
 * the server is used when the browser holds none. Neither is ever returned,
 * logged or put in a message.
 *
 * `{ probe: true }` asks only which model would be used, so the menu can say
 * so before anything is drawn. Every failure is a 200 with a reason and a
 * sentence; a call that hangs is cut off before the platform's own limit.
 */

export const runtime = "nodejs";
export const maxDuration = 180;

/** OpenAI, or a stand-in a test serves (`OPENAI_API=http://127.0.0.1:…`). Never a key. */
const BASE = () => (process.env.OPENAI_API ?? "https://api.openai.com").replace(/\/$/, "");
const BUDGET_MS = 170_000;

type Body = { probe?: boolean; prompt?: string; image?: string; w?: number; h?: number; transparent?: boolean; model?: string };

const say = (reason: string, message: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, reason, message, ...extra });

/** The models this key can use, or null when the list could not be read (then the asked-for one is simply tried). */
async function openModels(key: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${BASE()}/v1/models`, { headers: { authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { id?: string }[] };
    const ids = (data.data ?? []).map((m) => m.id ?? "").filter((id) => id.startsWith("gpt-image"));
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return say("bad-request", "Nothing readable was sent.");
  }
  const supplied = request.headers.get("x-openai-key")?.trim();
  const key = (supplied && supplied.length > 8 ? supplied : null) || process.env.OPENAI_API_KEY?.trim() || null;
  if (!key) {
    return say("no-key", "No OpenAI key yet. Press the key button in the top bar (Control or Command, Shift and K), paste your key under OpenAI, and press Try it. It is held in this browser and used for your own pictures only.");
  }
  const wanted = REMAKE_MODELS.some((m) => m.id === body.model) ? body.model! : DEFAULT_REMAKE_MODEL;
  const picked = pickModel(wanted, await openModels(key));
  if (!picked) return say("no-model", "This OpenAI key cannot use any GPT image model. Check the key's project has image models turned on.");
  const fell = picked.fellBack ? `${modelLabel(wanted)} is not open to this key, so ${modelLabel(picked.model)} is used instead.` : null;
  if (body.probe) return NextResponse.json({ ok: true, model: picked.model, label: modelLabel(picked.model), fellBack: picked.fellBack, said: fell });

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return say("no-prompt", "Say what the new picture should be.");
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(body.image ?? "");
  if (!m) return say("no-picture", "The picture to remake did not arrive.");
  const w = Math.max(1, Math.round(Number(body.w) || 0)), h = Math.max(1, Math.round(Number(body.h) || 0));
  const size = askSize(picked.model, w, h);

  const edit = async (background: boolean) => {
    const form = new FormData();
    form.append("model", picked.model);
    form.append("prompt", prompt);
    form.append("image", new Blob([Buffer.from(m[2]!, "base64")], { type: m[1]! }), `reference.${m[1]!.split("/")[1]?.replace("jpeg", "jpg") ?? "png"}`);
    form.append("size", `${size.w}x${size.h}`);
    form.append("n", "1");
    form.append("output_format", "png");
    if (background) form.append("background", "transparent");
    return fetch(`${BASE()}/v1/images/edits`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      /* Cancel in the browser reaches OpenAI too: a picture nobody waits for is not paid for twice over. */
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(Math.max(5_000, BUDGET_MS - (Date.now() - started)))]),
    });
  };

  try {
    let transparent = !!body.transparent;
    let res = await edit(transparent);
    /* A model that will not draw a see-through background is asked again without: the fit keeps the original's clear parts clear where it can. */
    if (transparent && res.status === 400) {
      const text = await res.clone().text().catch(() => "");
      if (/background|transparen/i.test(text)) { transparent = false; res = await edit(false); }
    }
    const data = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; error?: { message?: string; code?: string } };
    if (res.status === 401 || res.status === 403) return say("auth", "OpenAI refused this key. Check it is copied whole and has not been revoked, then press Try it under the key button.");
    if (!res.ok || !data.data?.[0]?.b64_json) {
      return say("error", `OpenAI answered ${res.status}${data.error?.message ? `: ${data.error.message}` : ""}.`, { seconds: Math.round((Date.now() - started) / 1000) });
    }
    return NextResponse.json({
      ok: true,
      image: `data:image/png;base64,${data.data[0].b64_json}`,
      model: picked.model, label: modelLabel(picked.model), fellBack: picked.fellBack, said: fell,
      asked: size, transparent,
      seconds: Math.round((Date.now() - started) / 1000),
    });
  } catch (err) {
    const late = err instanceof Error && /timeout|abort/i.test(err.name + err.message);
    return say(late ? "timeout" : "network", late ? "OpenAI took too long to answer. Try again." : "The server could not reach OpenAI.", { seconds: Math.round((Date.now() - started) / 1000) });
  }
}
