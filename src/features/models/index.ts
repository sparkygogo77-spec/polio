import { Box } from "lucide-react";
import { defineFeature, type RouteProps } from "@/core/types";
import dynamic from "next/dynamic";

/* The page, and three.js under it, load with the route only (`tests/route-split.mjs`). */
const ModelsPage = dynamic<RouteProps>(() => import("./ModelsPage").then((m) => m.ModelsPage), { ssr: false });

/**
 * Models: a Blender-like 360° viewer for .glb / .gltf passes, with markup for
 * the modeller (`ModelsPage.tsx`). Reached from the Builds page ("Models"),
 * the command palette and `g m`; it stands until the console drives Blender.
 */
export const models = defineFeature({
  id: "models",
  name: "Models",
  description: "Look at a 3D model from every side, Blender's way, and mark it up for the modeller.",
  icon: Box,
  hidden: true,
  routes: [{ path: "/models", component: ModelsPage, title: "Models" }],
  nav: [],
  commands: [
    {
      id: "models.open",
      label: "Models (3D viewer)",
      group: "Builds",
      icon: Box,
      keywords: ["3d", "glb", "gltf", "blender", "model", "orbit", "turntable", "viewer"],
      run: (ctx) => ctx.navigate("/models"),
    },
  ],
  shortcuts: [{ keys: "g m", label: "Go to Models", group: "Navigate", run: (c) => c.navigate("/models") }],
});
