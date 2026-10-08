"use client";
/**
 * A NEW SITE IS OFFERED AN IMPORT STRAIGHT AWAY.
 *
 * HIS DESIGN: when he makes a new site he is offered an import at once;
 * once he takes it, the site is locked to that repository; or he declines
 * and makes a new repository for it. This is that offer, across the top
 * of the board of a site with no repository and nothing on it, with the
 * two doors and a way to say not now. Answered once, it does not come
 * back for that site.
 */
import * as React from "react";
import { GitBranch, Plus, X } from "lucide-react";
import { useBuilds } from "@/features/builds/store";
import { useHeldStudio } from "./board/store";
import { isStarter } from "./starterPage";
import { VOID } from "@/core/ui/void";
import { openRepoPicker } from "./RepoPicker";

/** Open the one repo menu and put the hand in the section asked for. */
function openPanel(field: "bring" | "new") {
  openRepoPicker();
  window.setTimeout(() => document.querySelector<HTMLInputElement>(field === "bring" ? '[data-repo-section="bring"] input[aria-label="Find a repository"]' : "[data-repo-new]")?.focus(), 250);
}

export function NewSiteOffer() {
  const project = useBuilds((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
  /* The sample page a new site opens on is not work of his: the offer still stands over it. */
  const parts = useHeldStudio((s) => s.nodes.filter((n) => !isStarter(n.id)).length);
  if (!project || project.repo || project.offered || parts > 0) return null;
  return (
    <div data-new-site-offer="" role="status" className="relative z-[1] flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5 text-plain" style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}>
      <span className="min-w-0 flex-1">This site is not on GitHub yet. Bring a site in from GitHub to build from, or make a new place on GitHub for it to publish to.</span>
      <button type="button" data-offer-bring="" onClick={() => openPanel("bring")} className="tactile inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium" style={{ borderColor: VOID.rim }}>
        <GitBranch className="size-3" /> Bring one in
      </button>
      <button type="button" data-offer-make="" onClick={() => openPanel("new")} className="tactile inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium" style={{ borderColor: VOID.rim }}>
        <Plus className="size-3" /> Make a new one
      </button>
      <button type="button" data-offer-later="" aria-label="Not now" onClick={() => useBuilds.getState().setOffered(project.id)} className="tactile rounded px-1" style={{ color: VOID.muted }}>
        <X className="size-3" />
      </button>
    </div>
  );
}
