"use client";
/**
 * A motion, shown doing its one thing, on a small page made of the open
 * site.
 *
 * HIS REPORT: Motion's whole-page items were "an empty box with one yellow
 * dot". A behaviour that moves the whole page has no picture of its own,
 * so its part draws a marker, and a marker says nothing about what the
 * page will do. So a motion is shown on a page: the site's name across the
 * top, its own headings and a line of its own words, in its colours and
 * faces, and the motion done to that page.
 *
 * At rest the page is caught mid-motion (the third block still arriving,
 * the bar part-filled, the card tipped), so a still frame already says what
 * moves. Under the hand it plays once (`play`); in the detail card it loops
 * (`loop`). Nothing here is a timer: every movement is a CSS animation, so
 * leaving the card stops it on the spot.
 *
 * `hasDemo` says which ids this can show; anything else keeps its part.
 */
import * as React from "react";
import type { Theme } from "./shelf/ui";
import type { SiteWords } from "./shelfFacts";

/** Which demo each id plays: catalogue motions and the library's working behaviours alike. */
const KIND: Record<string, string> = {
  "reveal-on-scroll": "reveal", reveal: "reveal",
  "scroll-progress": "progress", "scroll-snap": "snap", "smooth-scroll": "smooth",
  parallax: "parallax", "cursor-effects": "cursor", "hover-tilt": "tilt", tilt: "tilt",
  "page-load": "intro", "crt-loader": "intro", "page-transitions": "transition", confetti: "confetti",
  "back-to-top": "top", marquee: "marquee", blink: "blink", spin: "spin", float: "float",
  "sticky-story": "sticky", "horizontal-scroll": "sideways", "scroll-video": "film",
  "morph-transition": "morph", physics: "physics", "infinite-scroll": "more",
  "dust-canvas": "dust", glide: "glide", grow: "grow", "follow-pointer": "cursor",
  /* The library's working behaviours, each shown doing its job to a piece of the open site. */
  "copy-toast": "copy", "hover-lift": "lift", "press-shows": "press", "world-dialogs": "dialog",
  "scroll-header": "header", "scroll-grow": "grow-scroll", embed: "embed",
  "sol-price": "price", "token-price": "price",
  /* One site's effects made any part's (library/effects.ts). */
  "screen-filter": "screen", "switch-on": "tvon", "press-push": "push",
  /* Turn in 3D: any part leaning in depth under the hand, as a tilting card shows it. */
  "turn-3d": "tilt",
};

export function hasDemo(id: string): boolean {
  return id in KIND;
}

