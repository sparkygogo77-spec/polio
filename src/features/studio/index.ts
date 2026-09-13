import {
  Brush, Copy, Eraser, Frame, Group, Hand, Layers, LayoutTemplate, Lightbulb, Link, Lock,
  MousePointer2, Palette as PaletteIcon, Pencil, Plus, Redo2, RotateCcw, Send, Sparkles, Star,
  Trash2, Undo2, Ungroup, Wand2, ZoomIn, Eye, EyeOff, Link2, Link2Off, Scissors, ClipboardPaste,
} from "lucide-react";
import { defineFeature, type ActionContext, type ContextTarget, type MenuEntry } from "@/core/types";
import { StudioPage } from "./StudioPage";
import { GithubButton } from "./GithubButton";
import { QueueStrip } from "./QueueStrip";
import { PreviewPage } from "./live/PreviewPage";
import { PublishedPage } from "./live/PublishedPage";
import { isLinkable } from "./parts";
import { CATEGORIES, categoryOf, featuresByCategory, getFeature, type FeatureDef } from "./catalog";
import { FORMAT_FIELDS } from "./format";
import { compileSpec, specToJson, specToMarkdown } from "./spec";
import { BACKGROUND_ID, heldBackground, heldNodes, HUES, livePath, useStudio, type StudioGroup, type StudioNode, type StudioPage as PageType, type StudioShape } from "./store";
import { addFeatureToCanvas, dropPoint } from "./Palette";
import { openBoard } from "./RadialMenu";

/** The Builder answers on /builder and keeps the old /studio addresses working. */
const onStudio = () => typeof window !== "undefined" && /^\/(builder|studio)/.test(window.location.pathname);
const onPreview = () => typeof window !== "undefined" && /^\/builder\/preview/.test(window.location.pathname);
const onBoard = () => onStudio() && !onPreview();
const onDesign = onBoard;

/** Right-click position in canvas space, so "add here" really means here. */
function canvasPoint(target: ContextTarget) {
  const { pan, zoom } = useStudio.getState();
  const rect = target.element.getBoundingClientRect();
  return { x: (target.x - rect.left - pan.x) / zoom, y: (target.y - rect.top - pan.y) / zoom };
}

/** Where a part sends people: nowhere, a page, or (in the inspector) a web address. */
function linksMenu(node: StudioNode): MenuEntry {
  const s = useStudio.getState();
  const setLink = (link: StudioNode["link"]) => s.updateNode(node.id, { link });
  const current = node.link;
  return {
    id: "studio.node.link",
    label: "Links to",
    icon: Link2,
    hint: current ? (current.kind === "page" ? s.pages.find((p) => p.id === current.target)?.name ?? current.target : current.target) : undefined,
    children: [
      { id: "link.none", label: "Nowhere", checked: !current, onSelect: () => setLink(null) },
      { type: "separator" },
      ...s.pages.map((p) => ({
        id: `link.page.${p.id}`,
        label: `${p.name}  ${p.path}`,
        checked: current?.kind === "page" && current.target === p.id,
        onSelect: () => setLink({ kind: "page", target: p.id }),
      })),
    ],
  };
}

function compile() {
  const s = useStudio.getState();
  return compileSpec({ pages: s.pages, nodes: s.nodes, groups: s.groups, shapes: s.shapes, format: s.format, brief: s.brief, frameWidth: s.frameWidth, look: s.look, motion: s.motion });
}

/** Add → category → feature. Every feature in the library is reachable by mouse alone. */
function addFeatureMenu(at: { x: number; y: number } | null): MenuEntry {
  return {
    id: "studio.add",
    label: "Add element",
    icon: Plus,
    children: CATEGORIES.map((cat) => ({
      id: `studio.add.${cat.id}`,
      label: cat.label,
      icon: cat.icon,
      children: featuresByCategory(cat.id).map((feature: FeatureDef) => ({
        id: `studio.add.${feature.id}`,
        label: feature.name,
        icon: feature.icon,
        hint: feature.blurb.length > 34 ? undefined : feature.blurb,
        onSelect: () => {
          if (at) useStudio.getState().addNode(feature.id, at.x - (feature.w ?? 132) / 2, at.y - (feature.h ?? 76) / 2);
          else addFeatureToCanvas(feature.id);
        },
      })),
    })),
  };
}

/** A colour for a drawing or a group — the things that are only on the board. */
const hueMenu = (current: number | null, apply: (h: number | null) => void): MenuEntry => ({
  id: "studio.hue",
  label: "Colour",
  icon: PaletteIcon,
  children: [
    { id: "studio.hue.auto", label: "Category colour", checked: current === null, onSelect: () => apply(null) },
    ...HUES.map((h) => ({ id: `studio.hue.${h}`, label: `Hue ${h}`, checked: current === h, onSelect: () => apply(h) })),
  ],
});

