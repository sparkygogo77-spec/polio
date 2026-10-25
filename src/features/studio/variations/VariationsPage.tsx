"use client";
/**
 * VARIATIONS: many better versions of one site, each beside the original.
 *
 * `/builder/variations?of=<site>&v=<variation>`. J picks what to aim at
 * (cleaner, more modern, like a site he names, clearer for visitors) and
 * presses Randomize for four made here, free and at once, or Ask Claude for
 * four from one call. Every variation is a site of its own (a Duplicate,
 * `versionOf`), so the original is never touched.
 *
 * The shown variation stands beside the original, scrolling together, as in
 * Compare. Under it, its six layers, each with a lock: Randomize again
 * re-rolls only the unlocked ones. Keep opens it in the Builder; Discard
 * throws it away. Claude's word suggestions are listed for him to accept one
 * at a time; none is put in until he does.
 */
import * as React from "react";
import { Check, Dices, Lock, LockOpen, Sparkles, Trash2 } from "lucide-react";
import { Select } from "@/core/ui/select";
import { EmptyState } from "@/core/ui/empty-state";
import { cn } from "@/core/lib/cn";
import { docOfStored, useBuilds } from "@/features/builds/store";
import { SitePreview, type PreviewDoc } from "../SitePreview";
import { useScrollLock, useInnerWidth } from "../compare/scrollLock";
import { compareHref, frameOf } from "../compare/model";
import { AIMS, AIM_LABEL, LAYERS, LAYER_LABEL, specWords, type Aim, type Layer, type Spec } from "./model";
import { useVariations, variationsOf } from "./store";
import { acceptWord, again, discard, keep, makeVariations } from "./run";

const NONE = "__none";
const BATCH = 4;

/** What a layer is in the shown variation, in plain words. */
function layerSays(spec: Spec, l: Layer): string {
  if (!spec[l]) return "as the original";
  const one = specWords({ colours: null, type: null, space: null, layout: null, order: null, motion: null, [l]: spec[l] } as Spec)[0] ?? "";
  return one.replace(/^[^:]+:\s*/, "");
}

