import { DEFAULT_REMAKE_MODEL, REMAKE_MODEL_SETTING, REMAKE_MODELS } from "./remake";
import { Brush, CircleDashed, ClipboardPaste, Copy, Download, Eraser, Eye, EyeOff, Frame, GitBranch, Group, Layers, LayoutTemplate, Lightbulb, Link, Link2, Link2Off, Lock, MousePointer2, Palette as PaletteIcon, Pencil, Plus, Redo2, Rocket, RotateCcw, Send, Sparkles, Trash2, Undo2, Ungroup, Unlock, Upload, Wand2, ZoomIn } from "lucide-react";
import { openLearned } from "./LearnedPanel";
import { defineFeature, type ActionContext, type ContextTarget, type MenuEntry } from "@/core/types";
import { StudioPage } from "./StudioPage";
import { GithubButton } from "./GithubButton";
import { LiveSiteLink } from "./LiveSiteLink";
import { GoLiveButton } from "./GoLiveButton";
import { openRepoPicker, RepoMenuHost } from "./RepoPicker";
import { siteFormatSettings } from "./siteSettings";
import { QueueStrip } from "./QueueStrip";
import { SaveLine } from "./SaveLine";
import { PublishCheckDialog } from "./PublishCheck";
import { LaunchKitKey } from "./LaunchKit";
import { PreviewPage } from "./live/PreviewPage";
import { PublishedPage } from "./live/PublishedPage";
import { isLinkable } from "./parts";
import { CATEGORIES, categoryOf, featuresByCategory, getFeature, type FeatureDef } from "./catalog";
import { FORMAT_FIELDS } from "./format";
import { compileSpec, specToJson, specToMarkdown } from "./spec";
import { BACKGROUND_ID, heldBackground, heldNodes, HUES, livePath, useStudio, type StudioGroup, type StudioNode, type StudioPage as PageType, type StudioShape } from "./board/store";
import { createSpaceAt } from "./createSpace";
import { addFeatureToCanvas, dropPoint } from "./Palette";
import { openBoard } from "./RadialMenu";
import { emptyWrappers, saysWhat, slimSays } from "./reassemble";
import { ridersOf } from "./owner";
import { resolvePalette } from "./parts/theme";
import { play } from "@/core/audio/engine";

/** The Builder answers on /builder and keeps the old /studio addresses working. */
const onSiteRoutes = ["/builder", "/builder/*", "/studio", "/studio/*"];
const onStudio = () => typeof window !== "undefined" && /^\/(builder|studio)/.test(window.location.pathname);
const onPreview = () => typeof window !== "undefined" && /^\/builder\/preview/.test(window.location.pathname);
const onBoard = () => onStudio() && !onPreview();
const onDesign = onBoard;

