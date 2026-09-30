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
 */
import * as React from "react";
import { useStudio, type StudioNode } from "./store";
import { plain, reword } from "./parts/spans";
import { getFeature } from "./catalog";
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

/** Close the words, keeping what was typed. */
export function stopEditingWords() { setEditing(null); }

/* ------------------------------------------------------------ the editor */

interface Spot { x: number; y: number; w: number; h: number; style: React.CSSProperties }

/**
 * Drawn inside the board's zoomed layer, so it scales with the page: its
 * place is the words' own box, read back off the drawn part.
 */
export function WordsInPlace({ zoom }: { zoom: number }) {
  const id = useEditingWords();
  const node = useStudio((s) => (id ? s.nodes.find((n) => n.id === id) ?? null : null));
  const [spot, setSpot] = React.useState<Spot | null>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const hidden = React.useRef<HTMLElement | null>(null);
  const done = React.useRef(false);

  /* Where the words are, in the page's own pixels, and how they are set. */
  React.useLayoutEffect(() => {
    done.current = false;
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
    /* Written once, by hand: React never reconciles text a person is typing into. */
    el.textContent = plain(useStudio.getState().nodes.find((n) => n.id === id)?.content);
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

  const finish = React.useCallback((keep: boolean) => {
    if (done.current || !id) return;
    done.current = true;
    const s = useStudio.getState();
    const n = s.nodes.find((x) => x.id === id);
    const typed = (box.current?.innerText ?? "").replace(/\n$/, "");
    if (keep && n && typed !== plain(n.content)) {
      s.commit();   // one step of undo for the whole edit
      s.updateNodeQuiet(id, { content: reword(n.content, typed) });
      play("confirm");
    }
    setEditing(null);
  }, [id]);

  /* A press anywhere else keeps the words: the board takes the pointer, so blur alone is not enough. */
  React.useEffect(() => {
    if (!spot) return;
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) finish(true); };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [spot, finish]);

  if (!id || !node || !spot) return null;
  return (
    <div
      ref={box}
      data-words-in-place={id}
      role="textbox"
      aria-label={`Words of ${node.label}`}
      aria-multiline="true"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      /* Focus handed to something else keeps the words. A blur to nowhere (the
         press that opened it, the window losing focus) does not: a press
         elsewhere is caught above. */
      onBlur={(e) => { if (e.relatedTarget) finish(true); }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
        else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); }
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
  );
}
