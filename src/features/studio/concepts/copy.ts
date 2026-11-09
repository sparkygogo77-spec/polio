/**
 * WORDS AND PARTS FOR A FREE CONCEPT, WRITTEN FROM THE PROMPT'S SUBJECT.
 *
 * The free Make used idea-versions' local roll, whose pages read as
 * templates ("A sentence or two that says who it is for", "Card 1"). J
 * judges the studio by what he sees first, so a free draft has to read as a
 * real page about the thing he asked for:
 *
 *   · the subject is read off the prompt ("three concepts for a lantern
 *     shop landing page" → "lantern shop"), split into what it is (shop)
 *     and what it is about (lantern);
 *   · every line is written from those words, picked by seed from a few
 *     ways of saying it, in the voice of the direction (calm, bold, warm,
 *     night);
 *   · every catalogue part gets its content (cards, questions, prices,
 *     quotes, tiles, captions), so no part falls back to its sample words;
 *   · pictures are planned as `picture` and `gallery` parts here, and drawn
 *     by `draft.ts#paintPictures` as colour blocks and shapes in the
 *     direction's own colours, varied by subject: the kit has one scene
 *     picture, and the same sky six times read as a template.
 *
 * Pure: no React, no store, no browser. `tests/concept-taste.mjs` reads
 * every part's words and fails on any placeholder.
 */
import type { PlanPart, PlanSection } from "../idea/plan.ts";
import type { Version, Versions } from "../idea/versions.ts";

/** The thing the prompt is about. */
export interface Subject {
  /** The whole subject, as typed: "lantern shop". */
  text: string;
  /** What it is: "shop", "studio", "app", "bakery". */
  thing: string;
  /** What it is about, singular: "lantern". Empty when the prompt names only a thing. */
  topic: string;
  /** The topic as many: "lanterns". */
  topics: string;
  /** The subject with its first letter up: "Lantern shop". */
  name: string;
}

const PAGE_WORDS = /\b(landing\s+page|home\s*page|web\s*site|website|site|page|homepage|one[- ]pager|brand|startup|company|business)\b/gi;
const ASKING = /^(please\s+)?(make|give|show|draft|design|do|build|i want|i need|i'd like|we want|we need)(\s+(me|us))?\s+/i;
const COUNT = /^(three|four|two|3|4|2|some|a few|several)?\s*(concepts?|options?|versions?|ideas?|directions?|takes?|looks?|designs?)\s+(for|of|on)\s+/i;
/** "the booking page of", "the home page for": the page words and their joining word. */
const PAGE_OF = /^(a|an|the|my|our)?\s*(\w+\s+)?(landing\s+page|home\s*page|web\s*site|website|site|page|homepage|one[- ]pager)\s+(for|of)\s+/i;
const LEAD = /^((for|of|about)\s+)?(a|an|the|my|our|this)\s+|^(for|of|about)\s+/i;
/** "… in Leeds", "… near Bristol": where it is, not what it is. */
const PLACE = /\s+(in|near|at|from)\s+[A-Z][\w'-]*(\s+[A-Z][\w'-]*)?$/;

/** "three concepts for a lantern shop landing page" → the lantern shop. */
export function subjectOf(prompt: string): Subject {
  let s = prompt.trim().replace(ASKING, "").replace(COUNT, "").replace(PAGE_OF, "").replace(/[.!?]+$/, "").trim();
  s = s.replace(PLACE, "").replace(PAGE_WORDS, " ").replace(/\s+/g, " ").trim().replace(LEAD, "").replace(/(small|little|new|local|modern|simple)\s+/i, "").trim();
  if (!s) s = "small shop";
  /* A long run of words: the last three carry the thing. */
  let words = s.toLowerCase().split(" ").filter(Boolean);
  if (words.length > 3) words = words.slice(-3);
  s = words.join(" ");
  const thing = words[words.length - 1]!;
  const topic = words.slice(0, -1).join(" ");
  return { text: s, thing, topic, topics: topic ? plural(topic) : plural(thing), name: cap(s) };
}

