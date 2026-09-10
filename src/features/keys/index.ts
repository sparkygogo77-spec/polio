import { KeyRound } from "lucide-react";
import { defineFeature } from "@/core/types";
import { KeysButton } from "./KeysPanel";

/**
 * The key vault.
 *
 * Not a page and not a setting: a button in the top bar and a panel behind a
 * four-digit PIN. It exists because someone may not have access to the server
 * where the real keys belong, and pasting a key into a settings field that
 * sits open on screen is worse than either.
 *
 * The module owns the button; the shell knows nothing about it and gets it
 * through `topBarItems`.
 */
export const keys = defineFeature({
  id: "keys",
  name: "Keys",
  description: "API keys held in this browser, sealed under a four-digit PIN, with what the server already has shown beside them.",
  icon: KeyRound,
  hidden: true,
  topBarItems: [{ id: "keys.button", order: 10, component: KeysButton }],
  commands: [
    {
      id: "keys.open",
      label: "Keys",
      group: "Keys",
      icon: KeyRound,
      keywords: ["api", "key", "token", "secret", "pin", "vault", "anthropic", "claude", "github", "x", "twitter", "vercel"],
      shortcut: "mod+shift+k",
      run: (ctx) => ctx.togglePanel("keys"),
    },
    {
      id: "keys.lock",
      label: "Lock the keys",
      group: "Keys",
      icon: KeyRound,
      keywords: ["lock", "close", "vault"],
      run: async () => { (await import("./store")).useKeys.getState().lock(); },
    },
  ],
  shortcuts: [{ keys: "mod+shift+k", label: "Keys", group: "Keys", run: (ctx) => ctx.togglePanel("keys") }],
  onMount: () => {
    // A vault open when the tab goes away is a vault open on a shared machine.
    const shut = () => void import("./store").then((m) => m.useKeys.getState().lock());
    window.addEventListener("pagehide", shut);
    return () => window.removeEventListener("pagehide", shut);
  },
});
