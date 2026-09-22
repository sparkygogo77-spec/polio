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
import { useStudio } from "./store";
import { VOID } from "@/core/ui/void";

/** Open the GitHub control and put the hand on one of its fields. */
function openPanel(field: "bring" | "new") {
  const button = document.querySelector<HTMLButtonElement>("[data-github-button]");
  if (!button) return;
  button.click();
  window.setTimeout(() => document.querySelector<HTMLInputElement>(field === "bring" ? "[data-repo-bring]" : "[data-repo-new]")?.focus(), 250);
}

export function NewSiteOffer() {
  const project = useBuilds((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
  const parts = useStudio((s) => s.nodes.length);
  if (!project || project.repo || project.offered || parts > 0) return null;
  return (
    <div data-new-site-offer="" role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5 text-plain" style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}>
      <span className="min-w-0 flex-1">This site has no repository yet. Bring one in and this site becomes it, or make a new repository for it.</span>
      <button type="button" data-offer-bring="" onClick={() => openPanel("bring")} className="tactile inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium" style={{ borderColor: VOID.rim }}>
        <GitBranch className="size-3" /> Bring a repo in
      </button>
      <button type="button" data-offer-make="" onClick={() => openPanel("new")} className="tactile inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium" style={{ borderColor: VOID.rim }}>
        <Plus className="size-3" /> Make a new repo
      </button>
      <button type="button" data-offer-later="" aria-label="Not now" onClick={() => useBuilds.getState().setOffered(project.id)} className="tactile rounded px-1" style={{ color: VOID.muted }}>
        <X className="size-3" />
      </button>
    </div>
  );
}
