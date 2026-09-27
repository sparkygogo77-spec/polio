"use client";
/**
 * The shelf's working features, and the review card for the ones that come
 * back from the site's repository.
 *
 * The Working band sits at the top of the category a feature belongs to.
 * A built-in feature shows its sample; one the owner accepted from a
 * repository shows the part it was attached to, drawn as that part was, so
 * the shelf picture is the real thing it was made for. Pressed with a part
 * picked, a feature goes onto that part; with none, it lands on a new line
 * of text.
 *
 * In the Data category the band also offers to check the site's own
 * repository for `features/` folders a code chat added (`repoFeatures.ts`).
 * What is new or changed comes up on the review card (`FeatureOffers`), with
 * its manifest, its script and a diff. Nothing is run here: accepting stores
 * the text in the library and puts the feature on the parts its manifest
 * names; its script only ever runs on the published site.
 */
import * as React from "react";
import { Check, GitBranch, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { Tooltip } from "@/core/ui/tooltip";
import { heldKeys } from "@/features/keys/store";
import { useBuilds } from "@/features/builds/store";
import type { CategoryDef } from "./catalog";
import { useStudio, type StudioNode } from "./store";
import { addFeatureToCanvas } from "./Palette";
import { Block, themeFrom } from "./blocks";
import { overrideTheme, resolvePalette, type NodeColour } from "./parts/theme";
import { allWorks, getWork, type Work, type WorkPicture } from "./library/works";
import { useLibrary } from "./library/useLibrary";
import { checkRepoFeatures } from "./library/repoFeatures";

/** A part as the shelf picture keeps it. */
export function pictureOf(n: StudioNode): WorkPicture {
  return {
    featureId: n.featureId, label: n.label, content: n.content, w: n.w, h: n.h, colour: n.colour, font: n.font, options: n.options,
    /* A captured part wears its box as these: without them the chip loses its own colour. */
    ...(n.layout ? { layout: n.layout } : {}), ...(n.pad ? { pad: n.pad } : {}), ...(n.edge ? { edge: n.edge } : {}), ...(n.text ? { text: n.text } : {}),
  };
}

/** The part a feature was accepted from, drawn again, fitted into the card. */
function WorkPictureView({ picture, width, height }: { picture: WorkPicture; width: number; height: number }) {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  /* The part's own colours over the site's, as the board paints it (`Canvas.tsx`). */
  const site = React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
  const theme = React.useMemo(
    () => (picture.colour ? overrideTheme(site, picture.colour as NodeColour, resolvePalette(format, look)) : site),
    [site, format, look, picture.colour],
  );
  const w = Math.max(1, picture.w);
  const h = Math.max(1, picture.h);
  const scale = Math.min(width / w, height / h, 1.5);
  const node = React.useMemo<StudioNode>(() => ({
    id: `work_picture_${picture.label}`, pageId: "", featureId: picture.featureId, label: picture.label, prompt: "",
    content: picture.content as StudioNode["content"], data: "", x: 0, y: 0, w, h, groupId: null, options: picture.options ?? {},
    priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null,
    colour: (picture.colour ?? null) as StudioNode["colour"], font: (picture.font ?? null) as StudioNode["font"],
    anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null, role: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
    layout: (picture.layout ?? null) as StudioNode["layout"], pad: (picture.pad ?? null) as StudioNode["pad"], edge: (picture.edge ?? null) as StudioNode["edge"], text: (picture.text ?? null) as StudioNode["text"],
  }), [picture, w, h]);
  return (
    <div data-work-picture="" aria-hidden inert className="pointer-events-none overflow-hidden rounded-sm" style={{ width, height, background: site.bg }}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "0 0", marginLeft: Math.max(0, (width - w * scale) / 2), marginTop: Math.max(0, (height - h * scale) / 2) }}>
        <Block node={node} t={theme} mode="board" />
      </div>
    </div>
  );
}