export const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** A plain English plural: lantern → lanterns, pottery class → pottery classes, coffee → coffee. */
export function plural(s: string): string {
  const w = s.trim();
  if (!w) return w;
  const parts = w.split(" ");
  const last = parts.pop()!;
  const MASS = new Set(["coffee", "tea", "bread", "cheese", "wine", "beer", "furniture", "jewellery", "jewelry", "music", "art", "clothing", "fitness", "yoga", "software", "food", "honey", "soap", "ceramics", "pottery", "photography"]);
  let p = last;
  if (/(ss|ch|sh|x|z)$/.test(last)) p = `${last}es`;
  else if (MASS.has(last.toLowerCase()) || /s$/.test(last)) p = last;
  else if (/[^aeiou]y$/.test(last)) p = `${last.slice(0, -1)}ies`;
  else p = `${last}s`;
  return [...parts, p].join(" ");
}

/** A small seeded picker, so the same prompt and seed say the same thing. */
export function picker(seed: number): <T>(list: readonly T[]) => T {
  let x = (seed >>> 0) || 1;
  return <T,>(list: readonly T[]) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return list[x % list.length]!; };
}

/* ------------------------------------------------------------------ */
/* The directions                                                      */
/* ------------------------------------------------------------------ */

export type Voice = "calm" | "bold" | "warm" | "night";

export interface Direction {
  id: Voice;
  name: string;
  pitch: string;
  /** Words `readPhilosophy` understands, for the theme the concept is drawn in. */
  philosophy: string;
}

export const DIRECTIONS: readonly Direction[] = [
  { id: "calm", name: "Calm editorial", pitch: "Few words, lots of room, one thing at a time. Reads like a magazine page.", philosophy: "editorial quiet light airy calm minimal paper warm" },
  { id: "bold", name: "Bold product", pitch: "A big promise up top, what you get in cards, prices and questions answered.", philosophy: "bold loud clean modern blue snappy soft shadows" },
  { id: "warm", name: "Warm and personal", pitch: "A person, a story and pictures first; the details after.", philosophy: "warm friendly playful rounded orange soft gentle" },
  { id: "night", name: "Night and neon", pitch: "Dark page, one glowing colour, big type. Made to be seen at night.", philosophy: "dark neon glow violet bold snappy square" },
];

/* ------------------------------------------------------------------ */
/* The words                                                           */
/* ------------------------------------------------------------------ */

interface Lines {
  title: string; sub: string; cta: string; cta2: string | null;
  what: { h: string; p: string; cards: string[] };
  story: { h: string; p: string };
  words: { h: string; quotes: string[] };
  faq: { h: string; rows: string[] };
  prices: { h: string; p: string; tiers: string[] };
  tiles: string[];
  gallery: { h: string; captions: string[] };
  picture: string;
  contact: { h: string; p: string; cta: string };
}