export function VariationsPage() {
  const projects = useBuilds((s) => s.projects);
  const byId = useVariations((s) => s.byId);
  const lockMap = useVariations((s) => s.locks);
  const [of, setOf] = React.useState<string | null>(null);
  const [shown, setShown] = React.useState<string | null>(null);
  const [aims, setAims] = React.useState<Aim[]>(["cleaner"]);
  const [like, setLike] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);

  React.useEffect(() => {
    void useBuilds.persist.rehydrate()?.then?.(() => useBuilds.getState().adopt());
    void useVariations.persist.rehydrate();
    const q = new URLSearchParams(window.location.search);
    setOf(q.get("of"));
    setShown(q.get("v"));
    /* For the checks (tests/variations.mjs): read only. */
    const hook = { list: (of: string) => variationsOf(useVariations.getState().byId, of), doc: (id: string) => docOfStored(id, useBuilds.getState().activeId === id) };
    (window as unknown as { __polioVariations?: unknown }).__polioVariations = hook;
    return () => { delete (window as unknown as { __polioVariations?: unknown }).__polioVariations; };
  }, []);
  const go = (next: { of?: string | null; v?: string | null }) => {
    const o = next.of !== undefined ? next.of : of, v = next.v !== undefined ? next.v : shown;
    setOf(o); setShown(v);
    const q = new URLSearchParams();
    if (o) q.set("of", o);
    if (v) q.set("v", v);
    window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
  };

  const list = of ? variationsOf(byId, of).filter((x) => projects.some((p) => p.id === x.id)) : [];
  const current = list.find((x) => x.id === shown) ?? list[0] ?? null;
  const locks = (of && lockMap[of]) || [];
  const docA = useDoc(of, 0);
  /* Written again by Randomize again or a word accepted: read again when its record changes. */
  const docB = useDoc(current?.id ?? null, current ? current.v.made + (current.v.accepted?.length ?? 0) : 0);

  const run = async (what: string, fn: () => Promise<{ ok: boolean; says?: string; ids?: string[] } | void>) => {
    setBusy(what); setSaid(null);
    try {
      const r = await fn();
      if (r && !r.ok) setSaid(r.says ?? "That did not work.");
      if (r && r.ok && r.ids?.[0]) go({ v: r.ids[0] });
    } finally { setBusy(null); }
  };
  const batch = (claude: boolean) => of && run(claude ? "claude" : "roll", () => makeVariations({ of, count: BATCH, aims, locks, from: current?.v ?? null, like: aims.includes("like") ? like : null, claude }));
  const toggleLock = (l: Layer) => of && useVariations.getState().setLocks(of, locks.includes(l) ? locks.filter((x) => x !== l) : [...locks, l]);

  const originals = projects.filter((p) => !byId[p.id]);
  const options = [{ value: NONE, label: "Choose a site" }, ...originals.map((p) => ({ value: p.id, label: p.name }))];
  const name = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "";

  return (
    <div data-variations="" className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-sm font-semibold uppercase tracking-[0.12em] text-fg-faint">Variations</h1>
        <Select aria-label="The original" className="w-52" value={of ?? NONE} options={options} onChange={(v) => go({ of: v === NONE ? null : v, v: null })} />
        {of ? <a className="text-plain text-fg-muted underline" href={compareHref(of, current?.id ?? null)}>Open in Compare</a> : null}
        <span className="text-plain text-fg-faint">drawn at <span className="num">{frameOf(docA)}</span> px, as captured</span>
      </div>

      {of ? (
        <>
          <section className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-2" data-variations-aims="">
            <div className="space-y-1">
              {AIMS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-plain text-fg">
                  <input type="checkbox" data-aim={a} checked={aims.includes(a)} onChange={(e) => setAims(e.target.checked ? [...aims, a] : aims.filter((x) => x !== a))} />
                  {AIM_LABEL[a]}
                </label>
              ))}
              {aims.includes("like") ? (
                <input data-variations-like="" value={like} onChange={(e) => setLike(e.target.value)} placeholder="a site to be like: stripe.com" className="ml-6 w-72 rounded-md border border-border bg-bg px-2 py-1 text-plain text-fg" />
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" data-variations-roll="" disabled={!!busy} onClick={() => batch(false)} className="tactile inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-plain font-medium text-fg">
                <Dices className="size-4" /> {busy === "roll" ? "Making…" : `Randomize ${BATCH}`}
              </button>
              <button type="button" data-variations-claude="" disabled={!!busy} onClick={() => batch(true)} className="tactile inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-plain text-fg" title="One Claude call with pictures of the pages: four variations at once. It uses your Claude key.">
                <Sparkles className="size-4" /> {busy === "claude" ? "Asking Claude…" : `Ask Claude for ${BATCH}`}
              </button>
            </div>
            {said ? <p data-variations-said="" className="w-full text-plain text-fg-muted">{said}</p> : null}
          </section>

          {list.length ? (
            <div className="mt-4 flex flex-wrap gap-2" data-variations-list="">
              {list.map((x) => (
                <button key={x.id} type="button" data-variation={x.id} aria-pressed={x.id === current?.id} onClick={() => go({ v: x.id })}
                  className={cn("tactile max-w-64 rounded-md border px-2 py-1 text-left text-small", x.id === current?.id ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted")}>
                  <div className="truncate font-medium">{name(x.id)}</div>
                  <div className="truncate">{x.v.by === "claude" ? x.v.note || "From Claude" : specWords(x.v.spec)[0] ?? "As the original"}</div>
                </button>
              ))}
            </div>
          ) : null}

          {current ? (
            <>
              <Pair a={{ id: of, name: `${name(of)} (the original)`, doc: docA }} b={{ id: current.id, name: name(current.id), doc: docB }} />
              <section className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]" data-variation-controls="">
                <div className="space-y-1" data-variation-layers="">
                  {current.v.note ? <p className="text-plain text-fg">{current.v.note}</p> : null}
                  {LAYERS.map((l) => {
                    const locked = locks.includes(l);
                    return (
                      <div key={l} className="flex items-start gap-2">
                        <button type="button" data-variation-lock={l} aria-pressed={locked} aria-label={`${locked ? "Unlock" : "Lock"} ${LAYER_LABEL[l]}`}
                          title={locked ? `${LAYER_LABEL[l]} stay as this variation has them. Press to let them change.` : `Keep ${LAYER_LABEL[l].toLowerCase()} as this variation has them when you randomize again.`}
                          onClick={() => toggleLock(l)}
                          className={cn("tactile mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border", locked ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted")}>
                          {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                        </button>
                        <div className="min-w-0 text-small">
                          <div className="font-medium text-fg">{LAYER_LABEL[l]}</div>
                          <div data-variation-says={l} className="text-fg-muted">{layerSays(current.v.spec, l)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" data-variation-again="" disabled={!!busy} onClick={() => run("again", () => again(current.id, locks))} className="tactile inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-plain font-medium text-fg">
                    <Dices className="size-4" /> {busy === "again" ? "Rolling…" : "Randomize again"}
                  </button>
                  <button type="button" data-variation-keep="" disabled={!!busy} onClick={() => run("keep", async () => { await keep(current.id); window.location.assign("/builder"); })} className="tactile inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-plain text-fg">
                    <Check className="size-4" /> Keep
                  </button>
                  <button type="button" data-variation-discard="" disabled={!!busy} onClick={() => run("discard", async () => { await discard(current.id); go({ v: null }); })} className="tactile inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-plain text-fg-muted">
                    <Trash2 className="size-4" /> Discard
                  </button>
                </div>
              </section>
              {current.v.words?.length ? (
                <section className="mt-4 space-y-1" data-variation-words="">
                  <h2 className="text-plain font-medium text-fg">Word suggestions. Your words stay until you accept one.</h2>
                  {current.v.words.map((w) => {
                    const on = !!current.v.accepted?.includes(w.id);
                    return (
                      <div key={w.id} className="flex items-start gap-2 text-small">
                        <button type="button" data-word={w.id} aria-pressed={on} disabled={!!busy} onClick={() => run("word", () => acceptWord(current.id, w.id, !on))} className={cn("tactile shrink-0 rounded-sm border px-2 py-0.5", on ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted")}>
                          {on ? "Accepted" : "Accept"}
                        </button>
                        <div className="min-w-0">
                          <div className="text-fg-muted line-through">{w.now}</div>
                          <div className="text-fg">{w.to}</div>
                          {w.why ? <div className="text-fg-faint">{w.why}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </section>
              ) : null}
            </>
          ) : (
            <EmptyState className="mt-8" icon={Dices} title="No variations yet" body="Tick what to aim at, then Randomize for four made here, or ask Claude for four. The original is never changed." />
          )}
        </>
      ) : (
        <EmptyState className="mt-8" icon={Dices} title="Choose a site" body="Pick the site to make variations of." />
      )}
    </div>
  );
}

interface Side { id: string; name: string; doc: PreviewDoc | null }

/** A site's stored document, read again whenever `rev` changes. */
function useDoc(id: string | null, rev: number): PreviewDoc | null {
  const active = useBuilds((s) => s.activeId);
  const [got, setGot] = React.useState<{ key: string; doc: PreviewDoc | null } | null>(null);
  const key = `${id}:${rev}`;
  React.useEffect(() => {
    if (!id) return;
    let alive = true;
    void docOfStored(id, id === active).then((doc) => { if (alive) setGot({ key, doc }); });
    return () => { alive = false; };
  }, [id, active, key]);
  return id && got?.key === key ? got.doc : null;
}

function Pair({ a, b }: { a: Side; b: Side }) {
  const [ea, setEa] = React.useState<HTMLDivElement | null>(null);
  const [eb, setEb] = React.useState<HTMLDivElement | null>(null);
  useScrollLock(ea, eb, true);
  return (
    <div data-variations-stage="" className="mt-4 grid gap-4 sm:grid-cols-2">
      <Pane which="a" side={a} refSet={setEa} />
      <Pane which="b" side={b} refSet={setEb} />
    </div>
  );
}

function Pane({ which, side, refSet }: { which: "a" | "b"; side: Side; refSet: (el: HTMLDivElement | null) => void }) {
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  const width = useInnerWidth(el);
  return (
    <section data-variations-pane={which} data-site-id={side.id} aria-label={side.name} className="min-w-0">
      <h2 className="mb-1.5 truncate text-plain font-medium text-fg-muted">{side.name}</h2>
      <div ref={(n) => { setEl(n); refSet(n); }} data-variations-scroll="" className="h-[70vh] overflow-y-auto overflow-x-hidden rounded-md border border-border [scrollbar-gutter:stable]">
        {width > 0 ? <SitePreview doc={side.doc} width={width} height={width} whole /> : null}
      </div>
    </section>
  );
}
