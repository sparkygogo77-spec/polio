"use client";
import * as React from "react";
import { DropdownMenu as D } from "radix-ui";
import { registry } from "@/core/registry";
import { useActions } from "@/core/actions";
import { play } from "@/core/audio/engine";
import { isTypingTarget } from "@/core/lib/env";
import type { ContextTarget, MenuEntry } from "@/core/types";
import { MenuEntries, menuContentClass, type MenuPrimitives } from "@/core/ui/menu-entries";
import { getCtxData } from "./ctx";

const prims: MenuPrimitives = {
  Item: D.Item,
  CheckboxItem: D.CheckboxItem,
  ItemIndicator: D.ItemIndicator,
  Separator: D.Separator,
  Label: D.Label,
  Sub: D.Sub,
  SubTrigger: D.SubTrigger,
  SubContent: D.SubContent,
  Portal: D.Portal,
};

function collectStack(start: EventTarget | null, x: number, y: number): ContextTarget[] {
  const stack: ContextTarget[] = [];
  // Clicks frequently land on an <svg> icon, which is an SVGElement rather than
  // an HTMLElement, so walk the generic Element chain and read the attribute
  // directly — otherwise right-clicking an icon loses every enclosing scope.
  let el: Element | null = start instanceof Element ? start : null;
  while (el) {
    const scope = el.getAttribute("data-ctx");
    if (scope) {
      const id = el.getAttribute("data-ctx-id") ?? "";
      stack.push({ scope, id, data: getCtxData(scope, id), element: el, stack, x, y });
    }
    el = el.parentElement;
  }
  return stack;
}

const isSep = (e: MenuEntry | undefined) => Boolean(e && "type" in e && e.type === "separator");

function tidy(entries: MenuEntry[]): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const e of entries) {
    if (isSep(e) && (out.length === 0 || isSep(out[out.length - 1]))) continue;
    out.push(e);
  }
  while (out.length && isSep(out[out.length - 1])) out.pop();
  return out;
}

/** Wrap the app once. Every right-click anywhere goes through here. */
export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const ctx = useActions();
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [target, setTarget] = React.useState<ContextTarget | null>(null);
  const [entries, setEntries] = React.useState<MenuEntry[]>([]);

  React.useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const stack = collectStack(e.target, e.clientX, e.clientY);
      // Native menu inside text fields unless a scope explicitly claims them.
      if (stack.length === 0 && isTypingTarget(e.target)) return;
      e.preventDefault();
      let x = e.clientX;
      let y = e.clientY;
      if (x === 0 && y === 0 && e.target instanceof HTMLElement) {
        const r = e.target.getBoundingClientRect();
        x = r.left + 8;
        y = r.top + r.height / 2;
      }
      const page: ContextTarget = { scope: "page", id: window.location.pathname, data: null, element: document.body, stack, x, y };
      const primary = stack[0] ?? page;
      const list: MenuEntry[] = [];
      for (const t of stack) {
        for (const c of registry.contextMenus.get(t.scope) ?? []) {
          const items = c.items(t, ctx);
          if (items.length) {
            if (list.length) list.push({ type: "separator" });
            list.push(...items);
          }
        }
      }
      for (const c of registry.contextMenus.get("*") ?? []) list.push(...c.items(primary, ctx));
      setTarget(primary);
      setEntries(tidy(list));
      setPos({ x, y });
      setOpen(true);
      play("open");
    };
    window.addEventListener("contextmenu", onContext);
    return () => window.removeEventListener("contextmenu", onContext);
  }, [ctx]);

  return (
    <>
      {children}
      <D.Root
        open={open}
        onOpenChange={(v) => {
          if (!v) play("close");
          setOpen(v);
        }}
        modal={false}
      >
        <D.Trigger asChild>
          <span aria-hidden tabIndex={-1} style={{ position: "fixed", left: pos.x, top: pos.y, width: 0, height: 0, pointerEvents: "none" }} />
        </D.Trigger>
        <D.Portal>
          <D.Content side="right" align="start" sideOffset={2} collisionPadding={8} className={menuContentClass} onCloseAutoFocus={(e) => e.preventDefault()}>
            {target ? <MenuEntries entries={entries} target={target} ctx={ctx} M={prims} /> : null}
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}
