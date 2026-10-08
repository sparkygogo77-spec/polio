"use client";
/**
 * WHAT THE OLD STATES MENU HELD THAT THE PANELS RAIL DID NOT (J, 2026-10-06:
 * "remove the states menu"). The page strip's States button is gone; Panels
 * and the Page state arrows cover it. What only it offered lives here, at
 * the foot of the Panels rail, folded away:
 *
 *   · a site that does not declare its scenes: its captured scenes in game
 *     order, one at a time, and what goes on top of them (`scenes.ts`);
 *   · every hidden part of the page, by hook, switched on for the board;
 *   · "Hide them all again".
 *
 * And ← → stepping the declared scenes on the board (`useSceneKeys`), which
 * the States button used to carry, now held by the page strip.
 */
import * as React from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { hiddenGroups, screenKey, type ScreenRead } from "./boardStates";
import { pageScenes } from "./scenes";
import type { SceneScreen } from "./stateRules";
import { stepScene } from "./sceneStep";
import { useHeldStudio, useStudio, useSteady } from "../board/store";

type Source = { files?: { file: string; pageId: string }[]; screens?: ScreenRead[] };
const sourceOf = (look: unknown) => (look as { styleSource?: Source } | undefined)?.styleSource;

/** ← and → step a page's declared scenes on the board (`sceneStep.ts`), when nothing is picked and nothing is typed in. */
export function useSceneKeys(pageId: string) {
  const stepping = useHeldStudio((s) => {
    const src = sourceOf(s.look);
    const file = src?.files?.find((f) => f.pageId === pageId)?.file ?? null;
    return (src?.screens ?? []).some((x) => (x as SceneScreen).declared && x.page === file);
  });
  React.useEffect(() => {
    if (!stepping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const st = useStudio.getState();
      if (st.mode !== "design" || st.selection.length || document.querySelector("[role='dialog'], [data-radial]")) return;
      e.preventDefault();
      stepScene(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepping]);
}

/** The foot of the Panels rail: captured scenes (sites that do not declare theirs) and every hidden part, folded away. */
export function MoreStates({ pageId }: { pageId: string }) {
  const nodes = useSteady(useHeldStudio((s) => s.nodes));
  const on = useHeldStudio((s) => s.statesOn ?? []);
  const source = useHeldStudio((s) => sourceOf(s.look));
  const [more, setMore] = React.useState(false);
  const groups = React.useMemo(() => hiddenGroups(nodes, pageId), [nodes, pageId]);
  const file = source?.files?.find((f) => f.pageId === pageId)?.file ?? null;
  const screens = (source?.screens ?? []).filter((x) => x.page === file);
  /* Declared scenes step from "Page state" by the search bar; only captured ones are listed here. */
  const declared = screens.some((x) => (x as SceneScreen).declared);
  const scenes = declared ? { scenes: [], onTop: [] } : pageScenes(screens, file);
  const listed = declared ? [] : screens;
  if (!groups.length && !listed.length) return null;
  const here = [...listed.map((x) => screenKey(x.name)), ...scenes.onTop.map((v) => v.key), ...groups.map((g) => g.group)];
  const lit = here.filter((k) => on.includes(k)).length;
  const flip = (key: string) => { play("tap"); const st = useStudio.getState(); const now = st.statesOn ?? []; st.setStatesOn(now.includes(key) ? now.filter((k) => k !== key) : [...now, key]); };
  /* One scene at a time: a scene is one capture of the whole page, so picking one puts the last away. */
  const pickScene = (key: string) => { play("tap"); const st = useStudio.getState(); const now = st.statesOn ?? []; const mine = new Set(listed.map((x) => screenKey(x.name))); st.setStatesOn(now.includes(key) ? now.filter((k) => k !== key) : [...now.filter((k) => !mine.has(k)), key]); };
  const Row = ({ k, name, note }: { k: string; name: string; note: string }) => {
    const pressed = on.includes(k);
    return (
      <button
        type="button"
        aria-pressed={pressed}
        {...(k.startsWith("screen:") ? { "data-screen-toggle": k.slice(7) } : k.startsWith("top:") ? { "data-on-top-toggle": k.slice(4) } : { "data-state-toggle": k })}
        onClick={() => (k.startsWith("screen:") ? pickScene(k) : flip(k))}
        className={cn("tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain", pressed ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}
      >
        {pressed ? <Eye className="size-3 shrink-0 text-accent" /> : <EyeOff className="size-3 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="num shrink-0 pl-2 text-fine text-fg-faint">{note}</span>
      </button>
    );
  };
  return (
    <div data-states-menu="" className="mt-2 flex flex-col gap-0.5 border-t border-border pt-1">
      <button type="button" data-states-more="" aria-expanded={more} onClick={() => setMore((v) => !v)} className="tactile flex h-7 items-center gap-1 rounded-md px-2 text-left text-fine text-fg-faint hover:bg-hover hover:text-fg">
        <ChevronDown className={cn("size-3 shrink-0 transition-transform", more && "rotate-180")} />
        <span className="min-w-0 flex-1">{listed.length ? "More: scenes and every hidden part" : "More: every hidden part"}</span>
        {lit ? <span className="num text-fine text-accent">{lit}</span> : null}
      </button>
      {more ? (
        <>
          {scenes.scenes.map((sc) => (
            <React.Fragment key={sc.key}>
              <p data-scene={sc.key} className="px-2 pt-1 text-fine font-medium text-fg-muted">{sc.name}</p>
              {sc.variants.map((v) => <Row key={v.key} k={v.key} name={v.label} note={v.screen.name} />)}
            </React.Fragment>
          ))}
          {scenes.onTop.length ? <p className="px-2 pt-1 text-fine font-medium text-fg-muted">On top</p> : null}
          {scenes.onTop.map((v) => <Row key={v.key} k={v.key} name={v.label} note={v.screen.name} />)}
          {groups.length ? <p className="px-2 pt-1 text-fine font-medium text-fg-muted">Hidden parts</p> : null}
          {groups.map((g) => <Row key={g.group} k={g.group} name={g.template ? `${g.hook} (template)` : g.hook} note={String(g.parts)} />)}
        </>
      ) : null}
      {lit ? (
        <button type="button" data-states-off="" onClick={() => { play("tap"); useStudio.getState().setStatesOn((useStudio.getState().statesOn ?? []).filter((k) => !here.includes(k))); }} className="tactile h-7 rounded-md px-2 text-left text-plain text-fg-muted hover:bg-hover hover:text-fg">
          Hide them all again
        </button>
      ) : null}
    </div>
  );
}
