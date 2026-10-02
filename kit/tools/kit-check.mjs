#!/usr/bin/env node
// kit-check: keeps a site readable and editable by the Polio builder (see BUILDER-CONTRACT.md).
//
//   node tools/kit-check.mjs [path/to/builder.json]           check; exit 1 on any problem
//   node tools/kit-check.mjs [path/to/builder.json] --write   also rewrite hooks.json first
//
// It reads builder.json, then every page it lists (plus the preview and gallery pages), the
// stylesheets they load and the scripts they load (following relative imports). It writes the
// hooks map: every data-hook with its pages, element, the hook around it, whether a script builds
// it from a <template>, the tokens it uses and every code reference (file, line, function).
// No dependencies: plain Node 18+.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// ------------------------------------------------------------------ small helpers

const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const HOOK_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const VAGUE = /^(div|span|el|element|item|box|wrap|wrapper|container|block|section|hook|thing|x)(-?\d+)?$/;
const NO_HOOK = new Set(['script', 'br', 'wbr']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|navy|teal|maroon|olive|lime|aqua|cyan|magenta|fuchsia|gold|crimson|indigo|violet|brown|tan|beige)\b/;

export function expandBraces(s) {
  const m = /\{([^{}]*)\}/.exec(s);
  if (!m) return [s];
  return m[1].split(',').flatMap((alt) => expandBraces(s.slice(0, m.index) + alt.trim() + s.slice(m.index + m[0].length)));
}

// ------------------------------------------------------------------ HTML

