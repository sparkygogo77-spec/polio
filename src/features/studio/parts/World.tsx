"use client";
/**
 * A CANVAS WORLD'S CHARACTERS, PRESSABLE (sink `node.world`, worlds.mjs).
 *
 * parasiteonsol.fun's hero is a field of pets its script walks on a canvas;
 * pressing one opens that coin's dialog. The capture keeps the canvas as a
 * flipbook (an svg of its frames) and, per character, where it stood in each
 * frame and the dialog it opened, dressed in the page's own look. This draws,
 * over the flipbook, one invisible press area per character that follows it
 * frame by frame, and the dialogs themselves, closed. Opening and closing is
 * the `world-dialogs` feature (library/behaviours.ts), so the Preview and the
 * published page run the same few lines.
 *
 * The areas are placed in a box the shape of the canvas laid over the part
 * the way the picture is (`object-fit: cover`), so they stay on the pets at
 * any width. Each moves with a step-end animation as long as the flipbook,
 * one keyframe per frame; the feature starts both clocks together. Where
 * characters overlap the smaller is on top, as the page's own hit test
 * prefers the smaller.
 *
 * The dialogs are the page's markup, cleaned again here (no script, no
 * handler, no `javascript:` address, no frame, and no link off the site:
 * an exchange, an explorer or a share intent is an inert control with the
 * address in `data-world-offsite`; only a path on the site stays a link): every button and field
 * keeps its words and attributes and is marked `data-world-control`, with
 * what pressing it did on the page (`data-world-does`, replayed by the
 * feature); what needed a wallet or a server stays a hook for a backend. Their ids are made the part's own, so two worlds on a page
 * never share one. Nothing here reads the store: props only, as every part.
 */
import * as React from "react";
import { DEFAULT_OFFSITE, isOffsite, linkAllowed, offsiteRules, type OffsiteRules } from "./offsite";

export interface NodeWorld {
  /** How long each frame stands, ms. */
  every: number;
  /** How many frames the flipbook has. */
  frames: number;
  chars: WorldChar[];
  dialogs: { html: string; backdrop?: string }[];
  /** Class -> the CSS it stands for (`sw3`); `sw3-b` is its ::before, `-a` ::after, `-m` ::marker, `-p` ::placeholder. */
  css: Record<string, string>;
  /** Drawn again live instead of played back, when the capture read what it is made of. */
  stage?: WorldStage | null;
}

/**
 * A SPRITE WORLD (sink worlds.mjs `stage`): what a canvas world is made of,
 * rather than frames of it, so it is drawn again live and at any width, as the
 * page drew it (`library/stageEngine.ts`). In art pixels: the canvas's own
 * pixels, drawn `px` CSS pixels each (the page's scale at each window width it
 * was seen at, `scaleAt`).
 */
export interface WorldStage {
  /** CSS px per art px as captured, and [window width, px] as the page chose it at each width seen. */
  px: number;
  scaleAt?: [number, number][];
  /** The canvas's art size as captured. */
  art: { w: number; h: number };
  /** Pictures, as data addresses: the sprite sheet and the scenes' backgrounds. */
  images: string[];
  /** A sprite: [image, sx, sy, sw, sh]. */
  sprites: Record<string, [number, number, number, number, number]>;
  scenes: StageScene[];
  /** The scene shown as the page opens. */
  start?: number;
  /** How a character's label is drawn: its face, words, fill, edge, height. */
  label?: { font: string; fg: string; bg: string; edge?: string; h: number; pad: number };
  /** How the characters wander: art px a second, the pause at a turn (s), how often one stops on its own (a second). */
  motion?: { speed: number; pause: [number, number]; stop: number };
  fps?: number;
}
export interface StageScene {
  name?: string;
  /** The fill behind everything. */
  sky?: string | null;
  /** The part (by id) or element (by selector) that switches to this scene. */
  tab?: string | null;
  /** Backgrounds, back to front: a piece of an image, stood `bottom` art px above the foot, repeated across or placed from one side. */
  layers: { img: number; sx: number; sy: number; sw: number; sh: number; w: number; h: number; bottom: number; repeat: boolean; side: "left" | "right" | "centre"; x: number }[];
  /** Things that stand still and flicker (a chest, a fire): their frames, each shown `every` ms. */
  props: { frames: string[]; every: number; side: "left" | "right"; x: number; bottom: number }[];
}
export interface WorldChar {
  /** What the dialog says the character is: an id-like attribute of it, then its heading. */
  key: string;
  name?: string;
  /** Per frame, [x, y, w, h] as fractions of the canvas box; null where it was not found. */
  boxes: ([number, number, number, number] | null)[];
  dialog?: number;
  /** A place on this site the press went to, by its path: the one kind of link a copy carries. */
  href?: string;
  /** An address off the site the press went to: never a link here, kept for a backend. */
  offsite?: string;
  /* In a sprite world (`stage`): */
  /** Its scene. */
  scene?: number;
  /** Its sprite facing right and facing left (one alone is mirrored for the other), and the way it faced as captured. */
  sprite?: { r?: string; l?: string };
  /** Its home across the scene, a share of the width; how far it wanders either side, a share too. */
  at?: number;
  range?: number;
  /** Its foot, art px above the scene's foot. */
  foot?: number;
  /** Its own pace, art px a second, when it had one. */
  speed?: number;
  /** The character it rides (a parasite on its host), and where on it: [dx, dy] from the host's top left, as the host faced `face`. */
  rides?: number;
  ride?: [number, number];
  face?: 1 | -1;
  /** The words drawn over it. */
  label?: string;
}

