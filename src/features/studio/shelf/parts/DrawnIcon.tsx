"use client";
/**
 * A drawing, used as an icon.
 *
 * The same paths the person drew, at whatever size the box is, in whatever
 * colour it is standing in. Three things make an icon out of a trace and
 * all three are here rather than in the drawing: the box is normalised by
 * wrapping rather than by rewriting the path data, so his line is his line
 * to the coordinate; the paths are cut to the few that carry the shape, so
 * it is still legible at sixteen pixels; and there is no colour in it at
 * all, so it takes the button's.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { simplify, vectorMarkup, weigh } from "../../vector";
import { num, opt, type PartProps } from "./types";

export function DrawnIcon({ label, vector, options, theme: t, w, h }: PartProps) {
  const line = opt(options, "drawn as", "solid") === "line";
  const most = num(options, "paths", 6, 1, 24);
  const markup = React.useMemo(() => (vector ? vectorMarkup(simplify(vector, most), { stroke: line, width: 2 }) : ""), [vector, most, line]);
  const kept = vector ? weigh(simplify(vector, most)) : null;
  const side = Math.round(Math.min(w, h) * (num(options, "size", 82, 20, 100) / 100));

  return (
    <Fill t={t} data-part="drawn-icon" style={{ display: "grid", placeItems: "center", color: t.text }}>
      {markup ? (
        <span
          data-icon=""
          data-icon-paths={kept?.paths ?? 0}
          role="img"
          aria-label={label}
          style={{ width: side, height: side, display: "block", lineHeight: 0 }}
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      ) : (
        <span style={{ fontSize: Math.max(9, t.fontPx * 0.75), color: t.muted, textAlign: "center", padding: 8 }}>
          Draw something and make it real, then set its role to icon. This shows the drawing itself.
        </span>
      )}
    </Fill>
  );
}
