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
import { useStudio } from "./store";
import { FAMILY } from "./parts/theme";
import { buildLayer, colourKey, type LayerNode, type StyleSource } from "./styleLayer";
import { prepareLayer, publishLayer } from "./styleLayerRun";
import { layerHooksOf, readRound, type KitManifest, type KitSeen, type RoundChanges } from "./kitRun";
import { kitLinksToOffsite } from "./parts/offsite";

const head = "text-small font-medium uppercase tracking-[0.12em] text-fg-faint";
const warn = { borderColor: "oklch(0.7 0.15 18 / 0.45)", background: "oklch(0.7 0.15 18 / 0.08)" };

/** A colour input wants #rrggbb. */
function hexOf(v: string): string {
  const k = colourKey(v).split(",");
  if (k.length < 3) return /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
  return `#${k.slice(0, 3).map((x) => Math.max(0, Math.min(255, Number(x))).toString(16).padStart(2, "0")).join("")}`;
}

export function StyleLayerSection() {
  const source = useStudio((s) => (s.look as { styleSource?: StyleSource | null }).styleSource ?? null);
  const nodes = useStudio((s) => s.nodes);
  const palette = useStudio((s) => s.look.palette as Record<string, string>);
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState<{ text: string; link?: string; bad?: boolean } | null>(null);
  const [more, setMore] = React.useState(false);
  const family = React.useCallback((name: string) => FAMILY[name], []);
  const layer = React.useMemo(() => (source ? buildLayer(nodes as unknown as LayerNode[], palette, source, { family, kit: !!source.kit }) : null), [nodes, palette, source, family]);
  const [round, setRound] = React.useState<{ busy?: boolean; changes?: RoundChanges; seen?: KitSeen; manifest?: KitManifest | null; says?: string } | null>(null);
  const layerHooks = React.useMemo(() => (layer ? layerHooksOf(layer.rules) : []), [layer]);
  const check = React.useCallback(async () => {
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    const src = (useStudio.getState().look as { styleSource?: StyleSource | null }).styleSource;
    if (!token || !src) { setRound({ says: "Reading the code again needs your GitHub token, under Keys." }); return; }
    setRound({ busy: true });
    const got = await readRound(src, token, { layerHooks });
    setRound(got.ok ? { changes: got.changes, seen: got.seen, manifest: got.manifest } : { says: got.says });
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
    st.setLook({ styleSource: { ...now, seen: round.seen, ...(round.manifest ? { kit: round.manifest } : {}) } } as never);
    if (round.manifest?.links) st.setFormat("links.offsite", kitLinksToOffsite(round.manifest.links));
    setRound({ changes: { ...round.changes!, same: true, says: "Taken in: the next round is compared with the code as it is now." } });
  };
  if (!source || !layer) return null;

  const missing = layer.check.filter((c) => c.fate === "missing");
  const count = (f: string) => layer.check.filter((c) => c.fate === f).length;
  const vars = (() => {
    const seen = new Map<string, { name: string; value: string; file: string; line: number }>();
    for (const f of source.files) for (const v of f.vars) if (!seen.has(v.name)) seen.set(v.name, v);
    return [...seen.values()].filter((v) => colourKey(v.value).includes(","));
  })();
  const setVar = (name: string, value: string | null) => {
    const st = useStudio.getState();
    const now = (st.look as { styleSource?: StyleSource | null }).styleSource;
    if (!now) return;
    const varsSet = { ...(now.varsSet ?? {}) };
    if (value === null) delete varsSet[name]; else varsSet[name] = value;
    st.setLook({ styleSource: { ...now, varsSet } } as never);
  };

  const send = async () => {
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    if (!token) { setSaid({ text: "This writes to the repository with your own GitHub token, and there is not one saved yet. Add one under Keys.", bad: true }); return; }
    setBusy(true);
    setSaid({ text: `Reading the pages from ${source.repo} on ${source.ref}…` });
    try {
      const prepared = await prepareLayer(nodes as unknown as LayerNode[], palette, source, token, { family, when: new Date().toISOString().slice(0, 10) });
      if (!prepared.ok) { setSaid({ text: prepared.says, bad: true }); return; }
      setSaid({ text: "Making the branch…" });
      const site = activeProject()?.name || source.repo.split("/")[1] || "site";
      const done = await publishLayer(prepared, source, token, { site });
      if (!done.ok) { setSaid({ text: done.says, bad: true }); return; }
      if (prepared.kit) { const held = prepared.skipped.length ? ` Held back: ${prepared.skipped.map((s) => s.from).join(" ")}` : ""; setSaid({ text: `${done.says}${held}`, link: done.pull ?? done.compare }); return; }
      const skipped = prepared.skipped.length ? ` ${prepared.skipped.length} word change${prepared.skipped.length === 1 ? " was" : "s were"} left out: ${prepared.skipped.map((s) => `“${s.from.slice(0, 40)}” (${s.why})`).join("; ")}.` : "";
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
      </div>
      <p data-style-layer-says="" className="text-plain text-fg">
        {layer.rules.length} part{layer.rules.length === 1 ? "" : "s"} restyled, {layer.vars.length} colour variable{layer.vars.length === 1 ? "" : "s"} set{source.kit ? "" : `, ${layer.text.length} line${layer.text.length === 1 ? "" : "s"} of words changed`}. Hooks: {count("covered")} restyled, {count("untouched")} untouched, {count("missing")} missing.
      </p>
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
          {vars.length ? <p className="text-small text-fg-muted">Colours the code reads (CSS variables in {source.files[0]?.file ?? "the page"}):</p> : <p className="text-small text-fg-muted">The code exposes no colour variables.</p>}
          {vars.map((v) => {
            const set = source.varsSet?.[v.name];
            const followed = layer.vars.find((x) => x.name === v.name);
            return (
              <label key={v.name} data-style-layer-var={v.name} className="flex items-center gap-2 text-small">
                <input type="color" aria-label={v.name} value={hexOf(set ?? followed?.value ?? v.value)} onChange={(e) => setVar(v.name, e.target.value)} className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="font-mono">{v.name}</span>
                <span className="text-fg-muted">{set ? `set, was ${v.value}` : followed ? `follows the board, was ${v.value}` : v.value}</span>
                {set ? <button type="button" className="text-fg-muted underline" onClick={() => setVar(v.name, null)}>Reset</button> : null}
              </label>
            );
          })}
          <details className="text-small">
            <summary className="cursor-pointer text-fg-muted">The stylesheet</summary>
            <pre data-style-layer-css="" className="mt-1 max-h-[200px] overflow-auto whitespace-pre-wrap rounded border border-border p-1.5 font-mono text-fine">{layer.css}</pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
