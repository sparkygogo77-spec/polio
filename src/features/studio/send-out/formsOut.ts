/**
 * FORMS THAT REALLY SEND, ON AN EXPORTED SITE (J 2026-11-01: "forms that
 * really send"; the destination is a setting, because he has not picked one).
 *
 * A captured form comes in as drawings: the box the `<form>` was, a box of
 * words for each field (its placeholder, measured), a box for its button. The
 * capture says what each was (`from.selector`, and "textbox, named “Email”,
 * required, type email" in `data`), and that is what is read here. A contact
 * form or an email sign-up from the shelf publishes with real inputs, and no
 * `<form>` round them either.
 *
 *   · `formsOf`: the site's forms: its fields, its button, and what is left out
 *     and why (a search form has no message to send: it needs the site's own
 *     data, and is said, not wired);
 *   · `formFiles`: the server side both ways of exporting share: a route that
 *     treats what comes in as hostile, the small list of destinations, and the
 *     list of forms it accepts;
 *   · Exact look: `exactFormScript`, one script beside the published markup,
 *     which it does not touch: a drawn field takes typing when it is pressed,
 *     and the page as it opens is the same page, pixel for pixel;
 *   · Clean code: `wireForClean` writes real inputs and buttons into the page
 *     before it is turned into classes, joined to a `<FormSender>` by the
 *     standard `form` attribute, so the layout stays as the layout reader wrote it.
 *
 * With no destination set the form says so, on the page, and keeps what was
 * typed. No key, address or message is written into an export: secrets are
 * environment variables on the server, read in `forms/destinations.ts`.
 *
 * A site with no form gets none of these files.
 *
 * Pure: it reads DOM Documents it is handed and returns files.
 */
import { homeFor, routeOf, type Routed } from "../homePage.ts";
import { POLIO_HEADER } from "./tokensOut.ts";

export type FieldKind = "text" | "email" | "tel" | "url" | "number" | "textarea" | "select" | "checkbox";

export interface FormField {
  /** The name it is sent under, unique in its form: `email`, `your-feedback`. */
  name: string;
  /** What a person calls it: its accessible name, as the page had it. */
  label: string;
  kind: FieldKind;
  required: boolean;
  /** The part that holds it. */
  part: string;
  /** True when the published page draws it as words: there is no input to type in until something makes one. */
  drawn: boolean;
  placeholder: string;
  value: string;
  /** The most characters the server takes for it. */
  max: number;
}

export interface SiteForm {
  /** Its id in the route's list and on the page: `feedback`. */
  id: string;
  pageId: string;
  /** The page, as a person names it. */
  page: string;
  /** The part the form was. */
  part: string;
  fields: FormField[];
  /** The part that sends it. */
  submit: string;
  /** Inside the form but not sent, in words: a choice drawn as buttons, a search box. */
  notSent: string[];
}

export interface SkippedForm { page: string; part: string; why: string }
export interface FormsFound { forms: SiteForm[]; skipped: SkippedForm[] }

/** One line of the board, as far as forms read it. */
export interface FormNode {
  id: string;
  pageId: string;
  featureId?: string | null;
  label?: string | null;
  prompt?: string | null;
  data?: string | null;
  content?: unknown;
  x?: number;
  y?: number;
  h?: number;
  state?: unknown;
  options?: Record<string, unknown> | null;
  hooks?: Record<string, string> | null;
  from?: { selector?: string } | null;
}

/** The most a field takes: a line, and a message. Past this it is not a person writing. */
const MAX_LINE = 500;
const MAX_LONG = 10_000;
/** The name of the trap field: a person never sees it, and a form-filling robot fills it. */
export const TRAP_FIELD = "website";
/** The shelf's parts that are a form with one send button. A form in steps shows one field at a time: said, not wired. */
const SHELF_FORMS = new Set(["contact-form", "newsletter", "booking", "survey"]);
const SHELF_SAID = new Set(["multi-step-form", "file-upload", "checkout", "subscription"]);

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const lastOf = (selector: string) => selector.split(">").pop()!.trim();
const isFormSelector = (selector: string) => /^form(:nth-of-type\(\d+\))?$/.test(lastOf(selector));
const quoted = (s: string, word: string) => new RegExp(`${word} “([^”]*)”`).exec(s)?.[1] ?? "";
const said = (n: FormNode) => `${n.data ?? ""} ${n.prompt ?? ""}`;
/** The capture's words for what the browser computed: "textbox, named “Email”, required, type email". */
const roleOf = (n: FormNode) => /^([a-z]+)\b/.exec(n.data ?? "")?.[1] ?? /^([a-z]+) “/.exec(n.label ?? "")?.[1] ?? "";

