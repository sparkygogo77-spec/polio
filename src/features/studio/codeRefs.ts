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

/** `nav-{home,about}` as `nav-home`, `nav-about`; a name with no braces as itself. */
function expand(name: string): string[] {
  const m = /^(.*?)\{([^{}]*)\}(.*)$/.exec(name.trim());
  if (!m) return name.trim() ? [name.trim()] : [];
  return m[2]!.split(",").flatMap((x) => expand(`${m[1]}${x.trim()}${m[3]}`));
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
    /* A name a script builds (`nav-${page}`) is declared on its line, as the kit's contract asks: `// hooks: nav-{home,about,list}`. */
    lines.forEach((l, i) => {
      const said = /\/\/\s*hooks?:\s*(.+)$/.exec(l)?.[1];
      if (!said) return;
      for (const name of said.split(/[\s,]+(?![^{]*\})/).flatMap(expand)) {
        const w = uniq.find((x) => x.attr === "data-hook" && x.value === name);
        if (w) add(`data-hook=${name}`, { file: f.path, line: i + 1, fn: fns[i + 1] ?? null, kind: kindOf(l.replace(/\/\/.*$/, "")), code: l.trim().slice(0, 160), via: `data-hook=${name}` });
      }
    });
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

/** What a repository's hooks.json says about one hook beyond its references (PST's: element, pages, script-built, template, variables). */
export interface HookMeta {
  element?: string;
  pages?: string[];
  /** Made by a script (from a template), not written in the page's HTML. */
  scriptBuilt?: boolean;
  template?: string | null;
  repeats?: boolean;
  /** The CSS variables its styles use. */
  cssVariables?: string[];
}

/** A CSS variable as hooks.json describes it: its default, the hooks that use it, the code that reads it. */
export interface VarMeta { default?: string; usedBy: string[]; readBy: CodeRef[] }

export interface HooksJson {
  refs: Map<string, CodeRef[]>;
  meta: Map<string, HookMeta>;
  vars: Map<string, VarMeta>;
}

/**
 * A repository's own hooks.json, read loosely. PST's shape: `{ hooks: { name:
 * { element, pages, scriptBuilt, template, repeats, cssVariables, references:
 * [{ file, line, function, actions: ["writes"] }] } }, cssVariables: { name:
 * { default, usedBy, readBy } } }`, its files written from the folder the
 * json is in (`dir`). Also an object of hook to a list of references, or a
 * list of `{ hook, refs }`, each reference naming `file` (or `path`), `line`,
 * `function` (or `fn`) and what it does (`actions`, `kind`, `does`). One
 * reference doing two things is two lines in the panel. Null when it cannot
 * be read.
 */
export function readHooksJson(text: string, dir = "", opts: { manifestDir?: string | null } = {}): HooksJson | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  /* The kit's map (it carries `kit`) writes every path from the folder builder.json is in; PST's older web/hooks.json wrote them from its own folder. */
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>).kit !== undefined && opts.manifestDir !== undefined && opts.manifestDir !== null) dir = opts.manifestDir;
  const refs = new Map<string, CodeRef[]>();
  const meta = new Map<string, HookMeta>();
  const vars = new Map<string, VarMeta>();
  const at = (file: string) => (dir && !file.startsWith(dir) && !file.startsWith("/") ? `${dir}${file}` : file.replace(/^\//, ""));
  const listOf = (list: unknown, via: string): CodeRef[] => {
    const out: CodeRef[] = [];
    if (!Array.isArray(list)) return out;
    for (const r of list) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      const file = String(o.file ?? o.path ?? "");
      const line = Number(o.line ?? 0);
      if (!file || !(line > 0)) continue;
      const named = (o.function ?? o.fn ?? o.name ?? null) as string | null;
      const fn = named && !/^(\(?top[ -]?level\)?|anonymous|\(anonymous\))$/i.test(named.trim()) ? named : null;
      /* The kit's map says what the line does in `uses`; PST's older one listed `actions`. */
      const did = Array.isArray(o.actions) && o.actions.length ? o.actions : [o.uses ?? o.kind ?? o.does ?? o.action ?? o.what];
      for (const a of did) out.push({ file: at(file), line, fn, kind: kindFrom(a), code: String(o.code ?? o.snippet ?? ""), via });
    }
    return out;
  };
  const keyOf = (hook: string) => (hook.startsWith("#") ? `id=${hook.slice(1)}` : `data-hook=${hook}`);
  const take = (hook: string, v: unknown) => {
    const key = keyOf(hook);
    if (Array.isArray(v)) { refs.set(key, listOf(v, key)); return; }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    refs.set(key, listOf(o.references ?? o.refs, key));
    meta.set(key, {
      ...(typeof o.element === "string" ? { element: o.element } : {}),
      ...(Array.isArray(o.pages) ? { pages: o.pages.map(String) } : {}),
      ...(typeof o.scriptBuilt === "boolean" ? { scriptBuilt: o.scriptBuilt } : {}),
      ...(o.template !== undefined ? { template: o.template === null ? null : String(o.template) } : {}),
      ...(typeof o.repeats === "boolean" ? { repeats: o.repeats } : {}),
      ...(Array.isArray(o.tokens) ? { cssVariables: o.tokens.map(String) } : Array.isArray(o.cssVariables) ? { cssVariables: o.cssVariables.map(String) } : {}),
    });
  };
  const top = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const body = top && top.hooks !== undefined ? top.hooks : raw;
  if (Array.isArray(body)) {
    for (const e of body) if (e && typeof e === "object" && typeof (e as { hook?: unknown }).hook === "string") take((e as { hook: string }).hook, e);
  } else if (body && typeof body === "object") {
    for (const [hook, v] of Object.entries(body as Record<string, unknown>)) take(hook, v);
  } else return null;
  /* The variables' map: `tokens` in the kit's map, `cssVariables` in PST's older one. */
  const cv = top?.tokens && typeof top.tokens === "object" && !Array.isArray(top.tokens) ? top.tokens : top?.cssVariables;
  if (cv && typeof cv === "object" && !Array.isArray(cv)) {
    for (const [name, v] of Object.entries(cv as Record<string, unknown>)) {
      const o = (v ?? {}) as Record<string, unknown>;
      vars.set(name, { ...(o.default !== undefined ? { default: String(o.default) } : {}), usedBy: Array.isArray(o.usedBy) ? o.usedBy.map(String) : [], readBy: listOf(o.readBy, `var=${name}`) });
    }
  }
  return { refs, meta, vars };
}