/** A path on this site (`/coins`, `/h/…`), and not an address somewhere else. */
export function onSite(href: string | undefined | null): href is string {
  return typeof href === "string" && /^\/(?!\/)/.test(href.trim());
}

export function isWorld(v: unknown): v is NodeWorld {
  const w = v as NodeWorld | null;
  return !!w && typeof w === "object" && Array.isArray(w.chars) && Array.isArray(w.dialogs) && Number(w.every) > 0 && Number(w.frames) > 0;
}

/** The page's markup made safe to put in ours: nothing in it runs. */
export function cleanDialog(html: string, rules: OffsiteRules = offsiteRules(DEFAULT_OFFSITE)): string {
  return String(html)
    .replace(/<(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|style|iframe|object|embed|template|noscript|link|meta|base)\b[^>]*>/gi, "")
    /* Inside each tag only, so words in the dialog are never touched. */
    .replace(/<[a-zA-Z][^>]*>/g, (tag) => tag
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(href|src|xlink:href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi, "")
      .replace(/\s(action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ""))
    /*
     * A link off the site stays a link only where the site's allow-list says (`parts/offsite.ts`); otherwise it is
     * an inert control saying where it went. sink leaves every off-site one inert with its address, so an allowed
     * one is given back its address here, and a control that opened an allowed address opens it again.
     */
    .replace(/<([a-z][a-z0-9-]*)\b[^>]*>/gi, (tag, name: string) => {
      const get = (a: string) => { const m = new RegExp(`\\s${a}\\s*=\\s*"([^"]*)"`, "i").exec(tag); return m ? m[1]!.replace(/&amp;/g, "&").replace(/&quot;/g, '"') : null; };
      const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      const drop = (t: string, ...names: string[]) => names.reduce((x, a) => x.replace(new RegExp(`\\s${a}\\s*=\\s*"[^"]*"`, "gi"), ""), t);
      const put = (t: string, at: string) => t.replace(/^<([a-z][a-z0-9-]*)\b/i, `<$1 ${at}`);
      const isA = name.toLowerCase() === "a";
      const href = isA ? get("href") : null;
      const off = get("data-world-offsite") ?? (href && isOffsite(href) ? href : null);
      /* A Share the page ran for its own page (the share sheet): allowed by `share:own`. */
      if (!off && get("data-world-does") === "hook" && get("data-world-share")) {
        let url = ""; try { url = String(JSON.parse(get("data-world-share")!).url ?? ""); } catch { url = ""; }
        return rules.shareOwn && url.startsWith("/") && !url.startsWith("//") ? drop(tag, "data-world-does").replace(/^<([a-z][a-z0-9-]*)\b/i, `<$1 data-world-does="share"`) : tag;
      }
      if (!off) return tag;
      if (linkAllowed(off, rules)) {
        if (isA) return put(drop(tag, "href", "target", "rel", "data-world-does", "data-world-hook", "data-world-offsite").replace(/\srole="link"/i, ""), `href="${esc(off)}" target="_blank" rel="noopener"`);
        return put(drop(tag, "data-world-does", "data-world-href", "data-world-target", "data-world-allowed"), `data-world-does="link" data-world-href="${esc(off)}" data-world-target="_blank" data-world-allowed=""`);
      }
      let t = drop(tag, "href", "target", "rel", "data-world-offsite", "data-world-href", "data-world-allowed");
      t = put(t, `data-world-offsite="${esc(off)}"`);
      if (get("data-world-does") !== "hook") t = put(drop(t, "data-world-does", "data-world-hook"), `data-world-does="hook" data-world-hook="goes off the site"`);
      if (isA && !get("role")) t = put(t, `role="link"`);
      return t;
    });
}

/** Every id in the dialog made its own (`p` in front), and every attribute that names one. */
function ownIds(html: string, p: string): string {
  const ids = new Set<string>();
  html.replace(/\sid="([^"]+)"/g, (_, id: string) => { ids.add(id); return ""; });
  if (!ids.size) return html;
  const one = (id: string) => (ids.has(id) ? `${p}${id}` : id);
  return html
    .replace(/\sid="([^"]+)"/g, (_, id: string) => ` id="${one(id)}"`)
    .replace(/\s(aria-labelledby|aria-describedby|aria-controls|aria-owns|for|list|form)="([^"]+)"/g, (_, a: string, v: string) => ` ${a}="${v.split(/\s+/).map(one).join(" ")}"`)
    .replace(/\shref="#([^"]+)"/g, (m, id: string) => (ids.has(id) ? ` href="#${p}${id}"` : m));
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The dialog as it is put in the page: a <dialog>, named for its press areas, its ids its own. */
export function dialogMarkup(html: string, k: number, key: string, part: string, rules?: OffsiteRules): string {
  let h = ownIds(cleanDialog(html, rules).trim(), `${part}-w${k}-`);
  if (!/^<dialog\b/i.test(h)) h = `<dialog style="padding:0;border:0;background:transparent;max-width:none;max-height:none;overflow:visible">${h}</dialog>`;
  return h.replace(/^<dialog\b/i, `<dialog data-world-dialog="${k}" data-world-key="${attr(key)}"`);
}

