import { KeyRound } from "lucide-react";
import { defineFeature } from "@/core/types";
import { KeysButton } from "./KeysPanel";

/**
 * The keys panel.
 *
 * Not a page: a button in the top bar and a panel behind it. It exists
 * because someone may not have access to the server where the real keys
 * belong. There is no PIN on the way in — the key is held in this browser
 * and the panel says plainly what that means and how to be rid of it — and
 * the old sealed-under-a-PIN keys panel is a setting away for anyone who wants
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
  settings: [
    {
      id: "keys.pin",
      group: "keys",
      /* The Keys panel in the top bar is where the key is; the switch that
         seals it belongs beside it, not in a drawer with a tab of its own
         that read empty because this was the only thing in it. */
      panel: "keys",
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
      keywords: ["api", "key", "token", "secret", "pin", "keys panel", "anthropic", "claude", "github", "x", "twitter", "vercel"],
      shortcut: "mod+shift+k",
      run: (ctx) => ctx.togglePanel("keys"),
    },
    {
      id: "keys.lock",
      label: "Forget the key held here",
      group: "Keys",
      icon: KeyRound,
      keywords: ["lock", "close", "keys panel", "forget", "clear"],
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
    /*
     * Opening the entry is asynchronous now — this browser's key comes out of
     * IndexedDB and the box is decrypted — so it starts the moment the app
     * does, rather than when the keys panel first renders. Nothing waits on
     * it; it is a head start, so that a call made seconds after a load finds
     * the key in memory where it expects it.
     */
    void import("./store").then((m) => m.useKeys.getState().refresh());

    // A keys panel open when the tab goes away is a keys panel open on a shared machine.
    // A key held for the tab — or a sealed one kept for it — is the tab's own:
    // sessionStorage ends with it, and pagehide also fires on a plain reload,
    // which both should survive. With no PIN there is nothing to shut: the
    // key is meant to still be here tomorrow.
    const shut = () => void import("./store").then((m) => { const s = m.useKeys.getState(); if (!s.plain && !s.held && !s.kept) s.lock(); });
    window.addEventListener("pagehide", shut);
    return () => window.removeEventListener("pagehide", shut);
  },
});
