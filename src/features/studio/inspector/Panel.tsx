"use client";
import * as React from "react";
import { LookFields, lookCount } from "../LookFields";
import { useShallow } from "zustand/react/shallow";
import { AlignCenter, AlignLeft, AlignRight, Bookmark, Code2, Frame, Group, Image as ImageIconLucide, Lightbulb, Lock, Megaphone, Palette as PaletteIcon, Pencil, Play, Sparkles, Trash2, Type, Unlock } from "lucide-react";
import { getFeature, categoryOf, type FeatureOption } from "../catalog";
import { isLinkable } from "../parts";
import { BACKGROUND_ID, NODE_SHAPES, pageGroups, pageNodes, pageShapes, activePage, useHeldStudio, useStudio, type StudioNode } from "../store";
import { ColourOverride } from "../ColourOverride";
import { AuditPanel, AuditReadout } from "../AuditPanel";
import { written } from "../parts/cubeFaces";
import { resolvePalette } from "../parts/theme";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Segmented } from "@/core/ui/segmented";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Switch } from "@/core/ui/switch";
import { Tooltip } from "@/core/ui/tooltip";
import { linkReason } from "../links";
import { plain } from "../parts/spans";
import { WorkFields } from "../WorkFields";
import { capturedFrom, insideControl, isMachineLabel, partName, wordsOf } from "../partNames";
import { wordsIn } from "../owner";
import { decisionSays } from "../library/badge";
import { TourEditor } from "../TourEditor";
import { Crumbs, KindIcon, PanelSection, ElementList, kindWord, useDecisions } from "../PartTreePanel";
import { ComponentFields } from "../ComponentFields";
import { componentsOf, KIND_WORD, type CompNode } from "../components";
import { PartFields } from "../PartFields";
import { JoinOrCut, WhatIsThis, WornLook, WornMotion, WornWords } from "../DrawKits";
import { PartEffects, SaveAsComponent, offeredIds } from "../PartEffects";
import { usesOf } from "../library/works";
import { LookCopy } from "../LookCopy";
import { MakeAllLike } from "../MakeAllLike";
import { codePlaced, panelFits, scriptCount } from "../partKind";
import { KitStyles } from "../KitStyles";
import { RemixKept } from "../RemixCard";
import { VERSION_ONLY, GLYPHS, OptionRange, OptionSet, WordsField, PictureField, Field, HuePicker, featureName, TEXTY, LABEL_HIDES, isLookOption, insideLink, Fold } from "./fields";
import { PageSummary, CodeLink, CodeView } from "./codeView";
import { FontField, EdgeField, PartMotions, Role } from "./partFields";
import { FrameField } from "./frameField";
import { Faces, Solid, LinkField } from "./solid";
import { PartSamples } from "../StatesTimeline";

