"use client";
/**
 * The part panel's EFFECTS, and SAVE AS A COMPONENT.
 *
 * When a part is clicked its panel offers the effects that fit its kind
 * (`library/partEffects.ts`): a picture its filters, a button its hover and
 * press and the button looks every site taught, a section its background
 * motions, any part the openings. Each comes plain or as a site had it (the
 * site's version, from the board or the learned library), and once on, its
 * settings are right here. They are library features, so the published page
 * runs exactly what the board shows.
 *
 * Save as a component keeps the part and everything it holds (the TV with
 * its screen, filter and knobs) builder-wide, on the shelf in its category
 * (`library/components.ts`), to be placed on any board.
 */
import * as React from "react";
import { Bookmark, Check } from "lucide-react";
import { useStudio, type StudioNode } from "./store";
import { getWork, usesOf, withWork, withoutWork } from "./library/works";
import { effectsFor, familyOf, kitPatch } from "./library/partEffects";
import { componentOf } from "./library/components";
import { useLearned } from "./library/useLearned";
import { useSiteVersions } from "./ShelfCards";
import { useBoardKits, KitSample } from "./DrawKits";
import { WorkFields } from "./WorkFields";
import { CATEGORIES, getFeature } from "./catalog";
import { partName } from "./partNames";
import { siteShortName, type StyleKit } from "./styleKits";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";

/** Whether a box holds a picture (the TV's case holds its screen): any picture part inside its box. */
function holdsPicture(node: StudioNode, nodes: readonly StudioNode[]): boolean {
  return nodes.some((n) => n.id !== node.id && n.picture && n.x >= node.x - 1 && n.y >= node.y - 1 && n.x + n.w <= node.x + node.w + 1 && n.y + n.h <= node.y + node.h + 1);
}

/** What the offer reads off a part: its size, its picture, whether it holds one, what it was made as. */
const partFacts = (node: StudioNode, nodes: readonly StudioNode[]) => ({ w: node.w, h: node.h, picture: node.picture, holdsPicture: holdsPicture(node, nodes), feature: getFeature(node.featureId)?.name ?? null });

/** The effects this part is offered, for the Content section to leave to Effects. */
export function offeredIds(kind: string, node: StudioNode, nodes: readonly StudioNode[]): Set<string> {
  return new Set(effectsFor(kind, partFacts(node, nodes)).map((o) => o.work));
}

