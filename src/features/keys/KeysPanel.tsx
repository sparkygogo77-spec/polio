"use client";
/**
 * The vault: a key button in the top bar, a four-digit pad, and the key.
 *
 * The pad is the console's own screen — dark teal glass, phosphor lettering,
 * four dots that fill as you type — because a PIN is the one moment in this
 * app that is purely about entering something. Digits can be typed or
 * pressed; a fourth digit submits itself, so there is no confirm to hunt for.
 * Under the pad is the other way in: skip the PIN and hold the key for this
 * tab only. Once it is open, "keep it open in this tab" carries it across a
 * reload and past the idle timer, for a run nobody is sitting with; a new
 * tab still meets the pad. Where the browser has no Web Crypto (an embedded browser on a
 * plain http address) the pad cannot work at all, and the panel says so and
 * offers only that.
 *
 * The panel is honest about what it is. It says what the PIN protects
 * against, what it does not, and that the server is the better place for a
 * key. It shows whether the server already has the key, so someone who has
 * set it properly is told to stop rather than encouraged to paste it twice,
 * and a "Try it" asks Anthropic whether the key works, so "the prompts are
 * not working" has a first answer that is not a guess. Keys the browser
 * cannot use — GitHub, X, Vercel — are named as server-only, not offered.
 */
import * as React from "react";
import { AlertTriangle, Check, Delete, Eye, EyeOff, KeyRound, Lock, LockOpen, ShieldCheck, Sparkles, Trash2, Unlock, X } from "lucide-react";
import { useUi } from "@/core/ui-state/store";
import { useActions } from "@/core/actions";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Input } from "@/core/ui/input";
import { Switch } from "@/core/ui/switch";
import { Tooltip } from "@/core/ui/tooltip";
import { SCREEN as VOID_SCREEN } from "@/core/ui/void";
import { guessCostMs, isPin } from "./crypto";
import { canSeal, IDLE_MS, SERVER_ONLY, SERVICES, storageWorks, useKeys, type ServiceId } from "./store";

/* ------------------------------------------------------------------ */
/* The screen                                                          */
/* ------------------------------------------------------------------ */

/*
 * The one screen, not a fifth copy of it.
 *
 * This file kept its own five-value screen — a glass two hundredths lighter,
 * a rim four hundredths darker, lettering ten degrees of hue away — which is
 * the drift `core/ui/void.ts` was written to end. `on` and `rim` were what
 * they were called here; they are the shared `ink` and `line`.
 */
const SCREEN = { ...VOID_SCREEN, on: VOID_SCREEN.ink, rim: VOID_SCREEN.line };