export function Inspector() {
  const selection = useHeldStudio((s) => s.selection);
  const nodes = useHeldStudio(useShallow(pageNodes));
  const shapes = useHeldStudio(useShallow(pageShapes));
  const groups = useHeldStudio(useShallow(pageGroups));
  const page = useHeldStudio(activePage);
  const frameWidth = useHeldStudio((s) => s.frameWidth);
  /* Which mark is open. None is the resting state, and the prompt is
     always there under it — see the row below. */
  /* The back arrow on a part's panel shows the tree with the part still picked; picking another part opens its panel. */
  const [backTo, setBackTo] = React.useState<string | null>(null);
  const selKey = selection.join(",");
  React.useEffect(() => { setBackTo((b) => (b && selKey === b ? b : null)); }, [selKey]);
  /* Asked for again (its row pressed in the list, a double press on the board), the part's panel opens, even when it is the part the back arrow left. */
  React.useEffect(() => useStudio.subscribe((s, was) => { if (s.wanted && s.wanted !== was.wanted && s.wanted.panel === "inspector") setBackTo(null); }), []);
  const format = useHeldStudio((s) => s.format);
  const look = useHeldStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const openDecisions = useDecisions(nodes);

  const selNodes = nodes.filter((n) => selection.includes(n.id));
  const selShapes = shapes.filter((s) => selection.includes(s.id));
  const store = useStudio.getState;

  /*
   * THE BACKGROUND HAS LEFT THIS PANEL, by his ruling and for the reason he
   * gave: the page's fill and the textures on it are the SITE's look, not
   * this element's, and having them here was the one thing in Element that
   * genuinely belonged in Looks. They are a section of the Look panel now.
   *
   * Picking the background still has to answer for itself rather than read
   * as an empty panel, so it says where its controls went — and the way it
   * says so is a button that takes you there, not a sentence telling you to
   * go yourself.
   *
   * WHAT IT MAY NOT DO IS BE THE WHOLE PANEL, which is the fault he read as
   * this tab having nothing in it. A press on the page is how most people
   * arrive here, and what they arrived at was a tab called Element saying
   * one sentence about the page's fill and offering to send them somewhere
   * else. A tab named for a thing leads with that thing: the elements on
   * this page, each one a press away from its own editor, and the signpost
   * folded to a line at the foot where a signpost belongs.
   */
  if (selection.includes(BACKGROUND_ID)) {
    return (
      <div className="flex h-full min-h-0 flex-col" data-page-picked="">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{page.name}</div>
          <div className="text-small text-fg-muted">
            {nodes.length ? `${nodes.length} element${nodes.length === 1 ? "" : "s"} on this page. Pick one to prompt it.` : "The page itself is picked."}
          </div>
        </div>
        <ElementList nodes={nodes} className="flex-1" />
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-sm"
            style={{ background: "oklch(0.7 0.15 320 / 0.18)", color: "oklch(0.84 0.16 320)" }}
          >
            <PaletteIcon className="size-3.5" />
          </span>
          <p className="min-w-0 flex-1 text-small text-fg-muted">The page&rsquo;s fill and its textures are the site&rsquo;s look.</p>
          <Button
            size="xs"
            variant="outline"
            data-to-looks=""
            onClick={() => window.dispatchEvent(new CustomEvent("studio:panel", { detail: "look" }))}
          >
            Open Looks
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- nothing picked */
  /*
   * With nothing picked, or with one part picked and the back arrow pressed:
   * where you are (the counts), then the page's parts as a tree in page
   * order, the picked one lit. The page's own prompt is folded at the foot.
   */
  const single = selNodes.length === 1 && selShapes.length === 0 ? selNodes[0]! : null;
  if ((selNodes.length === 0 && selShapes.length === 0) || (single && backTo === single.id)) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{page.name}</div>
          <div className="text-small text-fg-muted">
            {single ? <>Picked: <button type="button" data-back-to-part="" className="text-fg underline-offset-2 hover:underline" onClick={() => { play("open"); setBackTo(null); }}>{partName(single, nodes, featureName)}</button></> : "Press a part here or on the board to open it."}
          </div>
        </div>
        <div className="shrink-0 space-y-3 p-3 pb-2">
          {/*
            A SUMMARY FIRST, the prompt folded. What a person wants on
            arriving is where they are: how many parts, pages and links, and
            what still needs deciding, each count a press away from the parts
            it counts.
          */}
          <PageSummary nodes={nodes} />
          <div className="flex items-center justify-between">
            <span className="text-small font-semibold uppercase tracking-[0.08em] text-fg">Elements, top to bottom</span>
            <span className="num text-fine text-fg-faint">{nodes.length}</span>
          </div>
        </div>
        <ElementList nodes={nodes} picked={single?.id ?? null} className="mx-1.5 min-h-40 flex-1 rounded-md border border-border" />
        <div className="shrink-0 p-3 pt-2">
          <Fold id="page-prompt" title="This page's prompt" note={page.prompt.trim() ? "written" : "empty"}>
          <Field label="This page should…" hint="Applies to everything on this page.">
            <Textarea
              autoGrow
              rows={4}
              aria-label="Page prompt"
              placeholder="e.g. The whole page is one continuous scroll; nothing is clickable until the reader reaches the bottom."
              value={page.prompt}
              onChange={(e) => useStudio.getState().updatePage(page.id, { prompt: e.target.value })}
            />
          </Field>
          <Field label="Where it would go">
            <AuditReadout
              subject="a part made from these words"
              planned={{ label: page.name, prompt: page.prompt, featureId: "custom-idea", w: 1440, h: 800, role: null, outline: null, content: "" }}
            />
          </Field>
          </Fold>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- shape picked */
  if (selShapes.length === 1 && selNodes.length === 0) {
    const shape = selShapes[0]!;
    const kindLabel = shape.kind === "frame" ? "Region" : shape.kind === "arrow" ? "Connection" : "Sketch";
    const fromNode = nodes.find((n) => n.id === shape.fromNodeId);
    const toNode = nodes.find((n) => n.id === shape.toNodeId);
    /*
     * What the chain already says.
     *
     * A chain between two parts wears its reason on the board and carries it
     * into the blueprint whether or not anybody names it, so the Name box
     * shows that reason as its placeholder: what is in the field is what the
     * chain says, and typing over it says something else instead.
     */
    const derived = shape.kind === "arrow" && fromNode && toNode ? linkReason(fromNode, toNode, shape.relation ?? "flow") : "";
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="size-2 rounded-full" style={{ background: `oklch(0.75 0.16 ${shape.hue})` }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-plain font-semibold text-fg">{shape.label || kindLabel}</div>
            <div className="text-small text-fg-muted">
              {kindLabel}
              {fromNode && toNode ? ` · ${fromNode.label} → ${toNode.label}` : ""}
            </div>
          </div>
          <Button variant="ghost" size="iconXs" aria-label="Delete" onClick={() => useStudio.getState().removeShapes([shape.id])}>
            <Trash2 />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <Field label="Name" hint={derived ? "The chain says this by itself, from what the two parts already say. Write here to say it differently." : undefined}>
            <Input
              value={shape.label}
              placeholder={derived || (shape.kind === "frame" ? "e.g. Above the fold" : "e.g. opens on click")}
              onChange={(e) => useStudio.getState().updateShape(shape.id, { label: e.target.value })}
            />
          </Field>
          <Field
            label="Prompt"
            hint={
              shape.kind === "frame"
                ? "Applies to everything inside this region."
                : shape.kind === "arrow"
                  ? "Describes the relationship between the two elements."
                  : "What this drawing represents."
            }
          >
            <Textarea
              autoGrow
              rows={4}
              value={shape.prompt}
              aria-label="Drawing prompt"
              placeholder={shape.kind === "arrow" ? "e.g. clicking the card expands it into this panel" : "Describe what this means…"}
              onChange={(e) => useStudio.getState().updateShape(shape.id, { prompt: e.target.value })}
            />
          </Field>
          {shape.kind === "pen" ? (
            <Field label="Where it would go">
              <AuditReadout
                subject="this drawing"
                planned={{ label: shape.label, prompt: shape.prompt, featureId: "custom-idea", w: 320, h: 200, role: null, outline: null, content: "" }}
              />
            </Field>
          ) : null}
          {shape.kind === "arrow" ? (
            <Field
              label="Carries data"
              hint="A data wire means the part it points at reads from the part it starts on. Turning this on writes that into the target's data box."
            >
              <Segmented
                size="xs"
                value={shape.relation === "data" ? "data" : "flow"}
                onChange={(v) => useStudio.getState().setShapeRelation(shape.id, v as "data")}
                options={[
                  { value: "flow", label: "Relationship" },
                  { value: "data", label: "Data" },
                ]}
                aria-label="Carries data"
              />
            </Field>
          ) : null}
          <Field label="Colour">
            <HuePicker value={shape.hue} onChange={(h) => useStudio.getState().updateShape(shape.id, { hue: h ?? 265 })} />
          </Field>
          {shape.kind === "pen" ? (
            <Field label="Stroke width">
              <Slider
                value={[shape.width]}
                min={1}
                max={12}
                step={1}
                onValueChange={(v) => useStudio.getState().updateShape(shape.id, { width: v[0] ?? 3 })}
                readout={(n) => `${n}px`}
              />
            </Field>
          ) : null}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- multi-selection */
  if (selNodes.length > 1) {
    const groupIds = new Set(selNodes.map((n) => n.groupId).filter(Boolean));
    const sharedGroup = groupIds.size === 1 ? groups.find((g) => g.id === [...groupIds][0]) : null;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{selNodes.length} elements selected</div>
          <div className="truncate text-small text-fg-muted">{selNodes.map((n) => n.label).join(", ")}</div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <Field label="Look" hint="Paste a copied look on all of these, in one step.">
            <LookCopy node={null} targets={selNodes.map((n) => n.id)} />
          </Field>
          <RemixKept nodes={selNodes} />
          <JoinOrCut ids={selNodes.map((n) => n.id)} />
          {sharedGroup ? (
            <>
              <Field label="Group name">
                <Input value={sharedGroup.label} onChange={(e) => useStudio.getState().updateGroup(sharedGroup.id, { label: e.target.value })} />
              </Field>
              <Field label="Group prompt" hint="Covers all members and how they relate to each other.">
                <Textarea
                  autoGrow
                  rows={4}
                  value={sharedGroup.prompt}
                  aria-label="Group prompt"
              placeholder="e.g. These three share one card shell and animate in together."
                  onChange={(e) => useStudio.getState().updateGroup(sharedGroup.id, { prompt: e.target.value })}
                />
              </Field>
              <Field label="Hold together" hint="Picked as one and sized as one: the members' places, spacing and sizes go with every resize.">
                <Switch
                  size="sm"
                  aria-label="Hold the group together"
                  checked={!!sharedGroup.locked}
                  onCheckedChange={(v) => useStudio.getState().updateGroup(sharedGroup.id, { locked: v })}
                />
              </Field>
              <Button variant="outline" size="sm" className="w-full" onClick={() => useStudio.getState().ungroup(sharedGroup.id)}>
                Ungroup
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" className="w-full" onClick={() => useStudio.getState().groupSelection()}>
              <Group />
              Group these {selNodes.length}
            </Button>
          )}

          <Field label="Set priority for all">
            <Segmented
              size="xs"
              value={selNodes[0]!.priority}
              onChange={(v) => useStudio.getState().updateNodes(selNodes.map((n) => n.id), { priority: v as "must" })}
              options={[
                { value: "must", label: "Must" },
                { value: "nice", label: "Nice" },
                { value: "idea", label: "Idea" },
              ]}
            />
          </Field>
          <Field label="Colour all" hint="Applies to every part selected.">
            <ColourOverride
              colour={selNodes[0]!.colour}
              palette={palette}
              onChange={(colour) => useStudio.getState().updateNodes(selNodes.map((n) => n.id), { colour })}
            />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => useStudio.getState().duplicateNodes(selNodes.map((n) => n.id))}>
              Duplicate
            </Button>
            <Button variant="danger" size="sm" className="flex-1" onClick={() => useStudio.getState().removeNodes(selNodes.map((n) => n.id))}>
              <Trash2 />
              Delete
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- single node */
  const node = selNodes[0]!;
  const feature = getFeature(node.featureId);
  const cat = feature ? categoryOf(feature.category) : null;
  const group = groups.find((g) => g.id === node.groupId);
  const shownName = partName(node, nodes, featureName);
  const kind = kindWord(node);
  const effectIds = offeredIds(kind, node, nodes);
  const effectsOn = usesOf(node.work).filter((u) => effectIds.has(u.id)).length;
  /* Words inside a button or a link are that control's label: one line, no
     measure, not "long-form text with proper rhythm". */
  const isLabel = !!feature && (TEXTY.has(feature.id) || (feature.id === "box" && !!wordsOf(node))) && insideControl(node);
  const captured = capturedFrom(node, nodes);
  /* A link or a button whose words sit on a part inside it: the words are edited here, on the part that draws them. */
  /* A plain read, not a hook: this runs after the panel's early returns. Cached per board (`components.ts`). */
  const comps = componentsOf(nodes as unknown as CompNode[], palette);
  const comp = comps.byId.get(node.id) ?? null;
  const partOfId = comp ? null : comps.of.get(node.id);
  const partOf = partOfId ? comps.byId.get(partOfId) ?? null : null;
  const wordsPart = wordsIn(nodes, node);
  const wordsHere = wordsPart && wordsPart.id !== node.id ? wordsPart : null;
  /* A drawn button's link is asked under "What is this?", so it is not asked twice. */
  const control = !node.worn && (kind === "Link" || kind === "Button" || !!node.link || isLinkable(node.featureId));
  const decision = openDecisions.find((d) => d.id === node.id) ?? null;
  const featureOptions = feature?.options?.filter((o) => !(isLabel && LABEL_HIDES.has(o.id))) ?? [];
  const contentOptions = featureOptions.filter((o) => !isLookOption(o));
  const lookOptions = featureOptions.filter(isLookOption);
  /* Only the sections that mean something on this kind of part (`partKind.ts#panelFits`). */
  const fits = panelFits({ kind, label: isLabel, brought: !!(node.source || node.from), glyph: node.glyph ?? null, picture: !!node.picture || feature?.id === "picture" || kind === "Picture" });
  /* The page's code sets where it sits: typing a place here would be undone when the code runs. */
  const placedByCode = codePlaced(node.source?.code);
  const nowhere = decision?.why === "nowhere";
  /*
   * Typing a number into X, Y, W or H is his hand on the box exactly as a
   * drag is, so it marks the part his and the healing leaves it alone from
   * then on. Only the four: setting a colour or a prompt says nothing about
   * where the box belongs. See `StudioNode.byHand`.
   */
  const update = (patch: Parameters<ReturnType<typeof store>["updateNode"]>[1]) => {
    const movesTheBox = patch && ("x" in patch || "y" in patch || "w" in patch || "h" in patch);
    useStudio.getState().updateNode(node.id, movesTheBox && !node.byHand ? { ...patch, byHand: true, handFrom: { x: node.x, y: node.y, w: node.w, h: node.h } } : patch);
  };

  const optionField = (opt: FeatureOption) =>
    opt.kind === "set" ? (
      <OptionSet key={opt.id} option={opt} value={node.options[opt.id]} onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })} />
    ) : opt.kind === "range" ? (
      <OptionRange key={opt.id} option={opt} value={node.options[opt.id]} onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })} />
    ) : (
      <div key={opt.id} className="flex items-center justify-between gap-2">
        <span className="text-plain text-fg">{opt.label}</span>
        <Select className="w-32" value={node.options[opt.id] ?? opt.values[0]!} onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
          options={opt.values.map((v) => ({ value: v, label: v }))} aria-label={opt.label} />
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col" data-part-panel={node.id}>
      <div className="shrink-0 space-y-1 border-b border-border px-3 pb-2 pt-1.5">
        <Crumbs node={node} nodes={nodes} pageName={page.name} onBack={() => setBackTo(node.id)} />
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            {node.glyph ? <span className="text-xs">{node.glyph}</span> : <KindIcon kind={kind} className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div data-element-name="" className="truncate text-plain font-semibold text-fg" title={shownName}>{shownName}</div>
            <div data-element-kind="" className="truncate text-small text-fg-muted">{isLabel ? (insideLink(node) ? "Label on a link" : "Label on a button") : kind}</div>
          </div>
          <Tooltip content={node.locked ? "Unlock" : "Lock position"}>
            <Button variant="ghost" size="iconXs" aria-label="Lock" onClick={() => update({ locked: !node.locked })}>
              {node.locked ? <Lock /> : <Unlock />}
            </Button>
          </Tooltip>
          {/* One Delete, not two. */}
          <Tooltip content="Delete">
            <Button variant="ghost" size="iconXs" aria-label="Delete" className="text-danger" onClick={() => useStudio.getState().removeNodes([node.id])}>
              <Trash2 />
            </Button>
          </Tooltip>
        </div>
        {node.source ? <CodeLink node={node} /> : null}
        {/* A part that goes through states: its samples of data, next to Focus (`StatesTimeline.tsx#PartSamples`). */}
        <PartSamples nodeId={node.id} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {decision ? (
          <div data-part-decision={decision.why} className="mx-3 mt-3 space-y-1.5 rounded-md border p-2" style={{ borderColor: "oklch(0.74 0.18 55 / 0.6)", background: "oklch(0.74 0.18 55 / 0.08)" }}>
            <p className="flex items-start gap-1.5 text-small leading-snug text-fg">
              <span className="mt-px shrink-0 font-bold" style={{ color: "oklch(0.74 0.18 55)" }}>!</span>
              <span>This is {decisionSays(decision.why, kind)}.</span>
            </p>
            {/* Said once, here, with its fix: where it leads, or that it stays unlinked on purpose. */}
            {nowhere ? (
              <>
                <LinkField node={node} />
                <Button size="xs" variant="outline" data-nowhere-on-purpose="" onClick={() => { play("confirm"); update({ nowhere: true }); }}>Leave it unlinked, on purpose</Button>
              </>
            ) : null}
          </div>
        ) : null}

        {/* Recognised as one thing from its stacked parts: its options as one set, its layers one press away (`components.ts`). */}
        {comp ? null : partOf ? (
          <div data-layer-of={partOf.id} className="border-b border-border px-3 py-2 text-small text-fg-muted">
            A layer of {partOf.name}.{" "}
            <button type="button" className="tactile text-accent underline" onClick={() => { useStudio.getState().setSelection([partOf.id]); useStudio.getState().want({ panel: "inspector", id: partOf.id }); }}>Pick the whole {KIND_WORD[partOf.kind].toLowerCase()}</button>
          </div>
        ) : null}
        {node.featureId === "whats-new" ? (
          <PanelSection id="tour" title="What's new steps" icon={<Megaphone />} note={`${node.tour?.current.steps.length ?? 0} of 6`}>
            <TourEditor node={node} />
          </PanelSection>
        ) : null}
        {/* A drawn shape is asked what it is first, and the options its answer needs open with it. */}
        {node.worn ? <WhatIsThis node={node} /> : null}

        <PanelSection id="content" title="Content" icon={<Type />} note={wordsOf(wordsHere ?? node) ? undefined : node.picture ? "a picture" : undefined}>
          {/* THE WORDS COME FIRST: they are what a first owner came to change.
              Two presses on the part land the caret here (`wanted`). */}
          {wordsHere ? (
            <WordsField node={wordsHere} content={{ label: "Its words" }} label={kind === "Button" ? "button" : "link"} alsoFor={node.id} />
          ) : feature?.content && !node.worn ? (
            <WordsField node={node} content={feature.content} label={isLabel ? (insideLink(node) ? "link" : "button") : undefined} />
          ) : null}
          {/* While it goes nowhere, the box at the top holds where it leads, so it is not asked twice. */}
          {control && !nowhere ? <LinkField node={node} /> : null}
          {node.worn ? <WornWords node={node} /> : null}
          {!node.worn && (node.picture || feature?.id === "picture" || !wordsOf(wordsHere ?? node)) ? <PictureField node={node} /> : null}
          <WorkFields node={node} pick={(id) => !effectIds.has(id)} />
          {node.vector ? <Role node={node} /> : null}
          {node.featureId === "cube-3d" || (node.featureId === "mesh-3d" && node.cube) ? <Faces node={node} palette={palette} /> : null}
          {node.featureId === "cube-3d" || (node.featureId === "mesh-3d" && node.cube) ? <Solid node={node} palette={palette} /> : null}
          {/* The shelf item's versions, read off the item's data (`partOptions.ts`): switching one swaps the part that draws. */}
          <PartFields node={node} only={VERSION_ONLY} />
          {contentOptions.length ? (
            <div className="space-y-2">
              <div className="text-small font-medium uppercase tracking-wider text-fg-faint">Options</div>
              {contentOptions.map(optionField)}
            </div>
          ) : null}
        </PanelSection>

        <PanelSection id="place" title="Position and size" icon={<Frame />} note={placedByCode ? "set by its code" : `${Math.round((Math.min(node.w, frameWidth) / frameWidth) * 100)}% wide`}>
          {placedByCode ? (
            <p data-place-by-code="" className="flex items-start gap-1.5 text-small leading-snug text-fg-muted">
              <Lock className="mt-0.5 size-3 shrink-0" />
              <span>The page&apos;s code sets where this sits, so it is locked here. Ask the code chat under Filled by code to move it.</span>
            </p>
          ) : null}
          <fieldset disabled={placedByCode} data-place-locked={placedByCode ? "" : undefined} className="m-0 min-w-0 space-y-1.5 border-0 p-0 disabled:opacity-60">
          <div className="grid grid-cols-2 gap-1.5" data-place="">
            {(["x", "y", "w", "h"] as const).map((k) => {
              const word = k === "w" ? "Width" : k === "h" ? "Height" : k === "x" ? "Across" : "Down";
              return (
                <label key={k} className="flex items-center gap-1.5">
                  <span className="w-12 shrink-0 text-small text-fg-muted">{word}</span>
                  <Input
                    type="number"
                    inputSize="sm"
                    className="min-w-0 flex-1 px-1.5"
                    value={String(Math.round(node[k]))}
                    aria-label={k === "w" ? "Width" : k === "h" ? "Height" : k.toUpperCase()}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      update({ [k]: k === "w" ? Math.max(40, v) : k === "h" ? Math.max(24, v) : v } as Partial<typeof node>);
                    }}
                  />
                </label>
              );
            })}
          </div>
          <p className="text-fine text-fg-faint">In pixels, from the page&apos;s top left corner.</p>
          <div className="flex gap-1">
            <Tooltip content="Span the whole page">
              <Button size="xs" variant="outline" className="flex-1" onClick={() => update({ x: 0, w: frameWidth })}>Full width</Button>
            </Tooltip>
            <Tooltip content="Against the left edge">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Flush left" onClick={() => update({ x: 0 })}><AlignLeft /></Button>
            </Tooltip>
            <Tooltip content="In the middle">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Centre" onClick={() => update({ x: Math.round((frameWidth - node.w) / 2) })}><AlignCenter /></Button>
            </Tooltip>
            <Tooltip content="Against the right edge">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Flush right" onClick={() => update({ x: frameWidth - node.w })}><AlignRight /></Button>
            </Tooltip>
          </div>
          </fieldset>
        </PanelSection>

        <PanelSection id="look" title="Look" icon={<PaletteIcon />} note={node.worn ? node.worn.kit.name : node.colour && Object.keys(node.colour).length ? "own colours" : undefined}>
          {/* Recognised as one thing from its stacked parts: its options as one set, its layers one press away (`components.ts`). */}
          {comp ? (
            <div data-component-block={comp.kind} className="space-y-1 border-b border-border pb-2">
              <div className="text-small font-semibold text-fg">This {KIND_WORD[comp.kind].toLowerCase()}</div>
              <ComponentFields comp={comp} nodes={nodes} />
            </div>
          ) : null}
          {lookOptions.length ? <div className="space-y-2" data-look-options="">{lookOptions.map(optionField)}</div> : null}
          <RemixKept nodes={[node]} />
          <LookCopy node={node} targets={[node.id]} />
          {/* A shape drawn wearing a style kit: its colour, style, lighting bar and outline (`DrawKits.tsx`). */}
          {node.worn ? <WornLook node={node} /> : null}
          {node.worn ? null : <>
          <Field label="Colour">
            <ColourOverride colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} tryFor={node.id} />
          </Field>
          <FontField node={wordsHere ?? node} base={Number(format["type.baseSize"]) || 16} />
          <EdgeField node={node} />
          <FrameField node={node} />
          <Field label="Shape" hint="What the part is cut to.">
            <Segmented size="xs" value={node.shape ?? "box"} onChange={(v) => update({ shape: v === "box" ? null : (v as "circle") })}
              options={NODE_SHAPES.map((v) => ({ value: v, label: v }))} />
          </Field>
          {fits.mark ? <Field label="Mark" hint="Give a new idea its own mark so you can spot it on the board.">
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => update({ glyph: null })} className={cn("tactile size-6 rounded-sm border text-small", node.glyph === null ? "border-accent" : "border-border")}>
                <PaletteIcon className="mx-auto size-3" />
              </button>
              {GLYPHS.map((g) => (
                <button key={g} type="button" onClick={() => update({ glyph: g })} className={cn("tactile size-6 rounded-sm border text-xs", node.glyph === g ? "border-accent" : "border-border")}>{g}</button>
              ))}
            </div>
          </Field> : null}
          </>}
          {/* The rest of the look, folded: the site's styles, making every part of its kind match, and every CSS slot it wears. */}
          <Fold id="look-styles" title="Styles from your sites">
            <p className="text-small leading-snug text-fg-muted">Point at one to see it on the part; click to put it on.</p>
            <KitStyles node={node} />
          </Fold>
          <Fold id="look-make-all" title="Make all like this">
            <p className="text-small leading-snug text-fg-muted">Every part of this kind on the site, restyled to match, in one step.</p>
            <MakeAllLike node={node} />
          </Fold>
          {/* Everything else it wears, as CSS, one slot each (`LookFields.tsx`). */}
          <Fold id="look-css" title="Every CSS slot" note={`${lookCount(node)} set`}>
            {node.source?.look?.length ? (
              <p className="text-small text-fg-muted" data-look-from-capture="">Look from capture: {node.source.look.join(", ")}. Drawn as the page computed it.</p>
            ) : null}
            <LookFields node={node} />
          </Fold>
        </PanelSection>

        {/* MOTION: how it moves, and the effects that fit this kind of part, plain or as a site had them (PartEffects.tsx). */}
        <PanelSection id="motion" title="Motion" icon={<Play />} note={node.worn?.motion?.name ?? (effectsOn ? `${effectsOn} ${effectsOn === 1 ? "effect" : "effects"} on` : undefined)}>
          {node.worn ? <WornMotion node={node} /> : <PartMotions node={node} />}
          <PartEffects node={node} kind={kind} nodes={nodes} />
        </PanelSection>

        {/* CODE, one line until opened: what the page's scripts do with it, and asking the code chat. */}
        {node.source?.code ? (
          <PanelSection id="code" title="Filled by code" icon={<Code2 />} note={`${scriptCount(node.source.code)} ${scriptCount(node.source.code) === 1 ? "script" : "scripts"}`} defaultOpen={false}>
            <CodeView node={node} />
          </PanelSection>
        ) : null}

        <PanelSection id="save-component" title="Save as a component" icon={<Bookmark />} defaultOpen={false}>
          <SaveAsComponent node={node} kind={kind} />
        </PanelSection>

        {fits.prompt ? <PanelSection id="prompt" title="Prompt" icon={<Pencil />} defaultOpen={false} note={(captured ? captured.rest : node.prompt).trim() ? "written" : "empty"}>
          <Field label="Prompt for this part" hint="Mention the parts beside it by name and the builder will keep them together.">
            {/* Where a captured part came from, said the way a person would: the
                site and the section, never the element path the capture used to
                find it. The path stays in the prompt the document keeps. */}
            {captured ? <span data-captured-from="" className="mb-1 block text-small text-fg-muted">{captured.says}</span> : null}
            <Textarea
              autoGrow
              rows={4}
              aria-label="Element prompt"
              value={captured ? captured.rest : node.prompt}
              placeholder={feature?.hint ?? `e.g. ${feature?.name ?? "This"} sits tight against the part on its left and shares its colour.`}
              onChange={(e) => update({ prompt: captured ? `${captured.prefix}${e.target.value}` : e.target.value })}
            />
          </Field>
          <Field label="Name">
            {/* A capture's own name for its box ("div · 1 inside") is not shown
                as if it were a name: the field is empty with the readable name
                as its placeholder, and typing gives the part a real one. */}
            <Input value={isMachineLabel(node.label) ? "" : node.label} placeholder={shownName} aria-label="Name" onChange={(e) => update({ label: e.target.value })} />
          </Field>
          <Field label="What it shows or does" hint="The values and actions the backend has to provide, in your words. Wires pointing at this part fill it in.">
            <Textarea autoGrow rows={2} aria-label="Data" value={node.data} placeholder="e.g. live coin price, trader profit and loss, time left, or: join duel" onChange={(e) => update({ data: e.target.value })} />
          </Field>
          <Field label="Priority">
            <Segmented size="xs" value={node.priority} onChange={(v) => update({ priority: v as "must" })}
              options={[{ value: "must", label: "Must have" }, { value: "nice", label: "Nice" }, { value: "idea", label: "Idea" }]} />
          </Field>
          {group ? (
            <Field label={`In the group ${group.label}`}>
              <Textarea autoGrow rows={2} value={group.prompt} placeholder="Prompt for the whole group…" onChange={(e) => useStudio.getState().updateGroup(group.id, { prompt: e.target.value })} />
            </Field>
          ) : null}
          {feature ? (
            <p data-element-means="" className="text-small leading-relaxed text-fg-muted">
              <Lightbulb className="mr-1 inline size-3 text-fg-faint" />
              {isLabel ? `The words on ${insideLink(node) ? "a link" : "a button"}: its label, kept on one line and read as part of the control.` : feature.blurb}
              {cat ? <span className="text-fg-faint"> ({cat.label})</span> : null}
            </p>
          ) : null}
        </PanelSection> : (
          /* A button says what it does where its link is: only its name is asked here. */
          <PanelSection id="name" title="Name" icon={<Pencil />} defaultOpen={false} note={isMachineLabel(node.label) ? undefined : node.label}>
            <Input value={isMachineLabel(node.label) ? "" : node.label} placeholder={shownName} aria-label="Name" onChange={(e) => update({ label: e.target.value })} />
          </PanelSection>
        )}

        {/* MAKE A PICTURE, closed. Where a picture of this part is sent: the
            model and its settings, for the one time in many a part is handed
            to a picture model. The drawing tool itself is the Pictures tab
            (PicturesPanel.tsx), which draws for this part while it is picked. */}
        {fits.picture ? <PanelSection id="make-picture" title="Make a picture" icon={<ImageIconLucide />} defaultOpen={false} note={node.plan ? "set by you" : undefined}>
          <Button variant="outline" size="xs" data-open-pictures="" onClick={() => { play("open"); useStudio.getState().want({ panel: "pictures" }); }}>
            <Sparkles className="size-3" /> Draw one in Pictures
          </Button>
          <div data-fold="make-picture">
            <Field label="Where a picture of this part is sent" hint="The route's own choice unless you say otherwise. Every option below is the model's own.">
              <AuditPanel node={node} />
            </Field>
          </div>
        </PanelSection> : null}
      </div>
    </div>
  );
}
