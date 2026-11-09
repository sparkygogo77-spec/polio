"use client";
/**
 * THE AGENTS BUTTON, THE DOCK AND ASK AGENTS (J, 2026-10-25, Q9).
 *
 * The button sits in the top bar. It opens a dock on the right, over the side
 * panel. Its first tab, a column 460px wide, is the lanes board (`LanesBoard.tsx`):
 * every chat working for J, with the coordinator's questions above it to answer
 * by a press (`Decisions.tsx`). Its second, 380px wide, is a frame the helper serves at
 * 127.0.0.1:47821/dock. Everything that frame does (Plan it, Start, Approve,
 * Pause, Stop) is a press inside it. This page only hands it context as data
 * (`context.ts`), each time it opens or the part changes, and only to the
 * helper's origin.
 *
 * When the helper doesn't answer, the dock says how to set it up and start
 * it (`polio-helper://start`), and offers the dock in its own tab, which
 * works where a frame is refused.
 *
 * Ask agents: a part's wheel has it in its tray, and a part's right-click
 * menu in Live has it as a submenu. Both lead to the same five actions, and
 * each opens the dock with the action and the part's chips filled in.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { Bot, Code2, ExternalLink, Lightbulb, Pencil, Play, RefreshCw, Server, ShieldCheck, X } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { useStudio } from "@/features/studio/board/store";
import { siteSystem } from "@/features/studio/system/api";
import { ACTION_WORDS, DOCK_URL, HELPER_ORIGIN, PART_ACTIONS, START_LINK, checkContext, installLine, uninstallLine, contextFor, type AgentsContext, type PartAction, type PartLike, type SystemLike } from "./context";
import { closeAsk, closeDock, openDock, reachHelper, setDockTab, useAgents } from "./store";
import { listen } from "./bridge";
import { LanesBoard } from "./LanesBoard";
import { startAsked } from "@/features/builds/start";

export const ACTION_ICONS: Record<PartAction, typeof Bot> = { change: Pencil, features: Lightbulb, security: ShieldCheck, backend: Server, explain: Code2 };

/** The context for a part (or the picked one), read from the board as it is now. */
export function readContext(action: PartAction | null, partId: string | null): AgentsContext {
  const s = useStudio.getState();
  const id = partId ?? s.selection.find((x) => s.nodes.some((n) => n.id === x)) ?? null;
  const node = id ? s.nodes.find((n) => n.id === id) ?? null : null;
  const page = s.pages.find((p) => p.id === (node?.pageId ?? s.activePageId)) ?? null;
  return contextFor(action, node as unknown as PartLike | null, page, s.frameWidth, siteSystem() as unknown as SystemLike | null);
}

/* What was handed to the frame, for the tests and for a look in the console. */
const sent: AgentsContext[] = [];
if (typeof window !== "undefined") { const w = window as unknown as { __agents?: Record<string, unknown> }; w.__agents = { ...(w.__agents ?? {}), sent }; }

function hand(frame: HTMLIFrameElement | null, ctx: AgentsContext) {
  if (!frame?.contentWindow) return;
  const why = checkContext(ctx);
  if (why.length) { console.warn("Agents: context not sent:", why.join("; ")); return; }
  sent.push(ctx);
  // The helper's origin, never "*": a frame that navigated elsewhere gets nothing.
  frame.contentWindow.postMessage(ctx, HELPER_ORIGIN);
}

export function AgentsButton() {
  const open = useAgents((s) => s.open);
  return (
    <Tooltip content={open ? "Close the agents dock" : "Agents: ask for a change, see what the agents are doing"}>
      <Button
        variant={open ? "subtle" : "ghost"}
        size="sm"
        aria-label="Agents"
        aria-pressed={open}
        data-agents-button=""
        onClick={() => (open ? closeDock() : openDock())}
      >
        <Bot />
        Agents
      </Button>
    </Tooltip>
  );
}

/** The commit this Builder was built from, for the install line (null until known, or on a build that has none). */
function useBuiltCommit(): string | null {
  const [commit, setCommit] = React.useState<string | null>(null);
  React.useEffect(() => {
    let on = true;
    fetch("/api/version", { cache: "no-store" }).then((r) => r.json()).then((v: { commit?: unknown }) => { if (on && typeof v.commit === "string") setCommit(v.commit); }).catch(() => {});
    return () => { on = false; };
  }, []);
  return commit;
}

function Setup() {
  const checking = useAgents((s) => s.reach === "checking");
  const commit = useBuiltCommit();
  const install = installLine(commit);
  return (
    <div data-agents-setup="" className="flex flex-col gap-3 p-4 text-small">
      <p className="font-medium">The helper isn&apos;t answering on this PC.</p>
      <p className="text-fg-muted">The agents run through Polio Helper, a small app on your PC. The dock is its page, so it shows here once the helper is running.</p>
      <a data-agents-start="" href={START_LINK} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-white">
        <Play className="size-3.5" /> Start the helper
      </a>
      <details data-agents-setup-steps="">
        <summary className="cursor-pointer">Set up the helper</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-fg-muted">
          <li>
            Install Polio Helper once: paste this line into PowerShell. It doesn&apos;t start with Windows.
            <code data-agents-install-line="" data-pinned={install.pinned ? "1" : "0"} className="mt-1 block select-all break-all rounded bg-surface p-1.5 font-mono text-[10px] text-fg">{install.line}</code>
            {install.pinned ? null : <span className="block text-[10px]">This Builder doesn&apos;t know its commit, so the line takes the newest helper.</span>}
          </li>
          <li>Press Start the helper. The first time, Windows asks to open Polio Helper.</li>
          <li>When Chrome asks to connect to devices on your local network, press Allow.</li>
          <li>In the dock, press Show a code on my PC, type the code the helper shows, and press Pair.</li>
        </ol>
        <p className="mt-2 text-fg-muted">To remove it, paste this line; it lists what it removes and what it leaves.</p>
        <code data-agents-uninstall-line="" className="mt-1 block select-all break-all rounded bg-surface p-1.5 font-mono text-[10px] text-fg">{uninstallLine(commit)}</code>
      </details>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" data-agents-retry="" disabled={checking} onClick={() => void reachHelper()}>
          <RefreshCw /> {checking ? "Looking…" : "Try again"}
        </Button>
        <a data-agents-fallback="" href={DOCK_URL} target="_blank" rel="noopener" className="inline-flex h-7 items-center gap-1 px-2 text-xs underline-offset-2 hover:underline">
          <ExternalLink className="size-3.5" /> Open the dock in its own tab
        </a>
      </div>
    </div>
  );
}