function parseAttrs(s) {
  const out = {};
  for (const m of s.matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

/** A small reader for hand-written pages: each element with its line, parent, and whether it is in <body> or a <template>. */
export function parsePage(file, text) {
  const page = { file, elements: [], scripts: [], styles: [], problems: [] };
  const stack = [];
  const tagRe = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
  let m;
  while ((m = tagRe.exec(text))) {
    if (!m[1]) continue;
    const tag = m[1].toLowerCase();
    const line = lineAt(text, m.index);
    if (m[0].startsWith('</')) {
      const at = stack.map((e) => e.tag).lastIndexOf(tag);
      if (at === -1) page.problems.push(`${file}:${line}: </${tag}> closes nothing`);
      else stack.length = at;
      continue;
    }
    const parent = stack.at(-1) ?? null;
    const tpl = [...stack].reverse().find((e) => e.tag === 'template');
    const el = { tag, attrs: parseAttrs(m[2] ?? ''), line, parent, inBody: tag === 'body' || stack.some((e) => e.tag === 'body'), template: tpl ? tpl.attrs['data-hook'] ?? '?' : null };
    page.elements.push(el);
    if (tag === 'script' || tag === 'style') {
      const end = text.indexOf(`</${tag}>`, tagRe.lastIndex);
      const body = text.slice(tagRe.lastIndex, end);
      if (tag === 'script') page.scripts.push({ src: el.attrs.src, inline: body.trim() !== '', line, type: el.attrs.type });
      else page.styles.push({ inline: true, line });
      tagRe.lastIndex = end + tag.length + 3;
      continue;
    }
    if (tag === 'link' && /\bstylesheet\b/.test(el.attrs.rel ?? '')) page.styles.push({ href: el.attrs.href, line });
    if (!VOID.has(tag) && !m[3]) stack.push(el);
  }
  if (stack.length) page.problems.push(`${file}: <${stack.at(-1).tag}> at line ${stack.at(-1).line} is never closed`);
  return page;
}

const kindOf = (el) => (el.tag === 'input' ? `input[type=${(el.attrs.type ?? 'text').toLowerCase()}]` : el.tag);
function parentHook(el) {
  for (let e = el.parent; e; e = e.parent) if (e.attrs['data-hook']) return e.attrs['data-hook'];
  return null;
}

// ------------------------------------------------------------------ CSS

export function cssRules(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const lead = m[1].length - m[1].trimStart().length;
    const declStart = m.index + m[1].length + 1;
    const decls = [];
    let off = 0;
    for (const part of m[2].split(';')) {
      const i = part.indexOf(':');
      if (i > 0) decls.push({ prop: part.slice(0, i).trim(), value: part.slice(i + 1).trim(), line: lineAt(clean, declStart + off + (part.length - part.trimStart().length)) });
      off += part.length + 1;
    }
    out.push({ line: lineAt(clean, m.index + lead), selector: m[1].trim().replace(/\s+/g, ' '), decls });
  }
  return out;
}
const selectorHooks = (sel) => [...sel.matchAll(/\[data-hook="([^"]+)"\]/g)].map((x) => x[1]);
/** Hooks a selector reaches, prefix ([data-hook^="nav-"]) and suffix ([data-hook$="-button"]) matches included. */
const selectorReach = (sel, known) => {
  const out = new Set(selectorHooks(sel));
  for (const [, op, v] of sel.matchAll(/\[data-hook([\^$*])="([^"]+)"\]/g)) {
    for (const h of known) if ((op === '^' && h.startsWith(v)) || (op === '$' && h.endsWith(v)) || (op === '*' && h.includes(v))) out.add(h);
  }
  return [...out];
};
const varsIn = (value) => [...value.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((x) => x[1]);

// ------------------------------------------------------------------ JS

/** Function ranges in a script, found by following braces (strings, comments and templates skipped). */
export function functionRanges(text) {
  const ranges = [];
  const stack = []; // { kind: 'fn'|'block'|'tpl', name, start }
  let mode = 'code';
  const modes = [];
  let last = 0; // start of the current statement head
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (mode === 'line') { if (c === '\n') { mode = 'code'; last = i + 1; } continue; }
    if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i++; last = i + 1; } continue; }
    if (mode === "'" || mode === '"') { if (c === '\\') i++; else if (c === mode || c === '\n') mode = 'code'; continue; }
    if (mode === '`') {
      if (c === '\\') i++;
      else if (c === '`') mode = modes.pop() ?? 'code';
      else if (c === '$' && n === '{') { stack.push({ kind: 'tpl' }); modes.push('`'); mode = 'code'; i++; }
      continue;
    }
    if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
    if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
    if (c === "'" || c === '"') { mode = c; continue; }
    if (c === '`') { modes.push('code'); mode = '`'; continue; }
    if (c === ';') { last = i + 1; continue; }
    if (c === '{') {
      const head = text.slice(last, i).replace(/\s+/g, ' ').trim();
      const name = functionName(head, stack);
      stack.push(name ? { kind: 'fn', name, start: i } : { kind: 'block' });
      last = i + 1;
    } else if (c === '}') {
      const top = stack.pop();
      if (top?.kind === 'tpl') { mode = modes.pop() ?? '`'; continue; }
      if (top?.kind === 'fn') ranges.push({ name: top.name, start: top.start, end: i });
      last = i + 1;
    }
  }
  return ranges;
}