/** Every line a page might carry, in the direction's voice, from the subject. */
export function linesFor(s: Subject, voice: Voice, seed: number): Lines {
  const r = picker(seed);
  const T = s.topic || s.thing;
  const Ts = s.topics;
  const Tc = cap(T);
  const Tsc = cap(Ts);
  const thing = s.thing;
  const name = s.name;
  /* "the lantern shop"; for a one-word subject just "the bakery", never "the bakery bakery". */
  const TT = s.topic ? `${T} ${thing}` : thing;

  const title = r(voice === "calm"
    ? [`${Tsc}, made slowly.`, `${Tsc}, kept simple.`, `A quieter kind of ${thing}.`, `${Tsc} worth the wait.`]
    : voice === "bold"
      ? [`The ${TT} that gets it right.`, `${Tsc}. Done properly.`, `Better ${Ts}, faster.`, `Everything a ${TT} should be.`]
      : voice === "warm"
        ? [`Hello. We're the ${TT}.`, `Come in, the ${Ts} are ready.`, `${Tsc} from people who love them.`, `Made by hand, sent with a note.`]
        : [`${Tsc}. Turned up.`, `${Tc} after dark.`, `Open late. Loud on purpose.`, `${Tsc}, louder.`]);
  const sub = r(voice === "calm"
    ? [`A small ${thing} for people who care about ${Ts}. Few things, chosen well, sent with care.`, `We make ${Ts} the slow way, and keep the ones that pass. Nothing here is in a hurry.`]
    : voice === "bold"
      ? [`Everything you need for ${Ts}, shipped in two days, with a year's guarantee on every one.`, `Pick from ${r(["forty", "sixty", "twelve"])} ${Ts}, compare them side by side, and have yours by ${r(["Friday", "the weekend", "Thursday"])}.`]
      : voice === "warm"
        ? [`Run by ${r(["four", "two", "three"])} people who love ${Ts}. Come in, have a look, ask us anything.`, `Every one of our ${Ts} has a story. We'll tell you it when you ask.`]
        : [`${Tsc} for the hours after dark: open late, loud on purpose, never boring.`, `One rule here: nothing quiet. ${Tsc} for people who come alive when the street goes dark.`]);
  const cta = voice === "calm" ? r([`See the ${Ts}`, "Have a look"]) : voice === "bold" ? r(["Shop now", "Get started"]) : voice === "warm" ? r(["Come and see", "Say hello"]) : r(["Get one", "See the drops"]);
  const cta2 = voice === "bold" ? "See prices" : voice === "night" ? "Join the club" : null;

  const three = (a: string[], b: string[], c: string[]) => [r(a), r(b), r(c)];
  const cards = three(
    [`Chosen by hand: Every ${T} is picked by someone who would buy it.`, `Made to last: ${Tsc} that still work in ten years, or we fix them.`],
    [`Sent in two days: Packed well, posted fast, tracked all the way.`, `Easy returns: Thirty days, no questions, we pay the post.`],
    [`Real help: A person answers, usually within the hour.`, `Fair prices: What it costs to make it well, and not much more.`],
  );
  const what = { h: voice === "bold" ? "What you get" : voice === "calm" ? "What we make" : voice === "warm" ? "What we do" : "// What you get", p: voice === "bold" ? `The three things that make this ${thing} worth it.` : `Three things we hold to.`, cards };
  const story = {
    h: voice === "calm" ? "Why it exists" : voice === "warm" ? "How it started" : voice === "night" ? "// Built in a garage" : "Our story",
    p: r([`${name} began in a ${r(["back room", "garage", "kitchen"])} with one ${T} and a stubborn idea: that ${Ts} should be ${r(["beautiful and useful", "simple and good", "made to be kept"])}. ${r(["Four", "Two", "Three"])} people and ${r(["six", "eight", "three"])} years later, that is still the whole plan.`, `We started making ${Ts} because we could not find ones we liked. Now other people like them too. The ${thing} is small on purpose.`]),
  };
  const words = { h: voice === "night" ? "// Heard on the street" : "What people say", quotes: three(
    [`The ${T} arrived in two days and it is lovelier than the photo.`, `I bought one ${T} and came back for three more.`],
    [`Proper people, proper ${Ts}. Ask them anything, they answer.`, `The only ${thing} where I read every word on the page.`],
    [`It is the thing everyone asks about when they come round.`, `Best ${T} I have owned, and I have owned a few.`],
  ) };
  const faq = { h: voice === "night" ? "// Questions" : "Questions", rows: [
    `Do you ship ${Ts} abroad?: Yes, to most countries, usually within a week.`,
    `What if my ${T} arrives damaged?: Send a photo and a new one goes out that day.`,
    r([`Can I return a ${T}?: Within thirty days, for any reason, post paid.`, `Do you repair ${Ts}?: Yes, ours for life, others for the cost of parts.`]),
  ] };
  const prices = { h: voice === "night" ? "// The club" : voice === "calm" ? "By the month" : "Prices", p: voice === "calm" ? `${Tsc}, and what keeps them going, each month.` : "Plain prices, no surprises.", tiers: [
    `${r(["Single", "Starter", "Taster"])}: ${r(["12", "9", "15"])}`,
    `${r(["Household", "Regular", "Pair"])}: ${r(["28", "24", "32"])}`,
    `${r(["Workshop", "Studio", "Festival"])}: ${r(["60", "48", "70"])}`,
  ] };
  const tiles = [`${Tsc} made: ${r(["1,200", "3,400", "860"])}`, `Years at it: ${r(["6", "8", "3"])}`, `Repairs for life: ${r(["all", "every one"])}`, `Days to your door: ${r(["2", "3"])}`];
  const gallery = { h: voice === "calm" ? "This season" : voice === "warm" ? "Have a look" : "Pictures", captions: [r([`${Tc} in morning light`, `The first ${T}`]), r(["In the workshop", "On the bench"]), r([`${Tsc} on the shelf`, "Ready to go"]), "Packed to go", r(["Evening", "Closing time"]), r([`A ${T}, finished`, "Detail"])] };
  const picture = r([`${Tc} on the bench`, `The workshop`, `${Tsc}, lit`]);
  const contact = { h: voice === "warm" ? "Find us" : voice === "calm" ? "Say hello" : "Get in touch", p: r([`${r(["Thursday", "Wednesday"])} to Sunday, ${r(["ten", "eleven"])} till six. Or write, and a person answers.`, `One way to reach us, and we answer within a day.`]), cta: voice === "warm" ? "Send a message" : "Write to us" };
  return { title, sub, cta, cta2, what, story, words, faq, prices, tiles, gallery, picture, contact };
}

