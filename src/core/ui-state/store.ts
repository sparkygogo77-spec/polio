"use client";
/**
 * Ephemeral UI state: which overlays are open, the confirm dialog queue, and
 * the collapsed sidebar. Nothing here is business state.
 */
import { create } from "zustand";
import type { PanelName } from "@/core/types";

export interface ConfirmRequest {
  id: string;
  title: string;
  body?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (ok: boolean) => void;
}

interface UiState {
  panels: Record<PanelName, boolean>;
  sidebarCollapsed: boolean;
  confirm: ConfirmRequest | null;
  openPanel: (p: PanelName) => void;
  closePanel: (p?: PanelName) => void;
  togglePanel: (p: PanelName) => void;
  setSidebarCollapsed: (v: boolean) => void;
  requestConfirm: (req: Omit<ConfirmRequest, "id" | "resolve">) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
}

const CLOSED: Record<PanelName, boolean> = { settings: false, news: false, commands: false, shortcuts: false, updates: false, tweets: false };

export const useUi = create<UiState>()((set, get) => ({
  panels: { ...CLOSED },
  sidebarCollapsed: false,
  confirm: null,
  openPanel: (p) => set((s) => ({ panels: { ...s.panels, [p]: true } })),
  closePanel: (p) => set((s) => ({ panels: p ? { ...s.panels, [p]: false } : { ...CLOSED } })),
  togglePanel: (p) => set((s) => ({ panels: { ...s.panels, [p]: !s.panels[p] } })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  requestConfirm: (req) =>
    new Promise<boolean>((resolve) => {
      // If one is pending, resolve it as cancelled so we never stack dialogs.
      get().confirm?.resolve(false);
      set({ confirm: { id: String(Date.now()), ...req, resolve } });
    }),
  resolveConfirm: (ok) => {
    const c = get().confirm;
    if (!c) return;
    set({ confirm: null });
    c.resolve(ok);
  },
}));