function functionName(head, stack) {
  const outer = [...stack].reverse().find((s) => s.kind === 'fn')?.name;
  let m;
  if ((m = /function\s*\*?\s*([\w$]+)\s*\([^)]*\)$/.exec(head))) return m[1];
  if ((m = /addEventListener\(\s*['"]([\w-]+)['"]\s*,\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>$/.exec(head)) || (m = /addEventListener\(\s*['"]([\w-]+)['"]\s*,\s*(?:async\s*)?function\b[^(]*\([^)]*\)$/.exec(head))) return `${m[1]} listener${outer ? ` in ${outer}` : ''}`;
  if ((m = /([\w$.]+)\s*[:=]\s*(?:async\s*)?(?:function\b[^(]*\([^)]*\)|\([^)]*\)\s*=>|[\w$]+\s*=>)$/.exec(head))) return m[1];
  if ((m = /^(?:async\s+|static\s+|get\s+|set\s+)*([\w$]+)\s*\([^)]*\)$/.exec(head)) && !/^(if|for|while|switch|catch|function|with|return)$/.test(m[1])) return m[1];
  if (/=>$|function\b[^(]*\([^)]*\)$/.test(head)) {
    const call = /([\w$]+)\(\s*[^()]*(?:\([^)]*\))?\s*=>$/.exec(head) ?? /([\w$]+)\((?:[^()]*,)?\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>$/.exec(head);
    return call ? `${call[1]} callback${outer ? ` in ${outer}` : ''}` : `anonymous${outer ? ` in ${outer}` : ''}`;
  }
  return null;
}

const nameAt = (ranges, index) => ranges.filter((r) => r.start <= index && index <= r.end).sort((a, b) => a.start - b.start).at(-1)?.name ?? '(top level)';

function usesAfter(rest) {
  if (/^\s*\.(addEventListener|on[a-z]+\s*=)/.test(rest)) return 'listens';
  if (/^\s*\.(textContent|innerText|value|hidden|checked|disabled|src|href|alt|open)\s*=[^=]|^\s*\.(append|prepend|replaceChildren|replaceWith|remove|setAttribute|removeAttribute|toggleAttribute|showModal|show|close|focus|reset|style\.setProperty)\b/.test(rest)) return 'writes';
  return 'reads';
}

// ------------------------------------------------------------------ the check

export function check(manifestPath, { write = false } = {}) {
  const base = dirname(resolve(manifestPath));
  const rel = (abs) => relative(base, abs).split('\\').join('/');
  const problems = [];
  const read = (abs) => readFileSync(abs, 'utf8');
  let manifest;
  try { manifest = JSON.parse(read(manifestPath)); } catch (e) { return { problems: [`builder.json: cannot read (${e.message})`], map: null }; }

  // The manifest: every path it names exists.
  for (const key of ['kit', 'pages', 'hooks', 'tokens', 'styleLayer', 'preview', 'gallery']) if (manifest[key] === undefined) problems.push(`builder.json: "${key}" is missing`);
  if (problems.length) return { problems, map: null };
  const at = (p) => join(base, p);
  for (const p of [manifest.tokens, manifest.styleLayer, manifest.preview.page, manifest.gallery, ...manifest.pages.map((x) => x.file)]) if (!existsSync(at(p))) problems.push(`builder.json: ${p} does not exist`);
  if (problems.length) return { problems, map: null };
  const tokensFile = at(manifest.tokens);
  const layerFile = at(manifest.styleLayer);
  const helpers = manifest.scripts?.hookCalls ?? { hook: 0, hooks: 0, fromTemplate: 0, part: 1 };
  const tokensModule = manifest.tokensModule ? resolve(at(manifest.tokensModule)) : null;
  const fillCalls = manifest.scripts?.fillCalls ?? ['fill'];
  const ignore = (manifest.scripts?.ignore ?? ['/vendor/', '/node_modules/']).map((x) => x.toLowerCase());
  const helperFiles = new Set((manifest.scripts?.helperFiles ?? []).map((f) => resolve(at(f))));
  const allowHosts = manifest.links?.allowHosts ?? [];
  const blockLinks = (manifest.links?.block ?? []).map((b) => ({ re: new RegExp(b.pattern, 'i'), why: b.why }));

  const pageFiles = [...manifest.pages.map((p) => p.file), manifest.preview.page, manifest.gallery];
  const pages = pageFiles.map((f) => ({ ...parsePage(f, read(at(f))), abs: at(f) }));

  // ---- markup
  const where = new Map(); // hook -> [{ page, el }]
  const nowhere = []; // links without a target; fine only when a script sets the href
  for (const p of pages) {
    problems.push(...p.problems);
    const seen = new Map();
    for (const el of p.elements) {
      if (el.attrs.style !== undefined) problems.push(`${p.file}:${el.line}: <${el.tag}> has an inline style (put the rule in a stylesheet, keyed by its hook)`);
      if (el.tag === 'style') problems.push(`${p.file}:${el.line}: <style> in a page (styles live in stylesheets)`);
      if (!el.inBody) continue;
      if (el.tag === 'a') {
        const href = el.attrs.href;
        if (href === undefined || href === '' || href === '#' || /^javascript:/i.test(href)) nowhere.push({ hook: el.attrs['data-hook'], text: `${p.file}:${el.line}: a link that goes nowhere (use a <button> for an action, or have a script set its href)` });
        else if (/^(https?:)?\/\//i.test(href)) {
          const host = new URL(href, 'https://site.invalid/').hostname.replace(/^www\./, '');
          const blocked = blockLinks.find((b) => b.re.test(href));
          if (blocked) problems.push(`${p.file}:${el.line}: link ${href} is not allowed (${blocked.why})`);
          else if (!allowHosts.some((h) => host === h || host.endsWith(`.${h}`))) problems.push(`${p.file}:${el.line}: link to ${host} leaves the site (allowed outside hosts: ${allowHosts.join(', ') || 'none'})`);
        }
      }
      const hook = el.attrs['data-hook'];
      if (hook === undefined) {
        if (!NO_HOOK.has(el.tag)) problems.push(`${p.file}:${el.line}: <${el.tag}> has no data-hook`);
        continue;
      }
      if (!HOOK_NAME.test(hook)) problems.push(`${p.file}:${el.line}: hook "${hook}" is not lower-case words joined by dashes`);
      else if (VAGUE.test(hook)) problems.push(`${p.file}:${el.line}: hook "${hook}" says nothing about what it is`);
      if (el.template === null && seen.has(hook)) problems.push(`${p.file}:${el.line}: duplicate hook "${hook}" (also line ${seen.get(hook)})`);
      if (el.template !== null && p.elements.some((o) => o !== el && o.template === el.template && o.attrs['data-hook'] === hook)) problems.push(`${p.file}:${el.line}: duplicate hook "${hook}" inside ${el.template}`);
      if (el.template === null) seen.set(hook, el.line);
      if (el.tag === 'template') {
        if (!hook.startsWith('template-')) problems.push(`${p.file}:${el.line}: template hook "${hook}" must start with "template-"`);
        const inside = p.elements.filter((e) => e.parent === el);
        if (inside.length !== 1) problems.push(`${p.file}:${el.line}: ${hook} must hold exactly one element (it holds ${inside.length})`);
      } else if (hook.startsWith('template-')) problems.push(`${p.file}:${el.line}: only a <template> hook starts with "template-"`);
      if (!where.has(hook)) where.set(hook, []);
      where.get(hook).push({ page: p.file, el });
    }
    // Stylesheets: tokens first, style layer last.
    const sheets = p.styles.filter((s) => s.href).map((s) => resolve(dirname(p.abs), s.href));
    if (sheets[0] !== resolve(tokensFile)) problems.push(`${p.file}: ${manifest.tokens} must be the first stylesheet`);
    if (sheets.at(-1) !== resolve(layerFile)) problems.push(`${p.file}: ${manifest.styleLayer} must be the last stylesheet`);
    for (const s of p.scripts) if (s.inline && s.type !== 'application/json') problems.push(`${p.file}:${s.line}: inline script (move it to a .js file)`);
    p.sheets = sheets;
  }
  for (const [hook, list] of where) {
    if (new Set(list.map((w) => kindOf(w.el))).size > 1) problems.push(`hook "${hook}" is a different element on different pages: ${list.map((w) => `${w.page} ${kindOf(w.el)}`).join(', ')}`);
  }

  // ---- stylesheets
  const sheetFiles = [...new Set(pages.flatMap((p) => p.sheets))].filter(existsSync);
  const tokens = new Map(); // name -> default
  const tokenUsers = new Map(); // name -> Set(hook)
  const hookTokens = new Map(); // hook -> Set(token)
  const usedVars = [];
  const declared = new Set(); // custom properties any stylesheet declares (run-time values a script sets)
  for (const abs of sheetFiles) {
    const file = rel(abs);
    const colorsAllowed = abs === resolve(tokensFile) || abs === resolve(layerFile);
    for (const r of cssRules(read(abs))) {
      if (r.selector.startsWith('@')) continue;
      const bare = r.selector.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
      if (/[.#][a-zA-Z_-]/.test(bare)) problems.push(`${file}:${r.line}: selector "${r.selector}" uses a class or id (key rules by [data-hook="..."])`);
      const hooks = selectorReach(r.selector, where.keys());
      for (const d of r.decls) {
        if (d.prop.startsWith('--')) {
          declared.add(d.prop);
          if (abs === resolve(tokensFile) && !tokens.has(d.prop)) tokens.set(d.prop, d.value);
          if (abs === resolve(layerFile) && !tokens.has(d.prop)) tokens.set(d.prop, null);
          if (!colorsAllowed && COLOR.test(d.value)) problems.push(`${file}:${d.line}: colour "${d.value}" outside ${manifest.tokens} (name it there and use var(${d.prop}))`);
        } else if (COLOR.test(d.value.replace(/var\([^)]*\)/g, ''))) {
          problems.push(`${file}:${d.line}: colour in "${d.prop}: ${d.value}" is not a token (use var(--...) from ${manifest.tokens})`);
        }
        for (const v of varsIn(d.value)) {
          usedVars.push({ v, where: `${file}:${d.line}` });
          for (const h of hooks) {
            if (!tokenUsers.has(v)) tokenUsers.set(v, new Set());
            tokenUsers.get(v).add(h);
            if (!hookTokens.has(h)) hookTokens.set(h, new Set());
            hookTokens.get(h).add(v);
          }
        }
      }
      for (const h of selectorHooks(r.selector)) if (!where.has(h)) problems.push(`${file}:${r.line}: rule for hook "${h}", which no page has`);
    }
  }
  for (const u of usedVars) if (!tokens.has(u.v) && !declared.has(u.v)) problems.push(`${u.where}: var(${u.v}) is not defined in ${manifest.tokens} or any stylesheet`);

  // ---- scripts
  const scripts = new Map(); // abs -> text
  const pageScripts = new Map();
  const load = (abs, into) => {
    if (into.has(abs) || !existsSync(abs)) return;
    into.add(abs);
    if (!scripts.has(abs)) scripts.set(abs, read(abs));
    for (const m of scripts.get(abs).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"](\.{1,2}\/[^'"]+\.m?js)['"]/gm)) load(resolve(dirname(abs), m[1]), into);
  };
  for (const p of pages) {
    const set = new Set();
    for (const s of p.scripts) if (s.src && !/^(https?:)?\/\//.test(s.src)) {
      const abs = resolve(dirname(p.abs), s.src);
      if (!existsSync(abs)) problems.push(`${p.file}:${s.line}: script ${s.src} does not exist`);
      load(abs, set);
    }
    pageScripts.set(p.file, set);
  }
  const refs = new Map(); // hook -> [{file,line,function,uses}]
  const addRef = (hook, r) => { if (!refs.has(hook)) refs.set(hook, []); refs.get(hook).push(r); };
  const callRe = new RegExp(`(?<![\\w$.])(?<!function\\s)(${Object.keys(helpers).map((h) => h.replace(/\$/g, '\\$')).join('|')})\\s*\\(`, 'g');
  for (const [abs, text] of scripts) {
    const file = rel(abs);
    if (abs === tokensModule || helperFiles.has(abs) || ignore.some((x) => abs.toLowerCase().includes(x))) continue;
    const ranges = functionRanges(text);
    const lineOfIndex = (idx) => text.slice(0, idx).split('\n').length;
    // fill(copy, { 'hook-name': value, ... }): every quoted key is a hook the call writes.
    for (const m of text.matchAll(new RegExp(`(?<![\\w$.])(?:${fillCalls.join('|')})\\s*\\(`, 'g'))) {
      let depth = 0;
      let end = m.index + m[0].length;
      for (; end < text.length; end++) {
        const c = text[end];
        if (c === '(' || c === '{' || c === '[') depth++;
        else if (c === ')' || c === '}' || c === ']') { if (depth === 0) break; depth--; }
        else if (c === "'" || c === '"' || c === '`') { const e = text.indexOf(c, end + 1); if (e === -1) break; end = e; }
      }
      const call = text.slice(m.index, end).replace(/^(\s*)\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' ')); // whole-line comments blanked
      for (const k of call.matchAll(/(?<=[{,]\s*)(['"])([a-z][a-z0-9-]*)\1\s*:/g)) {
        const idx = m.index + k.index;
        addRef(k[2], { file, line: lineOfIndex(idx), function: nameAt(ranges, idx), uses: 'writes' });
      }
    }
    const held = new Map(); // variable name -> { hooks, end } for `const a = hook('x')`, followed to the end of its function
    const lines = text.split('\n');
    const lineStart = [];
    lines.reduce((pos, l, i) => ((lineStart[i] = pos), pos + l.length + 1), 0);
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      const fn = nameAt(ranges, lineStart[i]);
      const where_ = { file, line: i + 1, function: fn };
      if (/\.style\b(?!\s*\.\s*(setProperty|getPropertyValue|removeProperty)\(\s*['"`]--)|setAttribute\(\s*['"]style/.test(code)) problems.push(`${file}:${i + 1}: script sets an inline style (set a CSS variable with style.setProperty('--name', ...) or a data- attribute the stylesheet keys on)`);
      if (/\bcreateElement(NS)?\s*\(|\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(/.test(code)) problems.push(`${file}:${i + 1}: script builds markup (declare it in a <template data-hook="template-..."> and clone it)`);
      if (/(['"`])\s*(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch)\([^'"`]*\))\s*\1/.test(code)) problems.push(`${file}:${i + 1}: colour in a script (read it from a token with getComputedStyle)`);
      const note = /\/\/\s*hooks:\s*(.+)$/.exec(line);
      const noted = note ? note[1].split(/,\s*(?![^{]*\})/).flatMap((x) => expandBraces(x.trim())).filter(Boolean) : null;
      if (noted) for (const h of noted) addRef(h, { ...where_, uses: 'reads' });
      // Uses of an element held in a variable: a.href = ..., a.addEventListener(...)
      for (const [name, v] of held) {
        if (lineStart[i] > v.end) { held.delete(name); continue; }
        if (v.line === i) continue;
        const use = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?=\\s*\\.)`).exec(code);
        if (use) { const u = usesAfter(code.slice(use.index + name.length)); if (u !== 'reads') for (const h of v.hooks) addRef(h, { ...where_, uses: u }); }
      }
      const holdAs = (hooksHeld, at) => {
        const decl = /(?:const|let|var)\s+([\w$]+)\s*=\s*$/.exec(code.slice(0, at));
        if (decl) held.set(decl[1], { hooks: hooksHeld, line: i, end: ranges.filter((r) => r.start <= lineStart[i] && lineStart[i] <= r.end).sort((a, b) => a.start - b.start).at(-1)?.end ?? text.length });
      };
      for (const m of code.matchAll(callRe)) {
        const argPos = helpers[m[1]];
        let j = m.index + m[0].length;
        let depth = 0;
        let arg = 0;
        let start = j;
        let found = null;
        for (; j < code.length; j++) {
          const c = code[j];
          if ('([{'.includes(c)) depth++;
          else if (')]}'.includes(c)) { if (depth === 0) break; depth--; }
          else if (c === ',' && depth === 0) { if (arg === argPos) break; arg++; start = j + 1; }
          else if ((c === "'" || c === '"' || c === '`') && depth === 0) { const e = code.indexOf(c, j + 1); if (e === -1) break; j = e; }
        }
        if (arg === argPos) found = code.slice(start, j).trim();
        if (found === null || found === '' || /^\s*\{/.test(code.slice(j + 1))) continue; // empty, or a method's own definition
        const lit = /^(['"`])([^'"`$]*)\1$/.exec(found);
        const either = /\?\s*(['"])([^'"]*)\1\s*:\s*(['"])([^'"]*)\3$/.exec(found);
        const close = code.indexOf(')', j);
        const uses = usesAfter(code.slice(close + 1));
        if (lit) addRef(lit[2], { ...where_, uses });
        else if (either) for (const h of [either[2], either[4]]) addRef(h, { ...where_, uses });
        const names = lit ? [lit[2]] : either ? [either[2], either[4]] : noted;
        if (names) holdAs(names, m.index);
        else if (!noted) problems.push(`${file}:${i + 1}: ${m[1]}(${found}) builds a hook name at run time (add a "// hooks: name-{a,b}" comment listing every name)`);
      }
      for (const m of code.matchAll(/\[data-hook="([a-z0-9-]+)"\]/g)) addRef(m[1], { ...where_, uses: usesAfter(code.slice(code.indexOf(')', m.index) + 1)) });
    });
  }
  for (const n of nowhere) if (!(refs.get(n.hook) ?? []).some((r) => r.uses === 'writes')) problems.push(n.text);
  for (const [hook, list] of refs) if (!where.has(hook)) for (const r of list) problems.push(`${r.file}:${r.line}: script uses hook "${hook}", which no page has`);

  // ---- preview screens: each is named in its page's scripts
  for (const s of manifest.preview.screens ?? []) {
    const page = pages.find((p) => p.file === s.page);
    if (!page) { problems.push(`builder.json: screen "${s.name}" is on ${s.page}, which is not a listed page`); continue; }
    const named = [...(pageScripts.get(s.page) ?? [])].some((abs) => new RegExp(`['"]${s.name}['"]\\s*:|\\b${s.name.replace(/-/g, '\\-')}\\s*:`).test(scripts.get(abs)));
    if (!/^[a-z0-9-]+$/.test(s.name) || !named) problems.push(`builder.json: screen "${s.name}" is not declared in the scripts of ${s.page} (screens({ '${s.name}': () => ... }))`);
  }

  // ---- the map
  const hooks = {};
  for (const [hook, list] of where) {
    const el = list[0].el;
    hooks[hook] = {
      pages: [...new Set(list.map((w) => w.page))].sort(),
      element: kindOf(el),
      parent: parentHook(el),
      scriptBuilt: el.template !== null,
      template: el.template,
      tokens: [...(hookTokens.get(hook) ?? [])].sort(),
      references: (refs.get(hook) ?? []).sort((a, b) => (a.file + String(a.line).padStart(6, '0') < b.file + String(b.line).padStart(6, '0') ? -1 : 1)),
    };
  }
  const map = {
    about: 'Made by kit-check from the pages, stylesheets and scripts (npm run kit:hooks). Do not edit by hand.',
    kit: manifest.kit,
    pages: sortObj(Object.fromEntries(pages.map((p) => [p.file, { stylesheets: p.sheets.map(rel), scripts: [...pageScripts.get(p.file)].map(rel).sort() }]))),
    tokens: sortObj(Object.fromEntries([...tokens].map(([t, d]) => [t, { default: d, usedBy: [...(tokenUsers.get(t) ?? [])].sort() }]))),
    hooks: sortObj(hooks),
  };
  const json = `${JSON.stringify(map, null, 2)}\n`;
  if (tokensModule) {
    const entries = [...tokens].filter(([, d]) => d !== null).map(([t, d]) => `  ${JSON.stringify(t)}: ${JSON.stringify(d)},`);
    const js = `// Made by kit-check from ${manifest.tokens} (npm run kit:hooks). Do not edit by hand.\n// Every token's value, for scripts that need one outside a styled page (tests, pictures drawn as data).\nexport const TOKENS = {\n${entries.join('\n')}\n};\n`;
    if (write) writeFileSync(tokensModule, js);
    else if (!existsSync(tokensModule) || read(tokensModule) !== js) problems.push(`${manifest.tokensModule} is stale: it does not match ${manifest.tokens} (run npm run kit:hooks and commit it)`);
  }
  const hooksFile = at(manifest.hooks);
  if (write) writeFileSync(hooksFile, json);
  else if (!existsSync(hooksFile)) problems.push(`${manifest.hooks} is missing (run npm run kit:hooks)`);
  else if (read(hooksFile) !== json) problems.push(`${manifest.hooks} is stale: it does not match the code (run npm run kit:hooks and commit it)`);
  return { problems, map };
}

// ------------------------------------------------------------------ command line

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const args = process.argv.slice(2);
  const manifestPath = args.find((a) => !a.startsWith('--')) ?? 'builder.json';
  const { problems, map } = check(manifestPath, { write: args.includes('--write') });
  for (const p of problems) console.log(`  ✗ ${p}`);
  const n = map ? Object.keys(map.hooks).length : 0;
  const pagesN = map ? Object.keys(map.pages).length : 0;
  console.log(problems.length ? `kit:check failed: ${problems.length} problem(s)` : `kit:check passed: ${pagesN} pages, ${n} hooks, ${map ? Object.keys(map.tokens).length : 0} tokens`);
  process.exit(problems.length ? 1 : 0);
}
