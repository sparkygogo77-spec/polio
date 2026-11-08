import { Gauge } from "lucide-react";
import dynamic from "next/dynamic";
import { defineFeature, type RouteProps } from "@/core/types";
import { AuditDoor } from "./AuditDoor";

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
 * It is about Polio, not about the site on the board, so it is a page of its
 * own at /builder/audit rather than a panel on the board, reached from the
 * book under the timeline (where the other whole-site things are) and from
 * the command palette. No nav tab: like Builds, it is a door you take on
 * purpose.
 */
export const audit = defineFeature({
  id: "audit",
  name: "Audit and optimize",
  description: "Polio's features on one dated line, what each costs a deployment, and the cuts and shortcuts on offer.",
  icon: Gauge,
  hidden: true,
  routes: [{ path: "/builder/audit", component: AuditPage, title: "Audit and optimize" }],
  nav: [],
  topBarItems: [{ id: "audit.door", order: 6, component: AuditDoor }],
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