export const studio = defineFeature({
  id: "studio",
  name: "Builder",
  description: "Lay out what a site should be as parts, drawings and per-part prompts on one board, then compile it into a blueprint.",
  icon: LayoutTemplate,
  tags: ["builder", "board", "prompt", "blueprint"],
  settingGroups: [{ id: "studio", label: "Builder", icon: LayoutTemplate, order: 240, description: "The drawing board, and what goes to Claude with a prompt." }],
  settings: [
    {
      id: "studio.drawMode", group: "studio", label: "Drawing board keeps strokes", type: "select", default: "snap", order: 1,
      description: "Snap turns a wobbly box into a box, a loop into a circle, a slanted line level. The switch on the board's rim sets the same thing.",
      options: [{ value: "snap", label: "Snapped to shapes" }, { value: "smooth", label: "Smoothed" }, { value: "raw", label: "As drawn" }],
    },
    {
      id: "studio.screenshots", group: "studio", label: "Send screenshots to Claude", type: "toggle", default: true, order: 2,
      description: "Every prompt from the blueprint dialog goes with a picture of each page as the live preview shows it, so Claude sees the site and not only a description of it. Needs Playwright on the server; without it the words go alone.",
    },
    { id: "studio.screenshotPages", group: "studio", label: "Pages per prompt", description: "How many pages are photographed for one prompt, in order.", type: "number", default: 4, min: 1, max: 12, step: 1, advanced: true, order: 3 },
    { id: "studio.publishDeploy", group: "studio", label: "Publish also deploys", description: "After the push to GitHub, call the Vercel deploy hook when one is set.", type: "toggle", default: true, advanced: true, order: 4 },
  ],
  routes: [
    { path: "/builder", component: StudioPage, title: "Builder", fullBleed: true, ownSearch: true },
    { path: "/builder/preview", component: PreviewPage, title: "Live preview", fullBleed: true },
    { path: "/builder/preview/*", component: PreviewPage, title: "Live preview", fullBleed: true },
    { path: "/site", component: PublishedPage, title: "Site", fullBleed: true },
    { path: "/site/*", component: PublishedPage, title: "Site", fullBleed: true },
    // Old addresses keep working.
    { path: "/studio", component: StudioPage, title: "Builder", fullBleed: true },
    { path: "/studio/design", component: StudioPage, title: "Builder", fullBleed: true },
  ],
  /*
   * No nav tab.
   *
   * "Builder" named a tab for the screen you were already on, and the bar
   * below it now says which site is open — its mark and its build — which is
   * the thing that tab was standing in for. Builds is the way out, at the
   * head of that same bar; the command palette and /builder still get here.
   */
  nav: [],
  topBarItems: [
    /* Work in flight goes on the near side of the bell, where the eye already
       looks to find out what is happening; the repository link is a control
       and stays over with the rest of them. */
    { id: "studio.queue", order: 10, slot: "status", component: QueueStrip },
    { id: "studio.github", order: 20, component: GithubButton },
  ],

  commands: [
    { id: "studio.open", label: "Open the Builder", group: "Builder", icon: LayoutTemplate, keywords: ["board", "parts", "design"], run: (c) => c.navigate("/builder") },
    { id: "studio.library", label: "Builder: show or hide the library", group: "Builder", icon: Layers, when: onStudio, run: () => (window as unknown as { __studioToggleLibrary?: () => void }).__studioToggleLibrary?.() },
    { id: "studio.compile", label: "Builder: compile the blueprint", group: "Builder", icon: Send, when: onStudio, run: () => (window as unknown as { __studioOpenBrief?: () => void }).__studioOpenBrief?.() },
    {
      id: "studio.copyBrief",
      label: "Builder: copy the blueprint",
      group: "Builder",
      icon: Copy,
      run: (c) => void c.copy(specToMarkdown(compile()), "blueprint"),
    },
    { id: "studio.addPage", label: "Builder: add a page", group: "Builder", icon: Plus, run: () => { useStudio.getState().addPage(); } },
    { id: "studio.restoreLibrary", label: "Builder: put every removed part back", group: "Builder", icon: RotateCcw, run: () => useStudio.getState().restoreAllFeatures() },
    { id: "studio.live", label: "Builder: open the live preview", group: "Builder", icon: Eye, run: (c) => c.navigate(livePath()) },
    { id: "studio.board", label: "Builder: back to the board", group: "Builder", icon: LayoutTemplate, when: onPreview, run: (c) => c.navigate("/builder") },
    { id: "studio.newIdea", label: "Builder: drop a new idea", group: "Builder", icon: Lightbulb, when: onStudio, run: () => { addFeatureToCanvas("custom-idea"); } },
    { id: "studio.undo", label: "Builder: undo", group: "Builder", icon: Undo2, when: onStudio, run: () => useStudio.getState().undo() },
    { id: "studio.redo", label: "Builder: redo", group: "Builder", icon: Redo2, when: onStudio, run: () => useStudio.getState().redo() },
    {
      id: "studio.reset",
      label: "Builder: clear everything",
      group: "Builder",
      icon: RotateCcw,
      run: (c) =>
        void c
          .confirm({ title: "Clear the whole blueprint?", body: "Every page, element, drawing and prompt goes.", danger: true, confirmLabel: "Clear" })
          .then((ok) => ok && useStudio.getState().resetAll()),
    },
  ],

  shortcuts: [
    { keys: "g b", label: "Go to the Builder", group: "Navigate", run: (c) => c.navigate("/builder") },
    { keys: "p", label: "Design / Preview", group: "Builder", when: onBoard, run: () => { const s = useStudio.getState(); s.setMode(s.mode === "preview" ? "design" : "preview"); } },
    { keys: "w", label: "Show / hide the wires", group: "Builder", when: onBoard, run: () => { const s = useStudio.getState(); s.setShowWires(!s.showWires); } },
    { keys: "b", label: "Back to the board", group: "Builder", when: onPreview, run: (c) => c.navigate("/builder") },
    { keys: "l", label: "Show / hide the library", group: "Builder", when: onBoard, run: () => (window as unknown as { __studioToggleLibrary?: () => void }).__studioToggleLibrary?.() },
    { keys: "v", label: "Select tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("select") },
    { keys: "d", label: "Draw tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("pen") },
    { keys: "a", label: "Arrow tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("arrow") },
    { keys: "e", label: "Erase tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("erase") },
    { keys: "f", label: "Fit the frame in view", group: "Builder", when: onDesign, run: () => useStudio.getState().requestFit() },
    { keys: "mod+z", label: "Undo", group: "Builder", when: onDesign, run: () => useStudio.getState().undo() },
    { keys: "mod+shift+z", label: "Redo", group: "Builder", when: onDesign, run: () => useStudio.getState().redo() },
    { keys: "mod+g", label: "Group selection", group: "Builder", when: onDesign, run: () => useStudio.getState().groupSelection() },
    { keys: "mod+d", label: "Duplicate selection", group: "Builder", when: onDesign, run: () => useStudio.getState().duplicateNodes(useStudio.getState().selection) },
    { keys: "mod+a", label: "Select everything", group: "Builder", when: onDesign, run: () => useStudio.getState().selectAll() },
    // Cut takes the parts that are selected, or the background when that is
    // what is picked; paste puts back whatever was cut last.
    { keys: "mod+x", label: "Cut", group: "Builder", when: onDesign, run: () => { useStudio.getState().cut(); } },
    { keys: "mod+v", label: "Paste what was cut", group: "Builder", when: onDesign, run: () => { useStudio.getState().paste(); } },
    {
      keys: "backspace",
      label: "Delete selection",
      group: "Builder",
      when: onDesign,
      run: () => {
        const s = useStudio.getState();
        // On the background, delete strips it bare — and still holds it, so
        // it can be put back.
        if (s.selection.includes(BACKGROUND_ID)) { s.cutBackground(); return; }
        s.removeNodes(s.selection);
        s.removeShapes(s.selection);
      },
    },
    { keys: "mod+enter", label: "Compile the blueprint", group: "Builder", when: onStudio, allowInInput: true, run: () => (window as unknown as { __studioOpenBrief?: () => void }).__studioOpenBrief?.() },
  ],

  contextMenus: [
    /* ------------------------------------------------------- live preview */
    {
      scope: "studio-live",
      items: (target, ctx) => {
        const data = target.data as { pageId: string; device: string } | undefined;
        const s = useStudio.getState();
        const page = s.pages.find((p) => p.id === data?.pageId);
        const setDevice = (d: string) => (window as unknown as { __studioLiveDevice?: (d: string) => void }).__studioLiveDevice?.(d);
        return [
          { type: "label", label: `Live · ${page?.name ?? "page"}` },
          { id: "studio.live.board", label: "Back to the board", icon: LayoutTemplate, shortcut: "b", onSelect: () => ctx.navigate("/builder") },
          {
            id: "studio.live.device",
            label: "Device",
            icon: Layers,
            children: (["desktop", "tablet", "phone"] as const).map((d) => ({
              id: `studio.live.device.${d}`,
              label: d.charAt(0).toUpperCase() + d.slice(1),
              checked: data?.device === d,
              onSelect: () => setDevice(d),
            })),
          },
          {
            id: "studio.live.pages",
            label: "Go to page",
            icon: Layers,
            children: s.pages.map((p) => ({ id: `studio.live.page.${p.id}`, label: p.name, checked: p.id === page?.id, onSelect: () => ctx.navigate(livePath(p.id)) })),
          },
          { type: "separator" },
          { id: "studio.live.copy", label: "Copy page route", icon: Copy, onSelect: () => void ctx.copy(page?.path ?? "/", "route") },
        ];
      },
    },
    {
      scope: "studio-live-node",
      items: (target, ctx) => {
        const node = target.data as StudioNode | undefined;
        if (!node) return [];
        const s = useStudio.getState();
        const entries: MenuEntry[] = [
          { type: "label", label: node.label },
          {
            id: "studio.liveNode.edit",
            label: "Edit on the board",
            icon: Wand2,
            onSelect: () => {
              s.setActivePage(node.pageId);
              s.setSelection([node.id]);
              ctx.navigate("/builder");
            },
          },
        ];
        if (isLinkable(node.featureId)) entries.push(linksMenu(node));
        entries.push({ id: "studio.liveNode.copyName", label: "Copy name", icon: Copy, onSelect: () => void ctx.copy(node.label, "element name") });
        return entries;
      },
    },
    /* ------------------------------------------------------------ element */
    {
      scope: "studio-node",
      items: (target, ctx) => {
        const node = target.data as StudioNode | undefined;
        if (!node) return [];
        const s = useStudio.getState();
        const feature = getFeature(node.featureId);
        const selection = s.selection.includes(node.id) ? s.selection : [node.id];
        const multi = selection.length > 1;
        const group = s.groups.find((g) => g.id === node.groupId);

        const entries: MenuEntry[] = [
          { type: "label", label: multi ? `${selection.length} elements` : node.label },
          {
            id: "studio.node.prompt",
            label: node.prompt ? "Edit its prompt" : "Write its prompt",
            icon: Wand2,
            hint: node.prompt ? "written" : undefined,
            onSelect: () => s.setSelection([node.id]),
          },
          {
            id: "studio.node.priority",
            label: "Priority",
            icon: Star,
            children: (["must", "nice", "idea"] as const).map((p) => ({
              id: `studio.node.priority.${p}`,
              label: p === "must" ? "Must have" : p === "nice" ? "Nice to have" : "Just an idea",
              checked: node.priority === p,
              onSelect: () => s.updateNodes(selection, { priority: p }),
            })),
          },
        ];

        if (feature?.options?.length) {
          entries.push({
            id: "studio.node.options",
            label: "Options",
            icon: Layers,
            children: feature.options.map((opt) => ({
              id: `studio.node.opt.${opt.id}`,
              label: opt.label,
              children: opt.values.map((v) => ({
                id: `studio.node.opt.${opt.id}.${v}`,
                label: v,
                checked: (node.options[opt.id] ?? opt.values[0]) === v,
                onSelect: () => s.updateNode(node.id, { options: { ...node.options, [opt.id]: v } }),
              })),
            })),
          });
        }

        if (!multi && isLinkable(node.featureId)) entries.push(linksMenu(node));
        entries.push({ id: "studio.node.live", label: "Open in live preview", icon: Eye, shortcut: "p", onSelect: () => ctx.navigate(livePath(node.pageId)) });

        entries.push(
          {
            id: "studio.node.frame",
            label: "In the frame",
            icon: Layers,
            children: [
              { id: "frame.full", label: "Full width", onSelect: () => { for (const id of selection) s.updateNode(id, { x: 0, w: s.frameWidth }); } },
              { id: "frame.left", label: "Flush left", onSelect: () => { for (const id of selection) s.updateNode(id, { x: 0 }); } },
              { id: "frame.center", label: "Centre", onSelect: () => { for (const id of selection) { const n = useStudio.getState().nodes.find((x) => x.id === id); if (n) s.updateNode(id, { x: Math.round((s.frameWidth - n.w) / 2) }); } } },
              { id: "frame.right", label: "Flush right", onSelect: () => { for (const id of selection) { const n = useStudio.getState().nodes.find((x) => x.id === id); if (n) s.updateNode(id, { x: s.frameWidth - n.w }); } } },
              { type: "separator" },
              { id: "frame.top", label: "Move to the top", onSelect: () => { for (const id of selection) s.updateNode(id, { y: 0 }); } },
            ],
          },
          {
            id: "studio.node.align",
            label: "Align to each other",
            icon: Layers,
            disabled: !multi,
            children: [
              { id: "align.left", label: "Left edges", onSelect: () => alignNodes(selection, "left") },
              { id: "align.hcenter", label: "Horizontal centres", onSelect: () => alignNodes(selection, "hcenter") },
              { id: "align.right", label: "Right edges", onSelect: () => alignNodes(selection, "right") },
              { type: "separator" },
              { id: "align.top", label: "Top edges", onSelect: () => alignNodes(selection, "top") },
              { id: "align.vcenter", label: "Vertical centres", onSelect: () => alignNodes(selection, "vcenter") },
              { id: "align.bottom", label: "Bottom edges", onSelect: () => alignNodes(selection, "bottom") },
              { type: "separator" },
              { id: "align.row", label: "Spread into a row", onSelect: () => alignNodes(selection, "row") },
              { id: "align.column", label: "Stack into a column", onSelect: () => alignNodes(selection, "column") },
            ],
          },
          { type: "separator" },
          group
            ? { id: "studio.node.ungroup", label: `Ungroup "${group.label}"`, icon: Ungroup, onSelect: () => s.ungroup(group.id) }
            : { id: "studio.node.group", label: `Group these ${selection.length}`, icon: Group, disabled: !multi, shortcut: "mod+g", onSelect: () => s.groupSelection() },
          { id: "studio.node.duplicate", label: "Duplicate", icon: Copy, shortcut: "mod+d", onSelect: () => s.duplicateNodes(selection) },
          { id: "studio.node.lock", label: "Locked", icon: Lock, checked: node.locked, onSelect: () => s.updateNodes(selection, { locked: !node.locked }) },
          {
            id: "studio.node.convert",
            label: "Turn into a new idea",
            icon: Lightbulb,
            hint: "keeps position",
            onSelect: () => s.updateNode(node.id, { featureId: "custom-idea", custom: true, label: node.label }),
          },
          { id: "studio.node.copyName", label: "Copy name", icon: Copy, onSelect: () => void ctx.copy(node.label, "element name") },
          { type: "separator" },
          { id: "studio.node.delete", label: multi ? `Delete ${selection.length} elements` : "Delete", icon: Trash2, danger: true, onSelect: () => s.removeNodes(selection) },
        );
        return entries;
      },
    },

    /* -------------------------------------------------------------- group */
    {
      scope: "studio-group",
      items: (target, ctx) => {
        const group = target.data as StudioGroup | undefined;
        if (!group) return [];
        const s = useStudio.getState();
        const members = s.nodes.filter((n) => n.groupId === group.id);
        return [
          { type: "label", label: `${group.label} · ${members.length} elements` },
          { id: "studio.group.select", label: "Select members", icon: Group, onSelect: () => s.setSelection(members.map((n) => n.id)) },
          { id: "studio.group.prompt", label: group.prompt ? "Edit group prompt" : "Write group prompt", icon: Wand2, onSelect: () => s.setSelection(members.map((n) => n.id)) },
          hueMenu(group.hue, (h) => s.updateGroup(group.id, { hue: h ?? 265 })),
          { id: "studio.group.copy", label: "Copy member names", icon: Copy, onSelect: () => void ctx.copy(members.map((n) => n.label).join(", "), "member names") },
          { type: "separator" },
          { id: "studio.group.ungroup", label: "Ungroup", icon: Ungroup, onSelect: () => s.ungroup(group.id) },
          {
            id: "studio.group.delete",
            label: "Delete group and members",
            icon: Trash2,
            danger: true,
            onSelect: () =>
              void ctx.confirm({ title: `Delete "${group.label}"?`, body: `${members.length} elements go with it.`, danger: true, confirmLabel: "Delete" }).then((ok) => {
                if (ok) {
                  s.removeNodes(members.map((n) => n.id));
                  s.ungroup(group.id);
                }
              }),
          },
        ];
      },
    },

    /* ---------------------------------------------------- drawing / arrow */
    {
      scope: "studio-shape",
      items: (target) => {
        const shape = target.data as StudioShape | undefined;
        if (!shape) return [];
        const s = useStudio.getState();
        const kind = shape.kind === "frame" ? "Region" : shape.kind === "arrow" ? "Connection" : "Sketch";
        return [
          { type: "label", label: shape.label || kind },
          { id: "studio.shape.prompt", label: shape.prompt ? "Edit its prompt" : "Write its prompt", icon: Wand2, onSelect: () => s.setSelection([shape.id]) },
          hueMenu(shape.hue, (h) => s.updateShape(shape.id, { hue: h ?? 265 })),
          ...(shape.kind === "arrow"
            ? [
                {
                  id: "studio.shape.relation",
                  label: "Carries data",
                  icon: Link2,
                  checked: shape.relation === "data",
                  onSelect: () => s.setShapeRelation(shape.id, shape.relation === "data" ? "flow" : "data"),
                } satisfies MenuEntry,
              ]
            : []),
          {
            id: "studio.shape.width",
            label: "Stroke width",
            icon: Pencil,
            children: [1, 2, 3, 5, 8, 12].map((w) => ({
              id: `studio.shape.width.${w}`,
              label: `${w}px`,
              checked: shape.width === w,
              onSelect: () => s.updateShape(shape.id, { width: w }),
            })),
          },
          { type: "separator" },
          { id: "studio.shape.delete", label: `Delete ${kind.toLowerCase()}`, icon: Trash2, danger: true, onSelect: () => s.removeShapes([shape.id]) },
        ];
      },
    },

    /* ------------------------------------------------------------- canvas */
    {
      scope: "studio-canvas",
      items: (target, ctx) => {
        const s = useStudio.getState();
        const at = canvasPoint(target);
        const page = s.pages.find((p) => p.id === s.activePageId);
        const count = s.nodes.filter((n) => n.pageId === s.activePageId).length;
        const bgHeld = heldBackground();
        const nodesHeld = heldNodes();
        return [
          { type: "label", label: `${page?.name ?? "Page"} · ${count} elements` },
          {
            id: "studio.canvas.bg",
            label: "Background",
            icon: Layers,
            children: [
              { id: "bg.select", label: "Select the background", checked: s.selection.includes(BACKGROUND_ID), onSelect: () => s.selectBackground() },
              { id: "bg.cut", label: "Cut the background", icon: Scissors, shortcut: "mod+x", onSelect: () => { if (!s.cutBackground()) ctx.publish({ key: "studio:background", title: "The background is already bare", level: "info", source: "studio", toast: true }); } },
              { id: "bg.paste", label: "Put the background back", icon: ClipboardPaste, shortcut: "mod+v", disabled: !bgHeld, onSelect: () => s.pasteBackground() },
            ],
          },
          ...(nodesHeld ? [{ id: "studio.canvas.paste", label: `Paste ${nodesHeld.nodes.length === 1 ? nodesHeld.nodes[0]!.label : `${nodesHeld.nodes.length} parts`}`, icon: ClipboardPaste, shortcut: "mod+v", onSelect: () => s.pasteNodes() } satisfies MenuEntry] : []),
          addFeatureMenu(at),
          { id: "studio.canvas.idea", label: "Drop a new idea here", icon: Lightbulb, onSelect: () => { s.addNode("custom-idea", at.x - 66, at.y - 38); } },
          { id: "studio.canvas.note", label: "Pin a note here", icon: Wand2, onSelect: () => { s.addNode("note", at.x - 66, at.y - 38); } },
          // The same drawing board a part's wheel opens, with no part under
          // it: draw a shape, and a new part lands here in that shape.
          { id: "studio.canvas.draw", label: "Draw a new part here", icon: Brush, onSelect: () => openBoard(target.x, target.y, at) },
          { type: "separator" },
          {
            id: "studio.canvas.tool",
            label: "Tool",
            icon: MousePointer2,
            children: [
              { id: "tool.select", label: "Select & move", icon: MousePointer2, shortcut: "v", checked: s.tool === "select", onSelect: () => s.setTool("select") },
              { id: "tool.pen", label: "Draw freehand", icon: Pencil, shortcut: "d", checked: s.tool === "pen", onSelect: () => s.setTool("pen") },
              { id: "tool.arrow", label: "Connect elements", icon: Link, shortcut: "a", checked: s.tool === "arrow", onSelect: () => s.setTool("arrow") },
              { id: "tool.erase", label: "Erase", icon: Eraser, shortcut: "e", checked: s.tool === "erase", onSelect: () => s.setTool("erase") },
            ],
          },
          { id: "studio.canvas.selectAll", label: "Select everything", shortcut: "mod+a", onSelect: () => s.selectAll() },
          { id: "studio.canvas.fit", label: "Fit the frame in view", icon: ZoomIn, shortcut: "f", onSelect: () => s.requestFit() },
          { id: "studio.canvas.live", label: "Preview this page live", icon: Eye, shortcut: "p", onSelect: () => ctx.navigate(livePath()) },
          { id: "studio.canvas.wires", label: s.showWires ? "Hide the wires" : "Show the wires", icon: s.showWires ? Link2Off : Link2, shortcut: "w", onSelect: () => s.setShowWires(!s.showWires) },
          {
            id: "studio.canvas.frame",
            label: "Frame width",
            children: [
              { id: "fw.desktop", label: "Desktop · 1440", checked: s.frameWidth === 1440, onSelect: () => s.setFrameWidth(1440) },
              { id: "fw.tablet", label: "Tablet · 834", checked: s.frameWidth === 834, onSelect: () => s.setFrameWidth(834) },
              { id: "fw.phone", label: "Phone · 390", checked: s.frameWidth === 390, onSelect: () => s.setFrameWidth(390) },
            ],
          },
          { type: "separator" },
          { id: "studio.canvas.compile", label: "Compile the blueprint", icon: Send, shortcut: "mod+enter", onSelect: () => (window as unknown as { __studioOpenBrief?: () => void }).__studioOpenBrief?.() },
          { id: "studio.canvas.copyBrief", label: "Copy the blueprint", icon: Copy, onSelect: () => void ctx.copy(specToMarkdown(compile()), "blueprint") },
          { type: "separator" },
          {
            id: "studio.canvas.clear",
            label: "Clear this page",
            icon: Trash2,
            danger: true,
            disabled: count === 0,
            onSelect: () =>
              void ctx.confirm({ title: `Clear "${page?.name}"?`, body: "Elements, drawings and their prompts go.", danger: true, confirmLabel: "Clear" }).then((ok) => ok && s.clearPage(s.activePageId)),
          },
        ];
      },
    },

    /* ------------------------------------------------------------ palette */
    {
      scope: "studio-palette",
      items: (target, ctx) => {
        const feature = target.data as FeatureDef | undefined;
        if (!feature) return [];
        return [
          { type: "label", label: feature.name },
          { id: "studio.palette.add", label: "Add to canvas", icon: Plus, onSelect: () => { addFeatureToCanvas(feature.id); } },
          ...(useStudio.getState().hiddenFeatures.includes(feature.id)
            ? []
            : [{
                id: "studio.palette.delete",
                label: "Delete",
                icon: Trash2,
                danger: true,
                hint: "off the shelf",
                onSelect: () => useStudio.getState().hideFeature(feature.id),
              } satisfies MenuEntry]),
          {
            id: "studio.palette.add3",
            label: "Add three",
            icon: Copy,
            onSelect: () => {
              const p = dropPoint();
              for (let i = 0; i < 3; i++) useStudio.getState().addNode(feature.id, p.x + i * 150, p.y);
            },
          },
          {
            id: "studio.palette.addIdea",
            label: "Add as a new idea",
            icon: Lightbulb,
            hint: "blank prompt",
            onSelect: () => {
              const id = addFeatureToCanvas(feature.id);
              useStudio.getState().updateNode(id, { priority: "idea" });
            },
          },
          {
            id: "studio.palette.addEvery",
            label: `Add every ${feature.category} feature`,
            icon: Sparkles,
            onSelect: () => {
              const p = dropPoint();
              featuresByCategory(feature.category).forEach((f, i) => {
                useStudio.getState().addNode(f.id, p.x + (i % 4) * 150, p.y + Math.floor(i / 4) * 96);
              });
            },
          },
          { type: "separator" },
          ...(useStudio.getState().hiddenFeatures.includes(feature.id)
            ? [{ id: "studio.palette.restore", label: "Put it back in the library", icon: Eye, onSelect: () => useStudio.getState().restoreFeature(feature.id) } satisfies MenuEntry]
            : [
                { id: "studio.palette.hide", label: "Remove from the library", icon: EyeOff, hint: "reversible", onSelect: () => useStudio.getState().hideFeature(feature.id) } satisfies MenuEntry,
                {
                  id: "studio.palette.hideCategory",
                  label: `Remove every ${categoryOf(feature.category).label.toLowerCase()} part`,
                  icon: EyeOff,
                  onSelect: () => {
                    const s = useStudio.getState();
                    featuresByCategory(feature.category).forEach((f) => s.hideFeature(f.id));
                  },
                } satisfies MenuEntry,
              ]),
          ...(useStudio.getState().hiddenFeatures.length
            ? [{ id: "studio.palette.restoreAll", label: `Put back all ${useStudio.getState().hiddenFeatures.length} removed`, icon: RotateCcw, onSelect: () => useStudio.getState().restoreAllFeatures() } satisfies MenuEntry]
            : []),
          { type: "separator" },
          { id: "studio.palette.copyId", label: "Copy feature id", icon: Copy, onSelect: () => void ctx.copy(feature.id, "feature id") },
          { id: "studio.palette.copyBlurb", label: "Copy description", icon: Copy, onSelect: () => void ctx.copy(feature.blurb, "description") },
        ];
      },
    },

    /* --------------------------------------------------------------- page */
    {
      scope: "studio-page",
      items: (target, ctx) => {
        const page = target.data as PageType | undefined;
        if (!page) return [];
        const s = useStudio.getState();
        const count = s.nodes.filter((n) => n.pageId === page.id).length;
        return [
          { type: "label", label: `${page.name} · ${page.path}` },
          { id: "studio.page.open", label: "Open", onSelect: () => s.setActivePage(page.id) },
          { id: "studio.page.live", label: "Preview this page live", icon: Eye, onSelect: () => ctx.navigate(livePath(page.id)) },
          {
            id: "studio.page.scroll",
            label: "Scroll behaviour",
            children: ["inherit", "normal", "snap to sections", "smooth / inertial", "horizontal", "scroll-driven story", "paged"].map((v) => ({
              id: `studio.page.scroll.${v}`,
              label: v === "inherit" ? "Site default" : v,
              checked: page.scroll === v,
              onSelect: () => s.updatePage(page.id, { scroll: v }),
            })),
          },
          {
            id: "studio.page.duplicate",
            label: "Duplicate page",
            icon: Copy,
            onSelect: () => {
              const newId = s.addPage(`${page.name} copy`);
              const source = useStudio.getState().nodes.filter((n) => n.pageId === page.id);
              for (const n of source) {
                // Drop the source id and group so the copy gets its own.
                const { id: _id, groupId: _groupId, ...rest } = n;
                useStudio.getState().addNode(n.featureId, n.x, n.y, { ...rest, pageId: newId, groupId: null });
              }
            },
          },
          { id: "studio.page.up", label: "Move earlier", onSelect: () => s.movePage(page.id, -1) },
          { id: "studio.page.down", label: "Move later", onSelect: () => s.movePage(page.id, 1) },
          { id: "studio.page.copyPath", label: "Copy route", icon: Copy, onSelect: () => void ctx.copy(page.path, "route") },
          { type: "separator" },
          { id: "studio.page.clear", label: "Clear page", icon: Eraser, danger: true, disabled: !count, onSelect: () => s.clearPage(page.id) },
          {
            id: "studio.page.delete",
            label: "Delete page",
            icon: Trash2,
            danger: true,
            disabled: s.pages.length <= 1,
            onSelect: () =>
              void ctx.confirm({ title: `Delete "${page.name}"?`, body: `${count} elements go with it.`, danger: true, confirmLabel: "Delete" }).then((ok) => ok && s.removePage(page.id)),
          },
        ];
      },
    },

    /* -------------------------------------------------------------- brief */
    {
      scope: "studio-brief",
      items: (_target, ctx) => [
        { type: "label", label: "Blueprint" },
        { id: "studio.brief.compile", label: "Compile blueprint", icon: Send, shortcut: "mod+enter", onSelect: () => (window as unknown as { __studioOpenBrief?: () => void }).__studioOpenBrief?.() },
        { id: "studio.brief.copyMd", label: "Copy as markdown", icon: Copy, onSelect: () => void ctx.copy(specToMarkdown(compile()), "blueprint") },
        { id: "studio.brief.copyJson", label: "Copy as JSON", icon: Copy, onSelect: () => void ctx.copy(specToJson(compile()), "blueprint JSON") },
        { type: "separator" },
        {
          id: "studio.brief.reset",
          label: "Clear the whole blueprint",
          icon: RotateCcw,
          danger: true,
          onSelect: () =>
            void ctx.confirm({ title: "Clear everything?", body: "Every page, element, drawing and prompt.", danger: true, confirmLabel: "Clear" }).then((ok) => ok && useStudio.getState().resetAll()),
        },
      ],
    },

    /* ------------------------------------------------------- format group */
    {
      scope: "studio-format-group",
      items: (target) => {
        const group = target.data as { id: string; label: string } | undefined;
        if (!group) return [];
        const s = useStudio.getState();
        const fields = FORMAT_FIELDS.filter((x) => x.group === group.id);
        return [
          { type: "label", label: group.label },
          { id: "studio.format.showAll", label: "Show every option", checked: s.showAllFormat, onSelect: () => s.setShowAllFormat(!s.showAllFormat) },
          {
            id: "studio.format.reset",
            label: `Reset ${group.label}`,
            icon: RotateCcw,
            onSelect: () => {
              for (const field of fields) s.setFormat(field.id, field.default);
            },
          },
        ];
      },
    },
  ],
});

type AlignMode = "left" | "right" | "hcenter" | "top" | "bottom" | "vcenter" | "row" | "column";

function alignNodes(ids: string[], mode: AlignMode) {
  const s = useStudio.getState();
  const nodes = s.nodes.filter((n) => ids.includes(n.id));
  if (nodes.length < 2) return;
  s.commit();
  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const byX = [...nodes].sort((a, b) => a.x - b.x);
  const byY = [...nodes].sort((a, b) => a.y - b.y);

  const next = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => next.set(n.id, { x: n.x, y: n.y }));

  if (mode === "row") {
    let x = minX;
    for (const n of byX) {
      next.set(n.id, { x, y: minY });
      x += n.w + 24;
    }
  } else if (mode === "column") {
    let y = minY;
    for (const n of byY) {
      next.set(n.id, { x: minX, y });
      y += n.h + 24;
    }
  } else {
    for (const n of nodes) {
      const p = next.get(n.id)!;
      if (mode === "left") p.x = minX;
      if (mode === "right") p.x = maxX - n.w;
      if (mode === "hcenter") p.x = cx - n.w / 2;
      if (mode === "top") p.y = minY;
      if (mode === "bottom") p.y = maxY - n.h;
      if (mode === "vcenter") p.y = cy - n.h / 2;
    }
  }

  useStudio.setState({
    nodes: s.nodes.map((n) => {
      const p = next.get(n.id);
      return p ? { ...n, x: Math.round(p.x), y: Math.round(p.y) } : n;
    }),
  });
}
