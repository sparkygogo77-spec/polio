"use client";
/**
 * "SHOW:" AT THE TOP OF THE BOARD (J, 2026-10-08): the page's previews,
 * one per moment of its flow, stepped with ‹ › or ← →, the moment's other
 * page states as chips, what goes on top switched on over it, and "This
 * state only" for the rare edit that belongs to one state (`show.ts`).
 * Nothing for a site that does not list its scenes.
 */
import * as React from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { Popover } from "@/core/ui/popover";
import { previewsOnPage, scenesOnPage, showScene, stepScene } from "./sceneStep";
import { stateLooksIn } from "./show";
import { checkIn, checkOut, type CheckedOut } from "./stateEdits";
import { panelKey, type RuleNode } from "./stateRules";
import { usePanelsPageOpen } from "./PanelsPage";
import { useStudio } from "../store";

/*
 * "This state only": the panels on show wear this preview's state, checked
 * out on the board's parts, so whatever is edited is kept as that state's
 * look when they are checked back in (`stateEdits.ts`). One preview at a time.
 */
let worn: CheckedOut[] = [];
function takeOff() {
  if (!worn.length) return;
  const outs = worn;
  worn = [];
  useStudio.setState((s) => {
    let nodes = s.nodes as never;
    for (const out of [...outs].reverse()) nodes = checkIn(nodes, out) as never;
    return { nodes };
  });
}
function wear(pageId: string, scene: { panels: Record<string, string> }) {
  takeOff();
  let nodes = useStudio.getState().nodes as never;
  for (const g of stateLooksIn(nodes as RuleNode[], pageId, scene)) {
    const got = checkOut(nodes, g.key, g.ids);
    nodes = got.nodes as never;
    worn.push(got.out);
  }
  if (worn.length) useStudio.setState({ nodes });
}
/* Leaving the builder with a state worn would keep its look as the part's own. */
if (typeof window !== "undefined") window.addEventListener("pagehide", takeOff);

