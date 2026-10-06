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

// ------------------------------------------------------------------ script insertions (BUILDER-RULES.md, rule 1)

const INSERT = /(?<![\w$])((?:[\w$]+(?:\s*\([^()]*\))?)(?:\s*\.\s*[\w$]+(?:\s*\([^()]*\))?)*?)\s*\.\s*(append|appendChild|prepend|insertBefore|replaceChildren|before|after|replaceWith|insertAdjacentElement)\s*\(/g;
const CLONE = /\b(fromTemplate|cloneNode|importNode|part)\s*\(|\.content\b/;

/** The text between a call's ( and its matching ). */
function argsAt(text, open) {
  let depth = 0;
  for (let j = open; j < text.length; j++) {
    const c = text[j];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) return text.slice(open + 1, j); }
    else if (c === "'" || c === '"' || c === '`') { const e = text.indexOf(c, j + 1); if (e === -1) return text.slice(open + 1); j = e; }
  }
  return text.slice(open + 1);
}

/**
 * Every place a script adds an element to the page, and the part it lands in. A part is an element
 * a page declares with a data-hook (the builder sees and edits it), or a copy of a <template> that
 * is itself put into a part. Anything else (document.body, an element found some other way) is
 * outside every part: the builder cannot see it, so it cannot design it.
 */
