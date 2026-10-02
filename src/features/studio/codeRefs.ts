/**
 * WHICH CODE TOUCHES EACH PART, for the part panel's code view.
 *
 * The owner's words: "i need all the code imported properly associated with
 * the elements in the builder too". A part brought in from a code repository
 * already knows its markup (file and line) and the CSS rules that reach it
 * (`sourceHooks.ts`); this finds every place in the repository's scripts
 * that reads it, writes its words, builds what is inside it, sets its state
 * (shown, hidden, enabled), styles it, or listens on it, with the file, the
 * line and the function it is in.
 *
 * A repository that keeps a `hooks.json` (PonsStars will: each hook's code
 * references) is taken at its word for every hook it lists. Anything else
 * is found by reading the scripts: a hook's name as a string (`$('balance-
 * note')`, `[data-hook="balance-note"]`), an id where an id is looked up
 * (`getElementById('max')`, `'#max'`), a class where a class is (`.row`,
 * `classList`), and a variable a hook was put in, followed down its
 * function. Each use is labelled by what the line does with it. It is a
 * reading, not a parse: it can miss a name a script builds out of pieces
 * (`${prefix}-matches`), and says so in the panel.
 *
 * Read only. Pure: `tests/style-layer.mjs` holds it.
 */

export type RefKind = "listens" | "builds" | "writes" | "state" | "styles" | "reads" | "finds";

export interface CodeRef {
  file: string;
  line: number;
  /** The named function the line is in, or null at the top of the file. */
  fn: string | null;
  kind: RefKind;
  /** The line, trimmed, for the panel. */
  code: string;
  /** The hook, id or class this use names: `data-hook=x`, `id=x`, `class=x`. */
  via: string;
}

/** In plain words, for the panel. */
export const KIND_SAYS: Record<RefKind, string> = {
  listens: "listens for presses or changes",
  builds: "builds what is inside it",
  writes: "writes its words or value",
  state: "shows, hides or switches it on or off",
  styles: "styles it",
  reads: "reads it",
  finds: "finds it",
};

