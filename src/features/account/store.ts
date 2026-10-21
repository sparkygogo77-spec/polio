"use client";
/**
 * The account key held in this browser, and what the account says.
 *
 * The key is never written down in the clear: it is sealed with this
 * browser's own non-extractable key (`keys/keyring.ts`, the same box the
 * Claude key uses) under `builder.account`. Signing out drops the box; it
 * does not touch the account or anything saved in this browser.
 *
 * **The GitHub key opens it too** (J, 2026-10-21). With no account key held,
 * the GitHub token in Keys is offered instead, and when the server knows it
 * for the owner's (`api/account/core.ts`), this browser is signed in with
 * nothing more to type: put the GitHub key in Keys in any browser and its
 * sites and capture runs come with it. That key stays in Keys, sealed there;
 * nothing here writes it down a second time. Signing out of a GitHub sign-in
 * only stops it being offered in this browser (`builder.account.github`),
 * since the key itself still does capture and publish.
 */
import { create } from "zustand";
import { canWrap, isWrapped, unwrap, wrap } from "@/features/keys/keyring";
import { heldKeys, keysReady } from "@/features/keys/store";
import { AccountError, reportSays, syncAll } from "./sync";

export const ACCOUNT_KEY = "builder.account";
/** "off": the GitHub key in Keys is not offered to the account in this browser. */
export const GITHUB_OFF = "builder.account.github";

export interface Who { role: "owner" | "key"; name: string; github?: string; /** For a GitHub sign-in, the private repository the account is kept in. */ saves?: string }
export interface KeyShown { id: string; name: string; createdAt: string }

interface Account {
  ready: boolean;
  key: string | null;
  /** Where the key came from: one typed on the Account page, or the GitHub key in Keys. */
  via: "key" | "github" | null;
  who: Who | null;
  setup: { store: boolean; owner: boolean; github: boolean } | null;
  says: string | null;
  syncing: boolean;
  syncedAt: number | null;
  keys: KeyShown[] | null;
  /** A key just made: shown once, then gone. */
  made: { name: string; key: string } | null;
  refresh: () => Promise<void>;
  signIn: (key: string) => Promise<boolean>;
  signOut: () => void;
  /** Sign in with the GitHub key in Keys, after a sign-out put it aside. */
  useGithub: () => Promise<boolean>;
  sync: (quiet?: boolean) => Promise<void>;
  loadKeys: () => Promise<void>;
  makeKey: (name: string) => Promise<void>;
  cancelKey: (id: string) => Promise<void>;
  clearMade: () => void;
}

const auth = (key: string) => ({ authorization: `Bearer ${key}` });

async function status(key: string | null): Promise<{ ok: boolean; store: boolean; owner: boolean; github: boolean; who: Who | null; says?: string }> {
  const res = await fetch("/api/account/status", { headers: key ? auth(key) : {}, cache: "no-store" });
  const b = (await res.json().catch(() => ({}))) as { ok?: boolean; store?: boolean; owner?: boolean; github?: boolean; who?: Who | null; says?: string };
  return { ok: res.ok && !!b.ok, store: !!b.store, owner: !!b.owner, github: !!b.github, who: b.who ?? null, says: b.says };
}

const githubOff = (): boolean => { try { return localStorage.getItem(GITHUB_OFF) === "off"; } catch { return false; } };

/** The GitHub key in Keys, unless this browser signed out of it. */
export async function githubKey(): Promise<string | null> {
  if (githubOff()) return null;
  await keysReady().catch(() => undefined);
  return heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN?.trim() || null;
}

async function readHeld(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const box = JSON.parse(raw);
    return isWrapped(box) ? await unwrap<string>(box) : null;
  } catch { return null; }
}

