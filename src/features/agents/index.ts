import { Bot } from "lucide-react";
import { defineFeature, type MenuEntry } from "@/core/types";
import { AgentsButton, AgentsHost, ACTION_ICONS } from "./AgentsDock";
import { ACTION_WORDS, PART_ACTIONS } from "./context";
import { openDock } from "./store";

const onSiteRoutes = ["/builder", "/builder/*", "/studio", "/studio/*"];

/** Ask agents, as a submenu of a part's right-click menu. */
function askMenu(partId: string): MenuEntry {
  return {
    id: "agents.ask",
    label: "Ask agents",
    icon: Bot,
    children: PART_ACTIONS.map((a) => ({ id: `agents.ask.${a}`, label: ACTION_WORDS[a], icon: ACTION_ICONS[a], onSelect: () => openDock(a, partId) })),
  };
}

export const agents = defineFeature({
  id: "agents",
  name: "Agents",
  description: "The Agents button, the dock the helper serves, and Ask agents on a part.",
  icon: Bot,
  hidden: true,
  topBarItems: [
    /* Beside Go live (21): the other thing that changes the site from outside the board. */
    { id: "agents.button", order: 21.5, component: AgentsButton, routes: onSiteRoutes },
    /* The dock and the five-action chooser. Draws nothing in the bar itself. */
    { id: "agents.host", order: 98.7, component: AgentsHost, routes: onSiteRoutes },
  ],
  contextMenus: [
    /* A part in Live: its right-click is the list menu, not the wheel. On the board the wheel's tray has it (RadialMenu.tsx). */
    { scope: "studio-live-node", order: 50, items: (target) => (target.data && typeof (target.data as { id?: unknown }).id === "string" ? [{ type: "separator" }, askMenu((target.data as { id: string }).id)] : []) },
  ],
  commands: [
    { id: "agents.open", label: "Agents: open the dock", group: "Builder", icon: Bot, keywords: ["agents", "claude", "helper", "ask"], run: () => openDock() },
  ],
});
