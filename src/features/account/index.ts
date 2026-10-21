import { UserRound } from "lucide-react";
import { defineFeature } from "@/core/types";
import { AccountButton } from "./AccountButton";
import { AccountPage } from "./AccountPage";
import { useKeys } from "@/features/keys/store";
import { ACCOUNT_KEY, githubKey, useAccount } from "./store";

/**
 * Account keys (J, 2026-10-10): one owner key kept only as a Vercel setting,
 * keys made from it on this page, and the Builder's saved work kept in the
 * account so any browser can open it. Published sites are never locked.
 *
 * The owner's GitHub key in Keys opens it too (J, 2026-10-21), so putting
 * that one key into a browser brings its sites and capture runs along.
 *
 * Server: `src/app/api/account/` (`core.ts` says who may do what).
 * Browser: `store.ts` (the key, sealed) and `sync.ts` (what is saved, and how
 * nothing is ever erased).
 */
export const account = defineFeature({
  id: "account",
  name: "Account",
  description: "Sign in with a key to keep boards, saved textures and the shelf in your account, and open them in any browser.",
  icon: UserRound,
  hidden: true,
  routes: [{ path: "/account", component: AccountPage, title: "Account" }],
  nav: [],
  topBarItems: [{ id: "account.button", order: 11, component: AccountButton }],
  commands: [
    {
      id: "account.open",
      label: "Account",
      group: "Account",
      icon: UserRound,
      keywords: ["account", "sign in", "login", "key", "keys", "sync", "save", "browser", "cloud"],
      run: (ctx) => ctx.navigate("/account"),
    },
  ],
  onMount: () => {
    /* Signed in here, or a GitHub key in Keys: check the key once, then save every minute while the tab is in view. Neither: no call is made. */
    const start = () => void useAccount.getState().refresh().then(() => { if (useAccount.getState().key) void useAccount.getState().sync(true); });
    let held = false;
    try { held = !!localStorage.getItem(ACCOUNT_KEY); } catch { /* no storage, nobody signed in */ }
    if (held) start();
    else void githubKey().then((k) => { if (k) start(); });
    /* A GitHub key put in, changed or forgotten in Keys: the account follows it, unless a typed key is the one in use. */
    let lastGithub = useKeys.getState().unlocked ? (useKeys.getState().values.GITHUB_TOKEN ?? "") : "";
    const unsubscribe = useKeys.subscribe((k) => {
      const now = k.unlocked ? (k.values.GITHUB_TOKEN ?? "") : "";
      if (!k.ready || now === lastGithub) return;
      lastGithub = now;
      if (useAccount.getState().via !== "key") start();
    });
    const timer = window.setInterval(() => {
      const s = useAccount.getState();
      if (s.key && !s.syncing && document.visibilityState === "visible") void s.sync(true);
    }, 60_000);
    return () => { window.clearInterval(timer); unsubscribe(); };
  },
});
