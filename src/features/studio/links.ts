/**
 * What a chain between two elements is *for*.
 *
 * A link used to be a line with an arrowhead: it said two parts were joined
 * and nothing whatever about why, so it reached the blueprint as "A → B",
 * which is a fact nobody can build from. A chain is drawn between two parts
 * for one of two reasons — one of them reads something the other has, or one
 * of them only happens under a condition the other sets — and both of those
 * are already written down on the parts themselves, in their data and in
 * their prompts. Nobody should have to type them a second time.
 *
 * So the reason is *derived*, in this order:
 *
 *  1. **A condition.** A clause in the target's own words that turns on the
 *     source — "only when the wallet is connected", "after the form is sent".
 *     That is contingency, and it is the strongest thing either part says.
 *  2. **The data.** What the source holds, when the link is a data link:
 *     the target reads it, and the source has already said what it is.
 *  3. **A mention.** One part naming the other in its prompt: the sentence
 *     they are named in is the reason, in the author's own words.
 *  4. **The relation itself**, which is at least true.
 *
 * Kept to one short line, because it is drawn on the wire.
 */

export interface LinkEnd {
  label: string;
  /** What it shows or does — the values and actions the backend must provide. */
  data?: string | null;
  /** Its own prompt. */
  prompt?: string | null;
}

export type LinkRelation = "flow" | "data";

/** How long a reason may be before it stops being a label. */
const CAP = 52;

/** The words that make a clause a condition rather than a description. */
const IF = /\b(only\s+(?:when|if|after|once)|when|whenever|if|unless|after|once|until|while|provided)\b/i;

/** One line, no longer than a label, ending on a word. */
function short(s: string): string {
  const one = s.replace(/\s+/g, " ").trim().replace(/^[-–—•,;:]+\s*/, "").replace(/[.,;:]+$/, "");
  if (one.length <= CAP) return one;
  const cut = one.slice(0, CAP);
  const back = cut.lastIndexOf(" ");
  return `${(back > CAP * 0.6 ? cut.slice(0, back) : cut).replace(/[.,;:]+$/, "")}…`;
}

/** The sentences of a piece of writing, however it was punctuated. */
const sentences = (s: string): string[] =>
  s.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

/** The first thing a comma-separated list of values names. */
function firstValue(data: string): string {
  const first = data.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)[0] ?? "";
  return first.replace(/^(?:the|a|an)\s+/i, "");
}

/** Does this text name that part, as a word rather than as a fragment of one? */
function names(text: string, label: string): boolean {
  const word = label.trim();
  if (word.length < 3) return false;
  return new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(text);
}

/**
 * The clause in `text` that makes something conditional, when there is one.
 *
 * Preferring a clause that names the other part: "shown only when the wallet
 * is connected" is about the wallet, and "only on Tuesdays" is not about
 * anything the chain is drawn to.
 */
function condition(text: string, other: string): string | null {
  if (!text) return null;
  const clauses = sentences(text).flatMap((s) => s.split(/,\s*/));
  const conditional = clauses.filter((c) => IF.test(c));
  if (!conditional.length) return null;
  const about = conditional.find((c) => names(c, other));
  const pick = about ?? conditional[0]!;
  // From the condition word on: the half before it is what happens, and the
  // half after is when — and "when" is the reason the chain exists.
  const at = pick.search(IF);
  return short(at > 0 ? pick.slice(at) : pick);
}

/** The sentence in which one part names the other. */
function mention(text: string, other: string): string | null {
  if (!text) return null;
  const said = sentences(text).find((s) => names(s, other));
  return said ? short(said) : null;
}

/**
 * Why this chain is here, in one line.
 *
 * `undefined` for either end means the chain has an end in the air — a wire
 * dropped on the board rather than onto a part — and those get nothing:
 * there is no second part to have a reason about.
 */
export function linkReason(from: LinkEnd | undefined, to: LinkEnd | undefined, relation: LinkRelation = "flow"): string {
  if (!from || !to) return "";
  const fromData = (from.data ?? "").trim();
  const toData = (to.data ?? "").trim();
  const fromPrompt = (from.prompt ?? "").trim();
  const toPrompt = (to.prompt ?? "").trim();

  // 1. A condition, either way round. The target's own words first: a part
  //    that says when it appears is the one being made contingent.
  const cond = condition(toPrompt, from.label) ?? condition(toData, from.label) ?? condition(fromPrompt, to.label);
  if (cond) return cond;

  // 2. The data. On a data chain the target reads what the source holds.
  if (relation === "data") {
    if (fromData) return short(`reads ${firstValue(fromData)} from ${from.label}`);
    if (toData) return short(`needs ${firstValue(toData)}`);
  }

  // 3. A mention: whichever of them said the other's name meant something by it.
  const said = mention(toPrompt, from.label) ?? mention(fromPrompt, to.label);
  if (said) return said;

  // 4. And failing all of that, what the chain is.
  if (relation === "data") return short(`reads from ${from.label}`);
  if (fromData) return short(`carries ${firstValue(fromData)} on`);
  return short(`leads to ${to.label}`);
}

/** One end of a chain, as the board stores it. */
export interface ChainIn {
  kind?: string;
  fromNodeId?: string | null;
  toNodeId?: string | null;
  label?: string;
  relation?: LinkRelation;
}

/**
 * Every chain on the board, gathered against the parts at either end.
 *
 * A chain is drawn once and matters to both parts, so each gets its own side
 * of it: the source says where it leads, the target says what it hangs off.
 * The reason is whatever the author wrote on the chain, and when they wrote
 * nothing — which is the usual case, and the point — whatever the two parts
 * already say about one another.
 *
 * A wire with an end in the air is not a chain and is not gathered: it joins
 * a part to a patch of board, which is nothing either part has to know.
 */
export function chainLines<T extends LinkEnd & { id: string }>(nodes: T[], shapes: ChainIn[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const add = (id: string, line: string) => out.set(id, [...(out.get(id) ?? []), line]);
  for (const s of shapes) {
    if (s.kind !== "arrow" || !s.fromNodeId || !s.toNodeId) continue;
    const from = byId.get(s.fromNodeId);
    const to = byId.get(s.toNodeId);
    if (!from || !to || from === to) continue;
    const why = s.label?.trim() || linkReason(from, to, s.relation ?? "flow");
    add(from.id, `→ ${to.label}${why ? `, ${why}` : ""}`);
    add(to.id, `← ${from.label}${why ? `, ${why}` : ""}`);
  }
  return out;
}
