"use client";
/**
 * Buttons that do one thing: go where their link points, or say they did.
 */
import * as React from "react";
import { Btn, Fill } from "./primitives";
import { splitTurn } from "./Hero";
import { simplify, vectorMarkup } from "../vector";
import { cardStyle, items, radiusFor, saidRole, titled } from "./theme";
import { opt, type PartProps } from "./types";

export function Cta({ id, content, options, theme: t, mode, link, vector, onNavigate, emit }: PartProps) {
  /*
   * The library's stand-in label is for a button nobody has said anything
   * about. A node that speaks (a captured control, in its measured clothes)
   * and carries no words draws none: his wallet button's words are parts of
   * their own, drawn over it, and a stand-in would be white words under them.
   */
  const spoke = !!t.said || !!t.tight;
  const label = items(content, spoke ? [""] : [id === "follow" ? "Follow" : id === "quick-action" ? "Buy now" : "Get started"])[0]!;
  const variant = opt(options, "variant", "solid");
  const size = opt(options, "size", "medium");
  const [done, setDone] = React.useState(false);
  const [following, setFollowing] = React.useState(false);

  const onClick = () => {
    if (id === "follow") {
      setFollowing((v) => !v);
      emit?.({ type: "toast", text: following ? "Unfollowed" : "Following", level: "success" });
      return;
    }
    if (link) {
      onNavigate?.(link);
      return;
    }
    // Nothing to say, nothing said: no "Done ✓", no empty toast.
    if (!label) return;
    if (mode === "live") {
      setDone(true);
      window.setTimeout(() => setDone(false), 1200);
    }
    emit?.({ type: id === "quick-action" ? "success" : "toast", text: label });
  };

  /*
   * A drawing dropped on this button is worn as its icon: the same paths,
   * at the height of the label, in the button's own colour because the
   * markup carries no colour of its own.
   */
  const glyph = vector ? vectorMarkup(simplify(vector as never, 6), { stroke: opt(options, "icon", "solid") === "line", width: 2 }) : "";
  const outline = variant === "outline";
  const ghost = variant === "ghost";
  const text = id === "follow" && following ? "Following ✓" : done ? "Done ✓" : label;
  /*
   * A CAPTURED CONTROL KEEPS ITS OWN CLOTHES, AND STILL WORKS.
   *
   * Everything this button drew was its own: the accent behind it, the
   * accent's contrast colour on top, weight 700, a 2px edge, the words in
   * the middle. That is right for a button somebody drags out of the
   * library and has nothing to say about itself, and it is wrong for one
   * that came off his page, where the sidebar entries are grey at weight
   * 400, unedged, and set left beside an icon. So a captured control was
   * either faithful and dead, or working and restyled. His ruling is both.
   *
   * The rule, and it is the only rule: **the node where the node spoke, the
   * button's own where it did not.** `t.said` records which of these he
   * named (see `NodeSaid`); `t.fontWeight` is already undefined unless he
   * named a weight, so it needs no flag. A node that said nothing leaves
   * every one of these at the literal that was here before, which is why a
   * hand-placed button is unchanged to the pixel.
   *
   * The edge is the one that stands ASIDE rather than following. When a node
   * carries one, `blocks.tsx` wraps the part in a `[data-part-box]` that
   * draws it; a button drawing its own inside that is two edges 2px apart.
   * So his edge is the edge, and this draws none — which also gives back the
   * 4px that `2px solid transparent` was quietly taking out of a 143px box.
   *
   * AND A NODE THAT SPEAKS HAS NO EDGE IT DID NOT NAME. The transparent 2px
   * is the library's: it keeps a solid and an outline button of one size
   * the same size. A node that says what it wears (its colours, where its
   * words sit, its padding) is not the library's button, so with no edge
   * named it gets no border at all, rather than an invisible one eating 4px
   * of its inside. A weight alone is not enough to count: `button-own.mjs`
   * holds a weight-only node to the library's edge.
   */
  const fill = outline ? "transparent" : ghost ? `${t.accent}22` : following ? t.surface : t.accent;
  const style: React.CSSProperties = {
    width: "100%", height: "100%", display: "flex", alignItems: "center", cursor: "pointer",
    fontFamily: t.bodyFamily, fontSize: t.fontPx * (size === "large" ? 1.15 : size === "small" ? 0.85 : 1), whiteSpace: "nowrap",
    // His weight, else the library's. `t.fontWeight` is only ever his.
    fontWeight: t.fontWeight ?? 700,
    // The words sit where he set them, else in the middle. Read off `said`
    // and not off `t.textAlign`, which carries the SITE's setting and would
    // un-centre every hand-placed button on a left-set page.
    justifyContent: t.said?.align === "left" ? "flex-start" : t.said?.align === "right" ? "flex-end" : "center",
    // A fill he painted is already on the root, by `Fill`: painting the
    // accent over it is exactly the restyling this is here to stop.
    background: saidRole(t, "bg") ? "transparent" : fill,
    // A colour he set his words in beats the accent's contrast colour. A
    // captured control's words are grey because the page's were.
    color: saidRole(t, "text") ? t.text : outline || ghost || following ? t.accent : t.accentText,
    // His edge is drawn by the box round this part; nothing of our own inside it.
    border: t.said?.edge || spoke ? "none" : outline || following ? `2px solid ${t.accent}` : "2px solid transparent",
    borderRadius: radiusFor(opt(options, "shape", "rounded"), t) || Math.min(t.radius, 14),
    transition: "transform 120ms ease, background 160ms ease",
  };
  return (
    /* A captured control's words overflow its measured padding rather than
       being cut (trumpmorty.fun's remote read HOMI, ROADMAF; `tests/button-words-whole.mjs`). */
    <Fill t={t} data-part={id} overflow={spoke && label ? "visible" : "hidden"} style={{ display: "flex", alignItems: "center", justifyContent: style.justifyContent }}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={id === "follow" ? following : undefined}
        data-cta-own={[t.fontWeight != null ? "weight" : "", saidRole(t, "text") ? "colour" : "", saidRole(t, "bg") ? "fill" : "", t.said?.align ? "align" : "", t.said?.edge ? "edge" : ""].filter(Boolean).join(" ") || undefined}
        style={style}
      >
        {glyph ? (
          <span
            data-button-icon=""
            aria-hidden
            style={{ width: "1.15em", height: "1.15em", display: "inline-block", lineHeight: 0, marginRight: "0.5em", flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: glyph }}
          />
        ) : null}
        {text}
      </button>
    </Fill>
  );
}

