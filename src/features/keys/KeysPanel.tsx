"use client";
/**
 * The vault: a key button in the top bar, a four-digit pad, and the keys.
 *
 * The pad is the console's own screen — dark teal glass, phosphor lettering,
 * four dots that fill as you type — because a PIN is the one moment in this
 * app that is purely about entering something. Digits can be typed or
 * pressed; a fourth digit submits itself, so there is no confirm to hunt for.
 *
 * The panel is honest about what it is. It says what the PIN protects
 * against, what it does not, and that the server is the better place for a
 * key. It shows which keys the server already has, so someone who has set
 * them properly is told to stop rather than encouraged to paste them twice.
 */
import * as React from "react";
import { AlertTriangle, Check, Delete, Eye, EyeOff, KeyRound, Lock, LockOpen, ShieldCheck, Trash2, X } from "lucide-react";
import { useUi } from "@/core/ui-state/store";
import { useActions } from "@/core/actions";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Input } from "@/core/ui/input";
import { Tooltip } from "@/core/ui/tooltip";
import { guessCostMs, isPin } from "./crypto";
import { IDLE_MS, SERVICES, useKeys } from "./store";

/* ------------------------------------------------------------------ */
/* The screen                                                          */
/* ------------------------------------------------------------------ */

const SCREEN = {
  glass: "radial-gradient(ellipse at 50% 30%, oklch(0.22 0.05 195) 0%, oklch(0.145 0.04 200) 55%, oklch(0.1 0.03 205) 100%)",
  scan: "repeating-linear-gradient(0deg, oklch(0 0 0 / 0.26) 0 1px, transparent 1px 3px)",
  on: "oklch(0.86 0.13 185)",
  dim: "oklch(0.55 0.06 195)",
  rim: "oklch(0.4 0.05 200)",
};

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
            style={{ background: "oklch(0.19 0.03 200)", border: `1px solid ${SCREEN.rim}`, color: SCREEN.on }}
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
  const { create, unlock, busy, error, clearError, exists } = useKeys();
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(false);
  const [cost, setCost] = React.useState<number | null>(null);

  React.useEffect(() => { void guessCostMs().then(setCost).catch(() => setCost(null)); }, []);

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

  const push = React.useCallback(
    (d: string) => {
      if (busy) return;
      clearError();
      setPin((p) => {
        const next = (p + d).slice(0, 4);
        if (next.length === 4) window.setTimeout(() => void submit(next), 90);
        return next;
      });
    },
    [busy, submit, clearError],
  );

  // The keyboard works too; a pad you cannot type into is a pad that annoys.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") { e.preventDefault(); push(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); setPin((p) => p.slice(0, -1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [push]);

  const title = mode === "create" ? (confirm === null ? "Choose a four-digit PIN" : "Type it once more") : "Enter your PIN";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-4">
      <div
        className="w-full max-w-[280px] rounded-lg p-5"
        style={{ background: SCREEN.glass, border: `1px solid ${SCREEN.rim}`, boxShadow: `inset 0 0 30px oklch(0 0 0 / 0.5), 0 8px 30px oklch(0 0 0 / 0.4)` }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-lg opacity-40" style={{ backgroundImage: SCREEN.scan }} />
        <p className="mb-4 text-center text-[11px] font-medium tracking-wide" style={{ color: SCREEN.dim }}>{title}</p>
        <Dots n={pin.length} shake={shake} />
        <div className="mt-5">
          <Pad onDigit={push} onBack={() => setPin((p) => p.slice(0, -1))} disabled={busy} />
        </div>
      </div>

      {error ? (
        <p className="flex items-center gap-1.5 text-[11px] text-down"><AlertTriangle className="size-3" />{error}</p>
      ) : (
        <p className="max-w-[300px] text-center text-[10px] leading-relaxed text-fg-faint">
          {mode === "create"
            ? "This seals what you keep here. Forget it and the contents are gone — there is no way back in and no reset."
            : cost
              ? `Each guess costs about ${cost} ms, so all ten thousand take hours rather than an instant.`
              : "Four digits."}
        </p>
      )}

      {exists && mode === "unlock" ? (
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

function Vault({ server }: { server: ServerStatus | null }) {
  const { values, save, busy, lock, changePin, destroy, touch } = useKeys();
  const ctx = useActions();
  const [draft, setDraft] = React.useState<Record<string, string>>(values);
  const [shown, setShown] = React.useState<Record<string, boolean>>({});
  const [saved, setSaved] = React.useState(false);
  const [pinning, setPinning] = React.useState("");

  React.useEffect(() => { setDraft(values); }, [values]);
  const dirty = React.useMemo(() => JSON.stringify(draft) !== JSON.stringify(values), [draft, values]);

  const commit = async () => {
    if (await save(draft)) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      ctx.publish({ key: "keys:saved", title: "Keys saved in this browser", level: "success", source: "keys", toast: true });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" onPointerDown={touch} onKeyDown={touch}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-3 flex gap-2 rounded-md border border-warn/30 bg-warn/8 p-2 text-[10px] leading-relaxed text-fg-muted">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-warn" />
          <span>
            A four-digit PIN keeps out a passing glance, not a determined person with your unlocked computer. The safe
            place for a key is the server — <code className="text-fg">.env.local</code> when you run it yourself, or your
            host&rsquo;s environment variables. Keys held here are sent with a request only when the server has none.
          </span>
        </p>

        {SERVICES.map((s) => {
          const onServer = s.fields.some((f) => server?.set[f.id]);
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
              <div className="grid gap-2 sm:grid-cols-2">
                {s.fields.map((f) => {
                  const here = !!draft[f.id];
                  return (
                    <label key={f.id} className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] font-medium text-fg-muted">{f.label}</span>
                        {server?.set[f.id] ? <span className="text-[9px] text-up">server has it</span> : here ? <span className="text-[9px] text-accent">held here</span> : null}
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
            </section>
          );
        })}

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
          <p className="mt-2 text-[10px] text-fg-faint">The vault locks itself after {Math.round(IDLE_MS / 60_000)} minutes without a keystroke, and whenever this tab closes.</p>
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={lock}><Lock /> Lock</Button>
        <span className="flex-1" />
        {saved ? <span className="flex items-center gap-1 text-[11px] text-up"><Check className="size-3" /> saved</span> : null}
        <Button variant="primary" size="sm" disabled={!dirty} loading={busy} onClick={() => void commit()}>Save to this browser</Button>
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
  const { exists, unlocked, refresh, lock, lastTouch } = useKeys();
  const [server, setServer] = React.useState<ServerStatus | null>(null);

  React.useEffect(() => { refresh(); }, [refresh]);
  React.useEffect(() => {
    if (!open) return;
    refresh();
    void fetch("/api/keys/status", { cache: "no-store" }).then((r) => r.json()).then(setServer).catch(() => setServer(null));
  }, [open, refresh]);

  // Idle relock, and Escape.
  React.useEffect(() => {
    if (!unlocked) return;
    const t = window.setInterval(() => { if (Date.now() - lastTouch > IDLE_MS) lock(); }, 15_000);
    return () => window.clearInterval(t);
  }, [unlocked, lastTouch, lock]);
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
        {...(open ? {} : { inert: "" as unknown as boolean })}
        className={cn(
          "fixed right-0 top-0 z-[76] flex h-dvh w-[min(460px,94vw)] flex-col border-l border-border bg-panel shadow-panel transition-transform duration-(--motion-slow) ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <KeyRound className={cn("size-4", unlocked ? "text-accent" : "text-fg-muted")} />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-fg">Keys</h2>
            <p className="truncate text-[11px] text-fg-muted">{unlocked ? "Open. Lock it when you are done." : exists ? "Locked." : "Nothing kept in this browser yet."}</p>
          </div>
          {unlocked ? <Badge variant="accent" size="sm"><LockOpen className="size-3" /> open</Badge> : null}
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
  const { unlocked, exists, refresh } = useKeys();
  React.useEffect(() => { refresh(); }, [refresh]);
  return (
    <Tooltip content={unlocked ? "Keys — open" : exists ? "Keys — locked" : "Keys"} shortcut="mod+shift+k">
      <Button variant={openPanel ? "subtle" : "ghost"} size="icon" aria-label="Keys" onClick={() => ctx.togglePanel("keys")} className="relative">
        <KeyRound />
        {unlocked ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" /> : null}
      </Button>
    </Tooltip>
  );
}
