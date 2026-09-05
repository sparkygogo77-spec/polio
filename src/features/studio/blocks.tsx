"use client";
/**
 * How each part looks and behaves, at real size, from its options and contents.
 *
 * The board and the live preview both draw parts through `Block`, so what you
 * see on the board is what the page will be. `Block` is only a dispatcher: the
 * parts themselves live in `parts/` (see `parts/types.ts` for the contract) and
 * anything not migrated yet still draws through `parts/legacy.tsx`.
 */
import * as React from "react";
import { resolvePart, type NodeLink, type PartEvent, type PartMode, type Theme } from "./parts";
import { LegacyBlock } from "./parts/legacy";
import type { StudioNode } from "./store";

export { items, themeFrom, type Theme } from "./parts/theme";

export interface BlockProps {
  node: StudioNode;
  t: Theme;
  /** "board": initial state, held still, inert. "live": fully interactive. */
  mode?: PartMode;
  /** The box actually given to the part; defaults to the node's own size. */
  size?: { w: number; h: number };
  onNavigate?: (link: NodeLink) => void;
  emit?: (e: PartEvent) => void;
}

export function Block({ node, t, mode = "board", size, onNavigate, emit }: BlockProps) {
  const def = resolvePart(node.featureId);
  if (!def) return <LegacyBlock node={node} t={t} />;
  const P = def.component;
  return (
    <P
      id={node.featureId}
      label={node.label}
      content={node.content ?? ""}
      options={node.options}
      w={size?.w ?? node.w}
      h={size?.h ?? node.h}
      link={node.link ?? null}
      theme={t}
      mode={mode}
      onNavigate={onNavigate}
      emit={emit}
    />
  );
}
