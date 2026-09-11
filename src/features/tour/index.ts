import { Compass } from "lucide-react";
import { defineFeature } from "@/core/types";

/**
 * The tour.
 *
 * Not a page and not a panel: a layer over whatever is open, which the shell
 * renders once (`AppShell`) the way it renders the vault and the console. The
 * module exists to give it a command and a shortcut; the Builds page offers
 * it directly, because arriving is exactly when it is worth taking.
 */
export const tour = defineFeature({
  id: "tour",
  name: "Tour",
  description: "The wheel, Looks, the drawing board, the Blueprint and Builds, lit one at a time, on the real thing.",
  icon: Compass,
  hidden: true,
  commands: [
    {
      id: "tour.start",
      label: "Take the tour",
      group: "Help",
      icon: Compass,
      keywords: ["tour", "guide", "walkthrough", "help", "learn", "what", "how", "intro", "show me"],
      shortcut: "?",
      run: async () => { (await import("./store")).useTour.getState().start(); },
    },
  ],
  shortcuts: [
    { keys: "?", label: "Take the tour", group: "Help", run: () => { void import("./store").then((m) => m.useTour.getState().start()); } },
  ],
});
