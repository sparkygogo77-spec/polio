"use client";
/**
 * ActionContext: the one object commands, shortcuts and menu items receive.
 * It wraps navigation, the news feed, audio, settings, panels, clipboard and
 * confirmation so feature code never imports a store directly.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import type { ActionContext, CueName, NewsInput, PanelName } from "@/core/types";
import { publish } from "@/core/news/store";
import { play } from "@/core/audio/engine";
import { getSetting, setSetting } from "@/core/settings/store";
import { useUi } from "@/core/ui-state/store";
import { isBrowser } from "@/core/lib/env";

let current: ActionContext | null = null;

/** For non-React callers (module onMount, stores). Throws before the shell mounts. */
export function getActions(): ActionContext {
  if (!current) throw new Error("ActionContext not ready: the AppShell has not mounted yet.");
  return current;
}

const ActionsCtx = React.createContext<ActionContext | null>(null);

async function copyText(text: string, label?: string) {
  if (!isBrowser) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  if (getSetting<boolean>("feedback.copyToast")) {
    publish({
      key: "clipboard",
      title: label ? `Copied ${label}` : "Copied",
      body: text.length > 48 ? `${text.slice(0, 44)}…` : text,
      level: "success",
      source: "clipboard",
      toast: { durationMs: 1600 },
      sound: false,
      quiet: true,
      coalesceMs: Infinity,
    });
  }
}

export function ActionsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ui = useUi;
  const value = React.useMemo<ActionContext>(() => {
    const ctx: ActionContext = {
      navigate: (href) => {
        if (/^https?:\/\//.test(href)) {
          window.open(href, getSetting<boolean>("behaviour.externalNewTab") ? "_blank" : "_self", "noopener");
          return;
        }
        play("navigate");
        router.push(href);
      },
      publish: (input: NewsInput) => void publish(input),
      play: (cue: CueName) => play(cue),
      getSetting: <T,>(id: string) => getSetting<T>(id),
      setSetting: (id, v) => setSetting(id, v),
      openPanel: (p: PanelName) => {
        play("open");
        ui.getState().openPanel(p);
      },
      closePanel: (p?: PanelName) => {
        play("close");
        ui.getState().closePanel(p);
      },
      togglePanel: (p: PanelName) => {
        const open = ui.getState().panels[p];
        play(open ? "close" : "open");
        ui.getState().togglePanel(p);
      },
      copy: copyText,
      confirm: async (opts) => {
        if (opts.danger && !getSetting<boolean>("feedback.confirmDestructive")) return true;
        play("open");
        return ui.getState().requestConfirm(opts);
      },
    };
    return ctx;
  }, [router, ui]);

  React.useEffect(() => {
    current = value;
    return () => {
      if (current === value) current = null;
    };
  }, [value]);

  return <ActionsCtx.Provider value={value}>{children}</ActionsCtx.Provider>;
}

export function useActions(): ActionContext {
  const v = React.useContext(ActionsCtx);
  if (!v) throw new Error("useActions must be used inside <ActionsProvider>");
  return v;
}
