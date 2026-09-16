"use client";
/**
 * The keys panel: what this browser holds, and whether it is open.
 *
 * Two quite different things live near each other here and must not be
 * confused. **The server's keys** are the real ones: they sit in the
 * environment, no route ever returns them, and the browser learns only
 * whether each is set. **This browser's key** is a convenience for someone
 * without access to the server, sent with a request only when the server has
 * nothing of its own.
 *
 * By default there is no PIN at all. The key is held in this browser, open
 * on arrival and across reloads and tabs, with one plain way to be rid of
 * it: **Forget the key**. A pad on the way in bought very little — anything
 * that can run code on this page can read the key the moment it is
 * unlocked — and cost an unattended run every five minutes and every
 * reload. The honest line is the one drawn here: this browser is not where
 * a key belongs; the server is, and the panel says so.
 *
 * **Nothing is ever written down in the clear.** There is one entry,
 * `builder.keys`, and it is always a sealed box: under the browser's own
 * non-extractable key when there is no PIN (`keyring.ts`), under the PIN
 * when there is one (`crypto.ts`). There used to be a second entry beside
 * it, `builder.keys.plain`, holding a readable copy for the convenience of
 * surviving a reload — `sk-ant-…` in localStorage, in plain sight of
 * anything that could read the disk. It is gone, and any browser that still
 * has one has it taken away and folded into the sealed entry on the next
 * load. What the browser's own key does and does not protect is set out in
 * `keyring.ts`, and the panel says the same thing in a sentence.
 *
 * The PIN is still here, behind **Seal the key under a PIN** in Settings
 * (off by default). With it on, the browser can hold the key two ways:
 *
 * - **Sealed**, under a four-digit PIN: AES-GCM in localStorage, opened on
 *   demand and dropped on lock, on the idle timer, and when the tab goes
 *   away. Locked is the resting state. Only the sealed box is ever written
 *   down. This needs Web Crypto, which browsers provide only on https or
 *   localhost.
 * - **Held for this tab**, with no PIN: in memory, and sealed into
 *   sessionStorage when this browser can seal anything, so it survives a
 *   reload of this tab and dies with it. Where there is no Web Crypto at
 *   all (an embedded browser on a plain http address) nothing is written
 *   anywhere: the key lives in the page and a reload loses it, because the
 *   alternative is writing it down in the clear and that is the thing this
 *   does not do.
 * - **Kept for this tab**, which is the sealed keys after the PIN has been
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
import { canWrap, isWrapped, shred, unwrap, wrap, type WrappedBox } from "./keyring";
import { rateCardSays } from "@/features/studio/renderMeter";

export type ServiceId = "anthropic" | "replicate" | "github" | "vercel";

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
      `The renderer: a drawn part's body, drawn rather than written. Vector through recraft-ai/recraft-v3-svg, raster through black-forest-labs/flux-2-pro. ${rateCardSays()}, shown in the iteration's usage line.`,
    where: "https://replicate.com/account/api-tokens",
    fields: [{ id: "REPLICATE_API_TOKEN", label: "API token", hint: "r8_…", secret: true }],
  },
  {
    id: "github",
    label: "GitHub",
    blurb:
      "Publish: the site is pushed to a repository of its own. The first publish makes one, named after the site and private; every one after goes to the same place.",
    where: "https://github.com/settings/tokens?type=beta",
    fields: [{ id: "GITHUB_TOKEN", label: "Token", hint: "Contents write, and Administration write to make the repository", secret: true }],
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
  { label: "X", names: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"], does: "the tweet console posts" },
  { label: "Vercel hook", names: ["VERCEL_DEPLOY_HOOK"], does: "Push also pokes a project that is not connected to the repository" },
];

export const FIELDS = SERVICES.flatMap((s) => s.fields.map((f) => ({ ...f, service: s.id })));

/** The one entry. Always a sealed box: `v: 1` under a PIN, `v: 2` under this browser's key. */
const STORE_KEY = "builder.keys";
const SESSION_KEY = "builder.keys.session";
/**
 * The readable copy this used to keep beside the sealed one, kept only so it
 * can be taken away. Read once on the next load, folded into the sealed
 * entry, and deleted. Nothing writes it.
 */
