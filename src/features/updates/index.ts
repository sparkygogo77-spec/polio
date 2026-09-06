import { Sparkles } from "lucide-react";
import { defineFeature } from "@/core/types";
import { CURRENT } from "./changelog";

/**
 * The updates panel is not a page — it slides in over whatever you were doing,
 * because a changelog you have to navigate away to is a changelog nobody
 * reads. The module exists to give it a command, a shortcut and a menu entry.
 */
export const updates = defineFeature({
  id: "updates",
  name: "Updates",
  description: `What has been built, newest first. Currently v${CURRENT}.`,
  icon: Sparkles,
  hidden: true,
  commands: [
    {
      id: "updates.open",
      label: "What's new",
      group: "Help",
      icon: Sparkles,
      keywords: ["updates", "changelog", "release", "version", "new"],
      shortcut: "u",
      run: (ctx) => ctx.togglePanel("updates"),
    },
  ],
  shortcuts: [
    { keys: "u", label: "What's new", group: "Help", run: (ctx) => ctx.togglePanel("updates") },
  ],
});