function kindOf(type: string, name: string): FieldKind {
  const t = type.toLowerCase();
  if (t === "textarea" || t === "select" || t === "checkbox" || t === "email" || t === "tel" || t === "url" || t === "number") return t;
  if (t === "select-one") return "select";
  return /e-?mail/i.test(name) ? "email" : "text";
}

/** A field as the capture, or the import of a page's code, describes it. Null for a part that is no field. */
function fieldOf(n: FormNode, doc: Document): Omit<FormField, "name"> | { left: string } | null {
  const opt = n.options ?? {};
  const read = n.featureId === "field" || n.featureId === "checkbox";
  const role = roleOf(n);
  if (!read && !["textbox", "searchbox", "combobox", "spinbutton", "checkbox"].includes(role)) return null;
  const type = read ? String(opt.kind ?? "text") : /\btype ([a-z-]+)/.exec(said(n))?.[1] ?? (role === "checkbox" ? "checkbox" : "text");
  const label = (read ? String(opt.label ?? n.hooks?.name ?? "") : quoted(said(n), "named") || /“([^”]*)”/.exec(n.label ?? "")?.[1]) || String(n.content ?? "") || "Field";
  if (role === "searchbox" || type === "search") return { left: `a search box: ${label}` };
  if (type === "file" || type === "password") return { left: `${label} (${type === "file" ? "a file is not sent" : "a password is not sent"})` };
  const kind = kindOf(type, label);
  const drawn = !doc.getElementById(n.id)?.querySelector("input, textarea, select");
  /* A tick or a list only drawn has nothing to choose from: only words can be typed over. */
  if (drawn && (kind === "checkbox" || kind === "select")) return { left: `${label} (drawn, with nothing to choose)` };
  return {
    label, kind, part: n.id, drawn,
    required: read ? opt.required === "yes" : /, required\b/.test(said(n)),
    placeholder: read ? String(opt.placeholder ?? "") : quoted(said(n), "placeholder"),
    value: read ? String(opt.value ?? "") : quoted(said(n), "value"),
    max: kind === "textarea" ? MAX_LONG : MAX_LINE,
  };
}

const named = (fields: Omit<FormField, "name">[]): FormField[] => {
  const used = new Set<string>([TRAP_FIELD, "form", "page"]);
  return fields.map((f, i) => {
    const stem = slug(f.label) || `field-${i + 1}`;
    let name = stem;
    for (let k = 2; used.has(name); k++) name = `${stem}-${k}`;
    used.add(name);
    return { ...f, name };
  });
};