export function ShowSwitch() {
  const activePageId = useStudio((s) => s.activePageId);
  const look = useStudio((s) => s.look);
  const statesOn = useStudio((s) => s.statesOn);
  const nodes = useStudio((s) => s.nodes);
  const panelsOpen = usePanelsPageOpen();
  const { previews, onTop, at, scene } = React.useMemo(() => previewsOnPage({ activePageId, look, statesOn, nodes }), [activePageId, look, statesOn, nodes]);
  const [open, setOpen] = React.useState(false);
  const [only, setOnly] = React.useState(false);
  /* The Panels page edits states its own way; this lets go while it is open. */
  const wearing = only && !!scene && !panelsOpen;
  React.useEffect(() => {
    if (!wearing || !scene) return;
    wear(activePageId, scene);
    return () => takeOff();
  }, [wearing, scene?.name, activePageId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!previews.length) return null;
  const now = at >= 0 ? previews[at]! : null;
  const pickScene = (name: string | null) => {
    setOpen(false);
    const { scenes, at: was } = scenesOnPage(useStudio.getState());
    const i = name ? scenes.findIndex((x) => x.name === name) : -1;
    showScene(i, i >= was ? 1 : -1);
  };
  const flipTop = (panel: string, state: string) => {
    play("tap");
    const st = useStudio.getState();
    const k = panelKey(panel, state);
    const on = st.statesOn ?? [];
    st.setStatesOn(on.includes(k) ? on.filter((x) => x !== k) : [...on, k]);
  };
  const topsOn = onTop.filter((t) => (statesOn ?? []).includes(panelKey(t.panel, t.state)));
  return (
    /* A fixed width: a long name is cut short, so the arrows never move under a pointer clicking through. */
    <div data-scene-arrows="" data-show-switch="" className="flex h-6 w-[20rem] shrink-0 items-center rounded-md border border-accent/60 bg-accent-soft/40">
      <button type="button" data-scene-prev="" aria-label="Show the previous preview" title="Previous (←)" onClick={() => stepScene(-1)} className="tactile flex size-6 items-center justify-center text-fg-muted hover:text-fg"><ChevronLeft className="size-3.5" /></button>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        className="max-h-[70vh] w-auto min-w-[240px] max-w-[320px] overflow-y-auto p-1"
        content={
          <div data-scene-list="" className="flex flex-col gap-0.5">
            <p className="px-2 py-1 text-fine text-fg-faint">What the board shows. An edit changes every preview unless "This state only" is on. ← → step through them.</p>
            <button type="button" data-scene-pick="" data-show-preview="" aria-pressed={at < 0} onClick={() => pickScene(null)}
              className={cn("tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain", at < 0 ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
              <span className="num w-6 shrink-0 text-fine text-fg-faint">0</span>
              <span className="min-w-0 flex-1 truncate">As it opens</span>
              {at < 0 ? <Check className="size-3 shrink-0 text-accent" /> : null}
            </button>
            {previews.map((p, i) => {
              const lit = i === at;
              return (
                <div key={p.key} className="flex flex-col gap-0.5">
                  <button type="button" data-scene-pick={p.scenes[0]!.name} data-show-preview={p.key} aria-pressed={lit} onClick={() => pickScene(p.scenes[0]!.name)}
                    className={cn("tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain", lit ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
                    <span className="num w-6 shrink-0 text-fine text-fg-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {lit ? <Check className="size-3 shrink-0 text-accent" /> : null}
                  </button>
                  {/* The moment's page states, as chips: the match starting and live, won and lost. */}
                  {p.scenes.length > 1 ? (
                    <div className="flex flex-wrap gap-1 pb-1 pl-8 pr-1">
                      {p.scenes.map((x, j) => (
                        <button key={x.name} type="button" {...(j ? { "data-scene-pick": x.name } : {})} data-show-chip={x.name} aria-pressed={scene === x} title={x.label} onClick={() => pickScene(x.name)}
                          className={cn("tactile h-6 max-w-[200px] truncate rounded-full border px-2 text-small", scene === x ? "border-accent bg-accent text-accent-fg" : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg")}>
                          {(x.label ?? x.name).replace(/^[^:]{1,40}:\s*/, "") || x.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {onTop.length ? <p className="px-2 pt-1 text-fine font-medium text-fg-muted">On top</p> : null}
            {onTop.map((t) => {
              const lit = topsOn.includes(t);
              return (
                <button key={t.panel} type="button" data-show-top={t.panel} aria-pressed={lit} onClick={() => flipTop(t.panel, t.state)}
                  className={cn("tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain", lit ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
                  <span className={cn("size-3 shrink-0 rounded-sm border", lit ? "border-accent bg-accent" : "border-border")} />
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                </button>
              );
            })}
            <div className="mt-1 border-t border-border pt-1">
              <button type="button" data-show-only="" aria-pressed={only} disabled={!scene || panelsOpen} onClick={() => { play("tap"); setOnly((v) => !v); }}
                title={scene ? `On: the panels wear ${now?.name ?? "this preview"}'s state, and an edit changes that state only` : "Pick a preview first"}
                className={cn("tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain disabled:opacity-40", only ? "text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
                <span className={cn("flex size-3 shrink-0 items-center justify-center rounded-sm border", only ? "border-accent bg-accent text-accent-fg" : "border-border")}>{only ? <Check className="size-2.5" /> : null}</span>
                <span className="min-w-0 flex-1 truncate">This state only</span>
              </button>
            </div>
          </div>
        }
      >
        <button type="button" data-scene-now={scene?.name ?? ""} title={`Show: ${now?.name ?? "as it opens"}. Pick one, or step with ← →`} className="tactile flex h-6 min-w-0 flex-1 items-center gap-1 px-1 text-small text-fg">
          <span className="shrink-0 font-medium">Show</span>
          <span className="num w-10 shrink-0 text-fg-faint">{at + 1}/{previews.length}</span>
          <span className="min-w-0 flex-1 truncate text-left text-fg-muted">{now?.name ?? "as it opens"}{topsOn.length ? ` + ${topsOn.map((t) => t.label).join(", ")}` : ""}</span>
          {wearing ? <span data-show-only-on="" className="shrink-0 rounded-sm bg-accent px-1 text-fine text-accent-fg">this state</span> : null}
        </button>
      </Popover>
      <button type="button" data-scene-next="" aria-label="Show the next preview" title="Next (→)" onClick={() => stepScene(1)} className="tactile flex size-6 items-center justify-center text-fg-muted hover:text-fg"><ChevronRight className="size-3.5" /></button>
    </div>
  );
}
