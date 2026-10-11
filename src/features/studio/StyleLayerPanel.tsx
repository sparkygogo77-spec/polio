"use client";
/**
 * "Send the design back": the style layer, in the repo menu.
 *
 * Shown only for a site brought in from a code repository's HTML pages
 * (`look.styleSource`). It says first what the layer would do, in plain
 * words: how many parts it restyles, which hooks are covered, untouched or
 * missing, with a warning for each missing one; then, on one press, puts
 * the layer on a new `style/` branch of that repository and gives the
 * compare link, so the owner reads the change and merges it himself. The
 * CSS variables the source exposes are listed under "Advanced", each with
 * its colour, to set by hand. `styleLayer.ts` holds the rules.
 *
 * Before each design round it reads the repository again (`kitRun.ts
 * readRound`): the default branch's builder.json and hooks map, or its
 * pages' hooks, against what the site was brought in from, and says what
 * changed (pages and hooks added or gone, and the design's rules for hooks
 * no page has now). "Take these in" makes now the baseline, and for a
 * builder-ready repository takes its link rules again. The send opens a
 * pull request into the default branch; nothing here merges.
 */
import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/core/ui/button";
import { heldKeys } from "@/features/keys/store";
import { activeProject } from "@/features/builds/store";
import { useStudio } from "./board/store";
import { FAMILY, resolvePalette } from "./shelf/run";
import { wornPaint } from "./look";
import { buildLayer, wearTextures, colourKey, isColour, partSlots, partTokens, type LayerNode, type StyleSource } from "./send-out";
import { sendDesign } from "./codeSend";
import { gatherAsks } from "./publishAsks";
import { fixLoopOf, setFixLoop } from "./useFixLoop";
import { layerHooksOf, readRound, takeTokens, type CodeNotes, type KitManifest, type KitSeen, type RoundChanges } from "./kitRun";
import { kitLinksToOffsite } from "./shelf";
import { formatNumber, isScriptSlotKind, LINE_STYLES, parseFormat, parseKey, parseLine, parseSound, playSound, writeFormat, writeKey, writeLine, writeSound, type ScriptSlotKind } from "./slotKinds";
import { HandColour, HandRange } from "./HandSlider";

const head = "text-small font-medium uppercase tracking-[0.12em] text-fg-faint";
const warn = { borderColor: "oklch(0.7 0.15 18 / 0.45)", background: "oklch(0.7 0.15 18 / 0.08)" };

/** A colour input wants #rrggbb. */
function hexOf(v: string): string {
  const k = colourKey(v).split(",");
  if (k.length < 3) return /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
  return `#${k.slice(0, 3).map((x) => Math.max(0, Math.min(255, Number(x))).toString(16).padStart(2, "0")).join("")}`;
}