/** The site's forms, from the board and each page as published. */
export function formsOf(nodes: readonly FormNode[], pages: readonly (Routed & { id: string; name?: string | null })[], published: ReadonlyMap<string, Document>): FormsFound {
  const home = homeFor(pages as (Routed & { id: string })[]);
  const pageName = new Map(pages.map((p) => [p.id, p.name?.trim() || routeOf(home, p) || "Home"]));
  const forms: Omit<SiteForm, "id">[] = [];
  const skipped: SkippedForm[] = [];
  const state = (n: FormNode) => JSON.stringify(n.state ?? null);

  const onPage = new Map<string, FormNode[]>();
  for (const n of nodes) { const l = onPage.get(n.pageId); if (l) l.push(n); else onPage.set(n.pageId, [n]); }

  for (const [pageId, doc] of published) {
    const here = onPage.get(pageId) ?? [];
    const page = pageName.get(pageId) ?? "Home";
    for (const holder of here) {
      if (!doc.getElementById(holder.id)) continue;
      /* The shelf's: a real form part, its inputs in the published page. */
      if (SHELF_SAID.has(holder.featureId ?? "")) { skipped.push({ page, part: holder.id, why: "it needs more than one send button can do: a person or a code chat wires it" }); continue; }
      if (SHELF_FORMS.has(holder.featureId ?? "")) {
        const el = doc.getElementById(holder.id)!;
        const controls = Array.from(el.querySelectorAll("input, textarea, select"));
        const button = Array.from(el.querySelectorAll("button")).pop();
        if (!controls.length || !button) { skipped.push({ page, part: holder.id, why: "it has no field or no button on the page" }); continue; }
        const fields = named(controls.map((c): Omit<FormField, "name"> => {
          const label = c.getAttribute("aria-label") ?? c.getAttribute("placeholder") ?? "Field";
          const tag = c.tagName.toLowerCase();
          const kind = kindOf(tag === "input" ? c.getAttribute("type") ?? "" : tag, label);
          return { label, kind, required: true, part: holder.id, drawn: false, placeholder: c.getAttribute("placeholder") ?? "", value: "", max: kind === "textarea" ? MAX_LONG : MAX_LINE };
        }));
        forms.push({ pageId, page, part: holder.id, fields, submit: holder.id, notSent: [] });
        continue;
      }
      /* The captured, and the read: the box the form was, its fields under it by their path. */
      const sel = holder.from?.selector;
      if (!sel || !isFormSelector(sel)) continue;
      if (/^search\b/.test(holder.label ?? "")) { skipped.push({ page, part: holder.id, why: "a search form looks things up in the site's own data: it has nothing to send" }); continue; }
      const inside = here.filter((n) => n.from?.selector?.startsWith(`${sel} > `) && state(n) === state(holder) && doc.getElementById(n.id));
      const read = inside.map((n) => ({ n, f: fieldOf(n, doc) }));
      const fields = read.flatMap(({ f }) => (f && !("left" in f) ? [f] : []));
      const notSent = read.flatMap(({ f }) => (f && "left" in f ? [f.left] : []));
      if (!fields.length) {
        /* A copy of a form for one state of a press, holding none of the fields: not a form of its own. */
        if (holder.state == null) skipped.push({ page, part: holder.id, why: notSent.length ? `it has only ${notSent.join(", ")}` : "it has no field to type in" });
        continue;
      }
      const taken = new Set(fields.map((f) => f.part));
      const buttons = inside.filter((n) => !taken.has(n.id) && (roleOf(n) === "button" || /^button\b/.test(lastOf(n.from!.selector!)))).sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
      /* The capture does not say which button submits: a form's send is its last, as a person reads it. */
      const said1 = buttons.filter((n) => /\btype submit\b/.test(said(n)));
      const submit = said1.pop() ?? buttons.pop();
      if (!submit) { skipped.push({ page, part: holder.id, why: "it has no button to send it" }); continue; }
      for (const b of buttons) if (b !== submit) notSent.push(`a choice drawn as a button: ${/“([^”]*)”/.exec(b.label ?? "")?.[1] ?? b.id}`);
      forms.push({ pageId, page, part: holder.id, fields: named(fields), submit: submit.id, notSent });
    }
  }
  const used = new Set<string>();
  const out = forms.map((f): SiteForm => {
    const stem = slug(f.page) || "form";
    let id = stem;
    for (let k = 2; used.has(id); k++) id = `${stem}-${k}`;
    used.add(id);
    return { ...f, id };
  });
  return { forms: out, skipped };
}

/** The id the page's `<form>` carries. */
export const formDomId = (f: SiteForm) => `polio-form-${f.id}`;

/**
 * The site's setting for where forms send: `format["forms.destination"]`, the
 * name of one destination in `forms/destinations.ts`. Only a name: anything
 * else (a pasted key, an address) is not written into an export.
 */
export function destinationSetting(format: Record<string, unknown> | null | undefined): string {
  const v = String(format?.["forms.destination"] ?? "").trim().toLowerCase();
  return /^[a-z][a-z0-9-]{0,30}$/.test(v) ? v : "";
}

/* ------------------------------------------------------------------ */
/* What a visitor is told                                              */
/* ------------------------------------------------------------------ */

/** The one place these words live, for the route and both ways of exporting. Each failure says it was not sent. */
export const FORM_SAYS = {
  sent: "Sent. Thank you.",
  test: "Test only: kept on the server for checking. Nobody was told.",
  no_destination: "This form is not connected yet. Your message was not sent.",
  destination_failed: "The message could not be delivered. It was not sent. Please try again later.",
  invalid: "Please check what you typed. Your message was not sent.",
  too_big: "That is too long. Your message was not sent.",
  too_many: "Too many messages from here. Yours was not sent. Please wait a minute.",
  refused: "This message was refused. It was not sent.",
  offline: "The site could not be reached. Your message was not sent.",
} as const;

/* ------------------------------------------------------------------ */
/* The server side                                                     */
/* ------------------------------------------------------------------ */

const HEADER = `/* ${POLIO_HEADER} */`;

