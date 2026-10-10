"use client";
/**
 * THE EMBED BOX: WHERE A PART'S EMBED LINK IS PASTED.
 *
 * J (2026-10-10): "when i drop an embed on a part and click on a part a box
 * with a link for the embed should pop up as well as when i pick the part to
 * put an embed in". Every way Embed lands on a part (dropped from the shelf,
 * Add with the part picked, Add then pressing the part) picks that part, and
 * a picked part that shows another page (the Embed effect, or a frame an
 * import found, `node.embed`) gets this box beside it on the board.
 *
 * It holds the link (a link, or the whole `<iframe>` code a site gives), a
 * live look at it, the DexScreener chart as the default, and a plain note
 * when the page refuses to be shown inside another site (`embedLink.ts`
 * knows the usual ones; `/api/studio/embed-check` asks the page itself) or
 * when the site's own rules do not allow it (PonsStars: DexScreener only).
 * Preview and Publish take the link from the part: the Embed effect's
 * Address, or the frame's own `src`.
 */
import * as React from "react";
import { X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { useStudio, type StudioNode } from "./board/store";
import { usesOf, withInput, withoutWork } from "./shelf";
import type { StyleSource } from "./send-out";
import { DEFAULT_EMBED, knownRefusal, readEmbed, refusalSays, siteRefusal } from "./embedLink";

/** The link a part shows: its Embed effect's Address, else the frame an import found. */
export function embedOf(node: Pick<StudioNode, "work" | "embed"> | null | undefined): { kind: "work" | "frame"; src: string } | null {
  if (!node) return null;
  const use = usesOf(node.work).find((u) => u.id === "embed");
  if (use) return { kind: "work", src: (use.inputs?.url ?? "").trim() };
  if (node.embed) return { kind: "frame", src: (node.embed.src ?? "").trim() };
  return null;
}

/** Set the link a part shows; a frame an import found keeps the address it came with in `was`, so Publish can ask for the change. */
export function setEmbed(nodeId: string, src: string) {
  const st = useStudio.getState();
  const node = st.nodes.find((n) => n.id === nodeId);
  const e = embedOf(node);
  if (!node || !e) return;
  if (e.kind === "work") st.updateNode(nodeId, { work: withInput(node.work, "embed", "url", src) });
  else st.updateNode(nodeId, { embed: { ...node.embed!, src, was: node.embed!.was ?? node.embed!.src } });
}

const checked = new Map<string, Promise<{ refuses: boolean | null; says?: string }>>();
function askPage(src: string) {
  let p = checked.get(src);
  if (!p) {
    p = fetch(`/api/studio/embed-check?url=${encodeURIComponent(src)}`).then((r) => r.json()).catch(() => ({ refuses: null }));
    checked.set(src, p);
  }
  return p;
}

const W = 340;

export function EmbedBox() {
  const mode = useStudio((s) => s.mode);
  const picked = useStudio((s) => (s.selection.length === 1 ? s.nodes.find((n) => n.id === s.selection[0]) ?? null : null));
  const rules = useStudio((s) => (s.look as { styleSource?: StyleSource | null }).styleSource?.kit?.rules?.embeds ?? null);
  const siteName = useStudio((s) => (s.look as { styleSource?: StyleSource | null }).styleSource?.kit?.name ?? "This site");
  const [shut, setShut] = React.useState<string | null>(null);
  const embed = embedOf(picked);
  const open = mode === "design" && !!picked && !!embed && shut !== picked.id;
  const id = picked?.id ?? null;
  const src = embed?.src ?? "";

  const [draft, setDraft] = React.useState("");
  const [answer, setAnswer] = React.useState<{ src: string; refuses: boolean | null } | null>(null);
  const [at, setAt] = React.useState<{ left: number; top: number } | null>(null);
  const box = React.useRef<HTMLDivElement>(null);

  /* A new part picked: the box opens again, and shows its link. An Embed just put on, with no link yet, starts on the DexScreener chart. */
  React.useEffect(() => { if (shut && shut !== id) setShut(null); }, [id, shut]);
  React.useEffect(() => {
    if (!open || !id) return;
    if (!src) { setEmbed(id, DEFAULT_EMBED); setDraft(DEFAULT_EMBED); return; }
    setDraft(src);
  }, [open, id]);
  React.useEffect(() => { if (open && src) setDraft((d) => (d === "" ? src : d)); }, [open, src]);

  /* Beside the part on the board, following it as the board scrolls: under it, else above, else at the window's edge. */
  React.useEffect(() => {
    if (!open || !id) { setAt(null); return; }
    let raf = 0;
    const place = () => {
      const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      const h = box.current?.offsetHeight ?? 300;
      if (el instanceof HTMLElement) {
        const r = el.getBoundingClientRect();
        const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
        const below = r.bottom + 10;
        const top = below + h < window.innerHeight - 8 ? below : r.top - h - 10 > 8 ? r.top - h - 10 : Math.max(8, window.innerHeight - h - 8);
        setAt((p) => (p && p.left === left && p.top === top ? p : { left, top }));
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [open, id]);

  /* Ask the page itself whether it lets other sites show it, once per link. */
  React.useEffect(() => {
    if (!open || !src) return;
    let live = true;
    askPage(src).then((a) => { if (live) setAnswer({ src, refuses: a.refuses }); });
    return () => { live = false; };
  }, [open, src]);

  React.useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && id) { setShut(id); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, id]);

  if (!open || !picked || !embed) return null;
  const read = readEmbed(draft);
  const changed = read.ok && read.src !== src;
  const apply = () => {
    if (!read.ok || !id) return;
    setEmbed(id, read.src);
    setDraft(read.src);
    play("confirm");
  };
  const remove = () => {
    if (!id) return;
    if (embed.kind === "work") useStudio.getState().updateNode(id, { work: withoutWork(picked.work, "embed") });
    else useStudio.getState().updateNode(id, { embed: null });
    play("select");
  };
  const showing = src;
  const known = showing ? knownRefusal(showing) : null;
  const checkedNo = !known && answer?.src === showing && answer.refuses === true ? refusalSays(hostName(showing)) : null;
  const ruleNo = showing ? siteRefusal(showing, rules, siteName) : null;

  return (
    <div
      ref={box}
      data-embed-box={id ?? ""}
      role="dialog"
      aria-label="Embed link"
      className="fixed z-[2147483601] rounded-lg border border-border bg-panel p-3 text-fg shadow-xl"
      style={{ width: W, left: at?.left ?? -9999, top: at?.top ?? -9999 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-small font-medium">Embed: what this part shows</span>
        <button type="button" aria-label="Close the embed box" data-embed-close="" onClick={() => id && setShut(id)} className="tactile rounded-sm p-0.5 text-fg-faint hover:text-fg">
          <X className="size-3.5" />
        </button>
      </div>
      <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); apply(); }}>
        <input
          data-embed-input=""
          aria-label="Embed link"
          value={draft}
          placeholder="https://… or the embed code"
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            const r = readEmbed(t);
            if (r.ok && id) { e.preventDefault(); setDraft(r.src); setEmbed(id, r.src); play("confirm"); }
          }}
          className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-small text-fg outline-none focus:border-fg-faint"
        />
        <button type="submit" data-embed-apply="" disabled={!changed} className="tactile rounded-md border border-border px-2 py-1 text-small font-medium disabled:opacity-40">
          Show it
        </button>
      </form>
      {!read.ok && draft.trim() ? <p data-embed-note="bad" className="mt-1.5 text-fine leading-snug text-amber-300">{read.says}</p> : null}
      {read.ok && read.note && changed ? <p data-embed-note="player" className="mt-1.5 text-fine leading-snug text-fg-muted">{read.note}</p> : null}
      <div className="mt-2 overflow-hidden rounded-md border border-border bg-black/30" style={{ height: 190 }}>
        {showing ? (
          <iframe
            key={showing}
            data-embed-frame=""
            src={showing}
            title="How the embed looks"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
            referrerPolicy="no-referrer"
            loading="lazy"
            style={{ display: "block", width: "100%", height: "100%", border: 0 }}
          />
        ) : null}
      </div>
      {known || checkedNo ? <p data-embed-note="refuses" className="mt-1.5 text-fine leading-snug text-amber-300">{known ?? checkedNo}</p> : null}
      {ruleNo ? <p data-embed-note="site-rule" className="mt-1.5 text-fine leading-snug text-amber-300">{ruleNo}</p> : null}
      <p className="mt-1.5 text-fine leading-snug text-fg-faint">
        Most players and charts made to be embedded work (DexScreener, YouTube, maps, Spotify). Many sites refuse to be shown inside another page. Preview shows it live, and Publish sends it.
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          data-embed-default=""
          disabled={showing === DEFAULT_EMBED}
          onClick={() => { if (id) { setEmbed(id, DEFAULT_EMBED); setDraft(DEFAULT_EMBED); play("confirm"); } }}
          className="tactile rounded-md border border-border px-2 py-1 text-fine font-medium disabled:opacity-40"
        >
          DexScreener chart
        </button>
        <span className="flex-1" />
        <button type="button" data-embed-remove="" onClick={remove} className="tactile rounded-md px-2 py-1 text-fine text-fg-faint hover:text-fg">
          Take the embed off
        </button>
      </div>
    </div>
  );
}

function hostName(src: string) {
  try { return new URL(src).hostname.replace(/^www\./, ""); } catch { return "That site"; }
}