/** One variable: a colour picker for a colour, a box to type in for anything else (a size, a face), and what reads it. */
export function VarRow({ v, source, layer, setVar }: { v: { name: string; value: string; file: string; line: number; token?: boolean; /** A choice slot's values (builder.json rules.slots): picked, never typed. */ options?: string[]; /** A slot's kind: sound, key, format and line get their own control (rule 28). */ kind?: string }; source: StyleSource; layer?: ReturnType<typeof buildLayer> | null; setVar: (name: string, value: string | null) => void }) {
  const set = source.varsSet?.[v.name];
  const followed = layer?.vars.find((x) => x.name === v.name && x.why === "followed");
  const colour = isColour(v.value);
  const [typed, setTyped] = React.useState(set ?? v.value);
  const read = source.varsRead?.[v.name] ?? [];
  return (
    <label data-style-layer-var={v.name} data-token={v.token ? "" : undefined} className="flex flex-wrap items-center gap-2 text-small">
      {isScriptSlotKind(v.kind) ? (
        <SlotKindEditor kind={v.kind} name={v.name} value={set ?? v.value} onChange={(x) => setVar(v.name, x === v.value ? null : x)} />
      ) : v.options?.length ? (
        <select aria-label={v.name} data-slot-choice="" value={set ?? v.value} onChange={(e) => setVar(v.name, e.target.value === v.value ? null : e.target.value)} className="h-5 rounded border border-border bg-transparent px-1 font-mono text-fine">
          {[...new Set([v.value, ...v.options])].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : colour ? (
        <HandColour aria-label={v.name} value={hexOf(set ?? followed?.value ?? v.value)} onPick={(hex) => setVar(v.name, hex)} className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
      ) : (
        <input type="text" aria-label={v.name} value={typed} onChange={(e) => setTyped(e.target.value)} onBlur={() => setVar(v.name, typed.trim() && typed.trim() !== v.value ? typed.trim() : null)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="h-5 w-28 rounded border border-border bg-transparent px-1 font-mono text-fine" />
      )}
      <span className="font-mono">{v.name}</span>
      <span className="text-fg-muted">{set ? `set, was ${v.value}` : followed ? `follows the board, was ${v.value}` : v.value}</span>
      {read.length ? <span className="text-fg-faint">read by {read[0]!.fn ?? read[0]!.file}{read.length > 1 ? ` and ${read.length - 1} more` : ""}</span> : null}
      {set ? <button type="button" className="text-fg-muted underline" onClick={() => { setTyped(v.value); setVar(v.name, null); }}>Reset</button> : null}
    </label>
  );
}

const box = "h-5 rounded border border-border bg-transparent px-1 font-mono text-fine";

/**
 * A slot a script reads (kit/BUILDER-RULES.md, rule 28), edited as what it is: a sound J can play,
 * a key he presses, a number format with a live sample, a line with its look. What it writes is
 * what the kit's starter/parts/slots.js reads on the site.
 */
export function SlotKindEditor({ kind, name, value, onChange }: { kind: ScriptSlotKind; name: string; value: string; onChange: (value: string) => void }) {
  const [listening, setListening] = React.useState(false);
  if (kind === "sound") {
    const s = parseSound(value) ?? { kind: "none" as const };
    const vol = s.kind === "none" ? 0.5 : s.volume;
    return (
      <span data-slot-kind="sound" className="flex flex-wrap items-center gap-1">
        <select aria-label={`${name} sound`} value={s.kind} className={box} onChange={(e) => onChange(writeSound(e.target.value === "beep" ? { kind: "beep", hz: 880, volume: vol } : e.target.value === "file" ? { kind: "file", src: "sounds/click.mp3", volume: vol } : { kind: "none" }))}>
          <option value="none">No sound</option><option value="beep">Beep</option><option value="file">A sound file</option>
        </select>
        {s.kind === "beep" ? <input type="number" aria-label={`${name} pitch`} min={100} max={4000} step={20} value={s.hz} onChange={(e) => onChange(writeSound({ ...s, hz: Number(e.target.value) || 880 }))} className={`${box} w-16`} /> : null}
        {s.kind === "file" ? <input type="text" aria-label={`${name} file`} defaultValue={s.src} onBlur={(e) => onChange(writeSound({ ...s, src: e.target.value.trim() || s.src }))} className={`${box} w-28`} /> : null}
        {s.kind !== "none" ? <HandRange aria-label={`${name} volume`} min={0} max={1} step={0.05} value={vol} onChange={(volume) => onChange(writeSound({ ...s, volume }))} className="w-16" /> : null}
        {s.kind !== "none" ? <button type="button" data-slot-play="" className="text-fg-muted underline" onClick={() => playSound(value, typeof location !== "undefined" ? location.href : undefined)}>Play</button> : null}
      </span>
    );
  }
  if (kind === "key") {
    const key = parseKey(value) ?? "";
    return (
      <button type="button" data-slot-kind="key" aria-label={`${name} key`} className={`${box} min-w-12`} onClick={() => setListening(true)} onBlur={() => setListening(false)}
        onKeyDown={(e) => {
          if (!listening || ["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) return;
          e.preventDefault();
          onChange(e.key === "Escape" ? value : e.key === "Backspace" || e.key === "Delete" ? writeKey("") : writeKey(e.key));
          setListening(false);
        }}>
        {listening ? "Press a key" : key ? (key === " " ? "Space" : key) : "No key"}
      </button>
    );
  }
  if (kind === "format") {
    const f = parseFormat(value) ?? { before: "", sign: false, group: false, decimals: 0, after: "" };
    const set = (x: Partial<typeof f>) => onChange(writeFormat({ ...f, ...x }));
    return (
      <span data-slot-kind="format" className="flex flex-wrap items-center gap-1">
        <input type="text" aria-label={`${name} before`} value={f.before} placeholder="before" onChange={(e) => set({ before: e.target.value.replace(/[0+"]/g, "") })} className={`${box} w-10`} />
        <select aria-label={`${name} decimals`} value={f.decimals} onChange={(e) => set({ decimals: Number(e.target.value) })} className={box}>
          {[0, 1, 2, 3, 4].map((d) => <option key={d} value={d}>{d} decimals</option>)}
        </select>
        <input type="text" aria-label={`${name} after`} value={f.after} placeholder="after" onChange={(e) => set({ after: e.target.value.replace(/[0"]/g, "") })} className={`${box} w-10`} />
        <label className="flex items-center gap-0.5"><input type="checkbox" checked={f.sign} onChange={(e) => set({ sign: e.target.checked })} />+ sign</label>
        <label className="flex items-center gap-0.5"><input type="checkbox" checked={f.group} onChange={(e) => set({ group: e.target.checked })} />1,000</label>
        <span data-slot-sample="" className="font-mono text-fg-muted">{[1234.5, -3.75].map((n) => formatNumber(n, value).text).join("  ")}</span>
      </span>
    );
  }
  const l = parseLine(value) ?? { width: 0, style: "none" as const };
  return (
    <span data-slot-kind="line" className="flex items-center gap-1">
      <select aria-label={`${name} style`} value={l.style} onChange={(e) => onChange(writeLine({ width: l.width || 2, style: e.target.value as typeof l.style }))} className={box}>
        <option value="none">No line</option>{LINE_STYLES.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      {l.style !== "none" ? <input type="number" aria-label={`${name} width`} min={1} max={12} step={1} value={l.width} onChange={(e) => onChange(writeLine({ ...l, width: Number(e.target.value) }))} className={`${box} w-12`} /> : null}
      {/* A preview of the line: a value the builder draws, not a style written into the site. */}
      <svg data-slot-sample="" width="48" height="10" aria-hidden="true"><line x1="0" x2="48" y1="5" y2="5" stroke="currentColor" strokeWidth={l.width} strokeDasharray={l.style === "dashed" ? `${l.width * 3} ${l.width * 2}` : l.style === "dotted" ? `${l.width} ${l.width}` : undefined} opacity={l.style === "none" ? 0 : 1} /></svg>
    </span>
  );
}

/** A token set by hand: it goes back with the style layer, as a token change. */
export function setVar(name: string, value: string | null) {
  const st = useStudio.getState();
  const now = (st.look as { styleSource?: StyleSource | null }).styleSource;
  if (!now) return;
  const varsSet = { ...(now.varsSet ?? {}) };
  if (value === null) delete varsSet[name]; else varsSet[name] = value;
  st.setLook({ styleSource: { ...now, varsSet } } as never);
}

/**
 * THE PART'S SCRIPT SETTINGS, in its panel: the tokens it and the code that
 * runs it use (`partTokens`), each editable here as in the style layer.
 */
export function PartSettings({ code, hook, inside = [] }: { code: Parameters<typeof partTokens>[0]; hook: string; /** Hooks of the parts inside this one: their slots show here too, named by part, for a part its parent covers on the board. */ inside?: string[] }) {
  const source = useStudio((s) => (s.look as { styleSource?: StyleSource | null }).styleSource ?? null);
  /* Slots first (builder.json rules.slots, named by the code for this part), then the tokens its code uses. */
  const list = React.useMemo(() => {
    if (!source) return [];
    const slots = partSlots(hook, source);
    const own = [...slots, ...partTokens(code, source).filter((v) => !slots.some((s) => s.name === v.name))];
    const theirs = inside.filter((h) => h !== hook).flatMap((h) => partSlots(h, source).map((s) => ({ ...s, label: `${s.label} · ${h}` })));
    const seen = new Set(own.map((v) => v.name));
    return [...own, ...theirs.filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true)))];
  }, [code, source, hook, inside.join(" ")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!source || !list.length) return null;
  return (
    <div data-part-settings={hook} className="space-y-1">
      <p className="text-small text-fg-muted">Settings its code uses ({list.length}). A change goes back as a token change.</p>
      {list.map((v) => (
        <div key={v.name} data-part-setting={v.why} data-slot={"label" in v ? v.token ?? "" : undefined} title={"about" in v ? v.about : undefined}>
          {"label" in v ? <p data-slot-label="" className="text-small text-fg">{v.label}</p> : null}
          <VarRow v={v} source={source} setVar={setVar} />
        </div>
      ))}
    </div>
  );
}

export function StyleLayerSection() {
  const source = useStudio((s) => (s.look as { styleSource?: StyleSource | null }).styleSource ?? null);
  /* Parts wearing a texture carry it: a living background as their own living picture, any other as their own background pictures (`wearTextures`). */
  const textures = useStudio((s) => s.look.texture);
  const own = useStudio((s) => s.nodes);
  /* Every other texture a part wears is painted as the board paints it, over its own fill (`wornPaint`). */
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const full = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const nodes = React.useMemo(() => wearTextures(own, textures, (l, o) => wornPaint(l, full, o)), [own, textures, full]);
  const palette = useStudio((s) => s.look.palette as Record<string, string>);
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState<{ text: string; link?: string; bad?: boolean } | null>(null);
  const [more, setMore] = React.useState(false);
  const family = React.useCallback((name: string) => FAMILY[name], []);
  const layer = React.useMemo(() => (source ? buildLayer(nodes as unknown as LayerNode[], palette, source, { family, kit: !!source.kit }) : null), [nodes, palette, source, family]);
  const [round, setRound] = React.useState<{ busy?: boolean; changes?: RoundChanges; seen?: KitSeen; manifest?: KitManifest | null; notes?: CodeNotes | null; says?: string } | null>(null);
  const layerHooks = React.useMemo(() => (layer ? layerHooksOf(layer.rules) : []), [layer]);
  const check = React.useCallback(async () => {
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    const src = (useStudio.getState().look as { styleSource?: StyleSource | null }).styleSource;
    if (!token || !src) { setRound({ says: "Reading the code again needs your GitHub token, under Keys." }); return; }
    setRound({ busy: true });
    const got = await readRound(src, token, { layerHooks });
    setRound(got.ok ? { changes: got.changes, seen: got.seen, manifest: got.manifest, notes: got.notes } : { says: got.says });
  }, [layerHooks]);
  /* Each time the section opens: a design round starts from the code as it is now. */
  const asked = React.useRef(false);
  React.useEffect(() => {
    if (asked.current || !source) return;
    asked.current = true;
    void check();
  }, [source, check]);
  const takeIn = () => {
    const st = useStudio.getState();
    const now = (st.look as { styleSource?: StyleSource | null }).styleSource;
    if (!now || !round?.seen) return;
    st.setLook({ styleSource: { ...takeTokens(now, round.seen), seen: round.seen, ...(round.manifest ? { kit: round.manifest } : {}) } } as never);
    if (round.manifest?.links) st.setFormat("links.offsite", kitLinksToOffsite(round.manifest.links));
    setRound({ changes: { ...round.changes!, same: true, says: "Taken in: the next round is compared with the code as it is now." }, notes: round.notes });
  };
  if (!source || !layer) return null;

  const missing = layer.check.filter((c) => c.fate === "missing");
  const count = (f: string) => layer.check.filter((c) => c.fate === f).length;
  /* The design tokens first, every one whatever its kind; then the other colours the code reads. */
  const all = (() => {
    const seen = new Map<string, { name: string; value: string; file: string; line: number; token?: boolean }>();
    for (const f of source.files) for (const v of f.vars) if (!seen.has(v.name) || (v.token && !seen.get(v.name)!.token)) seen.set(v.name, v);
    return [...seen.values()];
  })();
  const tokens = all.filter((v) => v.token);
  const vars = all.filter((v) => !v.token && isColour(v.value));

  const send = async () => {
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    if (!token) { setSaid({ text: "This writes to the repository with your own GitHub token, and there is not one saved yet. Add one under Keys.", bad: true }); return; }
    setBusy(true);
    try {
      const site = activeProject()?.name || source.repo.split("/")[1] || "site";
      /* What the layer cannot carry rides along as it does on Publish: polio/NEXT.md lines, and a data-hook for each part made in the Builder (`publishAsks.ts`). */
      const asks = await gatherAsks(nodes as unknown as LayerNode[], source, token, site);
      const done = await sendDesign(asks.nodes, palette, source, token, { site, family, say: (text) => setSaid({ text }), extra: asks.extra, fresh: asks.fresh });
      if (!done.ok) { setSaid({ text: done.says, bad: true }); return; }
      if (asks.adding.length) { const l = fixLoopOf(useStudio.getState().look); setFixLoop({ ...l, sent: [...l.sent, ...asks.adding] }); }
      if (done.kit) { const held = done.held.length ? ` Held back: ${done.held.join(" ")}` : ""; setSaid({ text: `${done.says}${held}`, link: done.pull ?? done.compare }); return; }
      const skipped = done.held.length ? ` ${done.held.length} word change${done.held.length === 1 ? " was" : "s were"} left out: ${done.held.join("; ")}.` : "";
      setSaid({ text: `${done.says}${skipped}`, link: done.pull ?? done.compare });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-repo-section="style-layer" data-style-layer-panel="" className="flex flex-col gap-2 border-t border-border pt-3">
      <div>
        <p className={head}>Send the design back</p>
        <p className="text-small text-fg-muted">
          As a style layer for the code in <span className="font-mono text-fg">{source.repo}</span>: its scripts and hooks stay as they are, and the layer goes to a pull request you merge yourself.
        </p>
      </div>
      <div data-style-layer-round="" className="flex flex-col gap-1 rounded-md border border-border px-2 py-1.5 text-small">
        <p className="text-fg-muted">Since you brought it in{source.kit ? " (builder.json and hooks.json)" : ""}:</p>
        <p data-style-layer-round-says="" className="text-fg" style={round?.changes?.staleRules.length ? { color: "oklch(0.72 0.16 30)" } : undefined}>
          {round?.busy ? "Reading the code again…" : round?.changes?.says ?? round?.says ?? "Not read yet."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" data-style-layer-round-check="" disabled={!!round?.busy} onClick={() => void check()}>Check the code again</Button>
          {round?.changes && !round.changes.same ? <Button size="sm" variant="ghost" data-style-layer-round-take="" onClick={takeIn}>Take these in</Button> : null}
        </div>
        {round?.notes ? <CodeNotesList notes={round.notes} /> : null}
      </div>
      <p data-style-layer-says="" className="text-plain text-fg">
        {layer.rules.length} part{layer.rules.length === 1 ? "" : "s"} restyled, {layer.vars.length} variable{layer.vars.length === 1 ? "" : "s"} set{source.kit ? "" : `, ${layer.text.length} line${layer.text.length === 1 ? "" : "s"} of words changed`}. Hooks: {count("covered")} restyled, {count("untouched")} untouched, {count("missing")} missing.
        {layer.tokens.length ? <span data-style-layer-tokens=""> Design tokens: {layer.tokens.length} in {[...new Set(layer.tokens.map((t) => t.file))].join(", ")}, {layer.tokens.filter((t) => t.now).length} set by the layer (Advanced).</span> : null}
      </p>
      {source.manifest ? <p data-style-layer-manifest="" className="text-small text-fg-muted">From {source.manifest.file}{source.manifest.kit ? `, kit ${source.manifest.kit}` : ""}: the layer is written to {source.layerFile ?? `${source.dir}style-layer.css`}.</p> : null}
      {layer.held?.length ? (
        <div data-style-layer-held="" className="rounded-md border px-2 py-1.5 text-small text-fg" style={warn}>
          {layer.held.slice(0, 4).map((h) => <p key={h}>{h}</p>)}
          {layer.held.length > 4 ? <p>And {layer.held.length - 4} more.</p> : null}
        </div>
      ) : null}
      {missing.length ? (
        <div data-style-layer-missing="" className="rounded-md border px-2 py-1.5 text-small text-fg" style={warn}>
          {missing.slice(0, 6).map((m) => <p key={`${m.file}${m.attr}${m.value}`} data-style-layer-warn={m.value}>{m.why} <span className="text-fg-muted">({m.file} line {m.line})</span></p>)}
          {missing.length > 6 ? <p>And {missing.length - 6} more.</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="primary" data-style-layer-send="" disabled={busy} onClick={() => void send()}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          Open a pull request
        </Button>
        <Button size="sm" variant="ghost" data-style-layer-more="" onClick={() => setMore((v) => !v)}>{more ? "Less" : "Advanced"}</Button>
      </div>
      {said ? (
        <p data-style-layer-said="" className="text-small" style={{ color: said.bad ? "oklch(0.72 0.16 30)" : undefined }}>
          {said.text}{" "}
          {said.link ? <a data-style-layer-compare="" href={said.link} target="_blank" rel="noreferrer" className="underline">{/\/pull\/\d+$/.test(said.link) ? "Open the pull request" : "Compare"}</a> : null}
        </p>
      ) : null}
      {more ? (
        <div data-style-layer-advanced="" className="flex flex-col gap-1">
          {tokens.length ? <p className="text-small text-fg-muted">Design tokens ({source.tokensFile ?? tokens[0]!.file}): the layer overrides them, the file stays as it is.</p> : null}
          {tokens.map((v) => <VarRow key={v.name} v={v} source={source} layer={layer} setVar={setVar} />)}
          {vars.length ? <p className="text-small text-fg-muted">Other colours the code reads (CSS variables):</p> : !tokens.length ? <p className="text-small text-fg-muted">The code exposes no variables.</p> : null}
          {vars.map((v) => <VarRow key={v.name} v={v} source={source} layer={layer} setVar={setVar} />)}
          <details className="text-small">
            <summary className="cursor-pointer text-fg-muted">The stylesheet</summary>
            <pre data-style-layer-css="" className="mt-1 max-h-[200px] overflow-auto whitespace-pre-wrap rounded border border-border p-1.5 font-mono text-fine">{layer.css}</pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}

/**
 * "New from code" (BUILDER-RULES.md rules 26 and 27): each code change's
 * note since the last round, by plain name, and the looks the code asks the
 * builder to learn, each with its prompt for a Polio chat to copy.
 */
export function CodeNotesList({ notes }: { notes: CodeNotes }) {
  const [copied, setCopied] = React.useState<number | null>(null);
  const copy = (i: number, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => setCopied(i), () => setCopied(null));
  };
  const named = (p: { hook: string; label: string | null }) => p.label ?? p.hook;
  return (
    <div data-style-layer-notes="" className="flex flex-col gap-1 border-t border-border pt-1">
      {notes.entries.length ? <p className="text-fg-muted">New from code:</p> : null}
      {notes.entries.slice(0, 5).map((e) => (
        <div key={e.branch} data-style-layer-note={e.branch} className="text-fg">
          <p><span className="text-fg-muted">{e.date}</span> {e.why || e.branch}</p>
          {e.parts.length ? <p className="text-fg-muted">New parts: {e.parts.slice(0, 8).map(named).join(", ")}{e.parts.length > 8 ? ` and ${e.parts.length - 8} more` : ""}.</p> : null}
          {e.states.length ? <p className="text-fg-muted">States: {e.states.map((x) => `${x.label ?? x.panel} ${[...x.added.map((a) => `+${a}`), ...x.removed.map((a) => `-${a}`)].join(" ")}`).join("; ")}.</p> : null}
          {e.slots.length ? <p className="text-fg-muted">New settings: {e.slots.map((x) => x.label).join(", ")}.</p> : null}
          {e.removed.length ? <p className="text-fg-muted">Gone: {e.removed.slice(0, 8).join(", ")}{e.removed.length > 8 ? ` and ${e.removed.length - 8} more` : ""}.</p> : null}
        </div>
      ))}
      {notes.entries.length > 5 ? <p className="text-fg-muted">And {notes.entries.length - 5} older notes in design/CODE-CHANGES.md.</p> : null}
      {notes.requests.length ? <p className="text-fg-muted">The code asks the builder to learn:</p> : null}
      {notes.requests.map((q, i) => (
        <div key={`${q.hook}${i}`} data-style-layer-request={q.hook} className="flex flex-wrap items-center gap-1.5 text-fg">
          <span>{q.need} <span className="text-fg-muted">({q.hook}{q.kind ? `, ${q.kind}` : ""})</span></span>
          {q.prompt ? <Button size="sm" variant="ghost" data-style-layer-request-copy="" onClick={() => copy(i, q.prompt!)}>{copied === i ? "Copied" : "Copy the Polio prompt"}</Button> : null}
        </div>
      ))}
    </div>
  );
}