export function PartEffects({ node, kind, nodes }: { node: StudioNode; kind: string; nodes: readonly StudioNode[] }) {
  const part = partFacts(node, nodes);
  const offered = effectsFor(kind, part);
  const fam = familyOf(kind, part);
  const site = useSiteVersions();
  const ids = new Set(offered.map((o) => o.work));
  const on = new Set(usesOf(node.work).map((u) => u.id));
  const put = (id: string, inputs: Record<string, string>) => { useStudio.getState().updateNode(node.id, { work: withWork(node.work, { id, inputs }) }); play("confirm"); };
  return (
    <div data-part-effects={fam ?? "any"} className="space-y-2">
      <ul className="space-y-1">
        {offered.map((o) => {
          const w = getWork(o.work);
          if (!w) return null;
          const versions = (site.get(`work:${o.work}`) ?? []).filter((v) => v.take.kind === "work");
          const has = on.has(o.work);
          return (
            <li key={o.work} data-effect-offer={o.work} data-effect-on={has ? "on" : "off"} className="rounded-md border border-border px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-small font-medium text-fg">{w.manifest.name}</span>
                  <span className="block truncate text-fine text-fg-faint">{o.why}</span>
                </span>
                {has ? (
                  <Button size="xs" variant="outline" data-effect-remove={o.work} onClick={() => useStudio.getState().updateNode(node.id, { work: withoutWork(node.work, o.work) })}>Take off</Button>
                ) : (
                  <Button size="xs" variant="outline" data-effect-add={o.work} onClick={() => put(o.work, {})}>Add</Button>
                )}
              </div>
              {!has && versions.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {versions.map((v) => (
                    <button key={`${v.host}-${v.label}`} type="button" data-effect-version={o.work} data-effect-host={v.host}
                      onClick={() => v.take.kind === "work" && put(o.work, v.take.inputs)}
                      className="tactile rounded-sm border border-border px-1.5 py-0.5 text-fine text-fg-muted hover:border-accent">
                      {v.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {/* Every effect on it, with its settings, here where it was added; the Content section keeps the rest. */}
      <WorkFields node={node} pick={(id) => ids.has(id)} title="Its effects" />
      {fam === "button" ? <ButtonLooks node={node} /> : null}
    </div>
  );
}

/** The button looks the sites taught, put on this button: its colours, edge, corners, and its hover and press. */
function ButtonLooks({ node }: { node: StudioNode }) {
  const { here, elsewhere } = useBoardKits(true);
  const kits: StyleKit[] = [...here, ...elsewhere.flatMap((e) => e.kits)].filter((k) => k.role === "button" || k.role === "badge").slice(0, 12);
  if (!kits.length) return null;
  const wear = (kit: StyleKit) => {
    const p = kitPatch(kit);
    let work = node.work ?? null;
    for (const w of p.works) work = withWork(work, w);
    useStudio.getState().updateNode(node.id, {
      colour: { ...(node.colour ?? {}), ...p.colour } as StudioNode["colour"],
      art: { ...(node.art ?? {}), ...p.art },
      edge: p.edge ? { ...(node.edge ?? {}), ...p.edge } : node.edge ?? null,
      radius: p.radius,
      work,
    });
    play("confirm");
  };
  return (
    <div data-button-looks="" className="space-y-1">
      <span className="block text-small font-medium uppercase tracking-wider text-fg-faint">Button looks from your sites</span>
      <div className="flex flex-wrap gap-1.5">
        {kits.map((k) => (
          <button key={`${k.host}-${k.id}`} type="button" data-button-look={k.id} title={k.name} onClick={() => wear(k)}
            className="tactile flex flex-col items-center gap-0.5 rounded-sm border border-border p-1 hover:border-accent">
            <KitSample kit={k} w={56} h={24} />
            <span className="max-w-[64px] truncate text-fine text-fg-muted">{k.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ save as a component */
/** The shelf category a part of this kind is filed in, and the word for what it is. */
export function componentPlace(kind: string, node: StudioNode, nodes: readonly StudioNode[]): { category: string; kind: string } {
  if (kind === "Button" || kind === "Link") return { category: "interact", kind: "Buttons" };
  if (kind === "Picture" || node.picture || holdsPicture(node, nodes)) return { category: "media", kind: "Pictures and screens" };
  if (kind === "Section" || kind === "Header" || kind === "Footer") return { category: "structure", kind: "Sections" };
  return { category: "structure", kind: "Cards and boxes" };
}

export function SaveAsComponent({ node, kind }: { node: StudioNode; kind: string }) {
  const all = useStudio((s) => s.nodes);
  const look = useStudio((s) => s.look) as { keyframes?: { name: string; frames: { key: string; style: Record<string, string> }[] }[]; fonts?: { family: string; id?: string }[] };
  const place = componentPlace(kind, node, all);
  const [name, setName] = React.useState(() => partName(node as never, all as never));
  const [category, setCategory] = React.useState(place.category);
  const [saved, setSaved] = React.useState<string | null>(null);
  React.useEffect(() => { setName(partName(node as never, all as never)); setCategory(componentPlace(kind, node, all).category); setSaved(null); }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    const host = (node.from as { host?: string } | null | undefined)?.host ?? null;
    const c = componentOf(all as never, node.id, {
      name: name.trim() || "Saved part", category, kind: place.kind,
      site: host ? siteShortName(null, host) : null,
      keyframes: look.keyframes ?? [], fonts: look.fonts ?? [],
    });
    if (!c) return;
    useLearned.getState().saveComponent(c);
    setSaved(`${CATEGORIES.find((x) => x.id === category)?.label ?? category} › ${c.name}, ${c.nodes.length} ${c.nodes.length === 1 ? "part" : "parts"}`);
    play("confirm");
  };
  return (
    <div data-save-component={node.id} className="space-y-1.5">
      <p className="text-small leading-snug text-fg-muted">Keeps this part and everything inside it, with its effects and settings, on the shelf for any board.</p>
      <div className="flex items-center gap-1.5">
        <Input inputSize="sm" aria-label="Component name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
        <Select aria-label="Shelf category" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
      </div>
      <Button size="xs" variant="outline" data-save-component-go="" onClick={save} className={cn(saved && "border-accent")}>
        {saved ? <Check className="mr-1 size-3" /> : <Bookmark className="mr-1 size-3" />}Save as a component
      </Button>
      {saved ? <p data-component-saved="" className="text-fine text-fg-faint">On the shelf: {saved}.</p> : null}
    </div>
  );
}