const r3 = (v: number) => Math.round(v * 100000) / 1000;

/** The rules: the page's looks scoped to this world, each area's walk, and each dialog's backdrop. */
export function worldCss(world: NodeWorld, scope: string): string {
  const out: string[] = [];
  const S = `[data-part-world="${scope}"]`;
  const used = new Set<string>();
  /* Worn as a class, or named in what a press changes (`data-world-change`). */
  for (const d of world.dialogs) for (const m of d.html.matchAll(/\bsw[0-9a-z]+(?:-[bamp])?\b/g)) used.add(m[0]);
  for (const c of used) {
    const m = /^(sw[a-z0-9]+)(?:-([bamp]))?$/.exec(c);
    if (!m || !world.css[m[1]!]) continue;
    const pseudo = { b: "::before", a: "::after", m: "::marker", p: "::placeholder" }[m[2] ?? ""] ?? "";
    /* Values only, and never a closing brace: a look is a list of declarations. */
    const body = world.css[m[1]!]!.replace(/[{}<]/g, "");
    out.push(`${S} .${c}${pseudo}{${body}}`);
  }
  world.dialogs.forEach((d, k) => { if (d.backdrop) out.push(`${S} dialog[data-world-dialog="${k}"]::backdrop{${d.backdrop.replace(/[{}<]/g, "")}}`); });
  const total = world.every * world.frames;
  /* A sprite world's areas are placed by its engine, frame by frame, as it draws. */
  if (world.stage) return out.join("\n");
  world.chars.forEach((c, k) => {
    const steps: string[] = [];
    for (let f = 0; f < world.frames; f++) {
      const b = c.boxes[f] ?? null;
      const at = r3(f / world.frames);
      steps.push(b ? `${at}%{left:${r3(b[0])}%;top:${r3(b[1])}%;width:${r3(b[2])}%;height:${r3(b[3])}%;visibility:visible}` : `${at}%{visibility:hidden}`);
    }
    const last = c.boxes[world.frames - 1] ?? null;
    steps.push(last ? `100%{left:${r3(last[0])}%;top:${r3(last[1])}%;width:${r3(last[2])}%;height:${r3(last[3])}%;visibility:visible}` : "100%{visibility:hidden}");
    out.push(`@keyframes ${scope}-walk-${k}{${steps.join("")}}`);
    out.push(`${S} [data-world-hit="${k}"]{animation:${scope}-walk-${k} ${Math.round(total)}ms step-end infinite}`);
  });
  return out.join("\n");
}