const DESTINATIONS_TS = String.raw`/**
 * WHERE THIS SITE'S FORMS SEND.
 *
 * The site says which by name: FORM_DESTINATION in the server's environment,
 * else the name in forms/forms.ts (the site's setting in Polio). With neither,
 * or a name not listed here, there is no destination: the route answers
 * "not connected" and the visitor is told their message was not sent.
 *
 * To add a real destination, add one entry to DESTINATIONS: a name and a send
 * that delivers the message and says whether it did. Read its key from
 * process.env inside send, so it stays on the server and out of the code.
 * Never log a message's contents.
 */
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DESTINATION } from "./forms";

export interface FormMessage {
  form: string;
  page: string;
  /** When it arrived (ISO). */
  at: string;
  fields: { name: string; label: string; value: string }[];
}

export interface Sent {
  ok: boolean;
  /** A destination that keeps a message for checking, and tells nobody: the visitor is told that too. */
  test?: boolean;
}

export interface Destination {
  send(message: FormMessage): Promise<Sent>;
}

const DESTINATIONS: Record<string, Destination> = {
  /* Needs no account. Keeps each message as a line in a file on the server, for checking the form works; nobody is told. */
  test: {
    async send(message) {
      const file = process.env.FORM_TEST_OUTBOX || join(tmpdir(), "polio-form-outbox.jsonl");
      await appendFile(file, JSON.stringify(message) + "\n", "utf8");
      return { ok: true, test: true };
    },
  },
};

export function chooseDestination(env: Record<string, string | undefined> = process.env): Destination | null {
  const name = (env.FORM_DESTINATION || DESTINATION).trim();
  return Object.hasOwn(DESTINATIONS, name) ? DESTINATIONS[name]! : null;
}
`;

const CHECK_TS = String.raw`/**
 * WHAT COMES IN IS HOSTILE. Nothing here trusts the browser: the size is
 * counted as it is read, only the fields a form has are taken, and each is
 * held to its length and kind on the server.
 */
import { FORMS, TRAP_FIELD } from "./forms";
import type { FormMessage } from "./destinations";

export const MAX_BYTES = 64 * 1024;
const PER_MINUTE = 5;
const MINUTE = 60_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_OK = /^https?:\/\/\S+$/i;
const PHONE = /^[+()\d\s.-]{3,40}$/;

export type Refusal = "invalid" | "too_big" | "too_many" | "refused";

/** The body as text, stopped as soon as it is over the limit, whatever its headers claim. Null when it is. */
export async function readLimited(req: Request, max = MAX_BYTES): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** A browser says which site a post came from: only this site's own pages may post here. */
export function sameSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

const seen = new Map<string, number[]>();
/** At most PER_MINUTE posts a minute from one address. Held in this server's memory, so each running copy of the server counts its own. */
export function rateLimited(address: string, now = Date.now()): boolean {
  if (seen.size > 5000) seen.clear();
  const recent = (seen.get(address) ?? []).filter((t) => now - t < MINUTE);
  recent.push(now);
  seen.set(address, recent);
  return recent.length > PER_MINUTE;
}

export function addressOf(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
}

/** Control characters cannot be typed; a line break is kept only where a message may have one. */
const clean = (s: string, long: boolean) => s.replace(long ? /[^\P{Cc}\n\t]/gu : /\p{Cc}/gu, "").trim();

function fits(kind: string, value: string): boolean {
  if (!value) return true;
  if (kind === "email") return EMAIL.test(value);
  if (kind === "url") return URL_OK.test(value);
  if (kind === "tel") return PHONE.test(value);
  if (kind === "number") return value !== "" && Number.isFinite(Number(value));
  return true;
}

/** A message the form really has, or why not. */
export function checkMessage(body: unknown, at = new Date()): { message: FormMessage } | { refusal: Refusal } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { refusal: "invalid" };
  const got = body as Record<string, unknown>;
  const form = typeof got.form === "string" && Object.hasOwn(FORMS, got.form) ? FORMS[got.form]! : null;
  if (!form) return { refusal: "invalid" };
  const sent = got.fields;
  if (!sent || typeof sent !== "object" || Array.isArray(sent)) return { refusal: "invalid" };
  const values = sent as Record<string, unknown>;
  /* A person never sees the trap. Told plainly it was refused: a person whose browser filled it in must not think it went. */
  if (values[TRAP_FIELD]) return { refusal: "refused" };
  const known = new Set(form.fields.map((f) => f.name));
  for (const key of Object.keys(values)) if (key !== TRAP_FIELD && !known.has(key)) return { refusal: "invalid" };
  const fields: FormMessage["fields"] = [];
  for (const f of form.fields) {
    const raw = Object.hasOwn(values, f.name) ? values[f.name] : "";
    if (typeof raw !== "string") return { refusal: "invalid" };
    if (raw.length > f.max) return { refusal: "too_big" };
    const value = clean(raw, f.kind === "textarea");
    if ((f.required && !value) || !fits(f.kind, value)) return { refusal: "invalid" };
    fields.push({ name: f.name, label: f.label, value });
  }
  return { message: { form: form.id, page: form.page, at: at.toISOString(), fields } };
}
`;