export function WorkShelf({ category }: { category: CategoryDef }) {
  const accepted = useLibrary((s) => s.accepted);
  const says = useLibrary((s) => s.says);
  const checking = useLibrary((s) => s.checking);
  const repo = useBuilds((s) => s.projects.find((p) => p.id === s.activeId)?.repo ?? null);
  // Recomputed when the library changes: `accepted` is what `allWorks` reads.
  const works = React.useMemo(() => allWorks().filter((w) => w.manifest.category === category.id), [accepted, category.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const isData = category.id === "data";
  if (!works.length && !isData) return null;
  const attach = (id: string) => {
    const st = useStudio.getState();
    const picked = st.selection.length === 1 ? st.nodes.find((n) => n.id === st.selection[0]) : undefined;
    const w = getWork(id)!;
    if (picked) {
      st.updateNode(picked.id, { work: { id, inputs: {} } });
      play("confirm");
      return;
    }
    const at = addFeatureToCanvas("prose");
    useStudio.getState().updateNode(at, { content: w.manifest.look.sample, work: { id, inputs: {} }, w: 240, h: 40 });
    useStudio.getState().setSelection([at]);
  };
  const check = () => {
    if (!repo) return;
    play("tap");
    void checkRepoFeatures({ owner: repo.owner, name: repo.name, ref: repo.branch }, heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "");
  };
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0 text-fine uppercase tracking-wider text-fg-faint">Working</span>
        <span className="h-px flex-1 bg-border" />
        {isData && repo ? (
          <button
            type="button"
            data-check-repo-features=""
            disabled={checking}
            onClick={check}
            className="tactile flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-fine text-fg-muted hover:text-fg"
            style={{ boxShadow: `inset 0 0 0 1px oklch(0.72 0.15 ${category.hue} / 0.35)` }}
          >
            <GitBranch className="size-3" />
            {checking ? "Reading…" : `Check ${repo.owner}/${repo.name} for features`}
          </button>
        ) : null}
      </div>
      {isData && says ? <p data-repo-features-says="" className="mb-2 text-fine text-fg-muted">{says}</p> : null}
      <div className="flex flex-wrap items-start gap-2">
        {works.map((w) => <WorkCard key={w.manifest.id} work={w} hue={category.hue} onClick={() => attach(w.manifest.id)} />)}
      </div>
    </section>
  );
}

function WorkCard({ work, hue, onClick }: { work: Work; hue: number; onClick: () => void }) {
  const m = work.manifest;
  return (
    <Tooltip content={`${m.blurb}${work.from ? ` From ${work.from}.` : ""} Pick a part first to put it there.`} side="top">
      <button
        type="button"
        data-work-card={m.id}
        onClick={onClick}
        className="tactile flex w-[180px] flex-col items-start gap-1 rounded-md px-3 py-2 text-left"
        style={{ background: `oklch(0.2 0.04 ${hue} / 0.7)`, boxShadow: `inset 0 0 0 1px oklch(0.72 0.15 ${hue} / 0.35)` }}
      >
        {work.picture
          ? <WorkPictureView picture={work.picture} width={156} height={44} />
          : <span className="num text-[20px] font-semibold leading-none" style={{ color: `oklch(0.86 0.14 ${hue})` }}>{m.look.sample}</span>}
        <span className="text-small font-medium text-fg">{m.name}</span>
        <span className="text-fine text-fg-faint">
          {m.look.caption ?? ""}{m.look.caption ? " · " : ""}{m.needs === "none" ? "runs as published" : `needs a ${m.needs}`}{work.from ? ` · from ${work.from.split("/")[1]}` : ""}
        </span>
      </button>
    </Tooltip>
  );
}

/**
 * The review card: what came back from the repository, to accept or not.
 *
 * Each offer shows what it needs, its manifest, its script and a diff
 * against the library's version (all added, when it is new), and any
 * problem that stops it being accepted. Accepting takes the text into the
 * library, with the first part its manifest names as its shelf picture,
 * and puts it on every part it names that is on this site.
 */
export function FeatureOffers() {
  const offers = useLibrary((s) => s.offers);
  const from = useLibrary((s) => s.offersFrom);
  const ctx = useActions();
  const [open, setOpen] = React.useState<string | null>(null);
  if (!offers.length) return null;
  const accept = (id: string) => {
    const o = offers.find((x) => x.id === id);
    if (!o) return;
    const st = useStudio.getState();
    const on = st.nodes.filter((n) => o.parts.includes(n.id));
    const first = o.parts.map((p) => on.find((n) => n.id === p)).find(Boolean);
    const w = useLibrary.getState().accept(id, first ? pictureOf(first) : null);
    if (!w) return;
    for (const n of on) st.updateNode(n.id, { work: { id, inputs: {} } });
    play("confirm");
    ctx.publish({ key: `studio:feature:${id}`, title: `${w.manifest.name} is in the library`, body: on.length ? `On ${on.length} part${on.length === 1 ? "" : "s"} here, and on the shelf for every site.` : "On the shelf for every site.", level: "success", source: "studio", toast: true });
  };
  return (
    <div data-feature-offers="" className="fixed right-4 top-24 z-[60] flex max-h-[calc(100vh-8rem)] w-[440px] flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-panel/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2">
        <GitBranch className="size-3.5 text-fg-muted" />
        <span className="text-small font-medium text-fg">Features from {from}</span>
        <span className="text-fine text-fg-faint">review before they join the library; nothing runs here</span>
      </div>
      {offers.map((o) => {
        const shown = open === o.id || offers.length === 1;
        return (
          <article key={o.id} data-offer={o.id} data-offer-status={o.status} className="rounded-md border border-border bg-bg/60 p-2">
            <header className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(shown && offers.length > 1 ? null : o.id)} className="min-w-0 flex-1 truncate text-left text-small font-medium text-fg">
                {o.manifest?.name ?? o.id}
              </button>
              <span className="rounded-xs border border-border px-1 text-fine uppercase text-fg-muted">{o.status}</span>
              <span data-offer-needs="" className="text-fine text-fg-faint">{o.manifest ? (o.manifest.needs === "none" ? "runs as published" : `needs a ${o.manifest.needs}`) : ""}</span>
            </header>
            {o.manifest?.blurb ? <p className="mt-1 text-fine text-fg-muted">{o.manifest.blurb}</p> : null}
            {o.parts.length ? <p className="text-fine text-fg-faint">built for <span className="font-mono">{o.parts.join(", ")}</span></p> : null}
            {o.problems.length ? (
              <ul data-offer-problems="" className="mt-1 list-disc pl-4 text-fine" style={{ color: "oklch(0.78 0.14 40)" }}>
                {o.problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            ) : null}
            {shown ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <Code title="manifest.json" attr="data-offer-manifest">{o.manifestText}</Code>
                <Code title="script.js" attr="data-offer-script">{o.script}</Code>
                <div data-offer-diff="" className="max-h-40 overflow-auto rounded-sm border border-border bg-bg p-1.5 font-mono text-[10px] leading-snug">
                  <div className="mb-1 text-fine uppercase tracking-wider text-fg-faint">diff against the library</div>
                  {o.diff.map((l, i) => (
                    <div key={i} data-diff-op={l.op} className="whitespace-pre" style={{ color: l.op === "+" ? "oklch(0.8 0.15 150)" : l.op === "-" ? "oklch(0.72 0.16 25)" : undefined, opacity: l.op === " " ? 0.55 : 1 }}>
                      {l.op} {l.text}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <footer className="sticky bottom-0 mt-2 flex justify-end gap-1.5 bg-panel/95 py-1">
              <button type="button" data-offer-dismiss="" onClick={() => { play("close"); useLibrary.getState().dismiss(o.id); }} className="tactile flex items-center gap-1 rounded-sm px-2 py-1 text-fine text-fg-muted hover:text-fg">
                <X className="size-3" /> Not now
              </button>
              <button
                type="button"
                data-offer-accept=""
                disabled={!o.acceptable}
                onClick={() => accept(o.id)}
                className="tactile flex items-center gap-1 rounded-sm bg-accent px-2 py-1 text-fine font-medium text-accent-fg disabled:opacity-40"
              >
                <Check className="size-3" /> Accept into the library
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

function Code({ title, attr, children }: { title: string; attr: string; children: string }) {
  return (
    <div {...{ [attr]: "" }} className="max-h-40 overflow-auto rounded-sm border border-border bg-bg p-1.5 font-mono text-[10px] leading-snug">
      <div className="mb-1 text-fine uppercase tracking-wider text-fg-faint">{title}</div>
      <pre className="whitespace-pre-wrap break-words">{children}</pre>
    </div>
  );
}