/** The code with comments and the insides of strings blanked, lines kept: for counting braces. */
export function blankCode(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i]!;
    const d = text[i + 1];
    if (c === "/" && d === "/") { while (i < n && text[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && d === "*") { out += "  "; i += 2; while (i < n && !(text[i] === "*" && text[i + 1] === "/")) { out += text[i] === "\n" ? "\n" : " "; i++; } out += "  "; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      out += c; i++;
      while (i < n && text[i] !== c) {
        if (text[i] === "\\") { out += "  "; i += 2; continue; }
        if (c !== "`" && text[i] === "\n") break;
        out += text[i] === "\n" ? "\n" : " "; i++;
      }
      if (i < n) { out += text[i]; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

const HEADERS = [
  /\bfunction\s*\*?\s*([\w$]+)\s*\(/,
  /([\w$]+)\s*[:=]\s*(?:async\s+)?function\b/,
  /([\w$]+)\s*[:=]\s*(?:async\s*)?(?:\([^()]*\)|[\w$]+)\s*=>/,
  /^\s*(?:static\s+)?(?:async\s+)?([\w$]+)\s*\([^()]*\)\s*\{/,
];
const NOT_NAMES = new Set(["if", "for", "while", "switch", "catch", "function", "return", "else", "do", "with"]);

/** For each line (1-based index), the innermost named function it is in. */
export function functionsByLine(text: string): (string | null)[] {
  const lines = blankCode(text).split("\n");
  const raw = text.split("\n");
  const out: (string | null)[] = [null];
  const stack: { name: string; depth: number }[] = [];
  let depth = 0;
  for (let k = 0; k < lines.length; k++) {
    const l = lines[k]!;
    let name: string | null = null;
    /* `$('deposit-review').onclick = () => …`: a handler set as a property is named the same way as one added. */
    const prop = /(?:(['"`])([\w-]+)\1\s*\)\s*)?\.on([a-z]+)\s*=\s*(?:async\s*)?(?:function\b|\([^()]*\)\s*=>|[\w$]+\s*=>)/.exec(raw[k] ?? "");
    if (prop) name = `the ${prop[3]} handler${prop[2] ? ` on ${prop[2]}` : ""}`;
    else for (const re of HEADERS) { const m = re.exec(l); if (m && !NOT_NAMES.has(m[1]!)) { name = m[1]!; break; } }
    /* An anonymous handler is named by what it answers: "the click handler on wallet-connect-test". */
    const ev = /(?:(['"`])([\w-]+)\1\)?\s*\)?\s*)?\.addEventListener\s*\(\s*['"]([\w:-]+)['"]/.exec(raw[k] ?? "");
    if (!name && ev) name = `the ${ev[3]} handler${ev[2] ? ` on ${ev[2]}` : ""}`;
    const opens = (l.match(/\{/g) ?? []).length;
    const closes = (l.match(/\}/g) ?? []).length;
    if (name && opens > closes) stack.push({ name, depth });
    out.push(stack.length ? stack[stack.length - 1]!.name : name);
    depth += opens - closes;
    while (stack.length && depth <= stack[stack.length - 1]!.depth) stack.pop();
  }
  return out;
}

/** What a line does with the element it names. */
export function kindOf(line: string, v: string | null = null): RefKind {
  const on = v ? `\\b${v.replace(/\$/g, "\\$")}\\b` : "";
  const t = line;
  if (/addEventListener\s*\(|\.on[a-z]+\s*=|\.on\(\s*['"]/.test(t)) return "listens";
  if (/innerHTML\s*=(?!=)|\.append(Child)?\s*\(|replaceChildren\s*\(|insertAdjacent(HTML|Element)\s*\(|\.prepend\s*\(/.test(t)) return "builds";
  if (/(textContent|innerText|\.value|\.src|\.href)\s*=(?!=)|\bsetText\s*\(|\btext\s*\(/.test(t)) return "writes";
  if (/\.(hidden|disabled|checked|open)\s*=(?!=)|\b(show|hide|toggle|enable|disable)\s*\(|removeAttribute\s*\(\s*['"](hidden|disabled)/.test(t)) return "state";
  if (/\.style\.|classList\.|\.dataset\.[\w$]+\s*=(?!=)|setAttribute\s*\(|\.className\s*=(?!=)/.test(t)) return "styles";
  if (/\.(value|checked|files|textContent|innerText|dataset)\b|getComputedStyle\s*\(|getAttribute\s*\(/.test(t)) return "reads";
  void on;
  return "finds";
}

/** The statement a name sits in, from the name on: on a one-line handler, what is done to that element, not what the line begins with. */
function statementAt(line: string, at: number): string {
  /* From the start of the statement or the arrow the name sits in, so the call it is handed to counts (`setText('wallet-message', …)`). */
  const before = line.slice(0, at);
  const from = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("=>") + 1) + 1;
  const rest = line.slice(from);
  const end = rest.search(/;|\{\s*$/);
  return end > 0 ? rest.slice(0, end + 1) : rest;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** What to look for. `class` names are looked for only where a class is looked up. */
export interface Wanted { attr: "data-hook" | "id" | "class"; value: string }

/**
 * Every use of each wanted name in the scripts, keyed `attr=value`.
 */
export function scanScripts(files: { path: string; text: string }[], wanted: Wanted[]): Map<string, CodeRef[]> {
  const out = new Map<string, CodeRef[]>();
  const add = (key: string, r: CodeRef) => {
    const list = out.get(key) ?? [];
    if (!list.some((x) => x.file === r.file && x.line === r.line)) list.push(r);
    out.set(key, list);
  };
  const uniq = [...new Map(wanted.filter((w) => w.value).map((w) => [`${w.attr}=${w.value}`, w])).values()];
  for (const f of files) {
    if (!/\.(m?js|cjs)$/i.test(f.path)) continue;
    const lines = f.text.split("\n");
    const fns = functionsByLine(f.text);
    for (const w of uniq) {
      const v = esc(w.value);
      const re = w.attr === "data-hook"
        ? new RegExp(`(['"\`])${v}\\1|data-hook\\s*=\\s*\\\\?['"]${v}\\\\?['"]`)
        : w.attr === "id"
          ? new RegExp(`getElementById\\s*\\(\\s*['"\`]${v}['"\`]|['"\`][^'"\`]*#${v}(?![\\w-])[^'"\`]*['"\`]|\\bid\\s*=\\s*\\\\?['"]${v}\\\\?['"]`)
          : new RegExp(`getElementsByClassName\\s*\\(\\s*['"\`]${v}['"\`]|classList\\.\\w+\\s*\\([^)]*['"\`]${v}['"\`]|['"\`][^'"\`]*\\.${v}(?![\\w-])[^'"\`]*['"\`]|class(Name)?\\s*=\\s*\\\\?['"][^'"]*\\b${v}\\b`);
      const key = `${w.attr}=${w.value}`;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]!;
        const hit = re.exec(l);
        if (!hit) continue;
        add(key, { file: f.path, line: i + 1, fn: fns[i + 1] ?? null, kind: kindOf(statementAt(l, hit.index)), code: l.trim().slice(0, 160), via: key });
        /* Put in a variable: what is done to the variable down its function is done to the element. */
        const held = /(?:const|let|var)\s+([\w$]+)\s*=/.exec(l)?.[1] ?? /^\s*([\w$]+)\s*=(?!=)/.exec(l)?.[1];
        if (!held) continue;
        const fn = fns[i + 1] ?? null;
        const use = new RegExp(`\\b${esc(held)}\\b`);
        for (let j = i + 1; j < Math.min(lines.length, i + 80); j++) {
          if ((fns[j + 1] ?? null) !== fn && fn !== null) break;
          const u = lines[j]!;
          if (new RegExp(`(?:const|let|var)\\s+${esc(held)}\\b`).test(u)) break;
          const at = use.exec(u);
          if (!at) continue;
          add(key, { file: f.path, line: j + 1, fn: fns[j + 1] ?? null, kind: kindOf(statementAt(u, at.index)), code: u.trim().slice(0, 160), via: key });
        }
      }
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return out;
}

/** A word in hooks.json, as one of the kinds. */
function kindFrom(word: unknown): RefKind {
  const w = String(word ?? "").toLowerCase();
  if (/listen|event|click|press|change|handler/.test(w)) return "listens";
  if (/build|render|create|fill|append|list/.test(w)) return "builds";
  if (/write|text|set.?text|value/.test(w)) return "writes";
  if (/show|hide|hidden|enable|disable|toggle|state/.test(w)) return "state";
  if (/style|class|css|colou?r/.test(w)) return "styles";
  if (/read|get/.test(w)) return "reads";
  return "finds";
}

/**
 * A repository's own hooks.json, read loosely: an object of hook to list of
 * references, the same under `hooks`, or a list of `{ hook, refs }`. Each
 * reference names a `file` (or `path`), a `line`, a `function` (or `fn`),
 * and what it does (`kind`, `does`, `action`). Null when it cannot be read.
 */
export function readHooksJson(text: string): Map<string, CodeRef[]> | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const out = new Map<string, CodeRef[]>();
  const refsOf = (hook: string, list: unknown) => {
    if (!Array.isArray(list)) return;
    const key = hook.startsWith("#") ? `id=${hook.slice(1)}` : `data-hook=${hook}`;
    const refs: CodeRef[] = [];
    for (const r of list) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      const file = String(o.file ?? o.path ?? "");
      const line = Number(o.line ?? 0);
      if (!file || !(line > 0)) continue;
      refs.push({ file, line, fn: (o.function ?? o.fn ?? o.name ?? null) as string | null, kind: kindFrom(o.kind ?? o.does ?? o.action ?? o.what), code: String(o.code ?? o.snippet ?? ""), via: key });
    }
    out.set(key, refs);
  };
  const body = raw && typeof raw === "object" && !Array.isArray(raw) && (raw as Record<string, unknown>).hooks !== undefined ? (raw as Record<string, unknown>).hooks : raw;
  if (Array.isArray(body)) {
    for (const e of body) if (e && typeof e === "object" && typeof (e as { hook?: unknown }).hook === "string") refsOf((e as { hook: string }).hook, (e as { refs?: unknown; references?: unknown }).refs ?? (e as { references?: unknown }).references);
  } else if (body && typeof body === "object") {
    for (const [hook, v] of Object.entries(body as Record<string, unknown>)) refsOf(hook, Array.isArray(v) ? v : (v as { refs?: unknown; references?: unknown })?.refs ?? (v as { references?: unknown })?.references);
  } else return null;
  return out;
}

/** The index a site's parts are tied by: hooks.json where it speaks, the scan everywhere else. */
export interface CodeIndex {
  refs: Map<string, CodeRef[]>;
  /** Which keys came from hooks.json. */
  listed: Set<string>;
  hooksJson: string | null;
}

export function codeIndex(files: { path: string; text: string }[], wanted: Wanted[]): CodeIndex {
  const json = files.find((f) => /(^|\/)hooks\.json$/i.test(f.path)) ?? null;
  const given = json ? readHooksJson(json.text) : null;
  const scanned = scanScripts(files, wanted.filter((w) => !given?.has(`${w.attr}=${w.value}`)));
  const refs = new Map(scanned);
  for (const [k, v] of given ?? []) refs.set(k, v);
  return { refs, listed: new Set(given?.keys() ?? []), hooksJson: json?.path ?? null };
}
