/**
 * ONE RULE FOR WHAT MANY PARTS SAY THE SAME WAY.
 *
 * A captured page writes a rule per part: parasiteonsol.fun's 18,851 parts
 * wrote 1,588 transitions in 112 different words and 15,023 hover and press
 * rules, most of them one of a handful. This folds a stylesheet so that
 * each set of declarations is written once, for every selector that says
 * it, and draws exactly what it drew before:
 *
 *   · a rule written again later, word for word, is dropped where it came
 *     first: the later copy sets every property the earlier one did, with
 *     the same weight, after it, so the earlier one never decided anything;
 *   · rules with the same declarations (and the same `@media` round them)
 *     become one selector list, but only rules whose element no other rule
 *     of the same weight reaches (plain or `!important`: the two never
 *     decide against each other): with one such rule per element, no rule's
 *     place in the sheet can decide against another's. An element two rules
 *     of a weight reach keeps both, as written, where they were;
 *   · a selector that leans on `:has()` is not listed with one that does not,
 *     so a browser without it drops what it dropped before and no more.
 *
 * Only one-line rules are read (`sel { … }` and `@media … { sel { … } }`);
 * anything else (keyframes, a list already written as one) stays as it is,
 * where it is. Pure. `tests/css-scale.mjs`.
 */

interface Rule { i: number; media: string; sel: string; body: string; target: string | null }

/** The weight a rule's declarations carry: all `!important`, none, or a mix this will not fold. */
function weightOf(body: string): string | null {
  const decls = body.split(";").map((d) => d.trim()).filter(Boolean);
  const loud = decls.filter((d) => /!important$/i.test(d)).length;
  return loud === decls.length ? "!" : loud === 0 ? "" : null;
}

const ONE = /^([^{}@][^{}]*?)\s*\{\s*([^{}]*?)\s*\}$/;
const IN_MEDIA = /^(@media [^{}]+?)\s*\{\s*([^{}]+?)\s*\{\s*([^{}]*?)\s*\}\s*\}$/;

/** The element a selector lands on: its last compound, less the state it waits for; for a list, the one every selector in it lands on. Null for anything else. */
function targetOf(sel: string): string | null {
  const parts: string[] = [];
  let d = 0, from = 0;
  for (let i = 0; i < sel.length; i++) { const c = sel[i]; if (c === "(") d++; else if (c === ")") d--; else if (c === "," && d === 0) { parts.push(sel.slice(from, i)); from = i + 1; } }
  parts.push(sel.slice(from));
  if (parts.length > 1) { const all = parts.map((p) => targetOf(p.trim())); return all.every((t) => t !== null && t === all[0]) ? all[0]! : null; }
  let depth = 0, last = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && /[\s>+~]/.test(c!)) last = i + 1;
  }
  const tail = sel.slice(last).trim();
  if (!tail || /[*[]/.test(tail)) return null;
  return tail.replace(/(::?[\w-]+(\([^)]*\))?)+$/, "") || null;
}

/*
 * An element and the weight a rule gives it: an `!important` rule and a
 * plain one never decide against each other (the important one wins
 * wherever it stands), so a part's transition and its press are each alone
 * in their weight.
 */
function aimOf(sel: string, body: string): string | null {
  const t = targetOf(sel), w = weightOf(body);
  return t === null || w === null ? null : `${t}${w}`;
}

/** One selector of a part's own: its box (`.mo-<id>`, maybe in a state), or its box under its own element in a state (`#<id>:hover .mo-<id>`). */
const OWN_BOX = /^\.mo-([\w-]+)(:(?:hover|active|focus|focus-visible|focus-within))?$/;
const OWN_UNDER = /^#([\w-]+)(:(?:hover|active|focus|focus-visible|focus-within)) \.mo-([\w-]+)$/;

/** A rule's selectors as the shape they share and the part they name, or null when they name more than one part or something else. */
function ownShape(sel: string): { id: string; shape: string } | null {
  const items: string[] = [];
  let d = 0, from = 0;
  for (let i = 0; i < sel.length; i++) { const c = sel[i]; if (c === "(") d++; else if (c === ")") d--; else if (c === "," && d === 0) { items.push(sel.slice(from, i).trim()); from = i + 1; } }
  items.push(sel.slice(from).trim());
  let id: string | null = null;
  const shape: string[] = [];
  for (const it of items) {
    const box = OWN_BOX.exec(it), under = OWN_UNDER.exec(it);
    const who = box ? box[1]! : under && under[1] === under[3] ? under[1]! : null;
    if (!who || (id !== null && who !== id)) return null;
    id = who;
    shape.push(box ? `B${box[2] ?? ""}` : `U${under![2]}`);
  }
  return id ? { id, shape: shape.join(",") } : null;
}