/* One sheet for every demo, put in the page once. Class names start `md-` so nothing else collides. */
const CSS = `
.md-page{position:absolute;inset:0;overflow:hidden}
.md-anim .md-a{animation-duration:1.6s;animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-fill-mode:both}
.md-loop .md-a{animation-iteration-count:infinite;animation-duration:2.6s}
@keyframes md-rise{0%{opacity:0;transform:translateY(22px)}60%,100%{opacity:1;transform:none}}
@keyframes md-fill{0%{width:6%}100%{width:100%}}
@keyframes md-scroll{0%{transform:translateY(0)}100%{transform:translateY(-46%)}}
@keyframes md-snap{0%,20%{transform:translateY(0)}30%,55%{transform:translateY(-33.4%)}65%,100%{transform:translateY(-66.8%)}}
@keyframes md-smooth{0%{transform:translateY(0)}100%{transform:translateY(-40%)}}
@keyframes md-back{0%{transform:translateY(0)}100%{transform:translateY(-12%)}}
@keyframes md-cursor{0%{transform:translate(30px,40px)}35%{transform:translate(260px,70px)}70%{transform:translate(150px,170px)}100%{transform:translate(30px,40px)}}
@keyframes md-tilt{0%{transform:perspective(500px) rotateX(0) rotateY(0)}35%{transform:perspective(500px) rotateX(10deg) rotateY(-16deg)}70%{transform:perspective(500px) rotateX(-8deg) rotateY(14deg)}100%{transform:perspective(500px) rotateX(0) rotateY(0)}}
@keyframes md-wipe{0%{clip-path:inset(0 0 0 0)}55%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 100% 0)}}
@keyframes md-name{0%{opacity:0;letter-spacing:.6em}50%{opacity:1;letter-spacing:.08em}100%{opacity:1}}
@keyframes md-out{0%,30%{opacity:1;transform:none}60%,100%{opacity:0;transform:translateX(-30px)}}
@keyframes md-in{0%,40%{opacity:0;transform:translateX(30px)}75%,100%{opacity:1;transform:none}}
@keyframes md-burst{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(260deg)}}
@keyframes md-show{0%,40%{opacity:0;transform:translateY(12px)}70%,100%{opacity:1;transform:none}}
@keyframes md-ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes md-blink{0%,49%{opacity:1}50%,100%{opacity:.15}}
@keyframes md-spin{to{transform:rotate(360deg)}}
@keyframes md-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes md-side{0%,15%{transform:translateX(0)}85%,100%{transform:translateX(-58%)}}
@keyframes md-frame{0%{background-position:0 0}100%{background-position:100% 0}}
@keyframes md-morph{0%,20%{inset:52% 58% 12% 8%;border-radius:10px}70%,100%{inset:8% 8% 8% 8%;border-radius:4px}}
@keyframes md-drop{0%{transform:translateY(-120px)}45%{transform:translateY(0)}60%{transform:translateY(-34px)}75%{transform:translateY(0)}85%{transform:translateY(-9px)}100%{transform:translateY(0)}}
@keyframes md-more{0%,30%{height:0;opacity:0}70%,100%{height:34px;opacity:1}}
@keyframes md-dust{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-120px);opacity:0}}
@keyframes md-glide{0%{transform:translateY(0)}100%{transform:translateY(-38%)}}
@keyframes md-aim{0%{transform:translate(var(--fx),var(--fy))}45%,100%{transform:translate(var(--tx),var(--ty))}}
@keyframes md-tap{0%,44%{transform:scale(1);opacity:0}50%{transform:scale(.4);opacity:.9}70%,100%{transform:scale(1.6);opacity:0}}
@keyframes md-tvon{0%,15%{transform:scale(1,.006);filter:brightness(3)}45%{transform:scale(1,.006);filter:brightness(3)}80%,100%{transform:none;filter:none}}
@keyframes md-push{0%,35%{transform:none;box-shadow:0 6px 0 rgba(0,0,0,.45)}50%,70%{transform:translateY(5px);box-shadow:0 1px 0 rgba(0,0,0,.45)}85%,100%{transform:none;box-shadow:0 6px 0 rgba(0,0,0,.45)}}
@keyframes md-static{0%{background-position:0 0}25%{background-position:-40px 30px}50%{background-position:30px -20px}75%{background-position:-20px -40px}100%{background-position:0 0}}
@keyframes md-lift{0%,40%{transform:translateY(0);box-shadow:0 0 0 rgba(0,0,0,0)}60%,100%{transform:translateY(-12px);box-shadow:0 18px 30px rgba(0,0,0,.45)}}
@keyframes md-toast{0%,50%{opacity:0;transform:translate(-50%,16px)}62%,90%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,0)}}
@keyframes md-open{0%,50%{opacity:0;transform:scaleY(.2)}66%,100%{opacity:1;transform:scaleY(1)}}
@keyframes md-on{0%,50%{background:transparent}51%,100%{background:var(--on)}}
@keyframes md-pop{0%,50%{opacity:0;transform:scale(.6)}62%{transform:scale(1.05)}70%,100%{opacity:1;transform:scale(1)}}
@keyframes md-headbar{0%,35%{background:transparent;box-shadow:none;padding-top:14px;padding-bottom:14px}55%,100%{background:var(--fill);box-shadow:0 4px 0 var(--edge);padding-top:8px;padding-bottom:8px}}
@keyframes md-widen{0%{transform:scaleX(.15)}100%{transform:scaleX(1)}}
@keyframes md-tick{0%,40%{opacity:1}45%{opacity:0;transform:translateY(-6px)}50%{opacity:0;transform:translateY(6px)}60%,100%{opacity:1;transform:none}}
@keyframes md-flash{0%,48%{color:inherit}55%,80%{color:var(--up)}100%{color:inherit}}
@keyframes md-load{0%{width:0}100%{width:100%}}
@keyframes md-grow{0%{transform:scale(.6);opacity:.3}100%{transform:scale(1);opacity:1}}
`;

let sheetIn = false;
function useSheet() {
  React.useInsertionEffect(() => {
    if (sheetIn || typeof document === "undefined") return;
    const el = document.createElement("style");
    el.setAttribute("data-motion-demo-css", "");
    el.textContent = CSS;
    document.head.appendChild(el);
    sheetIn = true;
  }, []);
}

