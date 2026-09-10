import { Layers } from "lucide-react";
import { defineFeature } from "@/core/types";
import { BuildsPage } from "./BuildsPage";
import { SwitchButton } from "./SwitchButton";

/**
 * Builds is the front door — and, once a site is published, the only door
 * that stays a door.
 *
 * It took the place of a landing page whose job was to announce a version and
 * a changelog — both retired. What a person arriving actually has is more
 * than one site and one Builder, so the door lists them and swaps between
 * them, and the top bar carries the same swap for when you are already inside.
 *
 * It answers at two paths for that reason. `/` is where an unpublished
 * project meets it — the same "/" `next.config.ts` redirects to `/site` the
 * moment a document is pushed there, because a real visitor to a published
 * site should land on the site, not the tool that built it. Once that
 * redirect is live, "/" no longer reaches this page at all — a request for it
 * never gets past the redirect to ask the registry anything — so `/builds` is
 * the same page at a path the redirect does not touch, and everything that
 * has to survive publishing (the switcher's "All builds", the `builds.open`
 * command) points there rather than at "/".
 */
export const builds = defineFeature({
  id: "builds",
  name: "Builds",
  description: "Every site this browser is holding, where each one publishes, and the swap between them.",
  icon: Layers,
  hidden: true,
  routes: [
    { path: "/", component: BuildsPage, title: "Builds" },
    { path: "/builds", component: BuildsPage, title: "Builds" },
  ],
  nav: [{ label: "Builds", href: "/builds", icon: Layers, order: 0 }],
  topBarItems: [{ id: "builds.switch", order: 5, component: SwitchButton }],
  commands: [
    {
      id: "builds.open",
      label: "Builds",
      group: "Builds",
      icon: Layers,
      keywords: ["sites", "projects", "switch", "swap", "repo", "repository", "build"],
      run: (ctx) => ctx.navigate("/builds"),
    },
    {
      id: "builds.new",
      label: "New site",
      group: "Builds",
      icon: Layers,
      keywords: ["new", "site", "project", "start", "blank"],
      run: async (ctx) => {
        const { useBuilds } = await import("./store");
        useBuilds.getState().create();
        ctx.publish({ key: "builds:new", title: "New site", body: "The Builder is on it.", level: "success", source: "builds", toast: true });
        ctx.navigate("/builder");
      },
    },
  ],
  onMount: () => {
    // The list persists itself and is skipHydration like the document, so
    // something has to start it — and the first run has to adopt whatever the
    // Builder is already holding before anything can list it.
    void import("./store").then((m) => {
      void m.useBuilds.persist.rehydrate()?.then?.(() => m.useBuilds.getState().adopt());
    });
  },
});
