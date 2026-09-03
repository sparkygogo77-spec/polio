import { LayoutGrid, Palette } from "lucide-react";
import { defineFeature } from "@/core/types";
import { ShowcasePage } from "./ShowcasePage";

/**
 * Kitchen sink: every primitive, every subsystem, live. Also an example of a
 * module that contributes settings, a command, a shortcut and a context menu.
 */
export const showcase = defineFeature({
  id: "showcase",
  name: "Showcase",
  description: "Every component and subsystem in one page: buttons, menus, feed dedup, sound board, effects, virtual lists.",
  icon: LayoutGrid,
  tags: ["components", "reference", "demo"],
  demo: true,
  routes: [{ path: "/showcase", component: ShowcasePage, title: "Showcase" }],
  nav: [{ label: "Showcase", href: "/showcase", icon: LayoutGrid, order: 20, group: "Reference" }],
  settingGroups: [{ id: "showcase", label: "Showcase", icon: Palette, order: 200, description: "Options owned by the showcase module." }],
  settings: [
    { id: "showcase.liveNumbers", group: "showcase", label: "Animate live numbers", type: "toggle", default: true, order: 1 },
    { id: "showcase.tickMs", group: "showcase", label: "Tick interval", type: "slider", default: 900, min: 200, max: 3000, step: 100, format: (v) => `${v}ms`, advanced: true, order: 2 },
  ],
  commands: [
    {
      id: "showcase.randomAccent",
      label: "Random accent colour",
      group: "Showcase",
      icon: Palette,
      keywords: ["hue", "theme"],
      run: (c) => c.setSetting("appearance.accentHue", Math.floor(Math.random() * 360)),
    },
  ],
  shortcuts: [{ keys: "g s", label: "Go to showcase", group: "Navigate", run: (c) => c.navigate("/showcase") }],
  contextMenus: [
    {
      scope: "demo-card",
      items: (t, ctx) => {
        const data = t.data as { name: string; liked: boolean } | undefined;
        return [
          { type: "label", label: data?.name ?? "Card" },
          { id: "demo.like", label: "Liked", checked: Boolean(data?.liked), onSelect: () => ctx.publish({ key: `demo:like:${t.id}`, title: `${data?.name ?? "Card"} ${data?.liked ? "unliked" : "liked"}`, level: "success", source: "showcase", toast: true }) },
          { id: "demo.copy", label: "Copy card id", onSelect: () => void ctx.copy(t.id, "card id") },
          { id: "demo.remove", label: "Remove card", danger: true, onSelect: () => void ctx.confirm({ title: `Remove ${data?.name}?`, danger: true, confirmLabel: "Remove" }).then((ok) => ok && ctx.publish({ key: `demo:remove:${t.id}`, title: `Removed ${data?.name}`, level: "warn", source: "showcase", toast: true })) },
        ];
      },
    },
  ],
});