/** The index a site's parts are tied by: hooks.json where it speaks, the scan everywhere else. */
export interface CodeIndex {
  refs: Map<string, CodeRef[]>;
  /** Which keys came from hooks.json. */
  listed: Set<string>;
  hooksJson: string | null;
  meta: Map<string, HookMeta>;
  vars: Map<string, VarMeta>;
}

export function codeIndex(files: { path: string; text: string }[], wanted: Wanted[], opts: { hooksFile?: string | null; manifestDir?: string | null } = {}): CodeIndex {
  /* The hooks file builder.json names (PST's is web/builder-hooks.json), else a hooks.json. */
  const json = (opts.hooksFile ? files.find((f) => f.path === opts.hooksFile) : undefined) ?? files.find((f) => /(^|\/)hooks\.json$/i.test(f.path)) ?? null;
  const dir = json && json.path.includes("/") ? json.path.slice(0, json.path.lastIndexOf("/") + 1) : "";
  const given = json ? readHooksJson(json.text, dir, { manifestDir: opts.manifestDir }) : null;
  const scanned = scanScripts(files, wanted.filter((w) => !given?.refs.has(`${w.attr}=${w.value}`)));
  const refs = new Map(scanned);
  /*
   * hooks.json's lines, as the repository says; what a line does, read off
   * the line itself where it says more. PST's map calls `setText('score-lead', …)`
   * and `$('score-lead').dataset.state = …` "reads": the line writes and
   * styles, and a part its code writes is filled by code. A line the map
   * says writes or listens keeps the map's word.
   */
  const texts = new Map(files.map((f) => [f.path, f.text.split("\n")]));
  for (const [k, v] of given?.refs ?? []) {
    const name = k.replace(/^[\w-]+=/, "");
    refs.set(k, v.map((r) => {
      const line = texts.get(r.file)?.[r.line - 1];
      if (line === undefined) return r;
      const at = line.indexOf(name);
      const ours = kindOf(at >= 0 ? statementAt(line, at) : line);
      const kind = (r.kind === "reads" || r.kind === "finds") && ours !== "finds" && ours !== "reads" ? ours : r.kind;
      return { ...r, kind, code: r.code || line.trim().slice(0, 160) };
    }));
  }
  return { refs, listed: new Set(given?.refs.keys() ?? []), hooksJson: json?.path ?? null, meta: given?.meta ?? new Map(), vars: given?.vars ?? new Map() };
}
