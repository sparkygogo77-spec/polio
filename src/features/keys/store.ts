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
 * By default there is no PIN at all. The key is held in this browser, in
 * localStorage, in the clear, open on arrival and across reloads and tabs,
 * with one plain way to be rid of it: **Forget the key**. A pad on the way
 * in bought very little — anything that can read localStorage on this
 * machine can read the key the moment it is unlocked — and cost an
 * unattended run every five minutes and every reload. The honest line is
 * the one drawn here: this browser is not where a key belongs; the server
 * is, and the panel says so.
 *
 * The PIN is still here, behind **Seal the key under a PIN** in Settings
 * (off by default). With it on, the browser can hold the key two ways:
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
 * - **Kept for this tab**, which is the sealed vault after the PIN has been
 *   entered once, asked to stay open until the tab closes: the open values
 *   go to sessionStorage as well, so a reload does not relock it and neither
 *   does the idle timer. A new tab has an empty sessionStorage and asks for
 *   the PIN, which is the line this draws. It is for a run left unattended,
 *   where a relock halfway through is the thing that breaks it.
 *
 * Three keys live here, because they are the three a browser request can
 * carry: the studio routes take each as a header. Claude's is the Builder's
 * asks; Replicate's is the renderer that draws a part's body instead of
 * writing it; Vercel's is the one button that puts the site live and hands
 * back the address. X and GitHub work from the server's environment alone — a
 * key for them pasted into a browser would do nothing — so the panel does not
 * offer to hold one.
 */
import { create } from "zustand";
import { getSetting } from "@/core/settings/store";
import { isPin, open, seal, type SealedBox } from "./crypto";

export type ServiceId = "anthropic" | "replicate" | "vercel";

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
    blurb: "The Builder's asks, plan, critique, finish, ideas, build, and reading the drawing board.",
    where: "https://console.anthropic.com/settings/keys",
    fields: [{ id: "ANTHROPIC_API_KEY", label: "API key", hint: "sk-ant-…", secret: true }],
  },
  {
    id: "replicate",
    label: "Replicate",
    blurb:
      "The renderer: a drawn part's body, drawn rather than written. Vector through recraft-ai/recraft-v3-svg, raster through black-forest-labs/flux-2-pro. $0.08 and $0.04 a call, shown in the iteration's usage line.",
    where: "https://replicate.com/account/api-tokens",
    fields: [{ id: "REPLICATE_API_TOKEN", label: "API token", hint: "r8_…", secret: true }],
  },
  {
    id: "vercel",
    label: "Vercel",
    blurb: "Go live: the site is deployed from the repository it was pushed to and the address comes back.",
    where: "https://vercel.com/account/settings/tokens",
    fields: [
      { id: "VERCEL_TOKEN", label: "Token", hint: "from Account Settings › Tokens", secret: true },
      { id: "VERCEL_TEAM", label: "Team", hint: "only if the project is a team's, its slug" },
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
/** Where the key lives when there is no PIN: this browser, in the clear. */
const PLAIN_KEY = "builder.keys.plain";
/** The setting that brings the PIN back. Off, and there is no pad anywhere. */
export const PIN_SETTING = "keys.pin";
/** The sealed vault relocks itself after this long without a keystroke. */
export const IDLE_MS = 5 * 60_000;
/** Wrong PINs before the pad stops taking them for a while. */
const MAX_TRIES = 5;
const LOCKOUT_MS = 60_000;

type Values = Record<string, string>;

/** Is the PIN in play at all? Off by default, and then none of it runs. */
export function pinWanted(): boolean {
  return !!getSetting<boolean>(PIN_SETTING);
}

function readPlain(): Values | null {
  try {
    const raw = localStorage.getItem(PLAIN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Values) : null;
  } catch {
    return null;
  }
}

function writePlain(values: Values | null) {
  try {
    if (values && Object.keys(values).length) localStorage.setItem(PLAIN_KEY, JSON.stringify(values));
    else localStorage.removeItem(PLAIN_KEY);
  } catch {
    /* private mode, or a full quota: the key lives in memory for this page */
  }
}

interface KeysState {
  /** Is there a sealed vault on this browser at all? */
  exists: boolean;
  unlocked: boolean;
  /** Open with no PIN: held for this tab only. */
  held: boolean;
  /** The sealed vault, asked to stay open for this tab across reloads. */
  kept: boolean;
  /** No PIN: the key is simply held in this browser. The resting state. */
  plain: boolean;
  /** A sealed vault from before the PIN was put away, waiting to be brought across. */
  sealedWaiting: boolean;
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
  /** Keep the open vault for this tab, across reloads, until the tab closes. */
  keep: (on: boolean) => void;
  /** Drop the key this browser holds. The plain vault's only door. */
  forget: () => void;
  /** Open a vault sealed before the PIN was put away, and hold what was in it plainly. */
  bringAcross: (pin: string) => Promise<boolean>;
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

/**
 * What this tab has open, written down so a reload does not lose it.
 *
 * Held and kept both land here, and the record says which: a held tab has no
 * PIN to remember, a kept one keeps its PIN so a save can reseal the vault
 * without asking for it again. Either way it is sessionStorage, so it is this
 * tab's alone and goes when the tab does.
 */
interface SessionRecord {
  values: Values;
  pin: string | null;
  held: boolean;
}

function readSession(): SessionRecord | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const rec = v as Record<string, unknown>;
    // Before there was anything to keep, the record was the values alone.
    if (!rec.values || typeof rec.values !== "object") return { values: rec as Values, pin: null, held: true };
    return { values: rec.values as Values, pin: typeof rec.pin === "string" ? rec.pin : null, held: !!rec.held };
  } catch {
    return null;
  }
}

function writeSession(rec: SessionRecord | null) {
  try {
    if (rec) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ v: 2, ...rec }));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* then it lives in memory only, which still works until the next reload */
  }
}