/**
 * The same, with each fold of a part's own selectors (`.mo-<id>`,
 * `.mo-<id>:hover`, `#<id>:hover .mo-<id>, .mo-<id>:hover`) written as one
 * shared class for the box and one for its element (`.<share><n>`,
 * `.<share><n>o`), which `classes` says to put on them (`mo-<id>` the box,
 * `#<id>` the element). The sheet then holds a rule per way of moving, not a
 * name per part. Only rules alone in their weight on their box are folded
 * (`mergeRules`), so no other rule of that weight meets them there and
 * neither their place nor their specificity can decide anything. Other
 * folds stay selector lists.
 */
export function shareRules(css: string, share: string): { css: string; classes: Map<string, string[]> } {
  const classes = new Map<string, string[]>();
  const add = (k: string, c: string) => classes.set(k, [...(classes.get(k) ?? []), c]);
  let n = 0;
  const folded = mergeRules(css, (sels) => {
    if (sels.length < 2) return null;
    const own = sels.map(ownShape);
    if (own.some((o) => !o) || new Set(own.map((o) => o!.shape)).size !== 1) return null;
    const name = `${share}${(n++).toString(36)}`;
    const shape = own[0]!.shape.split(",");
    for (const o of own) { add(`mo-${o!.id}`, name); if (shape.some((x) => x.startsWith("U"))) add(`#${o!.id}`, `${name}o`); }
    return shape.map((x) => (x.startsWith("B") ? `.${name}${x.slice(1)}` : `.${name}o${x.slice(1)} .${name}`)).join(", ");
  });
  return { css: folded, classes };
}

export function mergeRules(css: string, asOne?: (selectors: string[]) => string | null): string {
  const lines = css.split("\n");
  const rules: (Rule | null)[] = lines.map((line, i) => {
    const t = line.trim();
    const m = IN_MEDIA.exec(t);
    if (m) return { i, media: m[1]!, sel: m[2]!, body: m[3]!, target: aimOf(m[2]!, m[3]!) };
    const o = ONE.exec(t);
    if (o && !t.startsWith("@")) return { i, media: "", sel: o[1]!, body: o[2]!, target: aimOf(o[1]!, o[2]!) };
    return null;
  });
  /* Word for word again later: the earlier copy goes. */
  const lastOf = new Map<string, number>();
  lines.forEach((l, i) => { if (rules[i]) lastOf.set(l.trim(), i); });
  const kept = rules.map((r, i) => (r && lastOf.get(lines[i]!.trim()) !== i ? "drop" : r));
  /* How many rules reach each element. */
  const reach = new Map<string, number>();
  for (const r of kept) if (r && r !== "drop" && r.target) reach.set(r.target, (reach.get(r.target) ?? 0) + 1);
  const alone = (r: Rule) => !!r.target && reach.get(r.target) === 1;
  const groups = new Map<string, Rule[]>();
  for (const r of kept) {
    if (!r || r === "drop" || !alone(r)) continue;
    const key = `${r.media}\u0000${/:has\(/.test(r.sel) ? 1 : 0}\u0000${r.body}`;
    const g = groups.get(key);
    if (g) g.push(r); else groups.set(key, [r]);
  }
  const firstOf = new Map<number, Rule[]>();
  const merged = new Set<number>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    firstOf.set(g[0]!.i, g);
    for (const r of g) merged.add(r.i);
  }
  const out: string[] = [];
  lines.forEach((line, i) => {
    const r = kept[i];
    if (r === "drop") return;
    const g = firstOf.get(i);
    if (g) {
      const sel = asOne?.(g.map((x) => x.sel)) ?? g.map((x) => x.sel).join(", ");
      out.push(g[0]!.media ? `${g[0]!.media} { ${sel} { ${g[0]!.body} } }` : `${sel} { ${g[0]!.body} }`);
      return;
    }
    if (merged.has(i)) return;
    out.push(line);
  });
  return out.join("\n");
}