/** The four dots, filling as digits land. */
function Dots({ n, shake }: { n: number; shake: boolean }) {
  return (
    <div className={cn("flex justify-center gap-3", shake && "animate-[shake_320ms_ease-in-out]")}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="size-3 rounded-full transition-[background,box-shadow] duration-150"
          style={{
            background: i < n ? SCREEN.on : "transparent",
            border: `1.5px solid ${i < n ? SCREEN.on : SCREEN.rim}`,
            boxShadow: i < n ? `0 0 10px ${SCREEN.on}` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function Pad({ onDigit, onBack, disabled }: { onDigit: (d: string) => void; onBack: () => void; disabled?: boolean }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div className="mx-auto grid w-[196px] grid-cols-3 gap-2">
      {keys.map((k, i) =>
        k === "" ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-label={k === "⌫" ? "Delete" : k}
            onClick={() => (k === "⌫" ? onBack() : onDigit(k))}
            className="tactile num flex h-11 items-center justify-center rounded-md text-[15px] font-semibold outline-none transition-[background,transform] enabled:hover:brightness-125 enabled:active:scale-[0.96] disabled:opacity-40"
            style={{ background: SCREEN.key, border: `1px solid ${SCREEN.rim}`, color: SCREEN.on }}
          >
            {k === "⌫" ? <Delete className="size-4" /> : k}
          </button>
        ),
      )}
    </div>
  );
}

/** Locked, or being set up for the first time. */
function PinGate({ mode }: { mode: "create" | "unlock" }) {
  const { create, unlock, hold, busy, error, clearError, exists } = useKeys();
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(false);
  const [cost, setCost] = React.useState<number | null>(null);
  const sealable = canSeal();

  React.useEffect(() => {
    if (sealable) void guessCostMs().then(setCost).catch(() => setCost(null));
  }, [sealable]);

  const wrong = React.useCallback(() => {
    setShake(true);
    setPin("");
    window.setTimeout(() => setShake(false), 340);
  }, []);

  const submit = React.useCallback(
    async (value: string) => {
      if (mode === "unlock") {
        if (!(await unlock(value))) wrong();
        return;
      }
      // Making one: the second entry has to agree with the first.
      if (confirm === null) { setConfirm(value); setPin(""); clearError(); return; }
      if (confirm !== value) { useKeys.setState({ error: "Those did not match. Start again." }); setConfirm(null); wrong(); return; }
      if (!(await create(value))) wrong();
    },
    [mode, confirm, unlock, create, wrong, clearError],
  );

  // A fourth digit submits itself. This is an effect on the value, not a side
  // effect inside the state updater: React runs updaters twice in development
  // to catch exactly that, and a PIN submitted twice cost two tries a go.
  const sent = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (pin.length !== 4 || sent.current === pin) return;
    sent.current = pin;
    const t = window.setTimeout(() => { void submit(pin).finally(() => { sent.current = null; }); }, 90);
    return () => window.clearTimeout(t);
  }, [pin, submit]);

  const push = React.useCallback(
    (d: string) => {
      if (busy) return;
      clearError();
      setPin((p) => (p.length >= 4 ? p : p + d));
    },
    [busy, clearError],
  );

  // The keyboard works too; a pad you cannot type into is a pad that annoys.
  React.useEffect(() => {
    if (!sealable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") { e.preventDefault(); push(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); setPin((p) => p.slice(0, -1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [push, sealable]);

  const title = mode === "create" ? (confirm === null ? "Choose a four-digit PIN" : "Type it once more") : "Enter your PIN";
  const storage = storageWorks();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4">
      {sealable ? (
        <div
          className="relative w-full max-w-[280px] rounded-lg p-5"
          style={{ background: SCREEN.glass, border: `1px solid ${SCREEN.rim}`, boxShadow: `inset 0 0 30px oklch(0 0 0 / 0.5), 0 8px 30px oklch(0 0 0 / 0.4)` }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-lg opacity-40" style={{ backgroundImage: SCREEN.scan }} />
          <p className="mb-4 text-center text-[11px] font-medium tracking-wide" style={{ color: SCREEN.dim }}>{title}</p>
          <Dots n={pin.length} shake={shake} />
          <div className="mt-5">
            <Pad onDigit={push} onBack={() => setPin((p) => p.slice(0, -1))} disabled={busy} />
          </div>
        </div>
      ) : (
        <div className="flex max-w-[320px] gap-2 rounded-md border border-warn/30 bg-warn/8 p-3 text-[11px] leading-relaxed text-fg-muted">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn" />
          <span>
            This browser will not do cryptography on this address, so a PIN cannot seal anything here. Browsers only allow it on
            <code className="mx-1 text-fg">https://</code> or <code className="mx-1 text-fg">localhost</code>. The key can still be held for this tab, below.
          </span>
        </div>
      )}

      {error ? (
        <p className="flex items-center gap-1.5 text-[11px] text-down"><AlertTriangle className="size-3" />{error}</p>
      ) : sealable ? (
        <p className="max-w-[300px] text-center text-[10px] leading-relaxed text-fg-faint">
          {mode === "create"
            ? "This seals what you keep here. Forget it and the contents are gone — there is no way back in and no reset."
            : cost
              ? `Each guess costs about ${cost} ms, so all ten thousand take hours rather than an instant.`
              : "Four digits."}
        </p>
      ) : null}

      <div className="flex w-full max-w-[300px] flex-col items-stretch gap-2">
        <Button variant={sealable ? "outline" : "primary"} size="sm" disabled={busy} onClick={hold}>
          <Unlock /> {sealable ? "Skip the PIN — hold the key for this tab" : "Hold the key for this tab"}
        </Button>
        <p className="text-center text-[10px] leading-relaxed text-fg-faint">
          Held in the clear, in this tab only: it survives a reload and goes when the tab closes. Nothing to unlock, nothing to forget.
        </p>
        {!storage ? (
          <p className="flex items-center justify-center gap-1.5 text-[10px] text-warn"><AlertTriangle className="size-3" /> This browser blocks storage, so nothing here outlives a reload.</p>
        ) : null}
      </div>

      {exists && mode === "unlock" && sealable ? (
        <Button variant="ghost" size="xs" onClick={() => { if (confirm !== null) setConfirm(null); useKeys.getState().destroy(); }}>
          Forgot it — empty the vault and start again
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The keys                                                            */
/* ------------------------------------------------------------------ */

interface ServerStatus { set: Record<string, boolean>; repo: string | null; branch: string }

type Tried = { ok: boolean; message: string; source?: string } | { busy: true } | null;
/** One answer per service: trying Claude says nothing about Vercel. */
type TriedBy = Partial<Record<ServiceId, Tried>>;

function Vault({ server }: { server: ServerStatus | null }) {
  const { values, save, busy, lock, changePin, destroy, touch, held, kept, keep, create, plain, forget, sealedWaiting, bringAcross } = useKeys();
  const ctx = useActions();
  const [draft, setDraft] = React.useState<Record<string, string>>(values);
  const [shown, setShown] = React.useState<Record<string, boolean>>({});
  const [saved, setSaved] = React.useState(false);
  const [pinning, setPinning] = React.useState("");
  const [tried, setTried] = React.useState<TriedBy>({});
  const sealable = canSeal();

  React.useEffect(() => { setDraft(values); }, [values]);
  const dirty = React.useMemo(() => JSON.stringify(draft) !== JSON.stringify(values), [draft, values]);

  const commit = async () => {
    if (await save(draft)) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      ctx.publish({ key: "keys:saved", title: held ? "Key held for this tab" : "Key saved in this browser", level: "success", source: "keys", toast: true });
    }
  };

  /** Ask the service itself whether the key the next request would use works. */
  const tryKey = async (service: ServiceId) => {
    setTried((t) => ({ ...t, [service]: { busy: true } }));
    const header: Record<string, string> = {};
    const typed = (id: string) => (draft[id] ?? "").trim();
    if (service === "anthropic" && typed("ANTHROPIC_API_KEY")) header["x-anthropic-key"] = typed("ANTHROPIC_API_KEY");
    if (service === "vercel" && typed("VERCEL_TOKEN")) header["x-vercel-token"] = typed("VERCEL_TOKEN");
    try {
      const res = await fetch("/api/keys/test", {
        method: "POST",
        headers: { "content-type": "application/json", ...header },
        body: JSON.stringify({ service }),
      });
      const data = (await res.json()) as { ok: boolean; message: string; source?: string };
      setTried((t) => ({ ...t, [service]: { ok: !!data.ok, message: data.message ?? (data.ok ? "It works." : "It did not work."), source: data.source } }));
    } catch (err) {
      setTried((t) => ({ ...t, [service]: { ok: false, message: err instanceof Error ? err.message : "Could not reach the server." } }));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" onPointerDown={touch} onKeyDown={touch}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-3 flex gap-2 rounded-md border border-warn/30 bg-warn/8 p-2 text-[10px] leading-relaxed text-fg-muted">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-warn" />
          <span>
            {held
              ? "Held for this tab, in the clear: anyone at this computer with this tab open can read it. It goes when the tab closes. "
              : "A four-digit PIN keeps out a passing glance, not a determined person with your unlocked computer. "}
            The safe place for a key is the server — <code className="text-fg">.env.local</code> when you run it yourself, or your
            host&rsquo;s environment variables. A key held here is sent with a request only when the server has none.
          </span>
        </p>

        {SERVICES.map((s) => {
          const onServer = s.fields.some((f) => server?.set[f.id]);
          // The first field of a service is the one that is the key; a team
          // slug on its own is nothing to try.
          const keyField = s.fields[0]!.id;
          const answer = tried[s.id] ?? null;
          const waiting = answer !== null && "busy" in answer;
          const canTry = !!server?.set[keyField] || !!(draft[keyField] ?? "").trim();
          return (
            <section key={s.id} className="mb-3 rounded-lg border border-border bg-elevated/50 p-3">
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-[12px] font-semibold text-fg">{s.label}</h3>
                {onServer ? (
                  <Tooltip content="Set in the server's environment. Nothing you type here is used for it.">
                    <Badge variant="up" size="sm"><Check className="size-3" /> on the server</Badge>
                  </Tooltip>
                ) : (
                  <Badge variant="default" size="sm">not on the server</Badge>
                )}
                <span className="flex-1" />
                <a href={s.where} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent underline underline-offset-2">where to get one</a>
              </header>
              <p className="mb-2 text-[10px] leading-snug text-fg-faint">{s.blurb}</p>
              <div className="grid gap-2">
                {s.fields.map((f) => {
                  const here = !!draft[f.id];
                  return (
                    <label key={f.id} className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] font-medium text-fg-muted">{f.label}</span>
                        {server?.set[f.id] ? <span className="text-[9px] text-up">server has it</span> : here ? <span className="text-[9px] text-accent">{held ? "held for this tab" : "held here"}</span> : null}
                      </span>
                      <Input
                        inputSize="sm"
                        type={f.secret && !shown[f.id] ? "password" : "text"}
                        autoComplete="off"
                        spellCheck={false}
                        value={draft[f.id] ?? ""}
                        placeholder={f.hint ?? (f.secret ? "not held in this browser" : "")}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                        right={
                          f.secret ? (
                            <button type="button" aria-label={shown[f.id] ? "Hide" : "Show"} onClick={() => setShown((v) => ({ ...v, [f.id]: !v[f.id] }))} className="text-fg-faint hover:text-fg">
                              {shown[f.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          ) : undefined
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="xs" disabled={!canTry || waiting} loading={waiting} onClick={() => void tryKey(s.id)}>
                  <Sparkles /> Try it
                </Button>
                {answer && !("busy" in answer) ? (
                  <span className={cn("flex items-center gap-1 text-[10px]", answer.ok ? "text-up" : "text-down")}>
                    {answer.ok ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
                    {answer.message}
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-faint">
                    {server?.set[keyField]
                      ? `Asks ${s.label} whether the server's ${s.fields[0]!.label.toLowerCase()} works.`
                      : `Asks ${s.label} whether this ${s.fields[0]!.label.toLowerCase()} works, before you save it.`}
                  </span>
                )}
              </div>
            </section>
          );
        })}

        <section className="mb-3 rounded-lg border border-border bg-elevated/50 p-3">
          <h3 className="mb-1 text-[12px] font-semibold text-fg">Only on the server</h3>
          <p className="mb-2 text-[10px] leading-snug text-fg-faint">
            These are used by the server alone, so a copy in this browser would do nothing. They go in <code className="text-fg">.env.local</code> or your host&rsquo;s environment; see <code className="text-fg">.env.example</code>.
          </p>
          <ul className="space-y-1">
            {SERVER_ONLY.map((o) => {
              const set = o.names.every((n) => server?.set[n]);
              const some = o.names.some((n) => server?.set[n]);
              return (
                <li key={o.label} className="flex items-center gap-2 text-[10px]">
                  <Badge variant={set ? "up" : some ? "warn" : "default"} size="sm">{set ? <Check className="size-3" /> : null} {set ? "set" : some ? "partly set" : "not set"}</Badge>
                  <span className="font-medium text-fg">{o.label}</span>
                  <span className="text-fg-faint">— {o.does}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {plain ? (
          <section className="rounded-lg border border-border bg-elevated/50 p-3">
            <h3 className="mb-2 text-[12px] font-semibold text-fg">How this is kept</h3>
            <p className="text-[11px] leading-relaxed text-fg-muted">
              In this browser, in the clear, until you forget it: across reloads and across tabs, on this machine only. It is
              never sent anywhere but this app&rsquo;s own routes, and only when the server has no key of its own. Anything that can
              read this browser&rsquo;s storage can read it, which is why the right place for a key is still the server.
            </p>
            {sealedWaiting ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="text-[11px] text-fg-muted">There is a key here sealed under a PIN. Type it once to bring it across:</span>
                <Input inputSize="sm" inputMode="numeric" maxLength={4} value={pinning} placeholder="four digits" onChange={(e) => setPinning(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-28" />
                <Button variant="outline" size="sm" disabled={!isPin(pinning) || busy} onClick={() => void bringAcross(pinning).then((ok) => ok && setPinning(""))}>Bring it across</Button>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-[10px] text-fg-faint">A PIN is available under Settings › Keys, off by default.</span>
              <span className="flex-1" />
              <Button
                variant="danger"
                size="sm"
                onClick={() => void ctx.confirm({ title: "Forget the key?", body: "It goes from this browser now. Keys on the server are untouched.", danger: true, confirmLabel: "Forget it" }).then((ok) => ok && forget())}
              >
                <Trash2 /> Forget the key
              </Button>
            </div>
          </section>
        ) : held ? (
          <section className="rounded-lg border border-border bg-elevated/50 p-3">
            <h3 className="mb-2 text-[12px] font-semibold text-fg">Held for this tab</h3>
            <div className="flex flex-wrap items-center gap-2">
              {sealable ? (
                <>
                  <Input inputSize="sm" inputMode="numeric" maxLength={4} value={pinning} placeholder="four digits" onChange={(e) => setPinning(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-32" />
                  <Button variant="outline" size="sm" disabled={!isPin(pinning) || busy} onClick={() => void create(pinning).then((ok) => ok && setPinning(""))}>Seal it under a PIN instead</Button>
                </>
              ) : (
                <span className="text-[10px] text-fg-faint">Sealing needs https or localhost, which this address is not.</span>
              )}
            </div>
            <p className="mt-2 text-[10px] text-fg-faint">Forget drops it now; closing the tab drops it anyway.</p>
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-elevated/50 p-3">
            <h3 className="mb-2 text-[12px] font-semibold text-fg">The PIN itself</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Input inputSize="sm" inputMode="numeric" maxLength={4} value={pinning} placeholder="new four digits" onChange={(e) => setPinning(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-32" />
              <Button variant="outline" size="sm" disabled={!isPin(pinning) || busy} onClick={() => void changePin(pinning).then((ok) => ok && setPinning(""))}>Change it</Button>
              <span className="flex-1" />
              <Button
                variant="danger"
                size="sm"
                onClick={() => void ctx.confirm({ title: "Empty the vault?", body: "Everything held in this browser goes, and the PIN with it. Keys on the server are untouched.", danger: true, confirmLabel: "Empty it" }).then((ok) => ok && destroy())}
              >
                <Trash2 /> Empty the vault
              </Button>
            </div>
            <label className="mt-3 flex items-start gap-2 border-t border-border pt-3">
              <Switch checked={kept} onCheckedChange={(v) => keep(v)} />
              <span className="text-[11px] leading-relaxed text-fg-muted">
                <span className="font-medium text-fg">Keep it open in this tab.</span> Reloading the page does not relock it and the idle timer stands
                aside, so a long run left alone is not stopped halfway by a PIN pad. A new tab still asks for the PIN, and closing this one drops it.
              </span>
            </label>
            <p className="mt-2 text-[10px] text-fg-faint">
              {kept
                ? "Kept for this tab: it stays open until you lock it or the tab closes."
                : `The vault locks itself after ${Math.round(IDLE_MS / 60_000)} minutes without a keystroke, on reload, and whenever this tab closes.`}
            </p>
          </section>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
        {plain ? (
          <Button variant="ghost" size="sm" onClick={forget}><Trash2 /> Forget the key</Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={lock}>{held ? <><Trash2 /> Forget</> : <><Lock /> Lock</>}</Button>
        )}
        <span className="flex-1" />
        {saved ? <span className="flex items-center gap-1 text-[11px] text-up"><Check className="size-3" /> saved</span> : null}
        <Button variant="primary" size="sm" disabled={!dirty} loading={busy} onClick={() => void commit()}>{held ? "Hold in this tab" : "Save to this browser"}</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The panel                                                           */
/* ------------------------------------------------------------------ */

export function KeysPanel() {
  const open = useUi((s) => s.panels.keys);
  const closePanel = useUi((s) => s.closePanel);
  const { exists, unlocked, held, kept, plain, refresh, lock, lastTouch } = useKeys();
  const [server, setServer] = React.useState<ServerStatus | null>(null);

  React.useEffect(() => { refresh(); }, [refresh]);
  React.useEffect(() => {
    if (!open) return;
    refresh();
    void fetch("/api/keys/status", { cache: "no-store" }).then((r) => r.json()).then(setServer).catch(() => setServer(null));
  }, [open, refresh]);

  // Idle relock, and Escape.
  React.useEffect(() => {
    if (!unlocked || held || kept || plain) return;
    const t = window.setInterval(() => { if (Date.now() - lastTouch > IDLE_MS) lock(); }, 15_000);
    return () => window.clearInterval(t);
  }, [unlocked, held, kept, plain, lastTouch, lock]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel("keys"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  return (
    <>
      <div aria-hidden={!open} onClick={() => closePanel("keys")} className={cn("fixed inset-0 z-[75] bg-black/45 transition-opacity duration-(--motion-slow)", open ? "opacity-100" : "pointer-events-none opacity-0")} />
      <aside
        role="dialog"
        aria-label="Keys"
        data-keys-panel=""
        data-open={open ? "1" : "0"}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed right-0 top-0 z-[76] flex h-dvh w-[min(460px,94vw)] flex-col border-l border-border bg-panel shadow-panel transition-transform duration-(--motion-slow) ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <KeyRound className={cn("size-4", unlocked ? "text-accent" : "text-fg-muted")} />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-fg">Keys</h2>
            <p className="truncate text-[11px] text-fg-muted">{unlocked ? (plain ? (exists ? "Held in this browser." : "Nothing kept in this browser yet.") : held ? "Held for this tab." : kept ? "Open, and kept for this tab." : "Open. Lock it when you are done.") : exists ? "Locked." : "Nothing kept in this browser yet."}</p>
          </div>
          {unlocked && !plain ? <Badge variant="accent" size="sm">{held ? <Unlock className="size-3" /> : <LockOpen className="size-3" />} {held ? "held" : kept ? "kept" : "open"}</Badge> : null}
          <Button variant="ghost" size="icon" aria-label="Close keys" onClick={() => closePanel("keys")}><X /></Button>
        </header>

        {open ? (unlocked ? <Vault server={server} /> : <PinGate mode={exists ? "unlock" : "create"} />) : null}
      </aside>
    </>
  );
}

/** The key in the top bar. Shut, open, or nothing kept here yet. */
export function KeysButton() {
  const ctx = useActions();
  const openPanel = useUi((s) => s.panels.keys);
  const { unlocked, held, kept, plain, exists, refresh } = useKeys();
  React.useEffect(() => { refresh(); }, [refresh]);
  return (
    <Tooltip content={plain ? (exists ? "Keys — held in this browser" : "Keys") : unlocked ? (held ? "Keys — held for this tab" : kept ? "Keys — kept for this tab" : "Keys — open") : exists ? "Keys — locked" : "Keys"} shortcut="mod+shift+k">
      <Button variant={openPanel ? "subtle" : "ghost"} size="icon" aria-label="Keys" onClick={() => ctx.togglePanel("keys")} className="relative">
        <KeyRound />
        {unlocked && (!plain || exists) ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" /> : null}
      </Button>
    </Tooltip>
  );
}
