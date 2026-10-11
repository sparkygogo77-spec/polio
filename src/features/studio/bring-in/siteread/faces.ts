

/**
 * The faces the page declares, read off its stylesheets.
 *
 * Every `@font-face` rule this browser can read: the family as declared,
 * its weight and style, its `src` list made absolute against the sheet
 * that declared it, and that sheet. A sheet from another origin cannot be
 * read at all, so its link is listed instead — a Google Fonts sheet names
 * its families in its address, and `fonts.ts` reads that. Nothing here
 * decides what to carry: that is `carryFaces`, with the faces the readings
 * are set in.
 */
export const FACES = (): { faces: { family: string; weight?: string; style?: string; sources: { url: string; format?: string }[]; sheet: string | null; unicodeRange?: string }[]; links: { href: string }[] } => {
  const faces: { family: string; weight?: string; style?: string; sources: { url: string; format?: string }[]; sheet: string | null; unicodeRange?: string }[] = [];
  const links: { href: string }[] = [];
  const abs = (u: string, base: string): string => { try { return new URL(u, base).href; } catch { return u; } };
  const walk = (list: CSSRuleList, base: string, sheet: string | null): void => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSFontFaceRule) {
        const st = r.style;
        const family = st.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "");
        const src = st.getPropertyValue("src");
        const sources: { url: string; format?: string }[] = [];
        const re = /url\((["']?)([^)"']+)\1\)(?:\s*format\((["']?)([^)"']+)\3\))?/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) sources.push({ url: abs(m[2]!, base), ...(m[4] ? { format: m[4] } : {}) });
        if (family && sources.length) {
          const weight = st.getPropertyValue("font-weight").trim();
          const style = st.getPropertyValue("font-style").trim();
          const range = st.getPropertyValue("unicode-range").trim();
          faces.push({ family, ...(weight ? { weight } : {}), ...(style ? { style } : {}), sources, sheet, ...(range ? { unicodeRange: range } : {}) });
        }
      } else if (r instanceof CSSImportRule) {
        try {
          const inner = r.styleSheet;
          if (inner) walk(inner.cssRules, inner.href ?? base, inner.href ?? sheet);
        } catch {
          if (r.href) links.push({ href: abs(r.href, base) });
        }
      } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) {
        walk((r as CSSGroupingRule).cssRules, base, sheet);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try { rules = sheet.cssRules; } catch { if (sheet.href) links.push({ href: sheet.href }); continue; }
    if (!rules) continue;
    walk(rules, sheet.href ?? location.href, sheet.href ?? null);
  }
  return { faces, links };
};

/* ------------------------------------------------------------------ */
/* Every element a person would name, one by one                        */
/* ------------------------------------------------------------------ */

/** A stretch of a text part's words carrying its own weight, slant, face, ink, link or hook. */
export interface PartRun {
  text: string;
  weight?: number;
  italic?: boolean;
  mono?: boolean;
  colour?: string;
  /** A chip in the sentence (PST's dark "not connected" code label): its fill, padding (top right bottom left) and rounding. */
  bg?: string;
  pad?: number[];
  radius?: number;
  /** Room the page left beside it in the line, left and right px (PST's "OFF AIR", 8px after the channel). */
  space?: number[];
  href?: string;
  /** A link the page drew without an underline (PST's nav pills): the board draws it so too. */
  bare?: true;
  /** The id and data-* attributes of the element these words sit in, so code can still find it. */
  hooks?: Record<string, string>;
}

/** How one element was set, as the browser computed it: the page's own rules, or the browser's defaults where it has none. */
/** One state rule as `parts/capturedMotion.ts` replays it. */
export interface PartState { selector: string; self: boolean; state: string; style: Record<string, string> }