export function insertions(text, { helpers, fillCalls = [], hookExists = () => true }) {
  const ranges = functionRanges(text);
  const blank = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\])\/\/(?!\s*(?:part|hooks):).*$/gm, (c, a) => a + ' '.repeat(c.length - a.length));
  const helperNames = Object.keys(helpers);
  const lineOf = (i) => text.slice(0, i).split('\n').length;
  const scopeOf = (i) => ranges.filter((r) => r.start <= i && i <= r.end).sort((a, b) => a.start - b.start).at(-1) ?? { start: 0, end: text.length };
  const noteAt = (i) => {
    const ln = lineOf(i) - 1;
    const line = text.split('\n')[ln] ?? '';
    const m = /\/\/\s*part:\s*([a-z][a-z0-9-]*)/.exec(line);
    return m ? m[1] : null;
  };
  // What an expression is: { part } a declared part, { clone: true } a template copy, { outside } the page itself, or null.
  const classify = (expr, at, depth = 0) => {
    expr = expr.trim().replace(/^\(|\)$/g, '').trim();
    if (depth > 4 || !expr) return null;
    if (/^document\s*\.\s*(body|documentElement|head)\b|^document$/.test(expr)) return { outside: expr.replace(/\s+/g, '') };
    if (/\bcreateElement(NS)?\s*\(/.test(expr)) return { outside: 'a new element' };
    const q = /\[data-hook="([a-z0-9-]+)"\]/.exec(expr);
    if (q) return { part: q[1] };
    for (const h of helperNames) {
      const m = new RegExp(`^(?:await\\s+)?${h.replace(/\$/g, '\\$')}\\s*\\(`).exec(expr);
      if (!m) continue;
      if (h === 'fromTemplate') return { clone: true };
      const args = argsAt(expr, m[0].length - 1).split(',').map((a) => a.trim());
      const lit = /^(['"`])([a-z0-9-]+)\1$/.exec(args[helpers[h]] ?? '');
      if (lit) return { part: lit[2] };
      return { part: null, runtime: true };
    }
    if (CLONE.test(expr) && !/^[\w$]+\s*\.\s*(parentNode|parentElement)/.test(expr)) return { clone: true };
    if (fillCalls.some((f) => new RegExp(`^${f}\\s*\\(`).test(expr))) return classify(argsAt(expr, expr.indexOf('(')).split(',')[0], at, depth + 1);
    const pm = /^([\w$]+)\s*\.\s*(parentNode|parentElement|closest\s*\([^)]*\))\s*$/.exec(expr);
    if (pm) { const r = classify(pm[1], at, depth + 1); return r && (r.part || r.clone) ? { ...r, part: r.part } : r; }
    const id = /^([\w$]+)$/.exec(expr);
    if (id) {
      // The last assignment to it before this point, in its function or an outer one.
      const scope = scopeOf(at);
      const re = new RegExp(`(?:(?:const|let|var)\\s+|[,(]\\s*|^\\s*|;\\s*)${id[1].replace(/\$/g, '\\$')}\\s*=(?!=)\\s*`, 'gm');
      let found = null;
      for (const m of blank.slice(0, at).matchAll(re)) found = m;
      if (found && found.index >= 0) {
        const noted = noteAt(found.index + found[0].length);
        if (noted) return { part: noted };
        const from = found.index + found[0].length;
        let end = from;
        for (let depth2 = 0; end < blank.length; end++) {
          const c = blank[end];
          if ('([{'.includes(c)) depth2++;
          else if (')]}'.includes(c)) { if (depth2 === 0) break; depth2--; }
          else if ((c === ';' || c === '\n') && depth2 === 0) break;
          else if (c === ',' && depth2 === 0) break;
        }
        return classify(blank.slice(from, end), from, depth + 1);
      }
      void scope;
      return null;
    }
    const prop = /^([\w$]+)\s*\.\s*([\w$]+)$/.exec(expr);
    if (prop && prop[1] !== 'document') {
      // An object's field, set as chart.pictures = $('trade-pictures') or { pictures: $('trade-pictures') }.
      const sets = [...blank.matchAll(new RegExp(`(?<![\\w$.])${prop[1]}\\s*\\.\\s*${prop[2]}\\s*=(?!=)\\s*([^;\\n]+)`, 'g')), ...blank.matchAll(new RegExp(`(?<![\\w$.])${prop[2]}\\s*:\\s*([^,}\\n]+)`, 'g'))];
      for (const m of sets) {
        if (/^\s*(null|undefined)\s*$/.test(m[1])) continue;
        const r = classify(m[1], m.index, depth + 1);
        if (r) return r;
      }
    }
    return null;
  };
  const out = [];
  for (const m of blank.matchAll(INSERT)) {
    const open = m.index + m[0].length - 1;
    const args = argsAt(blank, open).trim();
    if (m[2] === 'replaceChildren' && args === '') continue; // emptying a part
    if (args !== '' && args.split(/,(?![^(]*\))/).every((a) => /^\s*(['"`])[^'"`]*\1\s*$/.test(a))) continue; // text only
    const receiver = m[1].replace(/\s+/g, '');
    const own = /^([\w$]+)\.(parentNode|parentElement)$/.exec(receiver);
    if (own && args.split(',')[0].trim() === own[1]) continue; // a part moved within its own parent: nothing added
    const line = lineOf(m.index);
    const fn = nameAt(ranges, m.index);
    const noted = noteAt(m.index);
    let where = noted ? { part: noted } : classify(m[1], m.index);
    // before/after/replaceWith put the element beside the receiver, in the receiver's own parent.
    const beside = /^(before|after|replaceWith)$/.test(m[2]) || (m[2] === 'insertAdjacentElement' && /beforebegin|afterend/.test(args));
    if (beside && where?.part && !noted) where = { besidePart: where.part };
    if (beside && where?.clone) where = { clone: true };
    out.push({ line, function: fn, receiver, method: m[2], where });
  }
  return out.map((x) => {
    const w = x.where;
    let problem = null;
    if (!w) problem = `script adds an element to ${x.receiver}, which the check cannot follow to a part (get it with a hook call, or note "// part: hook-name" on the line)`;
    else if (w.outside) problem = `script adds an element to ${w.outside}, outside every part (build it inside a part the builder can see, as a state of that part; see BUILDER-RULES.md)`;
    else if (w.besidePart) problem = `script puts an element beside "${w.besidePart}" with ${x.method}, outside that part (put it inside a part, as a state of that part)`;
    else if (w.part && !hookExists(w.part)) problem = `script adds an element to "${w.part}", which no page declares`;
    else if (w.part && w.part.startsWith('template-')) problem = `script adds an element to the template "${w.part}" itself (clone it, then put the copy into a part)`;
    return { ...x, part: w?.part ?? w?.besidePart ?? (w?.clone ? '(template copy)' : null), problem };
  });
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
  // BUILDER-RULES.md: the one allowed embed, and the only values a script may set (positions).
  const ruled = manifest.rules !== undefined;
  const embeds = manifest.rules?.embeds ?? [];
  const positions = manifest.rules?.scriptPositions ?? { properties: [], values: [] };
  const sitePages = new Set(manifest.pages.map((x) => x.file));
  const outsideOk = new Set((manifest.rules?.outsideParts ?? []).map((x) => resolve(at(typeof x === 'string' ? x : x.file))));
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
      if (ruled && el.tag === 'iframe' && sitePages.has(p.file)) {
        const src = el.attrs.src && /^(https?:)?\/\//i.test(el.attrs.src) ? new URL(el.attrs.src, 'https://site.invalid/').hostname.replace(/^www\./, '') : null;
        const ok = embeds.some((e) => (e.hooks ?? []).includes(el.attrs['data-hook']) || (src && (e.hosts ?? []).some((h) => src === h || src.endsWith(`.${h}`))));
        if (!ok) problems.push(`${p.file}:${el.line}: <iframe> is not an allowed embed (the only ones are builder.json rules.embeds: ${embeds.map((e) => e.name).join(', ') || 'none'})`);
      }
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

  // ---- panels and states (BUILDER-RULES.md, rules 12-20): a panel that changes declares its states
  const panels = new Map(); // id -> { states, pages: Set, parent: id | null, hasShow }
  const STATE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  const panelOf = (el) => { for (let e = el.parent; e; e = e.parent) if (e.attrs['data-panel'] !== undefined) return e; return null; };
  for (const p of pages) for (const el of p.elements) {
    if (!el.inBody) continue;
    const a = el.attrs;
    const at_ = `${p.file}:${el.line}`;
    const id = a['data-panel'];
    if (id !== undefined) {
      const states = (a['data-states'] ?? '').split(/\s+/).filter(Boolean);
      if (id !== a['data-hook']) problems.push(`${at_}: data-panel="${id}" must be its root's hook ("${a['data-hook'] ?? ''}")`);
      if (!states.length) problems.push(`${at_}: panel "${id}" lists no states (data-states="a b c")`);
      for (const s of states) if (!STATE_NAME.test(s)) problems.push(`${at_}: panel "${id}": state "${s}" is not lower-case words joined by dashes`);
      if (!states.includes(a['data-state'])) problems.push(`${at_}: panel "${id}" starts in ${a['data-state'] === undefined ? 'no state' : `"${a['data-state']}", which it does not declare`} (data-state="${states[0] ?? ''}")`);
      if (a['data-show'] !== undefined) problems.push(`${at_}: panel "${id}" has data-show: a panel is never a state of another panel (give it an "off" state instead)`);
      const outer = panelOf(el);
      for (let e = el.parent; e && e !== outer; e = e.parent) if (e.attrs['data-show'] !== undefined) { problems.push(`${at_}: panel "${id}" sits inside a state of panel "${outer?.attrs['data-panel']}" (${e.attrs['data-hook']} shows only in "${e.attrs['data-show']}"); make it its own panel with an "off" state`); break; }
      const known = panels.get(id);
      if (known && known.states.join(' ') !== states.join(' ')) problems.push(`${at_}: panel "${id}" declares "${states.join(' ')}" here but "${known.states.join(' ')}" elsewhere (one id is one panel)`);
      if (!known) panels.set(id, { states, pages: new Set([p.file]), parent: outer?.attrs['data-panel'] ?? null, hasShow: false, copied: el.template !== null });
      else known.pages.add(p.file);
    } else if (a['data-state'] !== undefined) problems.push(`${at_}: data-state on ${a['data-hook'] ?? `<${el.tag}>`}, which is not a panel (only a panel's root has a state; for data use another data- attribute)`);
    if (a['data-states'] !== undefined && id === undefined) problems.push(`${at_}: data-states on ${a['data-hook'] ?? `<${el.tag}>`}, which is not a panel (add data-panel)`);
    if (a['data-show'] !== undefined) {
      const root = panelOf(el);
      const shows = a['data-show'].split(/\s+/).filter(Boolean);
      if (!root) problems.push(`${at_}: ${a['data-hook']} has data-show="${a['data-show']}" but sits in no panel`);
      else {
        const declared = (root.attrs['data-states'] ?? '').split(/\s+/);
        for (const s of shows) if (!declared.includes(s)) problems.push(`${at_}: ${a['data-hook']} shows in "${s}", a state panel "${root.attrs['data-panel']}" does not declare (${declared.join(', ')})`);
        if (panels.has(root.attrs['data-panel'])) panels.get(root.attrs['data-panel']).hasShow = true;
      }
      if (a.hidden !== undefined) problems.push(`${at_}: ${a['data-hook']} has both hidden and data-show (data-show alone decides)`);
    }
  }
  // The one shared hide rule, in tokens.css between its markers: a panel's "off" state hides it, and
  // in each other state the parts that do not list that state are hidden. CSS cannot compare two
  // attributes, so the rule names each panel's states; kit:hooks writes it, kit:check keeps it fresh.
  const PANELS_START = '/* kit:panels';
  const PANELS_END = '/* kit:panels end */';
  const hideSelectors = ['[data-panel][data-state="off"]'];
  for (const [id, pnl] of [...panels].sort(([x], [y]) => (x < y ? -1 : 1))) if (pnl.hasShow) for (const s of pnl.states) if (s !== 'off') hideSelectors.push(`[data-panel="${id}"][data-state="${s}"] [data-show]:not([data-show~="${s}"]):not([data-panel="${id}"] [data-panel] [data-show])`);
  const hideBlock = panels.size ? `${PANELS_START}: the shared state rule (BUILDER-RULES.md, rule 14). Made by kit:check from the pages' data-panel,\n   data-states and data-show (npm run kit:hooks). Do not edit by hand. */\n${hideSelectors.join(',\n')} { display: none !important; }\n${PANELS_END}` : '';
  {
    const text = read(tokensFile);
    const s = text.indexOf(PANELS_START);
    const e = text.indexOf(PANELS_END);
    const current = s === -1 || e === -1 ? '' : text.slice(s, e + PANELS_END.length);
    if (current !== hideBlock) {
      if (write) writeFileSync(tokensFile, s === -1 || e === -1 ? `${text.trimEnd()}\n\n${hideBlock}\n` : text.slice(0, s) + hideBlock + text.slice(e + PANELS_END.length));
      else problems.push(`${manifest.tokens}: the shared state rule (kit:panels) is ${current ? 'stale' : 'missing'} (run npm run kit:hooks and commit it)`);
    }
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
      const drawn = r.decls.find((d) => d.prop === 'content' && !/^(none|normal|''|"")$/.test(d.value));
      if (drawn && /::?(before|after|marker)\b/.test(r.selector) && abs !== resolve(layerFile)) problems.push(`${file}:${drawn.line}: "${r.selector}" draws something with CSS alone (make it a real child element with its own data-hook; see BUILDER-RULES.md)`);
      for (const d of r.decls) {
        if (d.prop.startsWith('--')) {
          declared.add(d.prop);
          if (abs === resolve(tokensFile) && !tokens.has(d.prop)) tokens.set(d.prop, d.value);
          if (abs === resolve(layerFile) && !tokens.has(d.prop)) tokens.set(d.prop, null);
          if (!colorsAllowed && COLOR.test(d.value)) problems.push(`${file}:${d.line}: colour "${d.value}" outside ${manifest.tokens} (name it there and use var(${d.prop}))`);
        } else if (COLOR.test(d.value.replace(/var\([^)]*\)/g, ''))) {
          problems.push(`${file}:${d.line}: colour in "${d.prop}: ${d.value}" is not a token (use var(--...) from ${manifest.tokens})`);
        }
        if (ruled && !d.prop.startsWith('--')) for (const v of varsIn(d.value)) if ((positions.values ?? []).includes(v) && !(positions.properties ?? []).includes(d.prop)) problems.push(`${file}:${d.line}: "${d.prop}" uses ${v}, a position a script sets; script-set values may only place things (${(positions.properties ?? []).join(', ')})`);
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
  const siteScripts = new Set([...pageScripts].filter(([f]) => sitePages.has(f)).flatMap(([, s]) => [...s]));
  const refs = new Map(); // hook -> [{file,line,function,uses}]
  const addRef = (hook, r) => { if (!refs.has(hook)) refs.set(hook, []); refs.get(hook).push(r); };
  const callRe = new RegExp(`(?<![\\w$.])(?<!function\\s)(${Object.keys(helpers).map((h) => h.replace(/\$/g, '\\$')).join('|')})\\s*\\(`, 'g');
  for (const [abs, text] of scripts) {
    const file = rel(abs);
    if (abs === tokensModule || helperFiles.has(abs) || ignore.some((x) => abs.toLowerCase().includes(x))) continue;
    const ranges = functionRanges(text);
    if (!outsideOk.has(abs)) for (const x of insertions(text, { helpers, fillCalls, hookExists: (h) => where.has(h) })) if (x.problem) problems.push(`${file}:${x.line}: ${x.problem}`);
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
      if (ruled && siteScripts.has(abs)) for (const sp of code.matchAll(/\.setProperty\(\s*(['"`])([^'"`]*)\1/g)) {
        if (!sp[2].startsWith('--')) continue;
        if (/\$\{/.test(sp[2]) || !(positions.values ?? []).includes(sp[2])) problems.push(`${file}:${i + 1}: script sets ${sp[2]}, which is not an allowed position (scripts may set only builder.json rules.scriptPositions.values; the rest of the look is the builder's)`);
      }
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

  // ---- labels for the builder (BUILDER-RULES.md, rules 21-24): plain names, kinds of text, lists, style groups
  const KINDS = ['text', 'number', 'money', 'percent', 'time', 'date', 'address', 'hash'];
  const groups = new Map(); // group -> Set of hooks
  for (const p of pages) {
    if (!sitePages.has(p.file)) continue;
    const templates = new Set(p.elements.filter((e) => e.tag === 'template').map((e) => e.attrs['data-hook']));
    const listed = new Set();
    for (const el of p.elements) {
      if (!el.inBody) continue;
      const a = el.attrs;
      const at_ = `${p.file}:${el.line}`;
      const what = a['data-hook'] ?? `<${el.tag}>`;
      if (a['data-label'] !== undefined && !(a['data-label'].trim() && a['data-label'].length <= 60)) problems.push(`${at_}: ${what}: data-label is a plain name of 1 to 60 characters`);
      if ((a['data-panel'] !== undefined || a['data-list'] !== undefined) && a['data-label'] === undefined) problems.push(`${at_}: ${what} is a ${a['data-panel'] !== undefined ? 'panel' : 'list'} with no plain name (data-label="...")`);
      if (a['data-kind'] !== undefined && !KINDS.includes(a['data-kind'])) problems.push(`${at_}: ${what}: data-kind "${a['data-kind']}" is not one of ${KINDS.join(', ')}`);
      if (a['data-list'] !== undefined) {
        if (!templates.has(a['data-list'])) problems.push(`${at_}: ${what}: data-list names "${a['data-list']}", which is not a <template> on this page`);
        listed.add(a['data-list']);
      }
      if (a['data-group'] !== undefined) {
        if (!HOOK_NAME.test(a['data-group'])) problems.push(`${at_}: ${what}: data-group "${a['data-group']}" is not lower-case words joined by dashes`);
        if (!groups.has(a['data-group'])) groups.set(a['data-group'], new Set());
        groups.get(a['data-group']).add(a['data-hook']);
      }
    }
    for (const t of templates) if (!listed.has(t)) problems.push(`${p.file}: ${t} has no list (put data-list="${t}" on the part its copies go into)`);
  }
  for (const [g, members] of groups) if (members.size < 2) problems.push(`style group "${g}" has one member (${[...members][0]}); a group is two or more parts that share a look`);

  // ---- states in scripts and in the scene and sample files (BUILDER-RULES.md, rules 13, 15, 17, 20)
  const HIDES = /\.hidden\s*=(?!=)|\b(?:set|remove|toggle)Attribute\(\s*['"]hidden['"]|\.style\.display\b|\.classList\b/;
  for (const [abs, text] of scripts) {
    if (!siteScripts.has(abs) || outsideOk.has(abs) || ignore.some((x) => abs.toLowerCase().includes(x))) continue;
    const file = rel(abs);
    text.split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (HIDES.test(code)) problems.push(`${file}:${i + 1}: script hides or shows a part itself (set data-state on its panel; the part lists its states in data-show)`);
      for (const m of code.matchAll(/(?<![\w$.])(setState|setOn)\(\s*(['"])([a-z0-9-]+)\2\s*(?:,\s*(['"])([a-z0-9-]+)\4)?/g)) {
        const pnl = panels.get(m[3]);
        if (!pnl) problems.push(`${file}:${i + 1}: ${m[1]}('${m[3]}') names no panel (data-panel="${m[3]}" on a page)`);
        else if (m[1] === 'setOn' && !(pnl.states.includes('on') && pnl.states.includes('off'))) problems.push(`${file}:${i + 1}: setOn('${m[3]}') needs the panel's states to be "off on"`);
        else if (m[5] && !pnl.states.includes(m[5])) problems.push(`${file}:${i + 1}: setState('${m[3]}', '${m[5]}'): the panel does not declare that state (${pnl.states.join(', ')})`);
      }
    });
  }
  const readJson = (key) => {
    if (!manifest[key]) return null;
    if (!existsSync(at(manifest[key]))) { problems.push(`builder.json: ${manifest[key]} does not exist`); return null; }
    try { return JSON.parse(read(at(manifest[key]))); } catch (e) { problems.push(`${manifest[key]}: cannot read (${e.message})`); return null; }
  };
  if (panels.size && !manifest.scenes) problems.push('builder.json: "scenes" is missing (the pages have panels, so a scene file lists which are present and in which state)');
  const scenes = readJson('scenes');
  if (scenes) {
    const names = new Set();
    for (const sc of scenes.scenes ?? []) {
      const name = `${manifest.scenes}: scene "${sc.name}"`;
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sc.name ?? '') || names.has(sc.name)) problems.push(`${name}: a scene needs a unique lower-case name`);
      names.add(sc.name);
      if (!sitePages.has(sc.page)) { problems.push(`${name}: page ${sc.page} is not a listed page`); continue; }
      const shown = sc.panels ?? {};
      for (const [id, s] of Object.entries(shown)) {
        const pnl = panels.get(id);
        if (!pnl || !pnl.pages.has(sc.page)) problems.push(`${name}: panel "${id}" is not on ${sc.page}`);
        else if (!pnl.states.includes(s) || s === 'off') problems.push(`${name}: panel "${id}" has no state "${s}" to show (${pnl.states.filter((x) => x !== 'off').join(', ')})`);
        else if (pnl.parent && panels.get(pnl.parent)?.states.includes('off') && !(pnl.parent in shown)) problems.push(`${name}: panel "${id}" sits in panel "${pnl.parent}", which the scene leaves out`);
      }
      for (const [id, pnl] of panels) if (pnl.pages.has(sc.page) && !pnl.copied && !pnl.states.includes('off') && !(id in shown)) problems.push(`${name}: panel "${id}" has no "off" state, so the scene must give its state`);
    }
  }
  const samples = readJson('samples');
  if (samples) for (const [hook, list] of Object.entries(samples.hooks ?? {})) {
    if (!where.has(hook)) problems.push(`${manifest.samples}: hook "${hook}" is on no page`);
    if (!Array.isArray(list) || !list.length || list.some((v) => typeof v !== 'string')) problems.push(`${manifest.samples}: "${hook}" needs a list of sample texts`);
  }

  // ---- slots (BUILDER-RULES.md): a style or setting the builder learns, as a token on a part
  const SLOT_KINDS = new Set(['colour', 'length', 'number', 'text', 'choice', 'shadow', 'filter', 'time', 'any']);
  for (const [i, s] of (manifest.rules?.slots ?? []).entries()) {
    const name = `builder.json rules.slots[${i}]${s?.token ? ` (${s.token})` : ''}`;
    if (!s?.token?.startsWith('--') || !s.hook || !s.label) { problems.push(`${name}: a slot needs "token" (--name), "hook" and "label"`); continue; }
    if (!where.has(s.hook)) problems.push(`${name}: hook "${s.hook}" is on no page`);
    if (!tokens.has(s.token) || tokens.get(s.token) === null) problems.push(`${name}: ${s.token} is not a token in ${manifest.tokens}`);
    else if (!(hookTokens.get(s.hook)?.has(s.token)) && ![...scripts.values()].some((t) => t.includes(s.token))) problems.push(`${name}: nothing uses ${s.token} for "${s.hook}" (a rule keyed by its hook, or a script reading the token)`);
    if (s.kind && !SLOT_KINDS.has(s.kind)) problems.push(`${name}: kind "${s.kind}" is not one of ${[...SLOT_KINDS].join(', ')}`);
    if (s.kind === 'choice' && !(Array.isArray(s.options) && s.options.length > 1)) problems.push(`${name}: a choice slot lists its "options"`);
  }

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