/**
 * The invitation: the panel a page ends on.
 *
 * A bordered box a shade off the page, holding a small label, a headline
 * that turns colour on its last line, and one button out to the right. It
 * was being drawn with a region — a dashed box with its name printed in the
 * middle — because there was no part for it, and a region is a note to the
 * builder rather than a thing on the page.
 *
 * Its three parts are typed as keyed items ("label: Join the transmission,
 * heading: Stay in the loop., button: Follow on X"), and positionally when
 * they are not keyed, so it can be filled in either way.
 */
export function InvitePanel({ id, content, options, theme: t, mode, link, onNavigate, emit }: PartProps) {
  const typed = items(content, ["Join the transmission", "Stay in the loop.", "Follow on X"]).map(titled);
  const keyed = (key: string) => typed.find((x) => x.body && x.title.toLowerCase() === key)?.body ?? null;
  const loose = typed.filter((x) => !x.body).map((x) => x.title);
  const label = keyed("label") ?? keyed("eyebrow") ?? loose[0] ?? "";
  const heading = keyed("heading") ?? keyed("headline") ?? loose[1] ?? "Stay in the loop.";
  const button = keyed("button") ?? keyed("cta") ?? loose[2] ?? "Follow on X";
  /*
   * Everything past the three slots, kept rather than dropped.
   *
   * This panel read loose[0], loose[1] and loose[2] and discarded whatever
   * came after, in silence \u2014 a headline written across two lines lost its
   * second one and nothing anywhere said so. It grows to hold what it is
   * given instead: the extra lines sit under the heading, in the body size,
   * which is where a line that was meant to be part of the sentence belongs.
   */
  const rest = loose.slice(3);
  // The same turn the headline part uses, so "last word" means the same
  // thing in both and a one-sentence heading can still turn at its end.
  const turn = opt(options, "turn", "last word accent");
  const split = splitTurn(heading, turn);
  const [done, setDone] = React.useState(false);

  return (
    <Fill
      t={t}
      data-part={id}
      style={{
        ...cardStyle(t),
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: t.fontPx * 2,
        padding: `${t.fontPx * 1.8}px ${t.fontPx * 2}px`,
        borderRadius: radiusFor(opt(options, "shape", "rounded"), t) || Math.min(t.radius * 2, 28),
      }}
    >
      <div style={{ minWidth: 0 }}>
        {label ? (
          <p style={{ margin: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: Math.max(9, t.fontPx * 0.72), letterSpacing: "0.22em", textTransform: "uppercase", color: t.accent }}>
            {label}
          </p>
        ) : null}
        <p style={{ margin: `${t.fontPx * 0.5}px 0 0`, fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 2.4, lineHeight: 1.06, letterSpacing: -0.5 }}>
          {split.head}
          {split.tail ? <span style={{ color: turn.endsWith("muted") ? t.muted : t.accent }}>{split.tail}</span> : null}
        </p>
        {rest.map((line, i) => (
          <p key={i} style={{ margin: `${t.fontPx * 0.45}px 0 0`, color: t.muted, fontSize: t.fontPx, lineHeight: t.lineHeight }}>
            {line}
          </p>
        ))}
      </div>
      <Btn
        t={t}
        primary={opt(options, "variant", "outline") === "solid"}
        shape="pill"
        label={done ? "Done \u2713" : button}
        onClick={() => {
          if (link) { onNavigate?.(link); return; }
          if (mode === "live") { setDone(true); window.setTimeout(() => setDone(false), 1200); }
          emit?.({ type: "toast", text: button });
        }}
        style={{ flex: "none", fontSize: t.fontPx * 0.85, textTransform: "uppercase", letterSpacing: "0.12em" }}
      />
    </Fill>
  );
}
