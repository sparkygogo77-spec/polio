/**
 * LEARN ON CLICK: the presses a capture held back, and asking for them.
 *
 * A capture does not press what would call a server (a form's submit or any
 * other write), prompt a wallet, or leave the site. It records each such
 * control, why, and where (sink `site/capture/worlds.mjs`: `doc.held`, one
 * entry a control). The Builder shows the why on the part's orange !, and
 * offers to Learn the server-call ones: pressed once each, on a later
 * capture, through the same Recapture path, so what they do can be read.
 * Wallet controls are never offered, and a wallet prompt stops a run.
 *
 * THE SHAPE, AND THE ADAPTER. Sink writes `{ page, part, character, held,
 * control, selector, attrs, hook, offsite }`; this reads that and the names
 * it could plausibly be renamed to (`why`/`reason`, `id`/`stable`,
 * `node`/`nodeId`), and nothing else of sink's is relied on. A capture that
 * can press says so (`doc.capturer.learn === true`, or `"learn"` in
 * `doc.capturer.can`); until one does, nothing is sent and the badge says it
 * is waiting. What a later capture learned comes back as `doc.learned`
 * (the same keys) or as `learned: true` on a held entry.
 *
 * None of this is published: it lives on the board beside the document
 * (`docOnly`), never in `studioDoc`. `tests/learn-on-click.mjs`.
 */
export type HeldWhy = "server-call" | "wallet" | "off-site";

export interface HeldControl {
  page: string;
  part: string;
  why: HeldWhy;
  /** The control's stable name, when the capture gave one; else the selector stands in. */
  control: string | null;
  selector: string;
  /** What the capture knew of what it would do: "not pressed: it sends a form", "POST host/api/…". */
  hook: string | null;
  offsite: string | null;
  /** It submits a form, so a press needs values to send. */
  form: boolean;
}

export interface LearnState {
  held: HeldControl[];
  /** Keys learned by a capture. */
  learned: string[];
  /** Keys waiting to be sent, in the order they were asked for. */
  queue: string[];
  /** The values a form control sends, by key. */
  values: Record<string, string>;
  /** Presses a day, at most. The owner sets it. */
  cap: number;
  /** Presses asked for, by day (YYYY-MM-DD). */
  sent: Record<string, number>;
  /** The capturer has said it can press. */
  supported: boolean;
}

export const LEARN_DEFAULT: LearnState = { held: [], learned: [], queue: [], values: {}, cap: 20, sent: {}, supported: false };
export const WAITING = "waiting for the capturer to support Learn";

export const keyOf = (h: Pick<HeldControl, "part" | "control" | "selector">) => `${h.part}|${h.control ?? h.selector}`;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const WHY: Record<string, HeldWhy> = { "server-call": "server-call", server: "server-call", wallet: "wallet", "off-site": "off-site", offsite: "off-site" };

/** A capture's held controls, whatever it called their fields. */
export function heldOf(raw: unknown): HeldControl[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const o = e as Record<string, unknown>;
    const why = WHY[(str(o.held) ?? str(o.why) ?? str(o.reason) ?? "").replace(/^held:\s*/, "").toLowerCase()];
    const part = str(o.part) ?? str(o.node) ?? str(o.nodeId);
    const selector = str(o.selector);
    if (!why || !part || !selector) return [];
    const hook = str(o.hook);
    return [{
      page: str(o.page) ?? "page_home", part, why,
      control: str(o.control) ?? str(o.id) ?? str(o.stable), selector, hook,
      offsite: str(o.offsite),
      form: o.form === true || /\bform\b/i.test(hook ?? ""),
    }];
  });
}

