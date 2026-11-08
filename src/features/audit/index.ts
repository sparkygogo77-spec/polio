import { Gauge } from "lucide-react";
import dynamic from "next/dynamic";
import { defineFeature, type RouteProps } from "@/core/types";

/* The page loads with its route, as every Builder page does (`tests/route-split.mjs`). */
const AuditPage = dynamic<RouteProps>(() => import("./AuditPage").then((m) => m.AuditPage));

/**
 * Audit and optimize: Polio's own features on one dated line, with what
 * each one costs a deployment and what could be cut.
 *
 * J (8 Nov 2026), after one line in a kit tool made every build pack the
 * whole project into one function and hold a lane on size: "a one button
 * check somewhere in the feature timeline of the website as an audit and
 * optimize that gives me the option to know what I'm changing or
 * optimizing/shortcutting on the feature or iteration". The runner
 * (`scripts/audit-runner.mjs`) does the checking; this is its screen.
 *
 * It lives as the fourth tab of the section the green Finish key opens
 * (the timeline with its red, green and blue boxes; `TimelineDetail.tsx`),
 * where J watches work land. /builder/audit is the same view filling the
 * screen, for going deep into one feature's findings, with a way back to
 * the timeline; it is not a door of its own. The palette command opens it.
 */
export const audit = defineFeature({
  id: "audit",
  name: "Audit and optimize",
  description: "Polio's features on one dated line, what each costs a deployment, and the cuts and shortcuts on offer.",
  icon: Gauge,
  hidden: true,
  routes: [{ path: "/builder/audit", component: AuditPage, title: "Audit and optimize" }],
  nav: [],
  commands: [
    {
      id: "audit.open",
      label: "Audit and optimize",
      group: "Builds",
      icon: Gauge,
      keywords: ["audit", "optimize", "optimise", "size", "deployment", "features", "timeline", "cut", "shortcut"],
      run: (ctx) => ctx.navigate("/builder/audit"),
    },
  ],
});
