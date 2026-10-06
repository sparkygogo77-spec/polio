"use client";
import * as React from "react";
import { useHeldStudio, useStudio, useSteady, type StudioNode } from "../store";
import { ROLE_MEANS, ROLES, simplify, weigh, type VectorRole } from "../vector";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { wordsOf } from "../partNames";
import { fontsInPageOrder, faceOf } from "../siteColours";
import { parseColor, toHex } from "../look";
import { movingParts } from "../motionInventory";
import { MoveRowView } from "../MotionPanel";
import { Field } from "./fields";

/** The face and size a part's words are set in, and a way to change both. */
export function FontField({ node, base }: { node: StudioNode; base: number }) {
  const nodes = useHeldStudio((s) => s.nodes);
  const carried = useHeldStudio((s) => s.look.fonts);
  const pages = useHeldStudio((s) => s.pages);
  /* The site's faces in page order, then any it carries that no part uses (`fontsInPageOrder`). */
  const faces = React.useMemo(() => [...new Set([...fontsInPageOrder(nodes, pages.map((p) => p.id)).map((f) => f.key).filter(Boolean), ...(carried ?? []).map((f) => f.family)])], [carried, nodes, pages]);
  if (!wordsOf(node) && !node.font) return null;
  const face = faceOf(node);
  const size = typeof node.font?.size === "number" ? node.font.size : 1;
  const set = (font: StudioNode["font"]) => useStudio.getState().updateNode(node.id, { font });
  return (
    <Field label="Font">
      <div className="flex items-center gap-1.5" data-part-font="">
        <Select
          className="min-w-0 flex-1"
          aria-label="Face"
          value={face || "site"}
          onChange={(v) => {
            const { stack: _s, face: _f, family: _fam, ...rest } = (node.font ?? {}) as NonNullable<StudioNode["font"]> & { stack?: unknown };
            void _s; void _f; void _fam;
            set(v === "site" ? (Object.keys(rest).length ? rest : null) : { ...rest, face: v });
          }}
          options={[{ value: "site", label: "The site's type" }, ...faces.map((f) => ({ value: f, label: f }))]}
        />
        <Input
          type="number"
          inputSize="sm"
          className="w-16 px-1.5"
          aria-label="Size in pixels"
          value={String(Math.round(base * size))}
          onChange={(e) => { const px = Number(e.target.value); if (Number.isFinite(px) && px > 0) set({ ...(node.font ?? {}), size: px / base }); }}
        />
        <span className="text-small text-fg-muted">px</span>
      </div>
    </Field>
  );
}

export const toHexish = (v: string | undefined) => { const c = v ? parseColor(v) : null; return c ? toHex(c) : "#000000"; };

/** This part's border and shadow. */
export function EdgeField({ node }: { node: StudioNode }) {
  const edge = node.edge ?? null;
  const set = (patch: Partial<NonNullable<StudioNode["edge"]>> | null) => useStudio.getState().updateNode(node.id, { edge: patch === null ? null : { ...(edge ?? {}), ...patch } });
  const width = edge?.style === "none" ? 0 : edge?.width ?? 0;
  return (
    <>
      <Field label="Border">
        <div className="flex items-center gap-1.5" data-part-border="">
          <Input type="number" inputSize="sm" className="w-14 px-1.5" aria-label="Border width in pixels" value={String(width)}
            onChange={(e) => { const w = Number(e.target.value); if (Number.isFinite(w) && w >= 0) set({ width: w, style: w ? (edge?.style && edge.style !== "none" ? edge.style : "solid") : "none" }); }} />
          <span className="text-small text-fg-muted">px</span>
          <Select className="min-w-0 flex-1" aria-label="Border style" value={edge?.style && edge.style !== "none" ? edge.style : "solid"}
            onChange={(v) => set({ style: v as "solid", width: width || 1 })}
            options={["solid", "dashed", "dotted", "double"].map((v) => ({ value: v, label: v }))} />
          <input type="color" aria-label="Border colour" className="h-7 w-8 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent"
            value={toHexish(edge?.colour)} onChange={(e) => set({ colour: e.target.value, width: width || 1, style: edge?.style && edge.style !== "none" ? edge.style : "solid" })} />
        </div>
      </Field>
      <Field label="Shadow">
        <div className="flex items-center gap-1.5" data-part-shadow="">
          <span className="min-w-0 flex-1 truncate text-small text-fg-muted">{edge?.shadow ? "A shadow the page gave it" : "None"}</span>
          {edge?.shadow ? <Button size="xs" variant="outline" onClick={() => set({ shadow: undefined })}>Remove</Button>
            : <Button size="xs" variant="outline" onClick={() => set({ shadow: "0 6px 18px rgb(0 0 0 / 0.25)" })}>Add a soft one</Button>}
        </div>
      </Field>
    </>
  );
}