const LEGACY_PLAIN_KEY = "builder.keys.plain";
/** The setting that brings the PIN back. Off, and there is no pad anywhere. */
export const PIN_SETTING = "keys.pin";
/** The sealed keys relocks itself after this long without a keystroke. */
export const IDLE_MS = 5 * 60_000;
/** Wrong PINs before the pad stops taking them for a while. */
const MAX_TRIES = 5;
const LOCKOUT_MS = 60_000;

type Values = Record<string, string>;

/** Is the PIN in play at all? Off by default, and then none of it runs. */
export function pinWanted(): boolean {
  return !!getSetting<boolean>(PIN_SETTING);
}

/**
 * The old readable copy, read and removed in the same breath.
 *
 * Whatever it held is carried into the sealed entry by the caller. It is
 * deleted whether or not that succeeds, because a key nobody can seal is
 * still a key that should not be sitting in storage in the clear.
 */
function takeLegacyPlain(): Values | null {
  try {
    const raw = localStorage.getItem(LEGACY_PLAIN_KEY);
    localStorage.removeItem(LEGACY_PLAIN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Values) : null;
  } catch {
    return null;
  }
}

/** Is the old readable copy still there? Only for saying so; reading it removes it. */
function legacyPlainThere(): boolean {
  try {
    return !!localStorage.getItem(LEGACY_PLAIN_KEY);
  } catch {
    return false;
  }
}

interface KeysState {
  /** Is there a sealed keys on this browser at all? */
  exists: boolean;
  unlocked: boolean;
  /** Open with no PIN: held for this tab only. */
  held: boolean;
  /** The sealed keys, asked to stay open for this tab across reloads. */
  kept: boolean;
  /** No PIN: the key is simply held in this browser. The resting state. */
  plain: boolean;
  /** A sealed keys from before the PIN was put away, waiting to be brought across. */
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

  refresh: () => Promise<void>;
  create: (pin: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  /** Open with no PIN, for this tab. */
  hold: () => Promise<void>;
  /** Keep the open keys panel for this tab, across reloads, until the tab closes. */
  keep: (on: boolean) => void;
  /** Drop the key this browser holds. The plain keys's only door. */
  forget: () => void;
  /** Open a keys panel sealed before the PIN was put away, and hold what was in it plainly. */
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

/** Whatever is in the one entry: a PIN box, this browser's box, or nothing. */
function readBox(): SealedBox | WrappedBox | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const box = JSON.parse(raw) as SealedBox | WrappedBox;
    if (isWrapped(box)) return box;
    const sealed = box as SealedBox;
    return sealed && sealed.v === 1 && sealed.salt && sealed.iv && sealed.cipher ? sealed : null;
  } catch {
    return null;
  }
}

/** The PIN box, when that is what is there. The pad has nothing to open otherwise. */
function read(): SealedBox | null {
  const box = readBox();
  return box && !isWrapped(box) ? box : null;
}

function write(box: SealedBox | WrappedBox) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(box));
  } catch {
    /* private mode, or a full quota: the keys panel simply does not persist */
  }
}

function clearBox() {
  try {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(LEGACY_PLAIN_KEY);
  } catch {
    /* nothing to remove */
  }
}

/**
 * Write the values down with this browser's own key, replacing whatever was
 * in the entry. Nothing is written at all if this browser cannot seal: the
 * key stays in the page, which is the honest end of that road.
 */
async function keepSealed(values: Values): Promise<void> {
  if (!Object.keys(values).length) return clearBox();
  if (!canWrap()) return clearBox();
  try {
    write(await wrap(values));
  } catch {
    clearBox();
  }
}

/**
 * What this tab has open, written down so a reload does not lose it.
 *
 * Held and kept both land here, and the record says which: a held tab has no
 * PIN to remember, a kept one keeps its PIN so a save can reseal the keys panel
 * without asking for it again. Either way it is sessionStorage, so it is this
 * tab's alone and goes when the tab does.
 */
