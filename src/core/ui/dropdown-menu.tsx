"use client";
import * as React from "react";
import { DropdownMenu as D } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import type { ActionContext, ContextTarget, MenuEntry } from "@/core/types";
import { useActions } from "@/core/actions";
import { MenuEntries, menuContentClass, type MenuPrimitives } from "./menu-entries";

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

export interface DropdownProps {
  /** Static entries or a builder that gets the ActionContext. */
  entries: MenuEntry[] | ((ctx: ActionContext) => MenuEntry[]);
  children: React.ReactElement;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  /** Identifier passed through as the context target id. */
  id?: string;
}

/**
 * Rendered only while the menu is open, which is always client-side. JSX props
 * are evaluated eagerly, so building the target inside this child is what keeps
 * `document` out of the server render.
 */
function DropdownBody({ list, ctx, id, trigger }: { list: MenuEntry[]; ctx: ActionContext; id: string; trigger: React.RefObject<HTMLButtonElement | null> }) {
  const target: ContextTarget = {
    scope: "dropdown",
    id,
    data: null,
    element: trigger.current ?? document.body,
    stack: [],
    x: 0,
    y: 0,
  };
  return <MenuEntries entries={list} target={target} ctx={ctx} M={prims} />;
}

/** Declarative dropdown: `<Dropdown entries={[...]}><Button>Open</Button></Dropdown>` */
export function Dropdown({ entries, children, align = "start", side = "bottom", className, id = "dropdown" }: DropdownProps) {
  const ctx = useActions();
  const [open, setOpen] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement | null>(null);
  const list = typeof entries === "function" ? entries(ctx) : entries;
  return (
    <D.Root
      open={open}
      onOpenChange={(v) => {
        play(v ? "open" : "close");
        setOpen(v);
      }}
      modal={false}
    >
      <D.Trigger asChild ref={trigger}>
        {children}
      </D.Trigger>
      <D.Portal>
        <D.Content align={align} side={side} sideOffset={4} collisionPadding={8} className={cn(menuContentClass, className)}>
          <DropdownBody list={list} ctx={ctx} id={id} trigger={trigger} />
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
