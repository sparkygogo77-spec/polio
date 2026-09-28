"use client";
/**
 * The one box: say what a part is, and it is.
 *
 * It replaces the pencil's words, contents, links, data and priority with one
 * place to type. What is typed is read (`library/read.ts`) and applied at
 * once: a web address becomes the link, a page's name a link to that page,
 * plain text the words, a feature from the library ("sol price") is attached,
 * and anything else is kept as a task for the code chat. It says how it
 * understood it, with undo beside that, and asks only when two readings are
 * both fair. The old controls are one press away, under "more".
 *
 * The orange ! on the board opens straight onto this.
 */
import * as React from "react";
import { Ellipsis, Info, Undo2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
import { getFeature } from "./catalog";
import { useStudio, type StudioNode } from "./store";
import { PlateQuad, RailButton, SCREEN, SCREEN_FIELD, Tick } from "./PlateEditors";
import type { Slab } from "./RingConsole";
import { plain, reword } from "./parts/spans";
import { growToWords } from "./growToWords";
import { readWords, type Reading } from "./library/read";
import { allWorks, describeWork, getWork, inputsOf, usesOf, withInput, withoutWork, withWork } from "./library/works";

const field = `min-h-0 w-full text-small leading-snug ${SCREEN_FIELD}`;
/** Parts that draw no words: plain text typed on one is an instruction, not copy. */
const WORDLESS = new Set(["drawn-icon", "picture"]);

type Applied = Exclude<Reading, { kind: "ask" } | { kind: "nothing" }>;
/** The fields a reading can change, so undo puts back exactly those. */
const TOUCHES = ["link", "content", "work", "task", "settled"] as const;
type Before = Pick<StudioNode, "link" | "content" | "work" | "task" | "settled">;

/** What a part is now, in the box's own words. */
export function nowSays(node: StudioNode, pages: { id: string; name: string }[]): string | null {
  if (node.work && getWork(node.work.id)) return describeWork(node.work);
  if (node.link?.kind === "page") return `a link to the ${pages.find((p) => p.id === node.link!.target)?.name ?? "?"} page`;
  if (node.link?.kind === "url") return `a link to ${node.link.target.replace(/^https?:\/\//, "")}`;
  if (node.link) return "a link";
  if (node.task?.trim()) return `a task: “${node.task.trim()}”`;
  return null;
}

/** What applying a reading changes on the part. */
export function patchFor(node: StudioNode, r: Applied): Partial<StudioNode> {
  switch (r.kind) {
    case "link": return { link: r.link };
    /* Words typed here are chosen: on a live-data spot they are its answer. */
    case "words": return { content: reword(node.content, r.text), settled: true };
    /* A feature joins the ones the part has; the same one again, or live data over live data, replaces. */
    case "work": return { work: withWork(node.work, r.work) };
    case "task": return { task: r.text };
  }
}

export function SayPlate({ node, plate, onMore }: { node: StudioNode; plate: Slab; onMore: () => void }) {
  const pages = useStudio((s) => s.pages);
  const feature = getFeature(node.featureId);
  const [text, setText] = React.useState("");
  const [asking, setAsking] = React.useState<Reading & { kind: "ask" } | null>(null);
  const [done, setDone] = React.useState<{ say: string; before: Before } | null>(null);
  const [info, setInfo] = React.useState(false);
  const box = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { box.current?.focus(); }, [node.id]);

  const apply = (r: Applied) => {
    const st = useStudio.getState();
    const was = st.nodes.find((n) => n.id === node.id) ?? node;
    const before = Object.fromEntries(TOUCHES.map((k) => [k, was[k] ?? (k === "settled" ? false : null)])) as Before;
    st.updateNode(node.id, patchFor(was, r));
    if (r.kind === "words") growToWords(node.id);
    setDone({ say: r.say, before });
    setAsking(null);
    setText("");
    play("confirm");
  };
  const submit = () => {
    const r = readWords(text, {
      pages: pages.map((p) => ({ id: p.id, name: p.name, path: p.path })),
      works: allWorks().map((w) => w.manifest),
      drawsWords: !WORDLESS.has(node.featureId) && (!!feature?.content || !!plain(node.content).trim()),
      words: plain(node.content),
    });
    if (r.kind === "nothing") return;
    if (r.kind === "ask") { setAsking(r); setDone(null); play("select"); return; }
    apply(r);
  };
  const undo = () => {
    if (!done) return;
    useStudio.getState().updateNode(node.id, done.before);
    setDone(null);
    play("close");
  };

  const now = nowSays(node, pages);
  const rail = (
    <>
      <RailButton label={info ? "Hide how the box reads" : "How does the box read?"} on={info} onClick={() => setInfo((v) => !v)}>
        <Info className="size-3" />
      </RailButton>
      <RailButton label="more" onClick={onMore}>
        <Ellipsis className="size-3" />
      </RailButton>
    </>
  );

  return (
    <PlateQuad
      slab={plate}
      title="Say what it is"
      sub={feature?.name ?? node.label}
      side={rail}
      lead={info ? (
        <p className="text-[8.5px] leading-snug" style={{ color: SCREEN.dim }}>
          A web address is a link, a page&apos;s name links there, plain words are its words, “sol price” attaches that feature, anything else is a task.
        </p>
      ) : null}
    >
      <div data-say-box={node.id} className="flex flex-1 flex-col gap-1">
        {now && !done ? <p data-say-now="" className="truncate font-mono text-[8px]" style={{ color: SCREEN.dim }} title={now}>now: {now}</p> : null}
        <Input
          ref={box}
          inputSize="sm"
          value={text}
          aria-label="Say what it is"
          data-say-input=""
          className={field}
          placeholder="a link, a page, words, sol price, or a task"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); }
          }}
        />
        {asking ? (
          <div data-say-ask="" className="flex flex-col gap-1">
            <span className="text-[8.5px] leading-snug" style={{ color: SCREEN.ink }}>{asking.question}</span>
            <div className="flex flex-wrap gap-1">
              {asking.options.map((o, i) => <Tick key={i} on={false} onClick={() => apply(o)}>{o.say}</Tick>)}
            </div>
          </div>
        ) : null}
        {done ? (
          <div data-understood={done.say} className="flex flex-col items-start gap-0.5">
            <span className="line-clamp-2 text-[8px] leading-tight" style={{ color: SCREEN.ink }} title={done.say}>understood as {done.say}</span>
            <button
              type="button"
              data-say-undo=""
              onClick={undo}
              className="pointer-events-auto flex h-[18px] items-center gap-0.5 rounded-[3px] px-1 font-mono text-[8px] font-semibold"
              style={{ background: SCREEN.key, color: SCREEN.ink, outline: `1px solid ${SCREEN.line}` }}
            >
              <Undo2 className="size-2.5" /> undo
            </button>
          </div>
        ) : null}
        {usesOf(node.work).map((use) => {
          const w = getWork(use.id);
          if (!w) return null;
          const set = (input: string, value: string) => useStudio.getState().updateNode(node.id, { work: withInput(node.work, use.id, input, value) });
          return (
            <div key={use.id} data-say-work={use.id} className="flex flex-col gap-1">
              {usesOf(node.work).length > 1 ? <span className="font-mono text-[8px]" style={{ color: SCREEN.dim }}>{w.manifest.name}</span> : null}
              {w.manifest.inputs.map((i) => {
                const v = inputsOf(w.manifest, use.inputs)[i.id] ?? "";
                if (i.kind === "one") {
                  return (
                    <div key={i.id} className="flex flex-wrap items-center gap-1">
                      {(i.values ?? []).map((x) => <Tick key={x} on={v === x} onClick={() => set(i.id, x)}>{x}</Tick>)}
                    </div>
                  );
                }
                return <Input key={i.id} value={v} aria-label={i.label} inputSize="sm" className={field} placeholder={i.placeholder ?? i.label} onChange={(e) => set(i.id, e.target.value)} />;
              })}
              <div><Tick on={false} onClick={() => useStudio.getState().updateNode(node.id, { work: withoutWork(node.work, use.id) })}>{usesOf(node.work).length > 1 ? `take ${w.manifest.name} off` : "take the feature off"}</Tick></div>
            </div>
          );
        })}
      </div>
    </PlateQuad>
  );
}