/** What a document brings: its held controls, what was learned, and whether its capturer can press. */
export function learnFromDoc(doc: Record<string, unknown>, was: LearnState | undefined): LearnState {
  const prev = was ?? LEARN_DEFAULT;
  const held = heldOf(doc.held);
  const cap = doc.capturer as { learn?: unknown; can?: unknown } | undefined;
  const supported = cap?.learn === true || (Array.isArray(cap?.can) && cap!.can.includes("learn"));
  const learned = new Set([
    ...heldOf(doc.learned).map(keyOf),
    ...(Array.isArray(doc.held) ? heldOf((doc.held as Record<string, unknown>[]).filter((e) => e && e.learned === true)).map(keyOf) : []),
  ]);
  const keys = new Set(held.map(keyOf));
  return {
    ...prev,
    held,
    learned: [...learned],
    /* A queued control the new capture no longer holds, or has learned, is done with. */
    queue: prev.queue.filter((k) => keys.has(k) && !learned.has(k)),
    supported,
  };
}

/** The held controls on a part. */
export const heldOn = (s: LearnState, part: string) => s.held.filter((h) => h.part === part);
/** A control is learnable: a server call. A wallet never is; off the site is not a press to learn. */
export const learnable = (h: HeldControl) => h.why === "server-call";
export const isLearned = (s: LearnState, h: HeldControl) => s.learned.includes(keyOf(h));
/** A part whose every held control has been learned: its ! goes. */
export function partLearned(s: LearnState, part: string): boolean {
  const on = heldOn(s, part).filter(learnable);
  return on.length > 0 && on.every((h) => isLearned(s, h));
}

/** The line the ! says on hover, after its own. */
export function heldSays(s: LearnState, part: string): string | null {
  const on = heldOn(s, part);
  if (!on.length) return null;
  return on.map((h) => `held: ${h.why}${h.offsite ? ` (${h.offsite})` : h.hook ? ` (${h.hook})` : ""}`).join("; ");
}

/** Queue controls to learn: server calls only, once each, and not ones learned unless asked again. */
export function queued(s: LearnState, hs: HeldControl[], again = false): LearnState {
  const add = hs.filter((h) => learnable(h) && (again || !isLearned(s, h))).map(keyOf);
  const learned = again ? s.learned.filter((k) => !add.includes(k)) : s.learned;
  return { ...s, learned, queue: [...new Set([...s.queue, ...add])] };
}

const today = (now: number) => new Date(now).toISOString().slice(0, 10);
export const leftToday = (s: LearnState, now = Date.now()) => Math.max(0, s.cap - (s.sent[today(now)] ?? 0));

export interface LearnRequest {
  learn: {
    targets: { page: string; part: string; control: string | null; selector: string; values: Record<string, string> | null }[];
    /** At most one press a control. */
    pressesPerControl: 1;
    /** A wallet prompt ends the run there. */
    stopOnWallet: true;
    /** What is left of today's cap: the run presses no more than this. */
    cap: number;
  };
}

/** `name=value` a line, as the form under Learn takes them. */
export function valuesOf(text: string | undefined): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const line of (text ?? "").split(/\n/)) {
    const at = line.indexOf("=");
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return Object.keys(out).length ? out : null;
}

/** The one request for the whole queue, within today's cap. Null when there is nothing to send. */
export function learnRequest(s: LearnState, now = Date.now()): LearnRequest | null {
  const left = leftToday(s, now);
  const byKey = new Map(s.held.map((h) => [keyOf(h), h]));
  const targets = s.queue
    .map((k) => byKey.get(k))
    .filter((h): h is HeldControl => !!h && learnable(h))
    .slice(0, left)
    .map((h) => ({ page: h.page, part: h.part, control: h.control, selector: h.selector, values: h.form ? valuesOf(s.values[keyOf(h)]) : null }));
  return targets.length ? { learn: { targets, pressesPerControl: 1, stopOnWallet: true, cap: left } } : null;
}

/** What sending did to the state: the queue sent is out of it, and today's count is up. */
export function afterSend(s: LearnState, req: LearnRequest, now = Date.now()): LearnState {
  const went = new Set(req.learn.targets.map((t) => `${t.part}|${t.control ?? t.selector}`));
  const d = today(now);
  return { ...s, queue: s.queue.filter((k) => !went.has(k)), sent: { ...s.sent, [d]: (s.sent[d] ?? 0) + went.size } };
}
