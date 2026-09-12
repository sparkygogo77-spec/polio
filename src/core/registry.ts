/**
 * Collects every feature module's contributions into flat, sorted lists the
 * shell renders from. This is the only place that knows the module list.
 */
import type { CommandDef, ContextMenuContribution, FeatureModule, NavEntry, RouteDef, ShortcutDef, TopBarItemDef } from "./types";
import { registerSettingDefs, registerSettingGroups } from "./settings/store";
import { coreModule } from "./core-module";
import { modules as featureModules } from "@/features";
import site from "@site";

interface CompiledRoute extends RouteDef {
  module: FeatureModule;
  match: (pathname: string) => Record<string, string> | null;
}

export interface Registry {
  modules: FeatureModule[];
  routes: CompiledRoute[];
  nav: (NavEntry & { module: FeatureModule })[];
  commands: (CommandDef & { module: FeatureModule })[];
  shortcuts: (ShortcutDef & { module: FeatureModule })[];
  contextMenus: Map<string, ContextMenuContribution[]>;
  topBarItems: (TopBarItemDef & { module: FeatureModule })[];
  byId: Map<string, FeatureModule>;
}

function compilePath(path: string): CompiledRoute["match"] {
  if (path === "/") return (p) => (p === "/" ? {} : null);
  const wildcard = path.endsWith("/*");
  const base = wildcard ? path.slice(0, -2) : path;
  const segs = base.split("/").filter(Boolean);
  return (pathname) => {
    const parts = pathname.split("/").filter(Boolean);
    if (wildcard ? parts.length < segs.length : parts.length !== segs.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]!;
      const p = parts[i]!;
      if (s.startsWith(":")) params[s.slice(1)] = decodeURIComponent(p);
      else if (s !== p) return null;
    }
    if (wildcard) params["*"] = parts.slice(segs.length).join("/");
    return params;
  };
}

const byOrder = <T extends { order?: number }>(a: T, b: T) => (a.order ?? 100) - (b.order ?? 100);

export function buildRegistry(mods: FeatureModule[]): Registry {
  const active = mods.filter((m) => !m.demo || site.demoModules.includes(m.id));
  const reg: Registry = {
    modules: active,
    routes: [],
    nav: [],
    commands: [],
    shortcuts: [],
    contextMenus: new Map(),
    topBarItems: [],
    byId: new Map(),
  };
  for (const m of active) {
    reg.byId.set(m.id, m);
    for (const r of m.routes ?? []) reg.routes.push({ ...r, module: m, match: compilePath(r.path) });
    for (const n of m.nav ?? []) reg.nav.push({ ...n, module: m });
    for (const c of m.commands ?? []) reg.commands.push({ ...c, module: m });
    for (const s of m.shortcuts ?? []) reg.shortcuts.push({ ...s, module: m });
    for (const cm of m.contextMenus ?? []) {
      const list = reg.contextMenus.get(cm.scope) ?? [];
      list.push(cm);
      reg.contextMenus.set(cm.scope, list);
    }
    for (const s of m.topBarItems ?? []) reg.topBarItems.push({ ...s, module: m });
    registerSettingGroups(m.settingGroups);
    registerSettingDefs(m.settings);
  }
  reg.nav.sort(byOrder);
  reg.topBarItems.sort(byOrder);
  for (const list of reg.contextMenus.values()) list.sort(byOrder);
  // Static routes before parameterised ones so "/pulse" beats "/:slug".
  reg.routes.sort((a, b) => Number(a.path.includes(":") || a.path.endsWith("*")) - Number(b.path.includes(":") || b.path.endsWith("*")));
  return reg;
}

export const registry: Registry = buildRegistry([coreModule, ...featureModules]);

export function resolveRoute(pathname: string): { route: CompiledRoute; params: Record<string, string> } | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  for (const route of registry.routes) {
    const params = route.match(clean);
    if (params) return { route, params };
  }
  return null;
}