const ROUTE_TS = String.raw`/**
 * THE SITE'S FORMS POST HERE. Whatever happens, the answer says whether the
 * message went, and the page shows it. Nothing here logs what was typed.
 */
import { chooseDestination } from "@/forms/destinations";
import { SAYS } from "@/forms/forms";
import { addressOf, checkMessage, rateLimited, readLimited, sameSite } from "@/forms/check";

type Answer = keyof typeof SAYS;

function answer(code: Answer, status: number, req: Request): Response {
  const wantsJson = (req.headers.get("content-type") ?? "").includes("json");
  const ok = code === "sent" || code === "test";
  /* A form posted with scripts off lands on this answer itself, so it is words. */
  return wantsJson ? Response.json({ ok, code, says: SAYS[code] }, { status }) : new Response(SAYS[code], { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

const STATUS = { invalid: 400, too_big: 413, too_many: 429, refused: 403 } as const;

/** A post from a page with scripts off is form fields; one from the page's script is JSON. */
function parse(text: string, type: string): unknown {
  if (type.includes("json")) { try { return JSON.parse(text); } catch { return null; } }
  if (!type.includes("x-www-form-urlencoded")) return null;
  const all = new URLSearchParams(text);
  const { form, ...fields } = Object.fromEntries(all);
  return { form, fields };
}

export async function POST(req: Request): Promise<Response> {
  if (!sameSite(req)) return answer("refused", STATUS.refused, req);
  if (rateLimited(addressOf(req))) return answer("too_many", STATUS.too_many, req);
  const text = await readLimited(req);
  if (text === null) return answer("too_big", STATUS.too_big, req);
  const checked = checkMessage(parse(text, req.headers.get("content-type") ?? ""));
  if ("refusal" in checked) return answer(checked.refusal, STATUS[checked.refusal], req);
  const destination = chooseDestination();
  if (!destination) return answer("no_destination", 503, req);
  try {
    const sent = await destination.send(checked.message);
    if (!sent.ok) return answer("destination_failed", 502, req);
    return answer(sent.test ? "test" : "sent", 200, req);
  } catch {
    console.error("form: the destination failed");
    return answer("destination_failed", 502, req);
  }
}
`;

function formsTs(forms: SiteForm[], destination: string): string {
  const list = Object.fromEntries(forms.map((f) => [f.id, { id: f.id, page: f.page, fields: f.fields.map(({ name, label, kind, required, max }) => ({ name, label, kind, required, max })) }]));
  return [
    "/**",
    " * THE FORMS THIS SITE HAS, and the name of where they send (the site's setting in",
    " * Polio; FORM_DESTINATION in the server's environment wins over it). Only a",
    " * name: a destination's key is an environment variable, never here.",
    " */",
    `export const DESTINATION: string = ${JSON.stringify(destination)};`,
    `export const TRAP_FIELD = ${JSON.stringify(TRAP_FIELD)};`,
    "",
    "export interface FormField { name: string; label: string; kind: string; required: boolean; max: number }",
    "export interface SiteForm { id: string; page: string; fields: FormField[] }",
    "",
    `export const FORMS: Record<string, SiteForm> = ${JSON.stringify(list, null, 2)};`,
    "",
    "/** What a visitor is told. Each failure says it was not sent. */",
    `export const SAYS = ${JSON.stringify(FORM_SAYS, null, 2)} as const;`,
    "",
  ].join("\n");
}

/** The server side, the same for both ways of exporting: nothing when the site has no form. */
export function formFiles(found: FormsFound, destination: string): { path: string; content: string }[] {
  if (!found.forms.length) return [];
  return [
    { path: "app/api/form/route.ts", content: `${HEADER}\n${ROUTE_TS}` },
    { path: "forms/check.ts", content: `${HEADER}\n${CHECK_TS}` },
    { path: "forms/destinations.ts", content: `${HEADER}\n${DESTINATIONS_TS}` },
    { path: "forms/forms.ts", content: `${HEADER}\n${formsTs(found.forms, destination)}` },
  ];
}