/** Right-click position in canvas space, so "add here" really means here. */
function canvasPoint(target: ContextTarget) {
  /* Read off the drawn page, so the scroll, the zoom and the room above the
     page are all in it: "here" is the point that was right-clicked. */
  const win = typeof document === "undefined" ? null : document.querySelector<HTMLElement>("[data-page-window]");
  if (win) {
    const r = win.getBoundingClientRect();
    const k = r.width / Math.max(1, useStudio.getState().frameWidth);
    if (k > 0) return { x: (target.x - r.left) / k, y: (target.y - r.top) / k };
  }
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
  settingGroups: [
    {
      /*
       * THE SITE'S OWN OPTIONS, in the same panel as everything else.
       *
       * His ruling: corner radius and the fonts are settings for the site
       * being built, not for the Builder around it. They existed on the site
       * side already — `layout.radius`, `type.headingFamily`,
       * `type.bodyFamily` in the Format panel — and he could not find them
       * there, which is a findability answer, not a "they are missing" one.
       * So they are offered here as well, reading and writing the *same*
       * three values in the document. Not copies: `read`, `write` and
       * `subscribe` point at the studio store, so changing one in Settings
       * moves the Format panel and the live preview with it, and changing it
       * in Format moves this row.
       *
       * It sits above the Builder's own group because the site is the thing
       * being made and the Builder is the tool.
       */
      id: "site", label: "This site", icon: PaletteIcon, hue: 170, order: 235,
      description: "The site being built, not the Builder around it. The same values the Format panel holds.",
    },
    { id: "studio", label: "Builder", icon: LayoutTemplate, hue: 110, order: 240, description: "The drawing board, and what goes to Claude with a prompt." },
  ],
  settings: [
    ...siteFormatSettings,
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
    {
      id: "studio.groupScaleContents", group: "studio", label: "Scale contents with group", type: "toggle", default: true, order: 5,
      description: "When a locked group is resized, its icons and words grow and shrink with it. Off, the arrangement still scales and each part keeps its own size. Also on the tool bar while the select tool is in hand.",
    },
    {
      /* The model "Remake this picture…" asks (RemakePicture.tsx). The owner's default is GPT Image 2; when the key cannot use it the newest it can is used and the card says so. */
      id: REMAKE_MODEL_SETTING, group: "studio", label: "Model for remaking pictures", type: "select", default: DEFAULT_REMAKE_MODEL, order: 6,
      description: "Which OpenAI image model redraws a picture from your prompt, with the picture as its reference. Uses your own OpenAI key from the key button.",
      options: REMAKE_MODELS.map((m) => ({ value: m.id, label: m.label })),
    },
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
  /*
   * The open site's own controls (its save line, repository, Refresh,
   * Publish, Update live site and the links beside it) show on the Builder's
   * pages only. On Builds no site is being worked on, and the bar there said
   * whatever the last one had said. Work in flight and the hosts that draw
   * nothing stay everywhere.
   */
  topBarItems: [
    /* Work in flight goes on the near side of the bell, where the eye already
       looks to find out what is happening; the repository link is a control
       and stays over with the rest of them. */
    /* Whether the board is kept, and its backups: a glance, before the work in flight (`SaveLine.tsx`). */
    { id: "studio.saved", order: 5, slot: "status", component: SaveLine, routes: onSiteRoutes },
    { id: "studio.queue", order: 10, slot: "status", component: QueueStrip },
    { id: "studio.github", order: 20, component: GithubButton, routes: onSiteRoutes },
    /* The site's website, from its repository on GitHub, in a new tab (`LiveSiteLink.tsx`). */
    { id: "studio.liveSite", order: 20.5, component: LiveSiteLink, routes: onSiteRoutes },
    /* Beside it, labelled: the owner could not find Go live at the foot of the book. */
    { id: "studio.golive", order: 21, component: GoLiveButton, routes: onSiteRoutes },
    /* The list Update live site shows first when the board has something wrong (`PublishCheck.tsx`). Draws nothing in the bar itself. */
    { id: "studio.publishCheck", order: 98, component: PublishCheckDialog },
    /* The launch kit: share card, X banner, icons and memes from the site's own style (`LaunchKit.tsx`). */
    { id: "studio.launchKit", order: 22, component: LaunchKitKey, routes: onSiteRoutes },
    /* The one repo menu, mounted once so every way in opens the same one. It draws nothing in the bar itself. */
    { id: "studio.repoMenu", order: 99, component: RepoMenuHost },
  ],

  commands: [
    { id: "studio.open", label: "Open the Builder", group: "Builder", icon: LayoutTemplate, keywords: ["board", "parts", "design"], run: (c) => c.navigate("/builder") },
    {
      id: "studio.launchKit", label: "Launch kit: share card, X banner, site icon, memes", group: "Builder", icon: Rocket,
      keywords: ["launch", "share", "card", "og", "banner", "icon", "favicon", "meme", "social"], when: onStudio,
      run: () => { void import("./LaunchKit").then((m) => m.openLaunchKit()); },
    },
    /* The site as a builder-ready repository a code chat builds on (`exportForCode.ts`, kit/PIPELINE.md route 1). */
    {
      id: "studio.exportForCode",
      label: "Export for code: a builder-ready repo (zip)",
      group: "Builder",
      icon: Download,
      keywords: ["export", "code", "kit", "hooks", "builder.json", "repo", "zip", "download", "claude"],
      when: onStudio,
      run: async (c) => {
        const { downloadForCode } = await import("./exportForCode");
        const r = await downloadForCode();
        c.publish({ key: "studio:export-for-code", title: r.ok ? "Exported for code" : "Exported, with problems", body: r.says, level: r.ok ? "success" : "warn", source: "studio", toast: true });
      },
    },
    /* The same export, written to a new design/ branch of the repository the site came from, with a draft pull request listing the hooks moved, added and removed (`designBranch.ts`). */
    {
      id: "studio.exportForCodeToBranch",
      label: "Export for code to a branch of its repo",
      group: "Builder",
      icon: GitBranch,
      keywords: ["export", "code", "kit", "hooks", "branch", "design", "pull request", "repo", "github"],
      when: onStudio,
      run: async (c) => {
        const { exportForCodeToBranch } = await import("./exportForCode");
        /* One card that says each step as it goes, then the outcome in the same place: a big site takes a while, and never fails without a word. */
        const card = { key: "studio:export-for-code", source: "studio", toast: true, coalesceMs: 30 * 60 * 1000 } as const;
        c.publish({ ...card, title: "Exporting for code", body: "Starting…", level: "info" });
        const r = await exportForCodeToBranch({ onProgress: (says) => c.publish({ ...card, title: "Exporting for code", body: says, level: "info" }) }).catch((e: unknown) => ({ ok: false, says: `The export stopped: ${e instanceof Error ? e.message : String(e)}` }));
        c.publish({ ...card, title: r.ok ? "Design sent to a branch" : "Not sent", body: r.says, level: r.ok ? "success" : "warn" });
      },
    },
    /* The board as one file, and back again (`backup.ts`): also on the save line and on each card on Builds. */
    {
      id: "studio.backup.download",
      label: "Download a backup of this site",
      group: "Builder",
      icon: Download,
      keywords: ["backup", "save", "export", "file", "keep", "copy"],
      run: async (c) => {
        const { downloadBackup } = await import("./backup");
        const { useBuilds } = await import("@/features/builds/store");
        const id = useBuilds.getState().activeId;
        const r = id ? await downloadBackup(id) : { ok: false, says: "No site is open, so there is nothing to back up." };
        c.publish({ key: "studio:backup", title: r.ok ? "Backup downloaded" : "No backup made", body: r.says, level: r.ok ? "success" : "warn", source: "studio", toast: true });
      },
    },
    {
      id: "studio.backup.load",
      label: "Load a backup as a new site",
      group: "Builder",
      icon: Upload,
      keywords: ["backup", "restore", "import", "file", "open", "load"],
      run: async (c) => {
        const { pickAndLoadBackup } = await import("./backup");
        const r = await pickAndLoadBackup();
        if (r) c.publish({ key: "studio:backup-load", title: r.ok ? "Backup loaded" : "Not loaded", body: r.says, level: r.ok ? "success" : "warn", source: "studio", toast: true });
      },
    },
    /* He searched the palette for "import" and for "site" and found nothing
       but "put every removed part back". Both words are keywords here. */
    {
      id: "studio.joinSentences",
      label: "Builder: put broken sentences back together",
      group: "Builder",
      icon: Wand2,
      keywords: ["runs", "spans", "sentence", "fragment", "merge", "text", "rejoin"],
      when: onStudio,
      run: (c) => {
        const done = useStudio.getState().joinSentences();
        c.publish({ key: "studio:join", title: done.length ? "Sentences put back together" : "Nothing was in pieces", body: saysWhat(done), level: "info", source: "studio", toast: { durationMs: 8000 } });
      },
    },
    {
      id: "studio.fitWrappers",
      label: "Builder: fit captured boxes to what they hold",
      group: "Builder",
      icon: Frame,
      keywords: ["empty", "wrapper", "box", "gap", "space", "banner", "collapse"],
      when: onStudio,
      run: (c) => {
        const done = useStudio.getState().fitWrappers();
        /* And the ones holding nothing, which are named and left alone: on his
           page both are real surfaces that slid below their own contents. */
        const empty = emptyWrappers(useStudio.getState().nodes as never);
        c.publish({ key: "studio:fit", title: done.length ? "Boxes fitted" : "Nothing to fit", body: slimSays(done, empty), level: "info", source: "studio", toast: { durationMs: 8000 } });
      },
    },
    {
      id: "studio.bringRepo",
      label: "Builder: bring a repository in, or choose where it publishes",
      group: "Builder",
      icon: Link,
      keywords: ["import", "repo", "repository", "github", "site", "bring", "attach", "connect"],
      run: () => openRepoPicker(),
    },
    { id: "studio.library", label: "Builder: show or hide the side panel", group: "Builder", icon: Layers, when: onStudio, run: () => (window as unknown as { __studioToggleLibrary?: () => void }).__studioToggleLibrary?.() },
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
    /*
     * DRAW A SPACE, FINDABLE. The space — the box a closed line becomes, with
     * its own panel on the right — had no command at all: the owner met it
     * only through the repository import, and once the import stopped making
     * one there was no way to it but the S key and a menu inside the tool
     * picker. `tests/space-command.mjs`.
     */
    { id: "studio.drawSpace", label: "Builder: Draw a space", group: "Builder", icon: CircleDashed, keywords: ["space", "surface", "black hole", "box", "area", "from a site", "generate", "create"], run: (c) => { if (!onStudio()) c.navigate("/builder"); useStudio.getState().setTool("space"); } },
    { id: "studio.newIdea", label: "Builder: drop a new idea", group: "Builder", icon: Lightbulb, when: onStudio, run: () => { addFeatureToCanvas("custom-idea"); } },
    { id: "studio.learned", label: "Builder: learned from your sites", group: "Builder", icon: Lightbulb, when: onStudio, run: () => { openLearned(); } },
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
    { keys: "l", label: "Show / hide the side panel", group: "Builder", when: onBoard, run: () => (window as unknown as { __studioToggleLibrary?: () => void }).__studioToggleLibrary?.() },
    { keys: "v", label: "Select tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("select") },
    { keys: "d", label: "Draw tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("pen") },
    { keys: "a", label: "Arrow tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("arrow") },
    { keys: "e", label: "Erase tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("erase") },
    { keys: "s", label: "Space tool", group: "Builder", when: onDesign, run: () => useStudio.getState().setTool("space") },
    { keys: "f", label: "Fit in view, or centre the timeline", group: "Builder", when: onDesign, run: () => useStudio.getState().requestFit() },
    { keys: "mod+z", label: "Undo", group: "Builder", when: onDesign, run: () => useStudio.getState().undo() },
    { keys: "mod+shift+z", label: "Redo", group: "Builder", when: onDesign, run: () => useStudio.getState().redo() },
    { keys: "mod+g", label: "Group selection", group: "Builder", when: onDesign, run: () => useStudio.getState().groupSelection() },
    { keys: "mod+d", label: "Duplicate selection", group: "Builder", when: onDesign, run: () => useStudio.getState().duplicateNodes(useStudio.getState().selection) },
    { keys: "mod+a", label: "Select everything", group: "Builder", when: onDesign, run: () => useStudio.getState().selectAll() },
    // Cut takes the parts that are selected, or the background when that is
    // what is picked; paste puts back whatever was cut last.
    /* Copy holds the picked parts and leaves them where they are; a button
       is copied with the words and icon it holds (`owner.ts`). Only while
       parts are picked, so a copy of words anywhere else is left alone. */
    {
      keys: "mod+c", label: "Copy", group: "Builder",
      when: () => onDesign() && useStudio.getState().selection.some((id) => useStudio.getState().nodes.some((n) => n.id === id)),
      run: () => { const s = useStudio.getState(); s.copyNodes([...s.selection, ...ridersOf(s.nodes, s.selection, resolvePalette(s.format, s.look))]); play("tap"); },
    },
    { keys: "mod+x", label: "Cut", group: "Builder", when: onDesign, run: () => { useStudio.getState().cut(); } },
    { keys: "mod+v", label: "Paste what was copied or cut", group: "Builder", when: onDesign, run: () => { useStudio.getState().paste(); } },
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
          {
            id: "studio.live.board",
            label: "Back to the board",
            icon: LayoutTemplate,
            shortcut: "b",
            // On the board itself this is a mode, not an address: navigating
            // to /builder from /builder went nowhere and left Preview on.
            onSelect: () => { if (onPreview()) ctx.navigate("/builder"); else useStudio.getState().setMode("design"); },
          },
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
          {
            id: "studio.group.lock",
            label: group.locked ? "Let go: members size on their own" : "Hold together: size as one",
            icon: group.locked ? Unlock : Lock,
            onSelect: () => s.updateGroup(group.id, { locked: !group.locked }),
          },
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
              /* Cut has gone. It and the wheel's Strip were the same thing
                 twice — literally: both called `cutBackground()`, which takes
                 the background bare and holds it for a paste. Two names for
                 one function is two places to learn and one of them to be
                 surprised by. Strip keeps the job, on the wheel, where the
                 background's own controls are; ⌘X still reaches it through
                 the board's own key handling, and Put it back is still here
                 because the clipboard Strip fills is the one it reads. */
              { id: "bg.paste", label: "Put the background back", icon: ClipboardPaste, shortcut: "mod+v", disabled: !bgHeld, onSelect: () => s.pasteBackground() },
            ],
          },
          ...(nodesHeld ? [{ id: "studio.canvas.paste", label: `Paste ${nodesHeld.nodes.length === 1 ? nodesHeld.nodes[0]!.label : `${nodesHeld.nodes.length} parts`}`, icon: ClipboardPaste, shortcut: "mod+v", onSelect: () => s.pasteNodes() } satisfies MenuEntry] : []),
          addFeatureMenu(at),
          { id: "studio.canvas.idea", label: "Drop a new idea here", icon: Lightbulb, onSelect: () => { addFeatureToCanvas("custom-idea", { at }); } },
          { id: "studio.canvas.note", label: "Pin a note here", icon: Wand2, onSelect: () => { s.addNode("note", at.x - 66, at.y - 38); } },
          // A space is the third thing a press on the page can put down: not
          // a part yet, an area set aside to become one. The same point the
          // two above are given, because it means the same thing here.
          { id: "studio.canvas.space", label: "Create a space here", icon: CircleDashed, onSelect: () => { createSpaceAt(at.x, at.y); } },
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
              { id: "tool.space", label: "Draw a space", icon: CircleDashed, shortcut: "s", checked: s.tool === "space", onSelect: () => s.setTool("space") },
            ],
          },
          { id: "studio.canvas.selectAll", label: "Select everything", shortcut: "mod+a", onSelect: () => s.selectAll() },
          { id: "studio.canvas.fit", label: "Fit in view", icon: ZoomIn, shortcut: "f", onSelect: () => s.requestFit() },
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