function Dock() {
  const { action, partId, reach, seq, compare, tab } = useAgents();
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = React.useState(false);
  /* The picked part, so a new pick hands the frame new chips. */
  const picked = useStudio((s) => s.selection.join(","));
  React.useEffect(() => {
    if (loaded) hand(frame.current, readContext(action, partId));
  }, [loaded, action, partId, picked, seq]);
  /* The site bridge hears this frame, and only it, while it shows (`bridge.ts`). */
  React.useEffect(() => (loaded && frame.current ? listen(frame.current) : undefined), [loaded]);
  return (
    <aside
      data-agents-dock=""
      aria-label="Agents"
      className={`fixed bottom-0 right-0 top-(--topbar-h) z-[60] flex ${tab === "chats" ? "w-[460px]" : "w-[380px]"} max-w-full flex-col border-l border-border glass shadow-panel`}
    >
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-wide">AGENTS{action ? ` · ${ACTION_WORDS[action]}` : ""}</span>
          <span role="tablist" aria-label="Agents" className="flex gap-1">
            {(["chats", "helper"] as const).map((t) => (
              <Button key={t} role="tab" variant={tab === t ? "subtle" : "ghost"} size="xs" aria-selected={tab === t} data-agents-tab={t} onClick={() => setDockTab(t)}>{t === "chats" ? "Chats" : "Helper"}</Button>
            ))}
          </span>
        </span>
        <Button variant="ghost" size="iconXs" aria-label="Close agents" data-agents-close="" onClick={closeDock}><X /></Button>
      </header>
      {/* The helper's page stays loaded under the board: site calls reach the Builder through it, whichever tab shows. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      {tab === "chats" ? <LanesBoard /> : null}
      <div inert={tab === "chats"} className="flex min-h-0 flex-1 flex-col">
      {compare ? (
        <p data-agents-compare="" className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-xs text-fg-muted">
          <span>“{compare.name}” was big, so a copy of the site before it was kept.</span>
          <a href={compare.href} target="_blank" rel="noopener" className="shrink-0 underline-offset-2 hover:underline">Compare before and after</a>
        </p>
      ) : null}
      {reach === "up" ? (
        <iframe
          ref={frame}
          data-agents-frame=""
          title="Agents dock"
          src={DOCK_URL}
          onLoad={() => setLoaded(true)}
          /* Its own page on its own origin: scripts and its forms, nothing reaching back into this one. */
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          /* Chrome's Local Network Access: a public page's frame of 127.0.0.1 loads only with this delegated (and J's yes once). */
          allow="local-network-access"
          className="min-h-0 flex-1 border-0"
        />
      ) : reach === "down" ? <Setup /> : <p className="p-4 text-small text-fg-muted">Looking for the helper…</p>}
      </div>
      </div>
    </aside>
  );
}

/** The five actions, by a part, where the wheel's tray asked for them. */
function AskChooser() {
  const ask = useAgents((s) => s.ask);
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!ask) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) closeAsk(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") closeAsk(); };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", away, true); window.removeEventListener("keydown", esc); };
  }, [ask]);
  if (!ask) return null;
  const x = Math.max(8, Math.min(ask.x, window.innerWidth - 220));
  const y = Math.max(8, Math.min(ask.y, window.innerHeight - 220));
  return createPortal(
    <div ref={box} data-agents-ask={ask.partId} role="menu" aria-label="Ask agents" style={{ left: x, top: y }} className="fixed z-[70] w-52 rounded-md border border-border bg-elevated p-1 text-fg shadow-lg">
      <div className="px-2 py-1 text-xs text-fg-muted">Ask agents</div>
      {PART_ACTIONS.map((a) => {
        const Icon = ACTION_ICONS[a];
        return (
          <button key={a} role="menuitem" data-agents-action={a} onClick={() => openDock(a, ask.partId)} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-hover">
            <Icon className="size-3.5" /> {ACTION_WORDS[a]}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/** Mounted once from the top bar; draws nothing there itself. */
export function AgentsHost() {
  const open = useAgents((s) => s.open);
  const [here, setHere] = React.useState(false);
  /* Builds' agents entry opens the Builder with `?start=agents` (`builds/start.ts`): the dock opens with it. */
  React.useEffect(() => { setHere(true); if (startAsked("agents")) openDock(); }, []);
  if (!here) return null;
  return (
    <>
      {open ? createPortal(<Dock />, document.body) : null}
      <AskChooser />
    </>
  );
}