/** POLIO.md's section: what each form sends, what it leaves out, and how to point it somewhere. */
export function formsMd(found: FormsFound, destination: string): string {
  if (!found.forms.length && !found.skipped.length) return "";
  const lines = ["## Forms", ""];
  if (found.forms.length) {
    lines.push(
      `${found.forms.length} form${found.forms.length === 1 ? "" : "s"} post to \`app/api/form/route.ts\`, which sends to the destination named by \`FORM_DESTINATION\` in the server's environment, else \`DESTINATION\` in \`forms/forms.ts\` (now ${destination ? `\`${destination}\`` : "none: visitors are told their message was not sent"}). Destinations are in \`forms/destinations.ts\`; \`test\` needs no account and tells nobody.`,
      "",
      "| Form | Page | Sends | Not sent |",
      "|---|---|---|---|",
    );
    for (const f of found.forms) lines.push(`| \`${f.id}\` | ${f.page.replace(/\|/g, "/")} | ${f.fields.map((x) => x.label.replace(/\|/g, "/")).join(", ")} | ${f.notSent.map((x) => x.replace(/\|/g, "/")).join(", ") || "nothing"} |`);
    lines.push("");
  }
  if (found.skipped.length) {
    lines.push("Not wired, and why:", "");
    for (const s of found.skipped) lines.push(`- \`${s.part}\` on ${s.page}: ${s.why}.`);
    lines.push("");
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Exact look                                                          */
/* ------------------------------------------------------------------ */

/** Where the exact-look script is served. */
export const EXACT_FORM_SCRIPT = "assets/polio-forms.js";

/**
 * Beside the published markup, never in it. On load it changes nothing that
 * paints (a role and a tab stop on a drawn field, a trap off the screen). A
 * press on a drawn field lets it take typing; the button sends; the answer
 * appears over the page, fixed, so nothing under it moves.
 */
export function exactFormScript(forms: SiteForm[]): string {
  const config = forms.map((f) => ({ id: f.id, submit: f.submit, part: f.part, fields: f.fields.map(({ name, label, kind, required, part, drawn, placeholder, value }) => ({ name, label, kind, required, part, drawn, placeholder, value })) }));
  return `/* ${POLIO_HEADER} */
(function () {
  var FORMS = ${JSON.stringify(config)};
  var SAYS = ${JSON.stringify(FORM_SAYS)};
  var TRAP = ${JSON.stringify(TRAP_FIELD)};
${String.raw`
  var answer = null;
  function say(words, good) {
    if (!answer) {
      answer = document.createElement("div");
      answer.setAttribute("role", "alert");
      answer.setAttribute("data-form-answer", "");
      answer.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;max-width:min(90vw,520px);padding:12px 16px;border-radius:8px;font:500 15px/1.4 system-ui,sans-serif;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.35)";
      document.body.appendChild(answer);
    }
    answer.style.background = good ? "#14683a" : "#a11d1d";
    answer.setAttribute("data-good", good ? "yes" : "no");
    answer.textContent = words;
  }

  /* The element a drawn field's words stand in: the deepest one that holds them. */
  function wordsOf(part) {
    var el = part;
    for (;;) {
      var kids = Array.prototype.filter.call(el.children, function (c) { return (c.textContent || "").trim() || c.children.length; });
      if (kids.length !== 1) return el;
      el = kids[0];
    }
  }

  /* A drawn field: its words are the placeholder (or its value) until typed over. */
  function drawnField(field) {
    var part = document.getElementById(field.part);
    if (!part) return null;
    var el = wordsOf(part);
    var long = field.kind === "textarea";
    var shown = el.textContent;
    var style = el.getAttribute("style") || "";
    var typed = !!field.value;
    el.setAttribute("role", "textbox");
    el.setAttribute("aria-label", field.label);
    if (field.required) el.setAttribute("aria-required", "true");
    if (long) el.setAttribute("aria-multiline", "true");
    el.setAttribute("tabindex", "0");
    el.setAttribute("data-form-field", field.name);
    part.style.cursor = "text";
    part.addEventListener("mousedown", function (e) { if (e.target !== el) { e.preventDefault(); el.focus(); } });
    el.addEventListener("focus", function () {
      if (!el.isContentEditable) {
        try { el.contentEditable = "plaintext-only"; } catch (_) { el.contentEditable = "true"; }
        el.spellcheck = false;
      }
      el.style.whiteSpace = long ? "pre-wrap" : "pre";
      el.style.minHeight = "1lh";
      el.style.outline = "none";
      if (long && el.parentElement) el.parentElement.style.overflowY = "auto";
      if (!typed) { el.textContent = ""; el.style.color = "var(--text, inherit)"; }
    });
    el.addEventListener("input", function () { typed = el.textContent !== ""; });
    el.addEventListener("blur", function () {
      if (!typed) { el.setAttribute("style", style); el.textContent = shown; }
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !long) { e.preventDefault(); if (field.send) field.send(); }
    });
    return {
      field: field,
      read: function () { return typed ? (el.innerText || el.textContent || "") : ""; },
      focus: function () { el.focus(); },
      clear: function () { typed = false; el.setAttribute("style", style); el.textContent = shown; },
    };
  }

  /* A real control the page already has. */
  function realField(field, form) {
    var part = document.getElementById(field.part);
    if (!part) return null;
    var el = Array.prototype.filter.call(part.querySelectorAll("input, textarea, select"), function (c) {
      return (c.getAttribute("aria-label") || c.getAttribute("placeholder") || "Field") === field.label || part.id !== form.part;
    })[0];
    if (!el) return null;
    el.removeAttribute("readonly");
    el.removeAttribute("tabindex");
    el.setAttribute("data-form-field", field.name);
    if (field.kind !== "textarea" && el.tagName === "INPUT") el.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (field.send) field.send(); } });
    return {
      field: field,
      read: function () { return el.type === "checkbox" ? (el.checked ? "yes" : "") : el.value; },
      focus: function () { el.focus(); },
      clear: function () { if (el.type === "checkbox") el.checked = false; else el.value = ""; },
    };
  }

  function wire(form) {
    if (!document.getElementById(form.part)) return;
    var sending = false;
    var trap = document.createElement("input");
    trap.name = TRAP;
    trap.tabIndex = -1;
    trap.autocomplete = "off";
    trap.setAttribute("aria-hidden", "true");
    trap.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(trap);

    function send() {
      if (sending) return;
      var fields = {};
      for (var i = 0; i < boxes.length; i++) {
        var v = boxes[i].read().trim();
        if (boxes[i].field.required && !v) { boxes[i].focus(); say(SAYS.invalid, false); return; }
        if (v && boxes[i].field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { boxes[i].focus(); say(SAYS.invalid, false); return; }
        fields[boxes[i].field.name] = v;
      }
      if (trap.value) fields[TRAP] = trap.value;
      sending = true;
      fetch("/api/form", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ form: form.id, fields: fields }) })
        .then(function (r) { return r.json(); })
        .then(function (a) {
          say(a.says || SAYS.offline, !!a.ok);
          if (a.ok) boxes.forEach(function (b) { b.clear(); });
        })
        .catch(function () { say(SAYS.offline, false); })
        .then(function () { sending = false; });
    }

    var boxes = form.fields.map(function (f) { f.send = send; return f.drawn ? drawnField(f) : realField(f, form); }).filter(Boolean);
    var part = document.getElementById(form.submit);
    if (!part || !boxes.length) return;
    /* The shelf's form holds its own button: the last one in it. */
    var inner = part.querySelectorAll("button");
    var button = form.submit === form.part && inner.length ? inner[inner.length - 1] : part;
    if (button.tagName !== "BUTTON") {
      button.setAttribute("role", "button");
      button.setAttribute("tabindex", "0");
      button.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); send(); } });
    }
    button.setAttribute("data-form-send", form.id);
    button.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); send(); }, true);
  }

  FORMS.forEach(wire);
})();
`}`;
}