/* ------------------------------------------------------------------ */
/* The pages                                                           */
/* ------------------------------------------------------------------ */

type Part = (id: string, label: string, content: string, options?: Record<string, string>) => PlanPart;

const h = (text: string, level: 1 | 2 | 3 = 2): PlanPart => ({ kind: "heading", text, level });
const p = (text: string): PlanPart => ({ kind: "text", text });
const btn = (text: string, main = true): PlanPart => ({ kind: "button", text, main });
const join = (lines: readonly string[]) => lines.join("\n");

/**
 * Each direction's Home page: which sections, in which order, with every
 * part's words. A catalogue part's label carries its section ("Prices:
 * table"), as `planToBoard` names headings and words, so the Mix reads one
 * section where there is one; a picture's label is "Picture: <caption>",
 * and the part draws the caption alone on its plate (`parts/Media.tsx`).
 */
export function pageFor(voice: Voice, L: Lines, part: Part, siteName: string): PlanSection[] {
  const sec = (name: string, ...parts: PlanPart[]): PlanSection => ({ name, parts });
  const in_ = (section: string, id: string, label: string, content: string, options?: Record<string, string>) => part(id, `${section}: ${label}`, content, options);
  /* The header's words are its links: the page's own sections. */
  const nav = voice === "calm" ? [L.gallery.h, "Story", "Prices"] : voice === "bold" ? ["Shop", "Prices", "Questions"] : voice === "warm" ? ["Shop", "Pictures", "Find us"] : ["Drops", "Club", "Street"];
  const header = sec("Header", part("sticky-header", "Header", join(nav)));
  const footer = sec("Footer", part("footer", "Footer", join([siteName, L.contact.p.split(".")[0] ?? ""])));
  const first = sec("First screen", h(L.title, 1), p(L.sub), btn(L.cta), ...(L.cta2 ? [btn(L.cta2, false)] : []));
  /* Section names are the same across directions (the headings keep the voice), so the grid's rows line up. */
  const picture = (caption: string): PlanSection => sec("Picture", part("picture", `Picture: ${caption}`, ""));
  const gallery = sec("Pictures", h(L.gallery.h), in_("Pictures", "gallery", "pictures", join(L.gallery.captions), { columns: "3" }));
  const what = sec("What you get", h(L.what.h), p(L.what.p), in_("What you get", "card-grid", "cards", join(L.what.cards)));
  const story = sec("Story", h(L.story.h), p(L.story.p));
  const words = sec("Kind words", h(L.words.h), in_("Kind words", "testimonials", "quotes", join(L.words.quotes)));
  const faq = sec("Questions", h(L.faq.h), in_("Questions", "faq", "list", join(L.faq.rows)));
  const prices = sec("Prices", h(L.prices.h), p(L.prices.p), in_("Prices", "pricing-table", "table", join(L.prices.tiers), { tiers: "3" }));
  const tiles = sec("Numbers", in_("Numbers", "stat-tiles", "tiles", join(L.tiles)));
  const contact = sec("Contact", h(L.contact.h), p(L.contact.p), btn(L.contact.cta));
  switch (voice) {
    case "calm": return [header, first, picture(L.picture), gallery, story, prices, footer];
    case "bold": return [header, first, tiles, what, picture(L.picture), prices, faq, footer];
    case "warm": return [header, first, picture(L.picture), words, gallery, story, contact, footer];
    case "night": return [header, first, picture(L.picture), what, prices, words, footer];
  }
}

