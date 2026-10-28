import { Sparkle } from "lucide-react";
import { defineFeature } from "@/core/types";

/**
 * What's new.
 *
 * Like the tour, a layer over whatever is open (`WhatsNew.tsx`, rendered once
 * by `AppShell`). The module gives it its Ctrl+K entry, which replays every
 * entry in `registry.ts`, seen or not.
 */
export const whatsnew = defineFeature({
  id: "whatsnew",
  name: "What's new",
  description: "New controls in the Builder, pointed out once after the update that brings them.",
  icon: Sparkle,
  hidden: true,
  commands: [
    {
      id: "whatsnew.replay",
      label: "What's new",
      group: "Help",
      icon: Sparkle,
      keywords: ["new", "whats new", "updates", "features", "changes", "release"],
      run: async () => { (await import("./store")).useWhatsNew.getState().startAll(); },
    },
  ],
});
