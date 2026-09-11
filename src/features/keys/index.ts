import { KeyRound } from "lucide-react";
import { defineFeature } from "@/core/types";
import { KeysButton } from "./KeysPanel";

/**
 * The key vault.
 *
 * Not a page: a button in the top bar and a panel behind it. It exists
 * because someone may not have access to the server where the real keys
 * belong. There is no PIN on the way in — the key is held in this browser
 * and the panel says plainly what that means and how to be rid of it — and
 * the old sealed-under-a-PIN vault is a setting away for anyone who wants
 * it back.
 *
 * The module owns the button; the shell knows nothing about it and gets it
 * through `topBarItems`.
 */
export const keys = defineFeature({
  id: "keys",
  name: "Keys",
  description: "The Claude key, held in this browser, with what the server already has shown beside it. A PIN is optional and off by default.",
  icon: KeyRound,
  hidden: true,
  topBarItems: [{ id: "keys.button", order: 10, component: KeysButton }],
  settingGroups: [{ id: "keys", label: "Keys", icon: KeyRound, order: 250, description: "What this browser holds, and whether a PIN is asked for it." }],
  settings: [
    {
      id: "keys.pin",
      group: "keys",
      label: "Seal the key under a PIN",
      description:
        "Off, the key is held in this browser in the clear and the panel opens straight to it. On, it is sealed with AES-GCM under four digits, asked for on every reload and after five idle minutes, which is stronger against someone at this machine and stops an unattended run dead.",
      type: "toggle",
      default: false,
      advanced: true,
      order: 1,
    },
  ],
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
      label: "Forget the key held here",
      group: "Keys",
      icon: KeyRound,
      keywords: ["lock", "close", "vault", "forget", "clear"],
      // With no PIN there is nothing to lock: the only thing this can mean
      // is dropping the key, and with a PIN it still means locking.
      run: async () => {
        const s = (await import("./store")).useKeys.getState();
        if (s.plain) s.forget(); else s.lock();
      },
    },
  ],
  shortcuts: [{ keys: "mod+shift+k", label: "Keys", group: "Keys", run: (ctx) => ctx.togglePanel("keys") }],
  onMount: () => {
    // A vault open when the tab goes away is a vault open on a shared machine.
    // A key held for the tab — or a sealed one kept for it — is the tab's own:
    // sessionStorage ends with it, and pagehide also fires on a plain reload,
    // which both should survive. With no PIN there is nothing to shut: the
    // key is meant to still be here tomorrow.
    const shut = () => void import("./store").then((m) => { const s = m.useKeys.getState(); if (!s.plain && !s.held && !s.kept) s.lock(); });
    window.addEventListener("pagehide", shut);
    return () => window.removeEventListener("pagehide", shut);
  },
});
