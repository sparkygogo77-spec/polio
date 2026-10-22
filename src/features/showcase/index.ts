import { useShowcase } from "./store";
import { LayoutGrid, Palette } from "lucide-react";
import { defineFeature, type RouteProps } from "@/core/types";
import dynamic from "next/dynamic";

/* The route's page loads with its route: a static import here put every page of the Builder in every route's script (`tests/route-split.mjs`). */
const ShowcasePage = dynamic<RouteProps>(() => import("./ShowcasePage").then((m) => m.ShowcasePage));

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
  // Kept as a developer reference; the Builder's library is where components are browsed.
  hidden: true,
  routes: [{ path: "/showcase", component: ShowcasePage, title: "Showcase" }],
  settings: [
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
          { id: "demo.like", label: "Liked", checked: Boolean(data?.liked), onSelect: () => { useShowcase.getState().toggleLike(t.id); ctx.publish({ key: `demo:like:${t.id}`, title: `${data?.name ?? "Card"} ${data?.liked ? "unliked" : "liked"}`, level: "success", source: "showcase", toast: true }); } },
          { id: "demo.copy", label: "Copy card id", onSelect: () => void ctx.copy(t.id, "card id") },
          { id: "demo.remove", label: "Remove card", danger: true, onSelect: () => void ctx.confirm({ title: `Remove ${data?.name}?`, danger: true, confirmLabel: "Remove" }).then((ok) => { if (!ok) return; useShowcase.getState().remove(t.id); ctx.publish({ key: `demo:remove:${t.id}`, title: `Removed ${data?.name}`, level: "warn", source: "showcase", toast: true }); }) },
        ];
      },
    },
  ],
});
