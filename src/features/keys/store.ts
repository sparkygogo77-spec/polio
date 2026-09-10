"use client";
/**
 * The key vault: what this browser holds, and whether it is open.
 *
 * Two quite different things live near each other here and must not be
 * confused. **The server's keys** are the real ones: they sit in the
 * environment, no route ever returns them, and the browser learns only
 * whether each is set. **This browser's keys** are a convenience for someone
 * without access to the server, sealed under a four-digit PIN and sent with
 * a request only when the server has nothing of its own.
 *
 * Locked is the resting state. The opened values live in memory for as long
 * as the vault is unlocked and are dropped on lock, on the idle timer, and
 * when the tab goes away. Only the sealed box is ever written down.
 */
import { create } from "zustand";
import { isPin, open, seal, type SealedBox } from "./crypto";

export type ServiceId = "anthropic" | "x" | "github" | "vercel";

export interface FieldDef {
  id: string;
  label: string;
  hint?: string;
  /** A repository name or a hook URL is not a secret; it need not be hidden. */
  secret?: boolean;
}

export interface ServiceDef {
  id: ServiceId;
  label: string;
  blurb: string;
  /** Where to get one, for the panel to link to. */
  where: string;
  fields: FieldDef[];
}

export const SERVICES: ServiceDef[] = [
  {
    id: "anthropic",
    label: "Claude",
    blurb: "The Builder's asks — plan, critique, finish, ideas, build — and reading the drawing board.",
    where: "https://console.anthropic.com/settings/keys",
    fields: [{ id: "ANTHROPIC_API_KEY", label: "API key", hint: "sk-ant-…", secret: true }],
  },
  {
    id: "x",
    label: "X",
    blurb: "Posting from the tweet console. Without these, Send opens X with the words instead.",
    where: "https://developer.x.com",
    fields: [
      { id: "X_API_KEY", label: "API key", secret: true },
      { id: "X_API_SECRET", label: "API secret", secret: true },
      { id: "X_ACCESS_TOKEN", label: "Access token", secret: true },
      { id: "X_ACCESS_SECRET", label: "Access secret", secret: true },
      { id: "X_HANDLE", label: "Handle", hint: "without the @" },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    blurb: "Publish pushes the site to a repository in one commit.",
    where: "https://github.com/settings/personal-access-tokens",
    fields: [
      { id: "GITHUB_TOKEN", label: "Token", hint: "fine-grained, Contents: read and write", secret: true },
      { id: "GITHUB_REPO", label: "Repository", hint: "owner/name" },
      { id: "GITHUB_BRANCH", label: "Branch", hint: "main when empty" },
    ],
  },
  {
    id: "vercel",
    label: "Vercel",
    blurb: "A connected project deploys on every push by itself. This is for one that is not.",
    where: "https://vercel.com/docs/deploy-hooks",
    fields: [{ id: "VERCEL_DEPLOY_HOOK", label: "Deploy hook URL", secret: true }],
  },
];

export const FIELDS = SERVICES.flatMap((s) => s.fields.map((f) => ({ ...f, service: s.id })));

const STORE_KEY = "builder.keys";
/** The vault relocks itself after this long without a keystroke. */
export const IDLE_MS = 5 * 60_000;
/** Wrong PINs before the pad stops taking them for a while. */
const MAX_TRIES = 5;
const LOCKOUT_MS = 60_000;

type Values = Record<string, string>;

interface KeysState {
  /** Is there a vault on this browser at all? */
  exists: boolean;
  unlocked: boolean;
  /** Open values. Only ever in memory. */
  values: Values;
  /** The PIN, held while unlocked so a save can reseal without asking again. */
  pin: string | null;
  tries: number;
  lockedOutUntil: number;
  busy: boolean;
  error: string | null;
  lastTouch: number;

  refresh: () => void;
  create: (pin: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  touch: () => void;
  save: (values: Values) => Promise<boolean>;
  changePin: (next: string) => Promise<boolean>;
  destroy: () => void;
  clearError: () => void;
}

function read(): SealedBox | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const box = JSON.parse(raw) as SealedBox;
    return box && box.v === 1 && box.salt && box.iv && box.cipher ? box : null;
  } catch {
    return null;
  }
}

function write(box: SealedBox) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(box));
  } catch {
    /* private mode, or a full quota: the vault simply does not persist */
  }
}

export const useKeys = create<KeysState>()((set, get) => ({
  exists: false,
  unlocked: false,
  values: {},
  pin: null,
  tries: 0,
  lockedOutUntil: 0,
  busy: false,
  error: null,
  lastTouch: 0,

  refresh: () => set({ exists: !!read() }),
  clearError: () => set({ error: null }),
  touch: () => set({ lastTouch: Date.now() }),

  create: async (pin) => {
    if (!isPin(pin)) return set({ error: "Four digits." }), false;
    set({ busy: true, error: null });
    try {
      write(await seal({}, pin));
      set({ exists: true, unlocked: true, values: {}, pin, tries: 0, lastTouch: Date.now() });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Could not make the vault." });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  unlock: async (pin) => {
    const now = Date.now();
    if (now < get().lockedOutUntil) return set({ error: "Too many tries. Wait a moment." }), false;
    const box = read();
    if (!box) return set({ error: "There is no vault on this browser." }), false;
    set({ busy: true, error: null });
    try {
      const values = await open<Values>(box, pin);
      set({ unlocked: true, values, pin, tries: 0, error: null, lastTouch: Date.now() });
      return true;
    } catch {
      const tries = get().tries + 1;
      set({
        tries,
        error: tries >= MAX_TRIES ? "Too many tries. Wait a minute." : "That is not the PIN.",
        lockedOutUntil: tries >= MAX_TRIES ? Date.now() + LOCKOUT_MS : 0,
        ...(tries >= MAX_TRIES ? { tries: 0 } : {}),
      });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  lock: () => set({ unlocked: false, values: {}, pin: null, error: null }),

  save: async (values) => {
    const pin = get().pin;
    if (!pin) return false;
    set({ busy: true, error: null });
    try {
      // Empty fields are removed rather than stored as blanks.
      const kept: Values = {};
      for (const [k, v] of Object.entries(values)) if (v.trim()) kept[k] = v.trim();
      write(await seal(kept, pin));
      set({ values: kept, lastTouch: Date.now() });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Could not save." });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  changePin: async (next) => {
    if (!isPin(next)) return set({ error: "Four digits." }), false;
    set({ busy: true, error: null });
    try {
      write(await seal(get().values, next));
      set({ pin: next, lastTouch: Date.now() });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Could not change the PIN." });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  destroy: () => {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* nothing to remove */
    }
    set({ exists: false, unlocked: false, values: {}, pin: null, error: null });
  },
}));

/**
 * What this browser holds for a request, when it holds anything.
 *
 * Returns only what the caller asks for, and only while the vault is open.
 * A locked vault hands back nothing, which is the point of locking it.
 */
export function heldKeys(ids: string[]): Record<string, string> {
  const { unlocked, values } = useKeys.getState();
  if (!unlocked) return {};
  const out: Record<string, string> = {};
  for (const id of ids) if (values[id]) out[id] = values[id]!;
  return out;
}