/* ------------------------------------------------------------------ */
/* Clean code                                                          */
/* ------------------------------------------------------------------ */

const FORM_SENDER_TSX = String.raw`"use client";
/**
 * ONE FORM ON THE PAGE. It draws nothing itself: the page's inputs and its
 * button join it by their form attribute (form="polio-form-…"), wherever the
 * layout puts them. It posts to app/api/form/route.ts and shows the answer over
 * the page. What was typed stays unless the answer says it went.
 */
import * as React from "react";

const OFFLINE = "The site could not be reached. Your message was not sent.";

export default function FormSender({ id, name }: { id: string; name: string }) {
  const [answer, setAnswer] = React.useState<{ ok: boolean; says: string } | null>(null);
  const [sending, setSending] = React.useState(false);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    setSending(true);
    try {
      const fields = Object.fromEntries(new FormData(form));
      delete fields.form;
      const res = await fetch("/api/form", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ form: name, fields }) });
      const got = (await res.json()) as { ok: boolean; says: string };
      setAnswer(got);
      if (got.ok) form.reset();
    } catch {
      setAnswer({ ok: false, says: OFFLINE });
    } finally {
      setSending(false);
    }
  }

  return (
    <form id={id} action="/api/form" method="post" onSubmit={send} className="contents">
      <input type="hidden" name="form" value={name} />
      {/* A person never sees this: a robot filling every box does, and the server refuses it. */}
      <input name="${TRAP_FIELD}" tabIndex={-1} autoComplete="off" aria-hidden="true" className="fixed top-0 -left-[9999px] size-px opacity-0" />
      {answer ? (
        <p role="alert" data-form-answer="" data-good={answer.ok ? "yes" : "no"} className={"fixed bottom-6 left-1/2 z-50 max-w-[min(90vw,520px)] -translate-x-1/2 rounded-lg px-4 py-3 text-[15px] font-medium text-white shadow-lg " + (answer.ok ? "bg-[#14683a]" : "bg-[#a11d1d]")}>
          {answer.says}
        </p>
      ) : null}
    </form>
  );
}
`;

