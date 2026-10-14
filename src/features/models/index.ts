import { Box } from "lucide-react";
import { defineFeature } from "@/core/types";
import { ModelsPage } from "./ModelsPage";

/**
 * The model viewer: Blender exports (.glb) and Blockbench models (.bbmodel)
 * straight out of a repository, in 3D, so a hand-off can be checked without
 * Blender, the game, or its author. See `ModelsPage.tsx` for the address it
 * reads and `scripts/model-shots.mjs` for the headless side.
 */
export const models = defineFeature({
  id: "models",
  name: "Models",
  description: "Blender and Blockbench models from a repository, in 3D, with the nine views of a concept sheet.",
  icon: Box,
  hidden: true,
  routes: [{ path: "/models", component: ModelsPage, title: "Models", fullBleed: true }],
  commands: [
    {
      id: "models.open",
      label: "Model viewer",
      group: "Navigate",
      icon: Box,
      keywords: ["3d", "blender", "glb", "gltf", "bbmodel", "blockbench", "lantern", "model", "viewer"],
      shortcut: "g m",
      run: (c) => c.navigate("/models"),
    },
  ],
  shortcuts: [{ keys: "g m", label: "Go to the model viewer", group: "Navigate", run: (c) => c.navigate("/models") }],
});