export interface PartStyle {
  px: number;
  weight: number;
  family: string;
  italic: boolean;
  colour: string;
  /** Its own fill, when it paints one. */
  bg: string | null;
  border: { w: number; style: string; colour: string } | null;
  radius: number;
  /** Padding: top, right, bottom, left. */
  pad: [number, number, number, number];
  align: string;
  leading: number;
  transform: string;
  /** Its letter-spacing as a share of its font size (em), where the page set one: PST's spaced capitals. */
  spacing?: number;
  /** The page keeps its words on one line (`white-space: nowrap` or `pre`). */
  nowrap?: boolean;
  /**
   * What paints it besides one colour: a gradient, several layered, a data:
   * picture (the TV's static), as computed, with its size, position and
   * repeat. A picture at an address of the page's own is not carried this way.
   */
  image?: string;
  imageOptions?: [string, string, string];
  /** `text`: the background is seen only through its letters. */
  imageClip?: string;
  /** How its background layers blend into each other and its colour (`background-blend-mode`), where any layer is not `normal`: a wood tile multiplied over brown. */
  imageBlend?: string;
  /** Its box-shadow, as computed (the TV body's offset ink shadow). */
  shadow?: string;
  /** A filter over it, as computed (the TV static's contrast). */
  filter?: string;
  /** The colour its control is ticked in (`accent-color`; PST's orange checkboxes). */
  accent?: string;
  /** How see-through it is as shown: its own opacity times every box round it, under 1. */
  opacity?: number;
  /** A mask it is painted through (an icon drawn in its colour), with its size, position and repeat. */
  mask?: string;
  maskOptions?: [string, string, string];
  /*
   * The rest of its look, as computed, carried as the capture carries it
   * (sink `node.art`): no field of the builder's sets these yet, so the part
   * is marked "look from capture" where it lands.
   */
  blend?: string;
  backdrop?: string;
  clipPath?: string;
  textShadow?: string;
  textStroke?: { w: number; color: string };
  paintOrder?: string;
  /** Each corner, top-left clockwise, where they differ. */
  radii?: number[];
  /** It clips what it holds (overflow other than visible): a rounded one rounds the corners of the parts in its corners (`pageParts.ts`). */
  clips?: boolean;
  maxw?: number;
  /** Its inside, when it is a flex row or column or a grid (as sink records it): the export grows its children as the page does (`fluidSite.ts`). */
  layout?: { display: "flex" | "grid"; direction?: "row" | "column"; align?: string; justify?: string; gap?: number; wrap?: boolean; columns?: number };
  /**
   * How it answers the pointer and the keyboard: each `:hover`, `:active` and
   * `:focus` rule that reaches it, its selector as written and its
   * declarations with the page's tokens resolved (`self`: the state is its
   * own, not an ancestor's). The shapes `parts/capturedMotion.ts` replays.
   */
  states?: { hover?: PartState[]; active?: PartState[]; focus?: PartState[] };
  /** What it eases between those states, as computed. */
  transition?: { property: string; duration?: string; timing?: string; delay?: string }[];
  /** A turned part that also animates (PST's swaying rods): its own turn at rest and the point it turns about, px from its box's top left, so its keyframes turn it where the page did. */
  ownTurn?: { transform: string; origin: string };
  /** Its z-index, when the page set one on a positioned box. */
  z?: number;
  /** Its running animations, every longhand as computed; their @keyframes are the read's `keyframes`. */
  animation?: { name: string; duration: string; timing: string; delay: string; iterations: string; direction: string; fill: string }[];
}

/** A form control as the page wrote it. */
export interface PartControl {
  type: string;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  rows?: number;
  /** A list's choices; `hook`: the `data-hook` the page's code finds one by. */
  options?: { text: string; value: string; selected: boolean; hook?: string }[];
}