const filled = (values: Values): Values => {
  // Empty fields are removed rather than stored as blanks.
  const out: Values = {};
  for (const [k, v] of Object.entries(values)) if (v.trim()) out[k] = v.trim();
  return out;
};

export const useKeys = create<KeysState>()((set, get) => ({
  exists: false,
  unlocked: false,
  held: false,
  kept: false,
  plain: false,
  sealedWaiting: false,
  values: {},
  pin: null,
  tries: 0,
  lockedOutUntil: 0,
  busy: false,
  error: null,
  lastTouch: 0,

  refresh: () => {
    /*
     * No PIN is the ordinary case: the key is in this browser, the vault is
     * open, and there is nothing to unlock. A key held under the old PIN
     * comes across on the way past — from this tab's own record without
     * asking, and from a sealed box only when someone types the PIN once
     * (`bringAcross`), because nothing else can open it.
     */
    if (!pinWanted()) {
      const plain = readPlain() ?? readSession()?.values ?? null;
      if (plain && Object.keys(plain).length) writePlain(plain);
      writeSession(null);
      set({
        exists: !!plain && Object.keys(plain).length > 0,
        unlocked: true,
        plain: true,
        held: false,
        kept: false,
        values: plain ?? {},
        pin: null,
        sealedWaiting: !plain && !!read(),
        lastTouch: Date.now(),
      });
      return;
    }
    // A reload lands here with an empty store and, if this tab was holding or
    // keeping anything, a record to come back to.
    const session = get().unlocked ? null : readSession();
    if (session)
      set({
        exists: !!read(),
        unlocked: true,
        held: session.held,
        kept: !session.held,
        values: session.values,
        pin: session.pin,
        lastTouch: Date.now(),
      });
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
      set({ exists: true, unlocked: true, held: false, kept: false, values, pin, tries: 0, lastTouch: Date.now() });
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
      // Whether this tab keeps it open across reloads is asked for after the
      // PIN, not before it: the PIN is what proves it may be kept at all.
      writeSession(null);
      set({ unlocked: true, held: false, kept: false, values, pin, tries: 0, error: null, lastTouch: Date.now() });
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
    const values = readSession()?.values ?? {};
    writeSession({ values, pin: null, held: true });
    set({ unlocked: true, held: true, kept: false, values, pin: null, error: null, lastTouch: Date.now() });
  },

  forget: () => {
    writePlain(null);
    writeSession(null);
    set({ values: {}, exists: false, error: null, lastTouch: Date.now() });
  },

  bringAcross: async (pin) => {
    const box = read();
    if (!box) return set({ sealedWaiting: false }), false;
    set({ busy: true, error: null });
    try {
      const values = await open<Values>(box, pin);
      writePlain(values);
      try { localStorage.removeItem(STORE_KEY); } catch { /* it was not there */ }
      set({ values, unlocked: true, plain: true, exists: Object.keys(values).length > 0, sealedWaiting: false, pin: null, error: null, lastTouch: Date.now() });
      return true;
    } catch {
      set({ error: "That is not the PIN." });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  keep: (on) => {
    const { unlocked, held, values, pin } = get();
    // Held is already this tab's for as long as the tab lives; there is
    // nothing to keep, and a locked vault has nothing to keep either.
    if (!unlocked || held) return;
    writeSession(on ? { values, pin, held: false } : null);
    set({ kept: on, lastTouch: Date.now() });
  },

  lock: () => {
    // With no PIN there is nothing to lock and nothing behind it: locking
    // would only mean forgetting, and forgetting has its own button.
    if (get().plain) return;
    writeSession(null);
    set({ unlocked: false, held: false, kept: false, values: {}, pin: null, error: null });
  },

  save: async (values) => {
    const { pin, held, plain } = get();
    if (plain) {
      const v = filled(values);
      writePlain(v);
      set({ values: v, exists: Object.keys(v).length > 0, lastTouch: Date.now() });
      return true;
    }
    if (held) {
      const v = filled(values);
      writeSession({ values: v, pin: null, held: true });
      set({ values: v, lastTouch: Date.now() });
      return true;
    }
    if (!pin) return false;
    set({ busy: true, error: null });
    try {
      const v = filled(values);
      write(await seal(v, pin));
      if (get().kept) writeSession({ values: v, pin, held: false });
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
      if (get().kept) writeSession({ values: get().values, pin: next, held: false });
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
      localStorage.removeItem(PLAIN_KEY);
    } catch {
      /* nothing to remove */
    }
    writeSession(null);
    set({ exists: false, unlocked: !get().plain ? false : true, held: false, kept: false, values: {}, pin: null, error: null });
  },
}));

/** Is there anything on this browser — a plain key or a sealed vault — whether or not it is open? */
export function vaultExists(): boolean {
  if (typeof localStorage === "undefined") return false;
  return !!readPlain() || !!read();
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