/**
 * Three (or four) concepts of the subject, as idea-versions' `Versions`,
 * every part a catalogue part that works (`allowed`) with its own words; a
 * part the catalogue lacks is left out rather than stood in for.
 */
export function conceptVersions(prompt: string, o: { seed: number; count?: number; allowed: ReadonlySet<string> }): Versions {
  const s = subjectOf(prompt);
  const count = Math.max(1, Math.min(DIRECTIONS.length, o.count ?? 3));
  const start = Math.abs(Math.floor(o.seed)) % DIRECTIONS.length;
  const picked = Array.from({ length: count }, (_, i) => DIRECTIONS[(start + i) % DIRECTIONS.length]!);
  const versions: Version[] = picked.map((d, i) => {
    const L = linesFor(s, d.id, o.seed + i * 7919);
    const part: Part = (id, label, content, options = {}) => (o.allowed.has(id) ? { kind: "part", featureId: id, label, content, options } : { kind: "text", text: content.split("\n")[0] ?? label });
    const sections = pageFor(d.id, L, part, s.name).map((sec) => ({ ...sec, parts: sec.parts.filter((q) => !(q.kind === "text" && !q.text.trim())) })).filter((sec) => sec.parts.length);
    return { name: d.name, pitch: d.pitch, pages: [{ name: "Home", sections }] };
  });
  return { name: s.name, description: `${s.name}: ${count} concepts.`, versions, missing: [], by: "local" };
}

/** The direction a version was written in, by its name. */
export const directionOf = (name: string): Direction | null => DIRECTIONS.find((d) => d.name.toLowerCase() === name.toLowerCase()) ?? null;

/** Words that mark a part as a template, not a page: a draft must carry none. */
export const PLACEHOLDER_WORDS: readonly RegExp[] = [
  /^card \d+$/i, /\bcard \d+\b/i, /sentence or two/i, /say the one thing/i, /words go here/i, /goes here/i, /^button$/i,
  /lorem ipsum/i, /placeholder/i, /^slide (one|two|three)/i, /^(acme|globex|initech|umbrella|hooli)$/i, /it took an afternoon, not a quarter/i, /the only tool the whole team/i, /^(free|pro|team): \d+$/i, /^(users|revenue|uptime|orders)$/i, /how does it work\?$/i,
];

/** The first placeholder phrase a part's words carry, or null. */
export function placeholderIn(content: unknown): string | null {
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((x) => (x && typeof x === "object" && "text" in x ? String((x as { text: unknown }).text) : "")).join("\n") : "";
  for (const line of text.split("\n")) for (const re of PLACEHOLDER_WORDS) if (re.test(line.trim())) return line.trim();
  return null;
}