/** The areas and the dialogs, over a picture of `w` by `h` (the canvas box as captured) drawn to cover its part. */
export function WorldLayer({ world, part, w, h, offsite }: { world: NodeWorld; part: string; w: number; h: number; offsite?: string }) {
  const rules = React.useMemo(() => offsiteRules(offsite ?? DEFAULT_OFFSITE), [offsite]);
  const scope = `w-${part.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const css = React.useMemo(() => worldCss(world, scope), [world, scope]);
  const dialogs = React.useMemo(() => world.dialogs.map((d, k) => {
    const key = world.chars.find((c) => c.dialog === k)?.key ?? String(k);
    return dialogMarkup(d.html, k, key, part, rules);
  }).join(""), [world, part, rules]);
  const W = Math.max(1, w), H = Math.max(1, h);
  /* Smaller on top: the order the page's own hit test prefers. */
  const area = (c: WorldChar) => { const bs = c.boxes.filter(Boolean) as number[][]; return bs.length ? bs.reduce((n, b) => n + b[2]! * b[3]!, 0) / bs.length : 1; };
  const order = world.chars.map((c, k) => ({ c, k, a: area(c) })).sort((p, q) => q.a - p.a);
  return (
    <div data-part-world={scope} style={{ position: "absolute", inset: 0, containerType: "size", overflow: "hidden", pointerEvents: "none" }}>
      <style>{css}</style>
      {world.stage ? (
        <>
          {/* Drawn by the feature, over the captured picture, which stays for a machine that runs no script. */}
          <canvas data-world-canvas="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }} />
          <script type="application/json" data-world-stage="" dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...world.stage, chars: world.chars.map(({ boxes: _b, ...c }) => c) }).replace(/</g, "\\u003c") }} />
        </>
      ) : null}
      <div
        data-world-frame=""
        /* A sprite world's areas stand where its engine draws each character, over the whole part; a flipbook's over the picture as it covers the part. */
        style={world.stage ? { position: "absolute", inset: 0 } : {
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          width: `max(100cqw, calc(100cqh * ${W} / ${H}))`, height: `max(100cqh, calc(100cqw * ${H} / ${W}))`,
        }}
      >
        {order.map(({ c, k }, z) => {
          const name = c.name || c.key;
          const style: React.CSSProperties = { position: "absolute", visibility: "hidden", pointerEvents: "auto", cursor: "pointer", zIndex: z + 1, background: "transparent", border: 0, padding: 0, margin: 0, display: "block" };
          /* A character that went to another page of the site is a link to it; one that went off the site, or opened nothing, is a press that does nothing. */
          if (c.dialog === undefined || !world.dialogs[c.dialog]) {
            const away = c.offsite ?? (c.href && !onSite(c.href) ? c.href : null);
            if (away && linkAllowed(away, rules)) return <a key={k} href={away} target="_blank" rel="noopener" data-world-hit={k} data-world-key={c.key} aria-label={`Open ${name}`} style={style} />;
            return onSite(c.href) ? (
              <a key={k} href={c.href} data-world-hit={k} data-world-key={c.key} aria-label={`Open ${name}`} style={style} />
            ) : (
              <button key={k} type="button" data-world-hit={k} data-world-key={c.key} data-world-offsite={c.offsite ?? c.href} aria-label={name} style={{ ...style, cursor: "default" }} />
            );
          }
          return (
            <button key={k} type="button" data-world-hit={k} data-world-open={c.dialog} data-world-key={c.key} aria-label={`Open ${name}`} aria-haspopup="dialog" style={style} />
          );
        })}
      </div>
      {/* Closed until a press opens one; a shown dialog stands in the page's top layer, over everything, whatever box it is written in. */}
      <div data-world-dialogs="" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "auto" }} dangerouslySetInnerHTML={{ __html: dialogs }} />
    </div>
  );
}
