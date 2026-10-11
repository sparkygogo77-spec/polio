"use client";
/**
 * Words typed where they are drawn.
 *
 * The only way to change a part's words was the WORDS box in the side panel:
 * press twice and the caret went across the screen. Now a second press (or
 * Enter on a picked part) opens the words on the canvas itself, in the part's
 * own face, size and colour, over the words it replaces. Enter or a press
 * anywhere else keeps what was typed; Shift+Enter is a new line; Escape puts
 * the words back as they were. The whole edit is one step of undo.
 *
 * It only opens where the words are drawn as one piece of text on the part,
 * so what is typed lands where it is seen. Anywhere else (a list of tab
 * names, a part that draws its words in several places) the panel's WORDS
 * box still takes them, as it did (`openWords`).
 *
 * WORDS INSIDE A SENTENCE, IN THEIR OWN FONT. J's ask (2026-10-11): it
 * should work like any document, where you highlight the text within a
 * sentence and change only that text into a different font, so a sentence
 * in two faces is not two text boxes laid beside each other and
 * overlapping. So the words open as their runs, each drawn in its own
 * face, size, colour, weight and slant, and highlighting some of them
 * brings a bar over the box: Font, size, colour, B, I and Plain. Each sets
 * that look on the highlighted stretch only (`restyle` in
 * `parts/spans.ts`), which cuts the runs there and leaves the rest as it
 * was; Ctrl/Cmd+B and Ctrl/Cmd+I do the same. The board, the Preview and
 * the published page all draw the runs through `parts/Runs.tsx`, so what
 * is set here is what is seen everywhere (tests/words-styled.mjs).
 */
import * as React from "react";
import { useStudio, type StudioNode } from "./board/store";
import { lookIn, plain, restyle, reword, spansOf, type RunLook, type Span } from "./shelf";
import { getFeature } from "./shelf";
import { FAMILY } from "./shelf/run";
import { fontsInPageOrder } from "./look";
import { partName } from "./partNames";
import { play } from "@/core/audio/engine";

/* ------------------------------------------------------------ which part */
let editing: string | null = null;
const watchers = new Set<() => void>();
const tell = () => watchers.forEach((w) => w());
function setEditing(id: string | null) {
  if (editing === id) return;
  editing = id;
  tell();
}
/** The part whose words are open on the canvas, or null. */
export const editingWords = () => editing;
export function useEditingWords(): string | null {
  return React.useSyncExternalStore(
    (w) => { watchers.add(w); return () => { watchers.delete(w); }; },
    () => editing,
    () => null,
  );
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The one element that draws this part's words, or null when no single
 * element does (the words are split across the part, or not drawn at all).
 */
export function wordsElement(nodeId: string): HTMLElement | null {
  const root = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"] [data-part-drawn]`);
  const n = useStudio.getState().nodes.find((x) => x.id === nodeId);
  if (!root || !n) return null;
  const want = squash(plain(n.content));
  if (!want) return null;
  let best: HTMLElement | null = null;
  for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    if (squash(el.innerText ?? el.textContent ?? "") !== want) continue;
    best = el;   // later is deeper: the smallest element that still holds all of them
  }
  return best;
}

/** Can this part's words be typed on the canvas? */
export function canEditInPlace(n: StudioNode): boolean {
  if (n.locked) return false;
  return !!wordsElement(n.id);
}

/**
 * Open a part's words for typing: on the canvas where they can be, else in
 * the side panel's WORDS box (a part with no words yet, or words drawn in
 * several places). Returns where they opened.
 */
export function openWords(id: string): "canvas" | "panel" | null {
  const s = useStudio.getState();
  const n = s.nodes.find((x) => x.id === id);
  if (!n || n.locked) return null;
  s.setSelection([id]);
  if (canEditInPlace(n)) { setEditing(id); return "canvas"; }
  if (getFeature(n.featureId)?.content || plain(n.content).trim()) {
    s.want({ panel: "inspector", focus: "words", id });
    return "panel";
  }
  return null;
}

/* ------------------------------------------------------------ the runs in the box */