/** One element of the page, read on its own. */
export interface PagePart {
  kind: "section" | "slot" | "heading" | "text" | "code" | "button" | "link" | "field" | "check" | "picture" | "shape";
  tag: string;
  /** The index of the section part this one sits in, or -1 for the page itself. */
  parent: number;
  box: { x: number; y: number; w: number; h: number };
  words: string;
  runs?: PartRun[];
  /** A field's or a checkbox's label, as the page wrote it. */
  label?: string;
  control?: PartControl;
  /** Its id and data-* attributes (and a control's name and role), exactly as written. */
  hooks: Record<string, string>;
  /** Null when it shows as the page opens; else what hides it (the hidden block's hook, id or path), and it took no room. */
  hidden: string | null;
  selector: string;
  /** "fixed" when it is pinned to the window rather than in the page's flow; "sticky" when it sticks as the page scrolls past. */
  position?: "fixed" | "sticky";
  /** Where a fixed or sticky part pins: the sides the page set, px as computed. */
  inset?: { top?: number; right?: number; bottom?: number; left?: number };
  /** What the live page computed for a hooked part, kept to check the board was handed all of it. */
  live?: { font: string; colour: string; bg: string; image: string; shadow: string; filter: string; turned: boolean; animations: string[]; position: string };
  /** An inline <svg> as markup: every shape's computed paint written on, its keyframes in a <style>, nothing that runs. Drawn as real svg. */
  svg?: string;
  href?: string;
  /** A link the page drew without an underline. */
  bare?: true;
  /** Words the page set on more than one line (an inline paragraph that wrapped): drawn wrapping, never held to one line. */
  wraps?: true;
  /** Set in the line right after a line part's words (PST's "?" after its note): that part's index, the room between (px) and its middle against the row's. */
  after?: { part: number; gap: number; dy: number };
  src?: string;
  alt?: string;
  style: PartStyle;
  /** The line of the page's source its hook (else its words) is written on, when the source was read beside it (`sourceHooks.ts#withLines`). */
  line?: number;
  /** The page's own CSS rules that reach it: a linked sheet's address, or which style block, and the selector as written. */
  rules?: { sheet: string | null; block: number; selector: string }[];
  /** Its class names, which scripts may find it by too. */
  classes?: string[];
  /** Hooks on elements inside it that are not parts of their own (a list's options, the words inside a button): carried by this part. */
  inner?: Record<string, string>[];
  /** The same rules with the file and line they are written on (`sourceHooks.ts#withLines`). */
  css?: { file: string; line: number; selector: string }[];
  /**
   * What turns it, as one matrix about its own box's centre: its own
   * rotation, scale or skew after those of what holds it. Its `box` is then
   * the one the layout gave, before the turn (PST's antenna rods: 6x90,
   * leaning -32deg, not the 51x81 box round the lean).
   */
  turn?: string;
  /** A `::before` or `::after` that draws (the red balls on the antenna tips), and the hooks of the element it belongs to. */
  pseudo?: { which: "::before" | "::after"; host: Record<string, string> };
}

/** What the fidelity count counts. */
export type CensusKey = "animated" | "keyframes" | "turned" | "svg" | "svgShapes" | "layered" | "pseudo" | "dropShadow" | "blend" | "clipPath" | "mask" | "fixed" | "sticky" | "canvas";

/** A page read element by element. */
export interface PageRead {
  title: string;
  width: number;
  height: number;
  /** The page's own ground, ink, face and size: the body's, as computed. */
  bg: string;
  colour: string;
  family: string;
  px: number;
  /** How many of the parts any rule of the page's own styles (a sheet or a style attribute) reaches. None: the browser's defaults are the whole look. */
  styledParts: number;
  /** Blocks hidden as the page opens (the hidden attribute, display none) and templates, read as hidden parts. */
  hiddenBlocks: number;
  templates: number;
  /** More than the cap: the rest are not read. */
  truncated: boolean;
  parts: PagePart[];
  /** Each part's box with the window at the tablet's and the phone's width, in the order of `parts`; null where the site does not draw it there (filled by whoever opened the page, `api/studio/zip`). */
  widths?: Partial<Record<"tablet" | "phone", ({ x: number; y: number; w: number; h: number; px?: number } | null)[]>>;
  /** The page's @keyframes that a part's animation names, as the capture records them. */
  keyframes?: { name: string; frames: { key: string; style: Record<string, string> }[] }[];
  /** Kept against live, over every element of the page: what animates (and the keyframes named), turns, inline svgs and their shapes, layered backgrounds, ::before/::after with content, drop shadows, blends, clip paths, masks, fixed, sticky, canvases. */
  census?: { live: Record<CensusKey, number>; kept: Record<CensusKey, number> };
  /** The page's own background layers that no part carries: <html>'s, an unhooked <body>'s, and their ::before/::after, in paint order. */
  layers?: { from: "html" | "body" | "html::before" | "html::after" | "body::before" | "body::after"; position: "absolute" | "fixed"; box: { x: number; y: number; w: number; h: number }; z: number | null; art: { colour?: string; background?: string; backgroundOptions?: string[]; backgroundBlend?: string; filter?: string; mask?: string; maskOptions?: string[]; blend?: string; opacity?: number } }[];
}
