"use client";
/**
 * START SOMETHING: the five ways a site begins, big, at the top of Builds.
 *
 * J (2026-10-25): the home page should have big clear entries to start new
 * things. Each is one press into the flow that already exists:
 *
 *   Import a site        the capture dialog in the Builder (`?start=capture`);
 *   Start from an idea   a blank site, and the idea dialog over it (`?start=idea`);
 *   Make variations      pick a site, and its Variations page;
 *   Blank site           a blank site, open in the Builder;
 *   Agents               the dock, open (`?start=agents`); "Set up agents"
 *                        until the dock has paired on this PC.
 *
 * No call is made to decide the agents entry's words: the record the dock
 * leaves (`agentsOnSite.ts`) says whether it has paired lately.
 */
import * as React from "react";
import { Bot, Camera, Dices, FilePlus2, Sparkles } from "lucide-react";
import { Popover } from "@/core/ui/popover";
import { cn } from "@/core/lib/cn";
import { useActions } from "@/core/actions";
import { useBuilds } from "./store";
import { pairedRecently } from "./agentsOnSite";
import { startHref } from "./start";

export const START_ENTRIES = ["capture", "idea", "variations", "blank", "agents"] as const;
export type StartEntry = (typeof START_ENTRIES)[number];

function Entry({ id, icon: Icon, title, body, onClick, children }: { id: StartEntry; icon: React.ComponentType<{ className?: string }>; title: string; body: string; onClick?: () => void; children?: React.ReactNode }) {
  const inner = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft/40 text-accent">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight text-fg">{title}</span>
        <span className="mt-0.5 block text-plain leading-snug text-fg-muted">{body}</span>
      </span>
    </>
  );
  const cls = cn(
    "tactile group flex h-full w-full items-start gap-3 rounded-xl border border-border bg-panel p-3.5 text-left transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
    "hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-[0_18px_36px_-22px_var(--accent)] motion-reduce:hover:translate-y-0",
  );
  return (
    <li className="min-w-0">
      {children ?? (
        <button type="button" data-start={id} onClick={onClick} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}

export function StartRow() {
  const ctx = useActions();
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const [picking, setPicking] = React.useState(false);
  /* Read on the client after mount: the record is this browser's, and the server has none. */
  const [paired, setPaired] = React.useState(false);
  React.useEffect(() => {
    const read = () => setPaired(pairedRecently());
    read();
    window.addEventListener("builds:agents", read);
    return () => window.removeEventListener("builds:agents", read);
  }, []);

  const blank = (then: string) => { useBuilds.getState().create(); ctx.navigate(then); };
  const variationsOf = (id: string) => { setPicking(false); ctx.navigate(`/builder/variations?of=${encodeURIComponent(id)}`); };
  const entryCls = "tactile group flex h-full w-full items-start gap-3 rounded-xl border border-border bg-panel p-3.5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-[0_18px_36px_-22px_var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

  return (
    <section aria-labelledby="builds-start" data-start-row="" className="mt-8">
      <h2 id="builds-start" className="flex items-center gap-2 text-small font-medium uppercase tracking-[0.12em] text-fg-faint">Start something</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Entry id="capture" icon={Camera} title="Import a site" body="Paste an address: it is captured and brought in, every part editable." onClick={() => ctx.navigate(startHref("capture"))} />
        <Entry id="idea" icon={Sparkles} title="Start from an idea" body="Say what the site is, and Claude drafts it in the house style." onClick={() => blank(startHref("idea"))} />
        <Entry id="variations" icon={Dices} title="Make variations" body="Better versions of a site you have, each a copy beside the original.">
          {projects.length > 1 ? (
            <Popover
              open={picking}
              onOpenChange={setPicking}
              align="start"
              className="w-64 bg-panel p-1.5"
              content={
                <>
                  <div className="px-1.5 pb-1 pt-0.5 text-small font-medium uppercase tracking-wider text-fg-faint">Variations of which site?</div>
                  <ul data-start-variations-list="" className="max-h-72 overflow-y-auto">
                    {projects.map((p) => (
                      <li key={p.id}>
                        <button type="button" data-start-variations-of={p.id} onClick={() => variationsOf(p.id)} className="tactile flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-xs text-fg-muted hover:bg-hover hover:text-fg">
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          {p.id === activeId ? <span className="shrink-0 text-small text-accent">open</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              }
            >
              <button type="button" data-start="variations" aria-expanded={picking} className={entryCls}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft/40 text-accent"><Dices className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-tight text-fg">Make variations</span>
                  <span className="mt-0.5 block text-plain leading-snug text-fg-muted">Better versions of a site you have, each a copy beside the original.</span>
                </span>
              </button>
            </Popover>
          ) : (
            <button type="button" data-start="variations" onClick={() => { const id = activeId ?? projects[0]?.id; if (id) variationsOf(id); }} className={entryCls}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft/40 text-accent"><Dices className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-fg">Make variations</span>
                <span className="mt-0.5 block text-plain leading-snug text-fg-muted">Better versions of a site you have, each a copy beside the original.</span>
              </span>
            </button>
          )}
        </Entry>
        <Entry id="blank" icon={FilePlus2} title="Blank site" body="An empty board: bring a repository in, or start from nothing." onClick={() => blank("/builder")} />
        <Entry
          id="agents"
          icon={Bot}
          title={paired ? "Open the agents dock" : "Set up agents"}
          body={paired ? "Ask for a change and watch the agents work on the open site." : "The agents run through Polio Helper on this PC. Pair it once."}
          onClick={() => ctx.navigate(startHref("agents"))}
        />
      </ul>
    </section>
  );
}
