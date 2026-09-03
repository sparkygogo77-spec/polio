"use client";
/**
 * Shared renderer that turns declarative MenuEntry[] into Radix menu items.
 * Used by both the context menu and dropdown menus so modules describe menus
 * once and never touch Radix directly.
 */
import * as React from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import type { ActionContext, ContextTarget, MenuEntry, MenuItemDef } from "@/core/types";
import { Kbd } from "./kbd";

type AnyProps = { className?: string; children?: React.ReactNode };
type TriggerProps = AnyProps & { disabled?: boolean };
type ItemProps = TriggerProps & { onSelect?: (e: Event) => void };
type CheckProps = ItemProps & { checked?: boolean; onCheckedChange?: (v: boolean) => void };

/** The subset of a Radix menu namespace we need. Both ContextMenu and DropdownMenu satisfy it. */
export interface MenuPrimitives {
  Item: React.ComponentType<ItemProps>;
  CheckboxItem: React.ComponentType<CheckProps>;
  ItemIndicator: React.ComponentType<AnyProps>;
  Separator: React.ComponentType<AnyProps>;
  Label: React.ComponentType<AnyProps>;
  Sub: React.ComponentType<{ children?: React.ReactNode }>;
  SubTrigger: React.ComponentType<TriggerProps>;
  SubContent: React.ComponentType<AnyProps & { sideOffset?: number; alignOffset?: number }>;
  Portal: React.ComponentType<{ children?: React.ReactNode }>;
}

export const menuContentClass =
  "z-[70] min-w-[190px] max-w-[320px] overflow-hidden rounded-md border border-border glass p-1 text-xs text-fg shadow-pop animate-pop";
export const menuItemClass =
  "relative flex h-[26px] cursor-default select-none items-center gap-2 rounded-sm px-2 text-xs outline-none data-[highlighted]:bg-hover data-[highlighted]:text-fg data-[disabled]:opacity-40 data-[disabled]:pointer-events-none [&_svg]:size-3.5 [&_svg]:text-fg-muted data-[highlighted]:[&_svg]:text-fg";
export const menuLabelClass = "px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-faint";
export const menuSeparatorClass = "-mx-1 my-1 h-px bg-border";

export function MenuEntries({
  entries,
  target,
  ctx,
  M,
}: {
  entries: MenuEntry[];
  target: ContextTarget;
  ctx: ActionContext;
  M: MenuPrimitives;
}) {
  return (
    <>
      {entries.map((entry, i) => {
        if ("type" in entry && entry.type === "separator") return <M.Separator key={entry.id ?? `sep-${i}`} className={menuSeparatorClass} />;
        if ("type" in entry && entry.type === "label")
          return (
            <M.Label key={entry.id ?? `label-${i}`} className={menuLabelClass}>
              {entry.label}
            </M.Label>
          );
        const item = entry as MenuItemDef;
        const Icon = item.icon;
        const body = (
          <>
            {Icon ? <Icon /> : item.checked !== undefined ? <span className="size-3.5" /> : null}
            <span className={cn("flex-1 truncate", item.danger && "text-down")}>{item.label}</span>
            {item.hint ? <span className="text-[10px] text-fg-faint">{item.hint}</span> : null}
            {item.shortcut ? <Kbd className="ml-2">{item.shortcut}</Kbd> : null}
          </>
        );
        if (item.children?.length) {
          return (
            <M.Sub key={item.id}>
              <M.SubTrigger className={menuItemClass} disabled={item.disabled}>
                {body}
                <ChevronRight className="ml-auto" />
              </M.SubTrigger>
              <M.Portal>
                <M.SubContent className={menuContentClass} sideOffset={4} alignOffset={-5}>
                  <MenuEntries entries={item.children} target={target} ctx={ctx} M={M} />
                </M.SubContent>
              </M.Portal>
            </M.Sub>
          );
        }
        if (item.checked !== undefined) {
          return (
            <M.CheckboxItem
              key={item.id}
              className={cn(menuItemClass, "pl-7")}
              checked={item.checked}
              disabled={item.disabled}
              onSelect={() => {
                play(item.checked ? "toggleOff" : "toggleOn");
                item.onSelect?.(target, ctx);
              }}
            >
              <M.ItemIndicator className="absolute left-2 inline-flex items-center">
                <Check className="text-accent!" />
              </M.ItemIndicator>
              {body}
            </M.CheckboxItem>
          );
        }
        return (
          <M.Item
            key={item.id}
            className={cn(menuItemClass, item.danger && "data-[highlighted]:bg-down/15")}
            disabled={item.disabled}
            onSelect={() => {
              play(item.danger ? "deny" : "select");
              item.onSelect?.(target, ctx);
            }}
          >
            {body}
          </M.Item>
        );
      })}
    </>
  );
}