/** The look a run wears while it is being typed: its own face, size, ink, weight and slant, nothing that moves. */
function runStyle(s: Span): string {
  const bits: string[] = [];
  if (s.face) { const name = s.face.replace(/['"]/g, "").trim(); bits.push(`font-family:${FAMILY[name] ?? `'${name}'`}`); }
  if (typeof s.size === "number" && s.size > 0) bits.push(`font-size:${s.size}px`);
  if (s.colour && !/^(bg|surface|text|muted|accent|highlight)$/.test(s.colour)) bits.push(`color:${s.colour}`);
  if (typeof s.weight === "number") bits.push(`font-weight:${s.weight}`);
  if (s.italic) bits.push("font-style:italic");
  return bits.join(";");
}

/** The runs written into the box by hand: React never reconciles text a person is typing into. */
function paint(el: HTMLElement, words: StudioNode["content"] | undefined) {
  el.textContent = "";
  for (const s of spansOf(words)) {
    const style = runStyle(s);
    if (!style) { el.appendChild(document.createTextNode(s.text)); continue; }
    const span = document.createElement("span");
    span.setAttribute("style", style);
    span.setAttribute("data-run", "");
    span.textContent = s.text;
    el.appendChild(span);
  }
}

/** The words in the box as typed: text nodes in order, a <br> the browser put in as a line break. */
function textOf(el: HTMLElement): string {
  let out = "";
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) { out += n.textContent ?? ""; return; }
    if (n.nodeName === "BR") { out += "\n"; return; }
    n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out.replace(/\n$/, "");
}

/** How far into the typed words a point of the selection is. */
function offsetOf(el: HTMLElement, node: Node, offset: number): number {
  let at = 0;
  let found = false;
  const walk = (n: Node) => {
    if (found) return;
    if (n === node) {
      if (n.nodeType === Node.TEXT_NODE) at += offset;
      else for (let i = 0; i < offset && i < n.childNodes.length; i++) at += textOf(n.childNodes[i] as HTMLElement).length + (n.childNodes[i]!.nodeName === "BR" ? 1 : 0);
      found = true;
      return;
    }
    if (n.nodeType === Node.TEXT_NODE) { at += (n.textContent ?? "").length; return; }
    if (n.nodeName === "BR") { at += 1; return; }
    n.childNodes.forEach(walk);
  };
  walk(el);
  return at;
}

/** The highlighted stretch of the typed words, as offsets, or null when the selection is not in the box. */
function highlighted(el: HTMLElement): [number, number] | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
  const a = offsetOf(el, r.startContainer, r.startOffset), b = offsetOf(el, r.endContainer, r.endOffset);
  return [Math.min(a, b), Math.max(a, b)];
}

/** The caret put back round a stretch of the typed words. */
function highlight(el: HTMLElement, a: number, b: number) {
  const point = (want: number): [Node, number] => {
    let at = 0;
    let out: [Node, number] | null = null;
    const walk = (n: Node) => {
      if (out) return;
      if (n.nodeType === Node.TEXT_NODE) {
        const len = (n.textContent ?? "").length;
        if (want <= at + len) { out = [n, want - at]; return; }
        at += len;
        return;
      }
      if (n.nodeName === "BR") { at += 1; return; }
      n.childNodes.forEach(walk);
    };
    walk(el);
    return out ?? [el, el.childNodes.length];
  };
  const range = document.createRange();
  const [sn, so] = point(a), [en, eo] = point(b);
  range.setStart(sn, so);
  range.setEnd(en, eo);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/* ------------------------------------------------------------ the editor */

interface Spot { x: number; y: number; w: number; h: number; style: React.CSSProperties; px: number }

/**
 * Drawn inside the board's zoomed layer, so it scales with the page: its
 * place is the words' own box, read back off the drawn part.
 */
export function WordsInPlace({ zoom }: { zoom: number }) {
  const id = useEditingWords();
  const node = useStudio((s) => (id ? s.nodes.find((n) => n.id === id) ?? null : null));
  const [spot, setSpot] = React.useState<Spot | null>(null);
  const [range, setRange] = React.useState<[number, number] | null>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const bar = React.useRef<HTMLDivElement>(null);
  const hidden = React.useRef<HTMLElement | null>(null);
  const done = React.useRef(false);
  const committed = React.useRef(false);
  /* The stretch the bar works on: the box's last selection, kept because the box loses it to the bar's own controls. */
  const held = React.useRef<[number, number] | null>(null);

  /* Where the words are, in the page's own pixels, and how they are set. */
  React.useLayoutEffect(() => {
    done.current = false;
    committed.current = false;
    held.current = null;
    setRange(null);
    if (!id || !node) { setSpot(null); return; }
    const el = wordsElement(id);
    const root = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
    if (!el || !root) { setEditing(null); return; }
    const r = el.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    const cs = getComputedStyle(el);
    setSpot({
      x: node.x + (r.left - o.left) / zoom,
      y: node.y + (r.top - o.top) / zoom,
      w: Math.max(24, r.width / zoom),
      h: Math.max(12, r.height / zoom),
      px: parseFloat(cs.fontSize) || 16,
      style: {
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight as React.CSSProperties["fontWeight"],
        fontStyle: cs.fontStyle, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight,
        textTransform: cs.textTransform as React.CSSProperties["textTransform"], textAlign: cs.textAlign as React.CSSProperties["textAlign"],
        color: cs.color, caretColor: cs.color,
      },
    });
    /* The drawn words step aside while their copy is being typed over them. */
    hidden.current = el;
    el.style.visibility = "hidden";
    return () => { if (hidden.current) hidden.current.style.visibility = ""; hidden.current = null; };
    // Measured once per opening: typing must not move the box under the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* The caret goes in at the end, with everything chosen, ready to be typed over or added to. */
  React.useEffect(() => {
    const el = box.current;
    if (!spot || !el) return;
    /* Written once, by hand, run by run: React never reconciles text a person is typing into. */
    paint(el, useStudio.getState().nodes.find((n) => n.id === id)?.content);
    const take = () => {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };
    take();
    /* And again once the press that opened it has finished with the focus. */
    const f = requestAnimationFrame(() => { if (document.activeElement !== el && !done.current) take(); });
    return () => cancelAnimationFrame(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  /* What is highlighted, so the bar shows for a stretch and says what it wears. */
  React.useEffect(() => {
    if (!spot) return;
    const read = () => {
      const el = box.current;
      if (!el || document.activeElement !== el) return;
      const got = highlighted(el);
      held.current = got;
      setRange(got && got[1] > got[0] ? got : null);
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [spot]);

  const finish = React.useCallback((keep: boolean) => {
    if (done.current || !id) return;
    done.current = true;
    const s = useStudio.getState();
    const n = s.nodes.find((x) => x.id === id);
    const typed = box.current ? textOf(box.current) : "";
    if (keep && n && typed !== plain(n.content)) {
      if (!committed.current) s.commit();   // one step of undo for the whole edit
      s.updateNodeQuiet(id, { content: reword(n.content, typed) });
      play("confirm");
    }
    setEditing(null);
  }, [id]);

  /**
   * The highlighted words given a look. What was typed so far lands first
   * (`reword`, so the runs round it keep theirs), then the stretch is
   * restyled, and the box is painted again with the caret back round it.
   */
  const apply = React.useCallback((look: RunLook, refocus = true) => {
    const el = box.current;
    const stretch = held.current;
    if (!id || !el || !stretch || stretch[1] <= stretch[0]) return;
    const s = useStudio.getState();
    const n = s.nodes.find((x) => x.id === id);
    if (!n) return;
    if (!committed.current) { s.commit(); committed.current = true; }
    const typed = textOf(el);
    const words = restyle(typed === plain(n.content) ? n.content : reword(n.content, typed), stretch[0], stretch[1], look);
    s.updateNodeQuiet(id, { content: words });
    paint(el, words);
    held.current = stretch;
    setRange([stretch[0], stretch[1]]);
    if (refocus) { el.focus(); highlight(el, stretch[0], stretch[1]); }
    /* The part draws its words again for the new runs, as a new element: that one steps aside too. */
    requestAnimationFrame(() => {
      if (done.current) return;
      const drawn = wordsElement(id);
      if (drawn && drawn !== hidden.current) { if (hidden.current) hidden.current.style.visibility = ""; hidden.current = drawn; drawn.style.visibility = "hidden"; }
    });
    play("confirm");
  }, [id]);

  /* A press anywhere else keeps the words: the board takes the pointer, so blur alone is not enough. */
  React.useEffect(() => {
    if (!spot) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (bar.current?.contains(t)) return;
      if (!box.current?.contains(t)) finish(true);
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [spot, finish]);

  if (!id || !node || !spot) return null;
  return (
    <>
      <div
        ref={box}
        data-words-in-place={id}
        role="textbox"
        aria-label={`Words of ${partName(node)}`}
        aria-multiline="true"
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck={false}
        onPointerDown={(e) => e.stopPropagation()}
        /* Focus handed to something else keeps the words, unless it went to
           the bar over them. A blur to nowhere (the press that opened it, the
           window losing focus) does not: a press elsewhere is caught above. */
        onBlur={(e) => { if (e.relatedTarget && !bar.current?.contains(e.relatedTarget as Node)) finish(true); }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") { e.preventDefault(); finish(false); }
          else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); }
          else if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) { e.preventDefault(); toggle(apply, held.current, node, "weight"); }
          else if ((e.metaKey || e.ctrlKey) && (e.key === "i" || e.key === "I")) { e.preventDefault(); toggle(apply, held.current, node, "italic"); }
        }}
        className="pointer-events-auto absolute z-40 whitespace-pre-wrap break-words outline-none"
        style={{
          left: spot.x, top: spot.y, minWidth: spot.w, minHeight: spot.h,
          ...spot.style,
          userSelect: "text", WebkitUserSelect: "text", cursor: "text",
          boxShadow: `0 0 0 ${(1.5 / zoom).toFixed(2)}px oklch(0.75 0.15 205)`,
          borderRadius: 2,
        }}
      />
      {range ? <WordsBar ref={bar} node={node} range={range} spot={spot} zoom={zoom} apply={apply} /> : null}
    </>
  );
}

/** Bold or italic flipped on the highlighted stretch, as a document does on Ctrl+B / Ctrl+I. */
function toggle(apply: (look: RunLook, refocus?: boolean) => void, stretch: [number, number] | null, node: StudioNode, what: "weight" | "italic") {
  if (!stretch || stretch[1] <= stretch[0]) return;
  const now = lookIn(node.content, stretch[0], stretch[1]);
  if (what === "italic") apply({ italic: now.italic ? null : true });
  else apply({ weight: now.weight === 700 ? null : 700 });
}

/* ------------------------------------------------------------ the bar over highlighted words */

interface BarProps { node: StudioNode; range: [number, number]; spot: Spot; zoom: number; apply: (look: RunLook, refocus?: boolean) => void }

const WordsBar = React.forwardRef<HTMLDivElement, BarProps>(function WordsBar({ node, range, spot, zoom, apply }, ref) {
  const nodes = useStudio((s) => s.nodes);
  const pages = useStudio((s) => s.pages);
  const carried = useStudio((s) => s.look.fonts);
  /* The site's faces in page order, the ones it carries, then the app's own families: what the Font control offers, and the families beside them. */
  const faces = React.useMemo(() => [...new Set([
    ...fontsInPageOrder(nodes, pages.map((p) => p.id)).map((f) => f.key).filter(Boolean),
    ...(carried ?? []).map((f) => f.family),
    ...Object.keys(FAMILY),
  ])], [carried, nodes, pages]);
  const now = lookIn(node.content, range[0], range[1]);
  const face = now.face ?? "";
  const size = typeof now.size === "number" ? now.size : null;
  const colour = typeof now.colour === "string" && /^(#|rgb|hsl|oklch)/i.test(now.colour) ? now.colour : "";
  const bold = (now.weight ?? 0) >= 600;
  const italic = !!now.italic;
  const key = "inline-flex h-7 items-center rounded-sm border border-border bg-elevated px-2 text-small text-fg hover:bg-surface";
  return (
    <div
      ref={ref}
      data-words-bar={node.id}
      role="toolbar"
      aria-label="Highlighted words"
      className="pointer-events-auto absolute z-50 flex items-center gap-1 rounded-md border border-border bg-elevated p-1 shadow-md"
      style={{ left: spot.x, top: spot.y - 6 / zoom, transform: `translateY(-100%) scale(${1 / zoom})`, transformOrigin: "left bottom", whiteSpace: "nowrap" }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); }}
    >
      <select
        aria-label="Font of the highlighted words"
        className="h-7 max-w-40 rounded-sm border border-border bg-elevated px-1 text-small text-fg"
        value={faces.includes(face) ? face : ""}
        onChange={(e) => apply({ face: e.target.value || null })}
      >
        <option value="">The part's font</option>
        {faces.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <input
        type="number"
        aria-label="Size of the highlighted words in pixels"
        className="h-7 w-16 rounded-sm border border-border bg-elevated px-1.5 text-small text-fg"
        placeholder={String(Math.round(spot.px))}
        value={size ?? ""}
        min={6}
        max={400}
        onChange={(e) => { const px = Number(e.target.value); apply({ size: e.target.value === "" ? null : Number.isFinite(px) && px > 0 ? px : undefined }, false); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); apply({}, true); } }}
      />
      <span className="text-small text-fg-muted">px</span>
      <input
        type="color"
        aria-label="Colour of the highlighted words"
        className="h-7 w-8 cursor-pointer rounded-sm border border-border bg-transparent"
        value={colour && colour.startsWith("#") ? colour : "#000000"}
        onInput={(e) => apply({ colour: (e.target as HTMLInputElement).value }, false)}
      />
      <button type="button" aria-label="Bold" aria-pressed={bold} className={`${key} font-bold ${bold ? "bg-surface" : ""}`} onPointerDown={(e) => e.preventDefault()} onClick={() => apply({ weight: bold ? null : 700 })}>B</button>
      <button type="button" aria-label="Italic" aria-pressed={italic} className={`${key} italic ${italic ? "bg-surface" : ""}`} onPointerDown={(e) => e.preventDefault()} onClick={() => apply({ italic: italic ? null : true })}>I</button>
      <button type="button" aria-label="Plain: the part's own look" className={key} onPointerDown={(e) => e.preventDefault()} onClick={() => apply({ face: null, size: null, colour: null, weight: null, italic: null })}>Plain</button>
    </div>
  );
});
