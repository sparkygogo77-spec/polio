"use client";
/**
 * The Account page: sign in with a key, see what is saved, and (with the
 * owner key) make, name and cancel keys.
 *
 * Published sites are never behind any of this. The Builder works without
 * signing in, exactly as before; signing in only adds saving to the account.
 */
import * as React from "react";
import { Cloud, KeyRound, LogOut, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button, CopyButton, Input } from "@/core/ui";
import { useAccount } from "./store";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

function Section({ title, icon, children, hook }: { title: string; icon: React.ReactNode; children: React.ReactNode; hook: string }) {
  return (
    <section className="rounded-xl border border-border bg-panel p-5" data-account={hook}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">{icon}{title}</h2>
      {children}
    </section>
  );
}

export function AccountPage() {
  const s = useAccount();
  const [draft, setDraft] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { void s.refresh().then(() => { if (useAccount.getState().who?.role === "owner") void useAccount.getState().loadKeys(); }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { if (await s.signIn(draft)) setDraft(""); } finally { setBusy(false); }
  };
  const make = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try { await s.makeKey(name.trim()); setName(""); } finally { setBusy(false); }
  };

  const setupLine = !s.setup
    ? "Checking the server…"
    : !s.setup.store && !s.setup.owner
      ? "Accounts are not set up on this server yet: it needs a store and an owner key."
      : !s.setup.store
        ? "The owner key is set, but the server has no store for saved work yet."
        : !s.setup.owner
          ? "The store is ready. The owner key (POLIO_OWNER_KEY in Vercel) is not set yet, so no keys can be made."
          : "Ready: the store and the owner key are both set.";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8" data-account="page">
      <header className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-fg">Account</h1>
        <p className="text-small text-fg-muted">Sign in with a key to save your boards, saved textures and what the shelf learned to your account, and open them in any browser. Published sites are never locked.</p>
        <p className="text-small text-fg-faint" data-account="setup">{setupLine}</p>
      </header>

      {s.says && <p role="status" className="rounded-lg border border-border bg-elevated px-3 py-2 text-small text-fg" data-account="says">{s.says}</p>}

      {!s.who ? (
        <Section title="Sign in" icon={<KeyRound className="size-4" />} hook="sign-in">
          <form onSubmit={signIn} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Your owner key, or a key made for you"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Account key"
              className="flex-1"
              data-account="key-input"
            />
            <Button type="submit" variant="primary" disabled={busy || !draft.trim()} data-account="sign-in-button">Sign in</Button>
          </form>
          <p className="mt-2 text-small text-fg-faint">Signing in the first time copies everything in this browser into the account. Nothing is erased, here or there.</p>
        </Section>
      ) : (
        <Section title={s.who.role === "owner" ? "Signed in with the owner key" : `Signed in as ${s.who.name}`} icon={<Cloud className="size-4" />} hook="signed-in">
          <p className="text-small text-fg-muted" data-account="synced">
            {s.syncing ? "Saving to the account…" : s.syncedAt ? `Last saved ${new Date(s.syncedAt).toLocaleTimeString()}. Changes save by themselves every minute while this browser is open.` : "Not saved yet in this visit."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void s.sync()} disabled={s.syncing} data-account="sync-button"><RefreshCw className="size-3.5" />Save and bring in now</Button>
            <Button variant="ghost" onClick={s.signOut} data-account="sign-out-button"><LogOut className="size-3.5" />Sign out here</Button>
          </div>
        </Section>
      )}

      {s.who?.role === "owner" && (
        <Section title="Keys" icon={<ShieldCheck className="size-4" />} hook="keys">
          <p className="mb-3 text-small text-fg-muted">A key opens your saved work in another browser, or for someone you trust. It cannot make or cancel keys; only your owner key can. Each key is shown once, when it is made, and kept on the server only as a fingerprint.</p>
          <form onSubmit={make} className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Name it, e.g. Laptop" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="New key's name" className="flex-1" data-account="name-input" />
            <Button type="submit" disabled={busy || !name.trim()} data-account="make-button"><Plus className="size-3.5" />Make a key</Button>
          </form>
          {s.made && (
            <div className="mt-3 rounded-lg border border-accent/40 bg-accent-soft/30 p-3" data-account="made">
              <p className="text-small text-fg">The key for <b>{s.made.name}</b>. Copy it now: it is not shown again.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-elevated px-2 py-1 text-small" data-account="made-key">{s.made.key}</code>
                <CopyButton text={s.made.key} label="Key" />
                <Button size="sm" variant="ghost" onClick={s.clearMade} data-account="made-done">Done</Button>
              </div>
            </div>
          )}
          <ul className="mt-3 flex flex-col divide-y divide-border" data-account="key-list">
            {(s.keys ?? []).length === 0 && <li className="py-2 text-small text-fg-faint">No keys made yet.</li>}
            {(s.keys ?? []).map((k) => (
              <li key={k.id} className="flex items-center gap-2 py-2" data-account="key-row">
                <span className="min-w-0 flex-1 truncate text-small text-fg">{k.name}</span>
                <span className="shrink-0 text-small text-fg-faint">{when(k.createdAt)}</span>
                <Button size="sm" variant="danger" onClick={() => void s.cancelKey(k.id)} aria-label={`Cancel ${k.name}`} data-account="cancel-button"><Trash2 className="size-3.5" />Cancel</Button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