interface SessionRecord {
  values: Values;
  pin: string | null;
  held: boolean;
}

/**
 * The tab's record is sealed the same way the entry is.
 *
 * It holds values and, when the keys panel is being kept open, the PIN that
 * opened it — both secrets, so neither is written in the clear. A record
 * from before this was true is readable JSON; it is thrown away rather than
 * read, because a tab that has to ask again is a smaller price than a
 * readable key.
 */
async function readSession(): Promise<SessionRecord | null> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!isWrapped(v)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    const rec = await unwrap<SessionRecord>(v);
    if (!rec || typeof rec !== "object" || !rec.values) return null;
    return { values: rec.values, pin: typeof rec.pin === "string" ? rec.pin : null, held: !!rec.held };
  } catch {
    return null;
  }
}

async function writeSession(rec: SessionRecord | null): Promise<void> {
  try {
    if (!rec || !canWrap()) return void sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(await wrap(rec)));
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

/** The refresh in flight, so two callers at once are one read. */
let inFlight: Promise<void> | null = null;

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
     * One at a time, and everybody waits on the same one.
     *
     * Two callers open this at once on every load — the module on mount and
     * the panel on render — and opening is asynchronous now. Racing, the
     * second one read the entry before the first had finished carrying the
     * old readable copy into it, and wrote back what it found: the migrated
     * key was taken away and the one before it put back. So the first call
     * in flight is the one that runs, and the others are handed its promise.
     */
    if (inFlight) return inFlight;
    inFlight = (async () => {
      /*
       * No PIN is the ordinary case: the key is in this browser, the keys panel is
       * open, and there is nothing to unlock. A key held under the old PIN
       * comes across on the way past — from this tab's own record without
       * asking, and from a sealed box only when someone types the PIN once
       * (`bringAcross`), because nothing else can open it.
       */
      /*
       * The readable copy is taken away first, whatever else happens here,
       * and whatever it held is carried somewhere sealed. A browser that has
       * been running the old build arrives once with a key in localStorage in
       * the clear and leaves without it, under a PIN or not.
       */
      const legacy = takeLegacyPlain();
      if (!pinWanted()) {
        const box = readBox();
        const values = legacy ?? (box && isWrapped(box) ? await unwrap<Values>(box) : null) ?? (await readSession())?.values ?? null;
        if (values && Object.keys(values).length) await keepSealed(values);
        else if (legacy) clearBox();
        await writeSession(null);
        set({
          exists: !!values && Object.keys(values).length > 0,
          unlocked: true,
          plain: true,
          held: false,
          kept: false,
          values: values ?? {},
          pin: null,
          // A PIN box with nothing else to go on still needs the PIN once.
          sealedWaiting: !values && !!read(),
          lastTouch: Date.now(),
        });
        return;
      }
      /*
       * Under a PIN, a readable copy found here cannot be folded into the
       * sealed keys — nothing has the PIN — and it is not going to be left
       * where it was. It goes into this tab's own sealed record, so the
       * session it belonged to keeps working and the browser keeps nothing
       * readable and nothing beyond this tab.
       */
      if (legacy && Object.keys(legacy).length) {
        await writeSession({ values: legacy, pin: null, held: true });
        set({ exists: !!read(), unlocked: true, held: true, kept: false, values: legacy, pin: null, lastTouch: Date.now() });
        return;
      }
      // A reload lands here with an empty store and, if this tab was holding or
      // keeping anything, a record to come back to.
      const session = get().unlocked ? null : await readSession();
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
    })().finally(() => { inFlight = null; });
    return inFlight;
  },
  clearError: () => set({ error: null }),
  touch: () => set({ lastTouch: Date.now() }),

  create: async (pin) => {
    if (!isPin(pin)) return set({ error: "Four digits." }), false;
    set({ busy: true, error: null });
    try {
      // Whatever is already open moves into the keys panel rather than being
      // lost: a tab's held values, or the ones this browser was keeping sealed
      // under its own key before the PIN was asked for.
      const values = get().unlocked ? get().values : {};
      write(await seal(values, pin));
      await writeSession(null);
      set({ exists: true, unlocked: true, held: false, kept: false, values, pin, tries: 0, lastTouch: Date.now() });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Could not seal the keys." });
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
    if (!box) return set({ error: "There are no sealed keys on this browser." }), false;
    set({ busy: true, error: null });
    try {
      const values = await open<Values>(box, pin);
      // Whether this tab keeps it open across reloads is asked for after the
      // PIN, not before it: the PIN is what proves it may be kept at all.
      await writeSession(null);
      set({ unlocked: true, held: false, kept: false, values, pin, tries: 0, error: null, lastTouch: Date.now() });
      return true;
    } catch (err) {
      if (!canSeal()) {
        set({ error: err instanceof Error ? err.message : "This browser cannot open sealed keys." });
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

  hold: async () => {
    const values = (await readSession())?.values ?? {};
    await writeSession({ values, pin: null, held: true });
    set({ unlocked: true, held: true, kept: false, values, pin: null, error: null, lastTouch: Date.now() });
  },

  forget: () => {
    /*
     * Everything, and the key that opened it. Shredding this browser's
     * wrapping key costs nothing — it seals only what is being thrown away —
     * and it means a box recovered from a backup after the fact opens for
     * nobody.
     */
    clearBox();
    void writeSession(null);
    void shred();
    set({ values: {}, exists: false, error: null, lastTouch: Date.now() });
  },

  bringAcross: async (pin) => {
    const box = read();
    if (!box) return set({ sealedWaiting: false }), false;
    set({ busy: true, error: null });
    try {
      const values = await open<Values>(box, pin);
      // Out of the PIN's box and into this browser's own, in the same entry.
      await keepSealed(values);
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
    // nothing to keep, and a locked keys panel has nothing to keep either.
    if (!unlocked || held) return;
    void writeSession(on ? { values, pin, held: false } : null);
    set({ kept: on, lastTouch: Date.now() });
  },

  lock: () => {
    // With no PIN there is nothing to lock and nothing behind it: locking
    // would only mean forgetting, and forgetting has its own button.
    if (get().plain) return;
    void writeSession(null);
    set({ unlocked: false, held: false, kept: false, values: {}, pin: null, error: null });
  },

  save: async (values) => {
    const { pin, held, plain } = get();
    if (plain) {
      const v = filled(values);
      await keepSealed(v);
      set({ values: v, exists: Object.keys(v).length > 0, lastTouch: Date.now() });
      return true;
    }
    if (held) {
      const v = filled(values);
      await writeSession({ values: v, pin: null, held: true });
      set({ values: v, lastTouch: Date.now() });
      return true;
    }
    if (!pin) return false;
    set({ busy: true, error: null });
    try {
      const v = filled(values);
      write(await seal(v, pin));
      if (get().kept) await writeSession({ values: v, pin, held: false });
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
      if (get().kept) await writeSession({ values: get().values, pin: next, held: false });
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
    clearBox();
    void writeSession(null);
    void shred();
    set({ exists: false, unlocked: !get().plain ? false : true, held: false, kept: false, values: {}, pin: null, error: null });
  },
}));

/** Is there anything on this browser — a plain key or a sealed keys — whether or not it is open? */
export function keysExist(): boolean {
  if (typeof localStorage === "undefined") return false;
  return !!readBox() || legacyPlainThere();
}

/**
 * What this browser holds for a request, when it holds anything.
 *
 * Returns only what the caller asks for, and only while the keys panel is open.
 * A locked keys panel hands back nothing, which is the point of locking it.
 */
export function heldKeys(ids: string[]): Record<string, string> {
  const { unlocked, values } = useKeys.getState();
  if (!unlocked) return {};
  const out: Record<string, string> = {};
  for (const id of ids) if (values[id]) out[id] = values[id]!;
  return out;
}