/** This part's own motions: the rows the Motion tab lists for it, with the same controls. */
export function PartMotions({ node }: { node: StudioNode }) {
  const nodes = useSteady(useHeldStudio((s) => s.nodes));
  const crates = useHeldStudio((s) => s.motion);
  const rows = React.useMemo(() => movingParts(nodes, crates, node.pageId).filter((r) => r.nodeId === node.id), [nodes, crates, node.pageId, node.id]);
  const [note, setNote] = React.useState<{ key: string; says: string } | null>(null);
  if (!rows.length) {
    return <p className="text-small leading-snug text-fg-muted">This part does not move. Motions from the shelf&apos;s Motion category, or the wheel&apos;s Animation piece, put one on it.</p>;
  }
  return (
    <div className="space-y-1" data-part-motions="">
      {rows.map((r) => <MoveRowView key={r.key} row={r} selected here note={note?.key === r.key ? note.says : null} onNote={(says) => setNote(says ? { key: r.key, says } : null)} />)}
    </div>
  );
}

/** Where a part sends people. Pages by name, or a web address. */
/**
 * The six faces of a cube, listed.
 *
 * A cube is the first part whose content is not one field, and the reason
 * it is here rather than in the part is that a part is a component a
 * generated site ships: it draws what it is given and never edits the
 * document. So the editing lives in the panel, all six faces at once,
 * because "which side is that on" is the only question anyone has, and
 * every change is one write to the node.
 */
/**
 * What a drawing is for, asked rather than guessed.
 *
 * A traced drawing is a shape with no purpose yet. The words choose a role
 * when they say one — "a bird icon" is an icon — and when they say nothing
 * this asks, with all three offered and none of them preselected. A bird
 * that quietly became an icon when it was meant to be a frame is worse
 * than a bird with no role yet, so nothing is chosen on the author's
 * behalf and the panel says so in as many words.
 */
export function Role({ node }: { node: StudioNode }) {
  const set = (role: VectorRole | null) => {
    play(role ? "confirm" : "close");
    useStudio.getState().updateNode(node.id, {
      role,
      // An icon is a part of its own; the other two are what the part it
      // is already does, so only this one changes what it is.
      ...(role === "icon" && node.featureId !== "drawn-icon" ? { featureId: "drawn-icon", outline: null, shape: null } : {}),
    });
  };
  const kept = simplify(node.vector!, 6);
  return (
    <Field
      label="What the drawing is for"
      hint={node.role
        ? ROLE_MEANS[node.role]
        : "Nothing has been chosen, and nothing will be chosen for you. Pick one."}
    >
      <div className="flex flex-col gap-1.5" data-role-picker="">
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              data-role={r}
              aria-pressed={node.role === r}
              onClick={() => set(node.role === r ? null : r)}
              className={cn("tactile rounded-md border px-2 py-1 text-small capitalize", node.role === r ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-fine leading-snug text-fg-faint">
          {weigh(node.vector!).paths} paths traced, {kept.paths.length} kept for an icon. Drop an icon onto a button and the
          button wears it.
        </p>
      </div>
    </Field>
  );
}
