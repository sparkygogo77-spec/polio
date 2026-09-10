import { Layers } from "lucide-react";
import { defineFeature } from "@/core/types";
import { BuildsPage } from "./BuildsPage";
import { SwitchButton } from "./SwitchButton";

/**
 * Builds is the front door.
 *
 * It took the place of a landing page whose job was to announce a version and
 * a changelog — both retired. What a person arriving actually has is more
 * than one site and one Builder, so the door lists them and swaps between
 * them, and the top bar carries the same swap for when you are already inside.
 */
export const builds = defineFeature({
  id: "builds",
  name: "Builds",
  description: "Every site this browser is holding, where each one publishes, and the swap between them.",
  icon: Layers,
  hidden: true,
  routes: [{ path: "/", component: BuildsPage, title: "Builds" }],
  nav: [{ label: "Builds", href: "/", icon: Layers, order: 0 }],
  topBarItems: [{ id: "builds.switch", order: 5, component: SwitchButton }],
  commands: [
    {
      id: "builds.open",
      label: "Builds",
      group: "Builds",
      icon: Layers,
      keywords: ["sites", "projects", "switch", "swap", "repo", "repository", "build"],
      run: (ctx) => ctx.navigate("/"),
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