/** Cut a line to a length, at a word. */
const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);

/**
 * The demo, drawn 400 wide and scaled into the box it is given.
 */
export function MotionDemo({ id, label, t, words, width, height, play, loop }: {
  /** The feature's name, shown on the site's card when there is no scene of its own for it. */
  label?: string;
  id: string; t: Theme; words: SiteWords; width: number; height: number; play?: boolean; loop?: boolean;
}) {
  useSheet();
  const kind = KIND[id] ?? (label ? "named" : "reveal");
  /* A page as wide as a small window, as tall as the box's own shape asks: a card's strip or the detail card's picture. */
  const W = 400;
  const H = Math.max(170, Math.min(300, Math.round((W * height) / Math.max(1, width))));
  const scale = Math.min(width / W, height / H);
  const moving = play || loop;
  /* Once a one-pass demo has played, it rests on its last frame: the opening
     wipe snapped back to a green bar over the page when its pass ended. */
  const [played, setPlayed] = React.useState(false);
  React.useEffect(() => { if (play) setPlayed(true); }, [play]);
  const a = (name: string, extra: React.CSSProperties = {}): React.CSSProperties =>
    moving ? { animationName: name, ...extra } : {};

  const heads = words.headings.length ? words.headings : [words.name];
  const h1 = cut(heads[0] ?? words.name, 34);
  const h2 = cut(heads[1] ?? heads[0] ?? words.name, 22);
  const h3 = cut(heads[2] ?? heads[1] ?? words.name, 22);
  const line = cut(words.lines[0] ?? `${words.name}, as your visitors will see it.`, 70);
  const links = (words.pages.length ? words.pages : heads.filter((h) => h.split(" ").length <= 2)).slice(0, 3);

  /**
   * A mouse pointer that travels from (fx, fy) to (tx, ty) and presses there,
   * for the behaviours that answer a press or a hover. At rest it sits on its
   * target, so the still frame shows where the hand goes.
   */
  const pointer = (fx: number, fy: number, tx: number, ty: number, press = true) => (
    <div
      className="md-a"
      style={{
        position: "absolute", left: 0, top: 0, zIndex: 5,
        ["--fx" as string]: `${fx}px`, ["--fy" as string]: `${fy}px`, ["--tx" as string]: `${tx}px`, ["--ty" as string]: `${ty}px`,
        ...(moving ? a("md-aim") : { transform: `translate(${tx}px,${ty}px)` }),
      } as React.CSSProperties}
    >
      {press ? <span className="md-a" style={{ position: "absolute", left: -14, top: -14, width: 28, height: 28, borderRadius: 99, border: `2px solid ${t.accent}`, opacity: 0, ...a("md-tap") }} /> : null}
      <svg width="18" height="22" viewBox="0 0 18 22" style={{ position: "absolute", left: -2, top: -2 }}>
        <path d="M1 1 L1 17 L5.5 13 L8.5 20 L11 19 L8 12 L14 12 Z" fill={t.text} stroke={t.bg} strokeWidth="1.2" />
      </svg>
    </div>
  );
  const text: React.CSSProperties = { color: t.text, fontFamily: t.bodyFamily, fontSize: 13, lineHeight: 1.4 };
  const heading: React.CSSProperties = { color: t.text, fontFamily: t.headingFamily, fontWeight: 700, fontSize: 22, lineHeight: 1.15, margin: 0 };
  const card: React.CSSProperties = { background: t.surface, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 14), padding: 12 };
  const r = Math.min(t.radius, 14);

  const bar = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: `1px solid ${t.line}`, background: t.bg }}>
      <span style={{ ...text, fontFamily: t.headingFamily, fontWeight: 700, color: t.accent, fontSize: 14 }}>{cut(words.name, 20)}</span>
      <span style={{ flex: 1 }} />
      {links.map((l) => <span key={l} style={{ ...text, fontSize: 11, color: t.muted }}>{cut(l, 12)}</span>)}
    </div>
  );
  /** Three blocks of the page; `how` animates each, `rest` is each one's still frame. */
  const blocks = (how?: (i: number) => React.CSSProperties, rest?: (i: number) => React.CSSProperties) => (
    <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="md-a" style={{ ...(moving ? how?.(0) : rest?.(0)) }}>
        <h3 style={heading}>{h1}</h3>
        <p style={{ ...text, color: t.muted, margin: "6px 0 0" }}>{line}</p>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {[h2, h3].map((h, i) => (
          <div key={i} className="md-a" style={{ ...card, flex: 1, ...(moving ? how?.(i + 1) : rest?.(i + 1)) }}>
            <div style={{ ...heading, fontSize: 14 }}>{h}</div>
            <div style={{ height: 6, marginTop: 8, width: "70%", background: t.line, borderRadius: 3 }} />
            <div style={{ height: 6, marginTop: 5, width: "45%", background: t.line, borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
  /** A long page, for the motions that are about scrolling it. */
  const tall = (style: React.CSSProperties, cls = "md-a") => (
    <div className={cls} style={style}>
      {[h1, h2, h3].map((h, i) => (
        <div key={i} style={{ height: 150, padding: 16, borderBottom: `1px solid ${t.line}`, background: i % 2 ? t.surface : t.bg }}>
          <h3 style={heading}>{h}</h3>
          <p style={{ ...text, color: t.muted, margin: "6px 0 0" }}>{i === 0 ? line : cut(words.lines[i] ?? line, 70)}</p>
        </div>
      ))}
    </div>
  );

  let body: React.ReactNode;
  switch (kind) {
    case "reveal":
      body = <>{bar}{blocks((i) => ({ animationName: "md-rise", animationDelay: `${i * 0.25}s` }), (i) => (i === 2 ? { opacity: 0.35, transform: "translateY(14px)" } : {}))}</>;
      break;
    case "progress":
      body = (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: t.line, zIndex: 2 }}>
            <div className="md-a" style={{ height: "100%", width: "40%", background: t.accent, ...a("md-fill") }} />
          </div>
          {tall(a("md-scroll"))}
        </>
      );
      break;
    case "snap":
      body = (
        <>
          {tall({ ...a("md-snap"), height: 450 })}
          <div style={{ position: "absolute", right: 10, top: 110, display: "flex", flexDirection: "column", gap: 6 }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: 9, background: i === 0 ? t.accent : t.line }} />)}
          </div>
        </>
      );
      break;
    case "smooth":
    case "glide":
      body = tall(a(kind === "glide" ? "md-glide" : "md-smooth", { animationTimingFunction: "cubic-bezier(.45,.05,.2,1)" }));
      break;
    case "parallax":
      body = (
        <>
          <div className="md-a" style={{ position: "absolute", inset: 0, ...a("md-back") }}>
            <div style={{ position: "absolute", width: 180, height: 180, borderRadius: 999, right: 30, top: 40, background: t.accent, opacity: 0.22, filter: "blur(2px)" }} />
            <div style={{ position: "absolute", width: 90, height: 90, borderRadius: 999, left: 40, top: 170, background: t.accent, opacity: 0.14 }} />
          </div>
          {tall({ ...a("md-scroll"), position: "relative", opacity: 0.94 })}
        </>
      );
      break;
    case "cursor":
      body = (
        <>
          {bar}{blocks()}
          <div className="md-a" style={{ position: "absolute", left: 0, top: 0, ...(moving ? a("md-cursor") : { transform: "translate(250px,110px)" }) }}>
            <span style={{ position: "absolute", width: 34, height: 34, left: -17, top: -17, borderRadius: 99, border: `2px solid ${t.accent}`, opacity: 0.6 }} />
            <span style={{ position: "absolute", width: 10, height: 10, left: -5, top: -5, borderRadius: 99, background: t.accent }} />
          </div>
        </>
      );
      break;
    case "tilt":
      body = (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div className="md-a" style={{ ...card, width: 260, padding: 20, boxShadow: "0 18px 40px rgba(0,0,0,.35)", ...(moving ? a("md-tilt") : { transform: "perspective(500px) rotateX(8deg) rotateY(-14deg)" }) }}>
            <div style={{ ...heading, fontSize: 18 }}>{h2}</div>
            <p style={{ ...text, color: t.muted, margin: "8px 0 0" }}>{cut(line, 60)}</p>
          </div>
        </div>
      );
      break;
    case "intro":
      body = (
        <>
          {bar}{blocks()}
          <div className="md-a" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: t.accent, ...(moving ? a("md-wipe") : { clipPath: played ? "inset(0 0 100% 0)" : "inset(0 0 0 0)" }) }}>
            <span className="md-a" style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: 30, color: t.accentText, ...a("md-name") }}>{cut(words.name, 18)}</span>
          </div>
        </>
      );
      break;
    case "transition":
      body = (
        <>
          <div className="md-a" style={{ position: "absolute", inset: 0, background: t.bg, ...(moving ? a("md-out") : { opacity: 0.35, transform: "translateX(-24px)" }) }}>{bar}{blocks()}</div>
          <div className="md-a" style={{ position: "absolute", inset: 0, background: t.bg, ...(moving ? a("md-in") : { opacity: 0.8, transform: "translateX(24px)" }) }}>
            {bar}
            <div style={{ padding: 16 }}><h3 style={heading}>{h2}</h3><p style={{ ...text, color: t.muted }}>{cut(words.lines[1] ?? line, 70)}</p></div>
          </div>
        </>
      );
      break;
    case "confetti": {
      const bits = Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2;
        return { dx: `${Math.round(Math.cos(ang) * 150)}px`, dy: `${Math.round(Math.sin(ang) * 100 - 30)}px`, hue: i % 3 };
      });
      body = (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span style={{ background: t.accent, color: t.accentText, borderRadius: r, padding: "10px 18px", fontFamily: t.bodyFamily, fontWeight: 700, fontSize: 14 }}>{cut(words.buttons[0] ?? "Done", 18)}</span>
          {bits.map((b, i) => (
            <span key={i} className="md-a" style={{
              position: "absolute", left: "50%", top: "50%", width: 8, height: 12, borderRadius: 2,
              background: b.hue === 0 ? t.accent : b.hue === 1 ? t.text : t.muted,
              ["--dx" as string]: b.dx, ["--dy" as string]: b.dy,
              ...(moving ? a("md-burst", { animationDelay: `${(i % 4) * 0.04}s` }) : { transform: `translate(calc(${b.dx} * .55), calc(${b.dy} * .55)) rotate(${i * 40}deg)`, opacity: 0.85 }),
            } as React.CSSProperties} />
          ))}
        </div>
      );
      break;
    }
    case "top":
      body = (
        <>
          {tall(a("md-scroll"))}
          <span className="md-a" style={{ position: "absolute", right: 14, bottom: 14, width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center", background: t.accent, color: t.accentText, fontSize: 18, fontWeight: 700, ...a("md-show") }}>↑</span>
        </>
      );
      break;
    case "marquee": {
      const run = [...heads.slice(0, 4), words.name].map((h) => cut(h, 26));
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 0, right: 0, top: 120, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`, background: t.surface, overflow: "hidden", padding: "12px 0" }}>
            <div className="md-a" style={{ display: "flex", gap: 40, width: "max-content", ...(moving ? a("md-ticker", { animationTimingFunction: "linear" }) : { transform: "translateX(-18%)" }) }}>
              {[...run, ...run].map((h, i) => <span key={i} style={{ ...heading, fontSize: 18, whiteSpace: "nowrap" }}>{h} <span style={{ color: t.accent }}>✦</span></span>)}
            </div>
          </div>
        </>
      );
      break;
    }
    case "blink":
    case "spin":
    case "float":
    case "grow":
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", inset: "44px 0 0", display: "grid", placeItems: "center" }}>
            <div className="md-a" style={{
              display: "flex", alignItems: "center", gap: 10, ...card, padding: "14px 22px",
              ...(kind === "spin" ? { borderRadius: 999, width: 130, height: 130, justifyContent: "center", padding: 0 } : {}),
              ...(moving ? a(kind === "blink" ? "md-blink" : kind === "spin" ? "md-spin" : kind === "grow" ? "md-grow" : "md-float", kind === "blink" ? { animationTimingFunction: "steps(1)" } : kind === "spin" ? { animationTimingFunction: "linear" } : {}) : kind === "spin" ? { transform: "rotate(-20deg)" } : kind === "float" ? { transform: "translateY(-8px)", boxShadow: "0 14px 24px rgba(0,0,0,.3)" } : {}),
            }}>
              {kind === "blink" ? <span style={{ width: 12, height: 12, borderRadius: 99, background: t.accent }} /> : null}
              <span style={{ ...heading, fontSize: 16 }}>{kind === "blink" ? "LIVE" : cut(kind === "spin" ? words.name : h2, 16)}</span>
            </div>
          </div>
        </>
      );
      break;
    case "sticky":
      body = (
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ width: "46%", display: "grid", placeItems: "center", background: t.surface, borderRight: `1px solid ${t.line}` }}>
            <div style={{ width: 110, height: 110, borderRadius: r, background: t.accent, opacity: 0.8 }} />
          </div>
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>{tall(a("md-scroll"))}</div>
        </div>
      );
      break;
    case "sideways":
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 0, right: 0, top: 70, overflow: "hidden" }}>
            <div className="md-a" style={{ display: "flex", gap: 12, padding: "0 16px", width: "max-content", ...(moving ? a("md-side") : { transform: "translateX(-20%)" }) }}>
              {[h1, h2, h3, words.name, h2].map((h, i) => <div key={i} style={{ ...card, width: 170, height: 150 }}><div style={{ ...heading, fontSize: 15 }}>{cut(h, 18)}</div></div>)}
            </div>
          </div>
        </>
      );
      break;
    case "film":
      body = (
        <>
          {bar}
          <div className="md-a" style={{ position: "absolute", inset: "60px 30px 30px", borderRadius: r, backgroundImage: `linear-gradient(90deg, ${t.surface}, ${t.accent}, ${t.surface})`, backgroundSize: "300% 100%", backgroundPosition: "30% 0", ...a("md-frame") }} />
          <div style={{ position: "absolute", left: 30, right: 30, bottom: 16, height: 4, background: t.line }}><div className="md-a" style={{ height: "100%", width: "30%", background: t.accent, ...a("md-fill") }} /></div>
        </>
      );
      break;
    case "morph":
      body = (
        <>
          {bar}{blocks()}
          <div className="md-a" style={{ position: "absolute", background: t.surface, border: `2px solid ${t.accent}`, inset: moving ? undefined : "30% 30% 12% 8%", ...(moving ? a("md-morph") : {}), borderRadius: 8, padding: 12 }}>
            <div style={{ ...heading, fontSize: 15 }}>{h2}</div>
          </div>
        </>
      );
      break;
    case "physics":
      body = (
        <div style={{ position: "absolute", inset: 0 }}>
          {bar}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, height: 2, background: t.line }} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="md-a" style={{ position: "absolute", bottom: 42, left: 90 + i * 110, width: 60, height: 60, borderRadius: i === 1 ? 999 : r, background: i === 1 ? t.accent : t.surface, border: `1px solid ${t.line}`, ...(moving ? a("md-drop", { animationDelay: `${i * 0.15}s`, animationTimingFunction: "ease-in" }) : { transform: `translateY(${-i * 30}px)` }) }} />
          ))}
        </div>
      );
      break;
    case "more":
      body = (
        <>
          {bar}
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {[h1, h2, h3].map((h, i) => <div key={i} style={{ ...card, padding: "8px 12px", ...text }}>{cut(h, 40)}</div>)}
            <div className="md-a" style={{ ...card, padding: "8px 12px", ...text, overflow: "hidden", ...(moving ? a("md-more") : { opacity: 0.4 }) }}>{words.name}…</div>
          </div>
        </>
      );
      break;
    case "dust":
      body = (
        <>
          {bar}{blocks()}
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="md-a" style={{ position: "absolute", left: `${(i * 37) % 100}%`, bottom: 10 + ((i * 53) % 120), width: 3, height: 3, borderRadius: 9, background: t.accent, ...(moving ? a("md-dust", { animationDelay: `${(i % 5) * 0.2}s` }) : { opacity: 0.7 }) }} />
          ))}
        </>
      );
      break;
    case "copy": {
      /* A value off the site, a press on its copy mark, and the toast saying so. */
      const value = cut(words.lines[0]?.match(/\S{8,}/)?.[0] ?? words.headings[0] ?? words.name, 22);
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 40, right: 40, top: 70, ...card, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <span style={{ ...text, color: t.muted, fontSize: 12 }}>{cut(words.headings[1] ?? "Address", 14)}</span>
            <span style={{ ...text, flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 15 }}>{value}</span>
            <span style={{ width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center", border: `1px solid ${t.line}`, color: t.accent, fontSize: 15 }}>⧉</span>
          </div>
          {pointer(40, 260, 355, 97)}
          <div className="md-a" style={{ position: "absolute", left: "50%", bottom: 22, transform: "translate(-50%,0)", background: t.text, color: t.bg, borderRadius: 8, padding: "8px 16px", fontFamily: t.bodyFamily, fontSize: 13, fontWeight: 600, ...(moving ? a("md-toast") : { opacity: 0.9 }) }}>✓ Copied</div>
        </>
      );
      break;
    }
    case "screen":
      /* The open site's page as if on a screen: its colours shifted, scanlines over it, a flicker of static. */
      body = (
        <>
          <div style={{ position: "absolute", inset: 0, filter: "hue-rotate(-12deg) saturate(1.25) contrast(1.1)" }}>{bar}{blocks()}</div>
          <div className="md-a" style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "overlay", backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 1px, transparent 1px 3px)", ...(moving ? a("md-static", { animationDuration: "0.4s", animationTimingFunction: "steps(4)", animationIterationCount: "infinite" }) : {}) }} />
        </>
      );
      break;
    case "tvon":
      body = <div className="md-a" style={{ position: "absolute", inset: 0, background: t.bg, ...(moving ? a("md-tvon") : {}) }}>{bar}{blocks()}</div>;
      break;
    case "push":
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 0, right: 0, top: 90, display: "flex", justifyContent: "center" }}>
            <span className="md-a" style={{ ...text, fontWeight: 700, fontSize: 15, padding: "12px 26px", borderRadius: r, background: t.accent, color: t.accentText, boxShadow: "0 6px 0 rgba(0,0,0,.45)", ...(moving ? a("md-push") : {}) }}>{cut(links[0] ?? h2, 16)}</span>
          </div>
          {pointer(330, 250, 200, 110)}
        </>
      );
      break;
    case "lift":
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 24, right: 24, top: 64, display: "flex", gap: 14 }}>
            {[h2, h3].map((h, i) => (
              <div key={i} className={i === 0 ? "md-a" : undefined} style={{ ...card, flex: 1, height: 110, ...(i === 0 ? (moving ? a("md-lift") : { transform: "translateY(-10px)", boxShadow: "0 16px 28px rgba(0,0,0,.4)" }) : {}) }}>
                <div style={{ ...heading, fontSize: 16 }}>{h}</div>
                <p style={{ ...text, color: t.muted, margin: "8px 0 0", fontSize: 12 }}>{cut(words.lines[i] ?? line, 60)}</p>
              </div>
            ))}
          </div>
          {pointer(300, 260, 110, 120, false)}
        </>
      );
      break;
    case "press": {
      /* Three of the site's own headings as buttons; the pressed one lights and its panel opens. */
      const tabs = [h1, h2, h3].map((h) => cut(h, 14));
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 24, right: 24, top: 60, display: "flex", gap: 8 }}>
            {tabs.map((h, i) => (
              <span key={i} className={i === 1 ? "md-a" : undefined} style={{ ...text, fontSize: 12, padding: "7px 12px", borderRadius: r, border: `1px solid ${t.line}`, ["--on" as string]: t.accent, ...(i === 1 ? (moving ? a("md-on") : { background: t.accent, color: t.accentText }) : {}) } as React.CSSProperties}>{h}</span>
            ))}
          </div>
          <div className="md-a" style={{ position: "absolute", left: 24, right: 24, top: 106, ...card, height: 100, transformOrigin: "top", ...(moving ? a("md-open") : {}) }}>
            <div style={{ ...heading, fontSize: 16 }}>{tabs[1]}</div>
            <p style={{ ...text, color: t.muted, margin: "8px 0 0", fontSize: 12 }}>{cut(words.lines[1] ?? line, 90)}</p>
          </div>
          {pointer(360, 250, 150, 76)}
        </>
      );
      break;
    }
    case "dialog":
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 60, bottom: 40, width: 70, height: 70, borderRadius: 999, background: t.accent, display: "grid", placeItems: "center", fontSize: 30 }}>🐾</div>
          <div className="md-a" style={{ position: "absolute", left: 150, right: 30, top: 70, ...card, padding: 16, transformOrigin: "left bottom", ...(moving ? a("md-pop") : {}) }}>
            <div style={{ ...heading, fontSize: 15 }}>{h2}</div>
            <p style={{ ...text, color: t.muted, margin: "6px 0 0", fontSize: 12 }}>{cut(words.lines[0] ?? line, 90)}</p>
          </div>
          {pointer(300, 270, 95, 210)}
        </>
      );
      break;
    case "header":
      body = (
        <>
          {tall({ ...a("md-scroll"), paddingTop: 50 })}
          <div className="md-a" style={{ position: "absolute", left: 0, right: 0, top: 0, display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", ["--fill" as string]: t.surface, ["--edge" as string]: t.accent, ...(moving ? a("md-headbar") : { background: t.surface, boxShadow: `0 4px 0 ${t.accent}`, padding: "8px 16px" }) } as React.CSSProperties}>
            <span style={{ ...text, fontFamily: t.headingFamily, fontWeight: 700, color: t.accent, fontSize: 14 }}>{cut(words.name, 20)}</span>
            <span style={{ flex: 1 }} />
            {links.map((l) => <span key={l} style={{ ...text, fontSize: 11, color: t.muted }}>{cut(l, 12)}</span>)}
          </div>
        </>
      );
      break;
    case "grow-scroll":
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 24, right: 24, top: 64 }}>
            <h3 style={{ ...heading, fontSize: 18 }}>{h1}</h3>
            <div style={{ marginTop: 16, height: 14, borderRadius: 9, background: t.line, overflow: "hidden" }}>
              <div className="md-a" style={{ height: "100%", background: t.accent, transformOrigin: "left", ...(moving ? a("md-widen") : { transform: "scaleX(.6)" }) }} />
            </div>
            <p style={{ ...text, color: t.muted, fontSize: 12 }}>{cut(line, 70)}</p>
          </div>
        </>
      );
      break;
    case "embed":
      body = (
        <div style={{ position: "absolute", inset: 16, borderRadius: r, border: `1px solid ${t.line}`, overflow: "hidden", background: t.surface }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${t.line}` }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 9, background: t.line }} />)}
            <span style={{ ...text, fontSize: 11, color: t.muted, marginLeft: 8 }}>https://…</span>
          </div>
          <div style={{ height: 3, background: t.line }}><div className="md-a" style={{ height: "100%", background: t.accent, width: "100%", ...a("md-load") }} /></div>
          <div className="md-a" style={{ padding: 14, ...a("md-rise", { animationDelay: ".5s" }) }}>
            <h3 style={{ ...heading, fontSize: 17 }}>{h2}</h3>
            <p style={{ ...text, color: t.muted, fontSize: 12 }}>{cut(line, 80)}</p>
          </div>
        </div>
      );
      break;
    case "price":
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", left: 0, right: 0, top: 60, display: "grid", placeItems: "center", gap: 6 }}>
            <span style={{ ...text, color: t.muted, fontSize: 12 }}>{cut(words.name, 20)} · live</span>
            <span className="md-a" style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: 40, color: t.text, ["--up" as string]: "oklch(0.8 0.18 150)", ...(moving ? a("md-flash") : {}) } as React.CSSProperties}>
              <span className="md-a" style={{ display: "inline-block", ...(moving ? a("md-tick") : {}) }}>$142.37</span>
            </span>
            <span style={{ ...text, fontSize: 11, color: t.muted }}>updates every 30 seconds</span>
          </div>
        </>
      );
      break;
    case "named":
      body = (
        <>
          {bar}
          <div style={{ position: "absolute", inset: "60px 30px 30px", display: "grid", placeItems: "center" }}>
            <div className="md-a" style={{ ...card, padding: "16px 20px", ...a("md-pop") }}>
              <div style={{ ...heading, fontSize: 16 }}>{h2}</div>
              <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, padding: "2px 8px", borderRadius: 99, background: t.accent, color: t.accentText, fontFamily: t.bodyFamily }}>{cut(label ?? "", 30)}</span>
            </div>
          </div>
        </>
      );
      break;
    default:
      body = <>{bar}{blocks()}</>;
  }

  return (
    <div
      aria-hidden
      data-motion-demo={kind}
      className="pointer-events-none relative overflow-hidden"
      style={{ width, height, background: t.bg }}
    >
      <div
        className={loop ? "md-page md-anim md-loop" : moving ? "md-page md-anim" : "md-page"}
        /* Remounted when it starts, so every pass begins at the beginning. */
        key={moving ? "on" : "off"}
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", left: Math.max(0, (width - W * scale) / 2), top: Math.max(0, (height - H * scale) / 2), background: t.bg }}
      >
        {body}
      </div>
    </div>
  );
}