export function cleanFormFiles(found: FormsFound): { path: string; content: string }[] {
  return found.forms.length ? [{ path: "components/FormSender.tsx", content: FORM_SENDER_TSX.replace(`"use client";`, `"use client";\n${HEADER}`) }] : [];
}

const px = (v: number) => `${Math.round(v * 100) / 100}px`;
/** How a control sits where its words were: the box's own look stays on the box. */
const CONTROL_CLASS = "block w-full bg-transparent outline-none placeholder:text-current resize-none";

function controlAttrs(el: Element, form: SiteForm, f: FormField): void {
  el.setAttribute("name", f.name);
  el.setAttribute("form", formDomId(form));
  el.setAttribute("aria-label", f.label);
  if (f.required) el.setAttribute("required", "");
  else el.removeAttribute("required");
  if (f.kind !== "select" && f.kind !== "checkbox") el.setAttribute("maxlength", String(f.max));
  for (const a of ["readonly", "tabindex", "aria-invalid", "disabled"]) el.removeAttribute(a);
}

/** The deepest element holding a drawn field's words. */
function wordsBox(part: Element): Element {
  let el = part;
  for (;;) {
    const kids = Array.from(el.children).filter((c) => (c.textContent ?? "").trim() || c.children.length);
    if (kids.length !== 1) return el;
    el = kids[0]!;
  }
}

/**
 * Writes real controls into a published page before it becomes classes: a
 * drawn field becomes an input or a textarea of the same height, and a real
 * one gets its name, and each joins its form by the `form` attribute. The part
 * that sends is said by `submitOf`, because it may be drawn as a library button.
 */
export function wireForClean(doc: Document, forms: readonly SiteForm[], heightOf: (id: string) => number): void {
  for (const form of forms) {
    const onPart = new Map<string, Element[]>();
    for (const f of form.fields) {
      const part = doc.getElementById(f.part);
      if (!part) continue;
      if (f.drawn) {
        const words = wordsBox(part);
        const control = doc.createElement(f.kind === "textarea" ? "textarea" : "input");
        if (f.kind !== "textarea") control.setAttribute("type", f.kind);
        if (f.placeholder) control.setAttribute("placeholder", f.placeholder);
        if (f.value) control.setAttribute("value", f.value);
        controlAttrs(control, form, f);
        const look = part.querySelector(":scope > .mo")?.getAttribute("style") ?? "";
        const pad = /padding:\s*([\d.]+)px(?:\s+[\d.]+px\s+([\d.]+)px)?/.exec(look);
        const inside = Math.max(0, heightOf(f.part) - (pad ? Number(pad[1]) + Number(pad[2] ?? pad[1]) : 0));
        control.setAttribute("class", `${CONTROL_CLASS} h-[${px(inside)}]`);
        words.replaceWith(control);
      } else {
        const here = onPart.get(f.part) ?? Array.from(part.querySelectorAll("input, textarea, select"));
        onPart.set(f.part, here);
        const el = here.shift();
        if (el) controlAttrs(el, form, f);
      }
    }
    /* The shelf's form holds its own button; a captured form's is a part, which the page's walk writes (`submitOf`). */
    if (form.submit === form.part) {
      const button = Array.from(doc.getElementById(form.part)?.querySelectorAll("button") ?? []).pop();
      if (button) { button.setAttribute("type", "submit"); button.setAttribute("form", formDomId(form)); }
    }
  }
}

/** Which form a part sends, for the page's walk: the part that is a captured form's button. */
export function submitOf(forms: readonly SiteForm[]): Map<string, string> {
  return new Map(forms.filter((f) => f.submit !== f.part).map((f) => [f.submit, formDomId(f)]));
}
