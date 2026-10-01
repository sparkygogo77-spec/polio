"use client";
/**
 * THE LIST BEFORE UPDATE LIVE SITE.
 *
 * Pressing Update live site (or Go live) reads the board first
 * (`publishCheck.ts`). Nothing wrong, it publishes as it always did. Something
 * wrong, this opens: one short list, grouped by kind, each line naming the
 * part and saying what is wrong, with Fix (where there is one) and Show,
 * which puts the part on the board and picks it. Publish anyway is always
 * there, beside Back to the board: the list informs, it never holds a site
 * back. A fixed line goes from the list at once. `tests/publish-check.mjs`.
 */
import * as React from "react";
import { create } from "zustand";
import { AlertTriangle, Check, Eye, Globe, Wrench } from "lucide-react";
import { Dialog } from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { play } from "@/core/audio/engine";
import { getFeature } from "./catalog";
import { resolvePalette } from "./parts/theme";
import { placeNodes } from "./live/layout";
import { held, put } from "./pictures";
import { readableFixes } from "./siteColours";
import { checkBoard, KIND_ORDER, type Problem } from "./publishCheck";
import { useStudio } from "./store";
import { goToPart } from "./PartTreePanel";

/** The board read now, as the check wants it. */
export async function readBoard(): Promise<Problem[]> {
  const s = useStudio.getState();
  let have: Set<string> | null = null;
  try { have = await held(); } catch { have = null; }
  const palette = resolvePalette(s.format, s.look);
  return checkBoard({
    nodes: s.nodes as never,
    pages: s.pages,
    format: s.format as Record<string, unknown>,
    palette,
    held: have,
    featureName: (id) => getFeature(id)?.name,
    layout: (pageId, device) => {
      const laid = placeNodes(s.nodes.filter((n) => n.pageId === pageId), device, s.frameWidth);
      return { width: laid.width, placed: laid.placed.map((p) => ({ id: p.node.id, x: p.x, w: p.w })) };
    },
  });
}

const useCheck = create<{ open: boolean; problems: Problem[]; go: (() => void) | null }>(() => ({ open: false, problems: [], go: null }));

/**
 * Read the board, and publish when it is clean; otherwise show the list,
 * and publish only when the person presses Publish anyway.
 */
export async function checkThenPublish(go: () => void): Promise<void> {
  const problems = await readBoard();
  if (!problems.length) { go(); return; }
  useCheck.setState({ open: true, problems, go });
}

/** Show a part on the board: its page, picked, in view, its panel open. */
function show(p: Problem) {
  const s = useStudio.getState();
  if (s.activePageId !== p.pageId) s.setActivePage(p.pageId);
  useCheck.setState({ open: false });
  requestAnimationFrame(() => goToPart(p.id));
}

async function choosePicture(): Promise<Blob | null> {
  return new Promise((done) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.onchange = () => { const f = input.files?.[0] ?? null; input.remove(); done(f); };
    input.addEventListener("cancel", () => { input.remove(); done(null); });
    document.body.appendChild(input);
    input.click();
  });
}

/** Do what a line's Fix says. True when the board changed. */
async function fix(p: Problem, choice: "fix" | "keep" = "fix"): Promise<boolean> {
  const s = useStudio.getState();
  const n = s.nodes.find((x) => x.id === p.id);
  if (!n) return false;
  switch (p.kind) {
    case "link":
      s.updateNode(n.id, { link: null, nowhere: true } as never);
      return true;
    case "share":
      if (choice === "keep") s.updateNode(n.id, { shareChecked: n.link?.target } as never);
      else s.updateNode(n.id, { link: null, nowhere: true } as never);
      return true;
    case "nowhere":
      s.updateNode(n.id, { nowhere: true } as never);
      return true;
    case "words": {
      const fixes = readableFixes(s.nodes.filter((x) => x.pageId === p.pageId) as never, resolvePalette(s.format, s.look)).filter((f) => f.id === p.id);
      if (!fixes.length) return false;
      s.patchNodes([p.id], (x) => ({ colour: { ...(x.colour ?? {}), text: fixes[0]!.to } }));
      return true;
    }
    case "picture": {
      const blob = await choosePicture();
      if (!blob) return false;
      const pic = await put(blob, { alt: n.picture?.alt ?? "", from: "upload" });
      s.updateNode(n.id, { picture: pic } as never);
      return true;
    }
    default:
      return false;
  }
}

export function PublishCheckDialog() {
  const { open, problems, go } = useCheck();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const close = () => useCheck.setState({ open: false, go: null });
  const again = async (): Promise<Problem[]> => { const next = await readBoard(); useCheck.setState({ problems: next }); return next; };
  const press = async (p: Problem, choice: "fix" | "keep" = "fix") => {
    setBusy(p.key);
    try {
      const changed = await fix(p, choice);
      play(changed ? "confirm" : "deny");
      if (!changed && p.kind === "words") setNote("None of the site's own colours reads better there: Show it and choose one.");
      const next = await again();
      /* Better, but still hard to read: the site's own colours go no further. Said, so the line staying is not a mystery. */
      if (changed && p.kind === "words" && next.some((x) => x.key === p.key)) setNote("Made as readable as the site's own colours allow, and still hard to read: Show it and choose a lighter or darker colour.");
    } finally { setBusy(null); }
  };
  const groups = KIND_ORDER.map((k) => ({ ...k, rows: problems.filter((p) => p.kind === k.kind) })).filter((g) => g.rows.length);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) close(); }}
      size="lg"
      title={problems.length ? `Before it goes live: ${problems.length} thing${problems.length === 1 ? "" : "s"} to look at` : "Nothing left to look at"}
      description="Fix a line, or Show it on the board. You can publish anyway: nothing here stops the site going live."
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="ghost" size="sm" onClick={close}>Back to the board</Button>
          <span className="flex-1" />
          <Button variant={problems.length ? "outline" : "primary"} size="sm" data-publish-anyway="" onClick={() => { const g = go; close(); g?.(); }}>
            <Globe /> {problems.length ? "Publish anyway" : "Publish"}
          </Button>
        </div>
      }
    >
      <div data-publish-check="" className="max-h-[60vh] space-y-3 overflow-y-auto">
        {!problems.length ? <p className="flex items-center gap-1.5 text-plain text-up"><Check className="size-3.5" /> Everything on the list is fixed.</p> : null}
        {groups.map((g) => (
          <section key={g.kind} data-check-group={g.kind}>
            <h3 className="mb-1 flex items-center gap-1.5 text-small font-medium text-fg"><AlertTriangle className="size-3 text-warn" /> {g.heading} <span className="num text-fg-faint">{g.rows.length}</span></h3>
            <ul className="space-y-1">
              {g.rows.map((p) => (
                <li key={p.key} data-check-line={p.kind} data-check-part={p.id} className="flex items-start gap-2 rounded-md border border-border bg-elevated/40 px-2 py-1.5">
                  <span className="min-w-0 flex-1 text-plain text-fg-muted">{p.says}</span>
                  {p.keep ? <Button size="xs" variant="ghost" data-check-keep="" disabled={busy === p.key} onClick={() => void press(p, "keep")}>{p.keep}</Button> : null}
                  {p.fix ? <Button size="xs" variant="subtle" data-check-fix="" loading={busy === p.key} onClick={() => void press(p)}><Wrench /> {p.fix}</Button> : null}
                  <Button size="xs" variant="ghost" data-check-show="" onClick={() => show(p)}><Eye /> Show</Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {note ? <p className="text-small text-fg-faint">{note}</p> : null}
      </div>
    </Dialog>
  );
}
