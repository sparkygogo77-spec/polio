"use client";
/**
 * The key vault: what this browser holds, and whether it is open.
 *
 * Two quite different things live near each other here and must not be
 * confused. **The server's keys** are the real ones: they sit in the
 * environment, no route ever returns them, and the browser learns only
 * whether each is set. **This browser's key** is a convenience for someone
 * without access to the server, sent with a request only when the server has
 * nothing of its own.
 *
 * The browser can hold it two ways:
 *
 * - **Sealed**, under a four-digit PIN: AES-GCM in localStorage, opened on
 *   demand and dropped on lock, on the idle timer, and when the tab goes
 *   away. Locked is the resting state. Only the sealed box is ever written
 *   down. This needs Web Crypto, which browsers provide only on https or
 *   localhost.
 * - **Held for this tab**, with no PIN: in memory and in sessionStorage, in
 *   the clear, so it survives a reload of this tab and dies with it. The
 *   honest option where there is no Web Crypto (an embedded browser on a
 *   plain http address), and the simple one anywhere.
 *
 * Two keys live here, because they are the two a browser request can carry:
 * the studio routes take each as a header. Claude's is the Builder's asks;
 * Vercel's is the one button that puts the site live and hands back the
 * address. X and GitHub work from the server's environment alone — a key for
 * them pasted into a browser would do nothing — so the panel does not offer
 * to hold one.
 */
import { create } from "zustand";
import { isPin, open, seal, type SealedBox } from "./crypto";

export type ServiceId = "anthropic" | "vercel";

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
    id: "vercel",
    label: "Vercel",
    blurb: "Go live: the site is deployed from the repository it was pushed to and the address comes back.",
    where: "https://vercel.com/account/settings/tokens",
    fields: [
      { id: "VERCEL_TOKEN", label: "Token", hint: "from Account Settings › Tokens", secret: true },
      { id: "VERCEL_TEAM", label: "Team", hint: "only if the project is a team's — its slug" },
    ],
  },
];

/** Keys that only the server can use. The panel says so rather than offering a field that would do nothing. */
export const SERVER_ONLY: { label: string; names: string[]; does: string }[] = [
  { label: "GitHub", names: ["GITHUB_TOKEN", "GITHUB_REPO"], does: "Publish pushes the site to a repository" },
  { label: "X", names: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"], does: "the tweet console posts" },
  { label: "Vercel hook", names: ["VERCEL_DEPLOY_HOOK"], does: "Push also pokes a project that is not connected to the repository" },
];

export const FIELDS = SERVICES.flatMap((s) => s.fields.map((f) => ({ ...f, service: s.id })));

const STORE_KEY = "builder.keys";
const SESSION_KEY = "builder.keys.session";
/** The sealed vault relocks itself after this long without a keystroke. */
export const IDLE_MS = 5 * 60_000;
/** Wrong PINs before the pad stops taking them for a while. */
const MAX_TRIES = 5;
const LOCKOUT_MS = 60_000;

type Values = Record<string, string>;

interface KeysState {
  /** Is there a sealed vault on this browser at all? */
  exists: boolean;
  unlocked: boolean;
  /** Open with no PIN: held for this tab only. */
  held: boolean;
  /** Open values. In memory; mirrored to sessionStorage only when held. */
  values: Values;
  /** The PIN, kept while unlocked so a save can reseal without asking again. */
  pin: string | null;
  tries: number;
  lockedOutUntil: number;
  busy: boolean;
  error: string | null;
  lastTouch: number;

  refresh: () => void;
  create: (pin: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  /** Open with no PIN, for this tab. */
  hold: () => void;
  lock: () => void;
  touch: () => void;
  save: (values: Values) => Promise<boolean>;
  changePin: (next: string) => Promise<boolean>;
  destroy: () => void;
  clearError: () => void;
}

/** Can this browser seal anything? Web Crypto is only there on https or localhost. */
export function canSeal(): boolean {
  return !!globalThis.crypto?.subtle;
}

/** Does storage work here at all? Some embedded and private browsers refuse it. */
export function storageWorks(): boolean {
  try {
    const probe = "builder.keys.probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
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

function readSession(): Values | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Values) : null;
  } catch {
    return null;
  }
}

function writeSession(values: Values | null) {
  try {
    if (values) sessionStorage.setItem(SESSION_KEY, JSON.stringify(values));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* then it lives in memory only, which still works until the next reload */
  }
}

const kept = (values: Values): Values => {
  // Empty fields are removed rather than stored as blanks.
  const out: Values = {};
  for (const [k, v] of Object.entries(values)) if (v.trim()) out[k] = v.trim();
  return out;
};

export const useKeys = create<KeysState>()((set, get) => ({
  exists: false,
  unlocked: false,
  held: false,
  values: {},
  pin: null,
  tries: 0,
  lockedOutUntil: 0,
  busy: false,
  error: null,
  lastTouch: 0,

  refresh: () => {
    const session = get().unlocked ? null : readSession();
    if (session) set({ exists: !!read(), unlocked: true, held: true, values: session, pin: null, lastTouch: Date.now() });
    else set({ exists: !!read() });
  },
  clearError: () => set({ error: null }),
  touch: () => set({ lastTouch: Date.now() }),

  create: async (pin) => {
    if (!isPin(pin)) return set({ error: "Four digits." }), false;
    set({ busy: true, error: null });
    try {
      // Whatever was held for the tab moves into the vault rather than being lost.
      const values = get().held ? get().values : {};
      write(await seal(values, pin));
      writeSession(null);
      set({ exists: true, unlocked: true, held: false, values, pin, tries: 0, lastTouch: Date.now() });
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
    if (get().busy) return false;
    if (now < get().lockedOutUntil) return set({ error: "Too many tries. Wait a moment." }), false;
    const box = read();
    if (!box) return set({ error: "There is no vault on this browser." }), false;
    set({ busy: true, error: null });
    try {
      const values = await open<Values>(box, pin);
      writeSession(null);
      set({ unlocked: true, held: false, values, pin, tries: 0, error: null, lastTouch: Date.now() });
      return true;
    } catch (err) {
      if (!canSeal()) {
        set({ error: err instanceof Error ? err.message : "This browser cannot open a vault." });
        return false;
      }
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

  hold: () => {
    const values = readSession() ?? {};
    writeSession(values);
    set({ unlocked: true, held: true, values, pin: null, error: null, lastTouch: Date.now() });
  },

  lock: () => {
    if (get().held) writeSession(null);
    set({ unlocked: false, held: false, values: {}, pin: null, error: null });
  },

  save: async (values) => {
    const { pin, held } = get();
    if (held) {
      const v = kept(values);
      writeSession(v);
      set({ values: v, lastTouch: Date.now() });
      return true;
    }
    if (!pin) return false;
    set({ busy: true, error: null });
    try {
      const v = kept(values);
      write(await seal(v, pin));
      set({ values: v, lastTouch: Date.now() });
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
    writeSession(null);
    set({ exists: false, unlocked: false, held: false, values: {}, pin: null, error: null });
  },
}));

/** Is there a sealed vault on this browser, whether or not it is open right now? */
export function vaultExists(): boolean {
  return typeof localStorage !== "undefined" && !!read();
}

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