export const useAccount = create<Account>()((set, get) => ({
  ready: false,
  key: null,
  via: null,
  who: null,
  setup: null,
  says: null,
  syncing: false,
  syncedAt: null,
  keys: null,
  made: null,

  refresh: async () => {
    /* A typed key wins; with none, the GitHub key in Keys. A GitHub key is read fresh each time, so a new one in Keys is the one used. */
    const typed = get().via === "key" ? get().key : await readHeld();
    const github = typed ? null : await githubKey();
    const key = typed ?? github;
    const via = typed ? "key" : github ? "github" : null;
    try {
      const s = await status(key);
      set({
        ready: true,
        setup: { store: s.store, owner: s.owner, github: s.github },
        key: s.who ? key : null,
        via: s.who ? via : null,
        who: s.who,
        says: key && !s.who ? (s.says ?? (via === "github" ? "The GitHub key in Keys does not open the account." : "The key held here no longer opens the account.")) : get().says,
      });
    } catch {
      set({ ready: true, says: "Could not reach the server to check the account." });
    }
  },

  signIn: async (raw) => {
    const key = raw.trim();
    if (!key) return false;
    const s = await status(key).catch(() => null);
    if (!s?.who) { set({ says: s?.says ?? "Could not reach the server." }); return false; }
    if (canWrap()) {
      try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(await wrap(key))); } catch { /* held for this visit only */ }
    }
    set({ key, via: "key", who: s.who, setup: { store: s.store, owner: s.owner, github: s.github }, says: `Signed in${s.who.role === "owner" ? " with the owner key" : ` as ${s.who.name}`}. Copying this browser's work into the account…` });
    /* The first sign-in copies everything here into the account: nothing is erased, anywhere. */
    void get().sync();
    if (s.who.role === "owner") void get().loadKeys();
    return true;
  },

  signOut: () => {
    const github = get().via === "github";
    try {
      localStorage.removeItem(ACCOUNT_KEY);
      if (github) localStorage.setItem(GITHUB_OFF, "off");
    } catch { /* nothing held */ }
    set({
      key: null,
      via: null,
      who: null,
      keys: null,
      made: null,
      says: github
        ? "Signed out in this browser. Your GitHub key stays in Keys for capture and publish; Use my GitHub key signs in again. Everything saved here and in the account is as it was."
        : "Signed out in this browser. Everything saved here and in the account is as it was.",
    });
  },

  useGithub: async () => {
    try { localStorage.removeItem(GITHUB_OFF); } catch { /* not set */ }
    if (!(await githubKey())) { set({ says: "There is no GitHub key in Keys yet. Put one in and this browser signs in by itself." }); return false; }
    set({ key: null, via: null });
    await get().refresh();
    if (!get().who) return false;
    set({ says: `Signed in with your GitHub key as ${get().who!.name}. Bringing in your saved sites and capture runs…` });
    void get().sync();
    return true;
  },

  sync: async (quiet = false) => {
    const key = get().key;
    if (!key || get().syncing) return;
    if (!get().setup?.store) { if (!quiet) set({ says: "The server has no store for saved work yet." }); return; }
    set({ syncing: true });
    try {
      const r = await syncAll(key);
      set({ syncedAt: Date.now(), ...(quiet && !r.up && !r.down && !r.updated && !r.both && !r.failed.length ? {} : { says: reportSays(r) }) });
    } catch (err) {
      /* A GitHub key that stopped working is put right in Keys, so it is not set aside here: the next one there is tried by itself. */
      if (err instanceof AccountError && err.code === "unknown-key") { if (get().via === "github") set({ key: null, via: null, who: null }); else get().signOut(); }
      set({ says: err instanceof Error ? err.message : "The sync did not finish." });
    } finally {
      set({ syncing: false });
    }
  },

  loadKeys: async () => {
    const key = get().key;
    if (!key) return;
    const res = await fetch("/api/account/keys", { headers: auth(key), cache: "no-store" }).catch(() => null);
    const b = (await res?.json().catch(() => ({}))) as { keys?: KeyShown[]; says?: string } | undefined;
    if (res?.ok && b?.keys) set({ keys: b.keys });
    else set({ says: b?.says ?? "Could not read the keys." });
  },

  makeKey: async (name) => {
    const key = get().key;
    if (!key) return;
    const res = await fetch("/api/account/keys", { method: "POST", headers: { ...auth(key), "content-type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    const b = (await res?.json().catch(() => ({}))) as { key?: string; record?: KeyShown; says?: string } | undefined;
    if (res?.ok && b?.key && b.record) {
      set((s) => ({ made: { name: b.record!.name, key: b.key! }, keys: [...(s.keys ?? []), b.record!], says: null }));
    } else set({ says: b?.says ?? "The key was not made." });
  },

  cancelKey: async (id) => {
    const key = get().key;
    if (!key) return;
    const res = await fetch(`/api/account/keys?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: auth(key) }).catch(() => null);
    if (res?.ok) set((s) => ({ keys: (s.keys ?? []).filter((k) => k.id !== id), says: "Cancelled. That key stops working now." }));
    else set({ says: ((await res?.json().catch(() => ({}))) as { says?: string } | undefined)?.says ?? "The key was not cancelled." });
  },

  clearMade: () => set({ made: null }),
}));
