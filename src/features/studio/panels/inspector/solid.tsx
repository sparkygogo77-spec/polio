"use client";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { pageNodes, useHeldStudio, useStudio, type StudioNode } from "../../board/store";
import { CUBE_SIDES, emptyFace, written } from "../../shelf";
import { makeSolid, showCube, showSolid, solidModel } from "../../solidRun";
import { rendererReady } from "../../loop/run";
import { useKeys } from "@/features/keys/store";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Select } from "@/core/ui/select";
import { partName } from "../../partNames";
import { kindWord } from "../PartTreePanel";
import { Field, featureName } from "./fields";

/** The colours a face may be: the site's, or one of the roles it already has. */
export const FACE_COLOURS = [
  { id: "", label: "site" },
  { id: "surface", label: "surface" },
  { id: "bg", label: "background" },
  { id: "accent", label: "accent" },
  { id: "highlight", label: "highlight" },
  { id: "muted", label: "muted" },
] as const;

export function Faces({ node, palette }: { node: StudioNode; palette: Record<string, string> | null }) {
  const set = useHeldStudio((s) => s.setCubeFace);
  /*
   * Every page but the one the cube is standing on. A surface showing the
   * page it is part of is a mirror, so it is not offered — the cube would
   * draw nothing there and the face would fall back to its words, which
   * looks like a bug rather than a rule.
   */
  const pages = useHeldStudio((s) => s.pages);
  const sites = React.useMemo(() => pages.filter((p) => p.id !== node.pageId), [pages, node.pageId]);
  const picked = useHeldStudio((s) => (s.pickedFace?.nodeId === node.id ? s.pickedFace.side : null));
  const faces = React.useMemo(() => CUBE_SIDES.map((_, i) => node.cube?.faces?.[i] ?? emptyFace()), [node.cube]);
  const filled = written(node.cube);
  /*
   * A face picked on the board is the one the panel is about: its card
   * comes into view and its heading takes the keys, so "pick a face and
   * give it words" is one press and then typing.
   */
  const cards = React.useRef<Record<string, HTMLDivElement | null>>({});
  const was = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!picked || picked === was.current) { was.current = picked; return; }
    was.current = picked;
    const card = cards.current[picked];
    if (!card) return;
    // Picked from the board: bring the card in and hand it the keys. Picked
    // from inside the card, the keys are already where they belong.
    if (card.contains(document.activeElement)) return;
    card.scrollIntoView({ block: "nearest" });
    const input = card.querySelector("input") as HTMLInputElement | null;
    input?.focus({ preventScroll: true });
  }, [picked]);
  return (
    <Field
      label="Faces"
      hint={`${filled} of six written. A face left blank stays blank: nothing is invented for it. Press a face on the cube, or its name here, to pick it. A face given a page becomes that page — the page's own parts on the side of the box, and a press goes there.`}
    >
      <div className="flex flex-col gap-2" data-face-list="">
        {CUBE_SIDES.map((side, i) => {
          const face = faces[i]!;
          const bare = !face.heading.trim() && !face.body.trim() && !face.pageId;
          const on = picked === side;
          return (
            <div
              key={side}
              ref={(el) => { cards.current[side] = el; }}
              data-cube-face={side}
              data-face-picked={on ? "" : undefined}
              className={cn("rounded-md border bg-elevated/40 p-2", on ? "border-accent" : "border-border")}
              // Typing on a face is pointing at it; a press on one of its
              // buttons is not, so the card does not move under the press.
              onFocusCapture={(e) => { if (!on && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) useStudio.getState().pickFace(node.id, side); }}
            >
              <div className="mb-1 flex items-center gap-2">
                <button
                  type="button"
                  data-pick-face={side}
                  aria-pressed={on}
                  aria-label={`Pick the ${side} face`}
                  onClick={() => { play(on ? "close" : "tap"); useStudio.getState().pickFace(node.id, on ? null : side); }}
                  className={cn("tactile rounded-sm px-1 text-small uppercase tracking-[0.14em]", on ? "text-fg" : "text-fg-faint hover:text-fg")}
                >
                  {side}
                </button>
                {bare ? <span className="text-fine text-fg-faint">empty</span> : null}
                {on ? <span className="text-fine text-accent">picked</span> : null}
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`Clear the ${side} face`}
                  disabled={bare && !face.colour && !(face.prompt ?? "").trim() && !face.pageId}
                  onClick={() => set(node.id, i, null)}
                  className="tactile rounded-sm border border-border px-1.5 py-0.5 text-fine text-fg-muted disabled:opacity-40 hover:text-fg"
                >
                  clear
                </button>
              </div>
              <Input
                inputSize="sm"
                aria-label={`${side} heading`}
                value={face.heading}
                placeholder="Heading"
                onChange={(e) => set(node.id, i, { heading: e.target.value })}
              />
              <Textarea
                autoGrow
                rows={1}
                className="mt-1"
                aria-label={`${side} body`}
                value={face.body}
                placeholder="A line or two"
                onChange={(e) => set(node.id, i, { body: e.target.value })}
              />
              {/* The face's own prompt, exactly as any part has one: what
                  this side is for, for whoever builds the site. */}
              <Textarea
                autoGrow
                rows={1}
                className="mt-1"
                aria-label={`${side} prompt`}
                data-face-prompt={side}
                value={face.prompt ?? ""}
                placeholder="What this face is for"
                onChange={(e) => set(node.id, i, { prompt: e.target.value })}
              />
              {/* A surface is a page. Given one, this side stops being a
                  card with words on it and becomes that page, drawn at the
                  face's size; its heading and body wait behind it and come
                  back the moment the page is taken off. */}
              {sites.length ? (
                <div className="mt-1 flex flex-wrap items-center gap-1" data-face-pages={side}>
                  <span className="text-fine uppercase tracking-[0.14em] text-fg-faint">page</span>
                  <button
                    type="button"
                    data-pick-page="none"
                    aria-pressed={!face.pageId}
                    onClick={() => { play("close"); set(node.id, i, { pageId: null }); }}
                    className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", !face.pageId ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
                  >
                    none
                  </button>
                  {sites.map((p) => {
                    const on = face.pageId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-pick-page={p.id}
                        aria-pressed={on}
                        onClick={() => { play(on ? "close" : "confirm"); set(node.id, i, { pageId: on ? null : p.id }); }}
                        className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", on ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {face.pageId ? (
                <p className="mt-1 text-fine leading-snug text-fg-faint">
                  This side is the page. Its heading and body are kept and come back when the page is taken off.
                </p>
              ) : null}
              {/* One colour, named as a role, so a face stays inside the
                  site's palette rather than becoming a colour nobody can
                  find again. */}
              <div className="mt-1 flex flex-wrap gap-1">
                {FACE_COLOURS.map((role) => {
                  const is = (face.colour || "") === role.id;
                  return (
                    <button
                      key={role.id || "site"}
                      type="button"
                      aria-label={`${side} face, ${role.label}`}
                      aria-pressed={is}
                      onClick={() => set(node.id, i, { colour: role.id })}
                      className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", is ? "border-accent text-fg" : "border-border text-fg-faint hover:text-fg")}
                      style={role.id && palette?.[role.id] ? { boxShadow: `inset 3px 0 0 ${palette[role.id]}` } : undefined}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
}

/**
 * Does this browser, or the server, hold a Replicate token?
 *
 * Asked once, and again whenever the keys panel changes: the control it lights
 * is the one control on this panel that spends money.
 */
export function useRendererReady(): boolean | null {
  const [ready, setReady] = React.useState<boolean | null>(null);
  const unlocked = useKeys((s) => s.unlocked);
  const held = useKeys((s) => !!s.values.REPLICATE_API_TOKEN);
  React.useEffect(() => {
    let live = true;
    void rendererReady(true).then((v) => { if (live) setReady(v); });
    return () => { live = false; };
  }, [unlocked, held]);
  return ready;
}

/**
 * The model road, behind the table.
 *
 * The cube needs no key and is the whole thing. This card is the road past
 * it: the same two-axis table that routes every picture routes a box to
 * the one model that returns a solid, and the button is lit the moment a
 * token is present. Without one it says what would light it, and nothing
 * on the cube is missing.
 */
export function Solid({ node, palette }: { node: StudioNode; palette: Record<string, string> | null }) {
  const ready = useRendererReady();
  const model = React.useMemo(() => solidModel(), []);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const isMesh = node.featureId === "mesh-3d";
  const go = async () => {
    play("confirm");
    setSaid(null);
    const r = await makeSolid(node.id, palette ?? {}, { onStep: setBusy });
    setBusy(null);
    setSaid(r.message);
    play(r.ok ? "confirm" : "deny");
  };
  return (
    <Field
      label="As a solid"
      hint={model ? `Routed to ${model.name} the moment a Replicate token is present: the four sides go up as pictures and a mesh comes back.` : "No model in the table returns a solid yet."}
    >
      <div className="flex flex-col gap-1.5" data-solid-card="" data-solid-ready={ready === null ? "asking" : ready ? "yes" : "no"} data-solid-model={model?.slug ?? ""}>
        {isMesh ? (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" data-solid-back="" onClick={() => { play("tap"); showCube(node.id); }}>Back to the cube</Button>
          </div>
        ) : ready ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" data-solid-make="" disabled={!!busy || !model} onClick={() => void go()}>{busy ?? "Make it a solid"}</Button>
            {node.mesh?.glb ? <Button size="sm" variant="outline" data-solid-show="" onClick={() => { play("tap"); showSolid(node.id); }}>Show the solid made before</Button> : null}
          </div>
        ) : (
          <p className="text-small leading-snug text-fg-muted" data-solid-needs="">
            {ready === null ? "Checking for a Replicate token…" : "No Replicate token yet. Paste one under Keys (⌘⇧K) and this lights up. Until then the cube is the whole thing: it turns, it takes words on every face, and nothing is missing from it."}
          </p>
        )}
        {said ? <p className="text-small leading-snug text-fg-faint" data-solid-said="">{said}</p> : null}
      </div>
    </Field>
  );
}

export function LinkField({ node }: { node: StudioNode }) {
  const pages = useHeldStudio((s) => s.pages);
  // A link drawn as an arrow points at another part; it is named here by
  // that part's name, where before no UI showed it at all.
  const other = useHeldStudio((s) => (node.link?.kind === "node" ? s.nodes.find((n) => n.id === node.link!.target) ?? null : null));
  const nodesHere = useHeldStudio(useShallow(pageNodes));
  const sections = React.useMemo(() => nodesHere.filter((n) => n.id !== node.id && kindWord(n) === "Section").sort((a, b) => a.y - b.y), [nodesHere, node.id]);
  const link = node.link;
  const toSection = link?.kind === "node" && sections.some((n) => n.id === link.target);
  const value = !link ? "none" : link.kind === "page" ? `page:${link.target}` : link.kind === "url" ? "url" : toSection ? `node:${link.target}` : "node";
  const set = (l: StudioNode["link"]) => useStudio.getState().updateNode(node.id, { link: l });
  return (
    <Field label="Links to" hint="Where this sends people in the live preview and the finished site.">
      <div data-link-field="">
      <Select
        value={value}
        onChange={(v) => (v === "none" ? set(null) : v === "url" ? set({ kind: "url", target: link?.kind === "url" ? link.target : "https://" }) : v === "node" ? undefined : v.startsWith("node:") ? set({ kind: "node", target: v.slice(5) }) : set({ kind: "page", target: v.slice(5) }))}
        options={[
          { value: "none", label: node.nowhere ? "Nowhere, on purpose" : "Not linked yet" },
          ...pages.map((p) => ({ value: `page:${p.id}`, label: `${p.name}  ${p.path}` })),
          ...sections.map((n) => ({ value: `node:${n.id}`, label: `Section: ${partName(n, nodesHere, featureName).replace(/^Section\s+/, "")}` })),
          { value: "url", label: "Web address…" },
          ...(link?.kind === "node" && !toSection ? [{ value: "node", label: `The part ${other?.label ?? link.target}, on this page` }] : []),
        ]}
        aria-label="Links to"
      />
      {link?.kind === "node" && !toSection ? (
        <p className="mt-1 text-small leading-snug text-fg-faint" data-link-node="">
          Drawn as an arrow to the part {other?.label ?? link.target}: pressing this scrolls to it. Pick a page or an address above to send people elsewhere.
        </p>
      ) : null}
      </div>
      {link?.kind === "url" ? (
        <Input className="mt-1.5" value={link.target} placeholder="https://" aria-label="Web address" onChange={(e) => set({ kind: "url", target: e.target.value })} />
      ) : null}
      {!link ? <WorkField node={node} /> : null}
    </Field>
  );
}

/**
 * The other thing a button that points nowhere can be: one that DOES something.
 *
 * HIS WORDS: "a drawn button if not linked to something should offer options
 * of a web link, prompt for backend to fill in, like a button i draw, I can
 * title it 'buy' and then i say 'swap route aggregator through jupiter or
 * specific exchange or platform via trading wallet' and it builds the backend
 * required to make it work where this exact button is."
 *
 * So the two are offered together, and only while it points nowhere: once it
 * sends people somewhere, asking what it should do instead is asking a
 * question he has already answered.
 *
 * What he writes goes on the part's own `data`, which is the field this app
 * already defines as "what it shows or does — the values and actions the
 * backend must provide". It is not a note about the button: it is the work,
 * and it is sited at the button because it lives on it, which is what the
 * backend surface reads when it builds.
 */
export function WorkField({ node }: { node: StudioNode }) {
  const says = node.data ?? "";
  return (
    <div className="mt-2 border-t border-border pt-2">
      <p className="mb-1 text-small leading-snug text-fg-muted">
        Or say what it should <em>do</em>, and the backend for it is built here, on this button.
      </p>
      <Textarea
        data-backend-ask=""
        rows={3}
        value={says}
        aria-label="What this button should do"
        placeholder={"swap route aggregator through jupiter or specific exchange or platform via trading wallet"}
        onChange={(e) => useStudio.getState().updateNode(node.id, { data: e.target.value })}
      />
      {says.trim() ? (
        <p data-backend-sited="" className="mt-1 text-small leading-snug text-fg-faint">
          The backend builds this where this button is.
        </p>
      ) : null}
    </div>
  );
}
