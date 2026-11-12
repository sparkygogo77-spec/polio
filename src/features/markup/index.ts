import { PenLine } from "lucide-react";
import { defineFeature } from "@/core/types";
import { MarkupButton } from "./MarkupButton";
import { MarkupLayer } from "./MarkupLayer";
import { openMarkup } from "./store";

const onSiteRoutes = ["/builder", "/builder/*", "/studio", "/studio/*"];

/** ✍️ Mark up: J draws on the Builder; every stroke registers what it touches; Send and Snapshot save presses for the coordinator. */
export const markup = defineFeature({
  id: "markup",
  name: "Mark up",
  description: "Draw on the Builder to show the coordinator what is wrong; each stroke names the elements it touches.",
  icon: PenLine,
  hidden: true,
  topBarItems: [
    /* Beside Agents (21.5): it is a message to the agents, drawn. */
    { id: "markup.button", order: 21.6, component: MarkupButton, routes: onSiteRoutes },
    { id: "markup.layer", order: 98.8, component: MarkupLayer, routes: onSiteRoutes },
  ],
  commands: [
    { id: "markup.open", label: "Mark up: draw what is wrong", group: "Builder", icon: PenLine, keywords: ["mark", "draw", "snapshot", "annotate", "coordinator"], run: () => openMarkup() },
  ],
});
