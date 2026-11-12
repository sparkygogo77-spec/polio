"use client";
/** The board's top-bar button for ✍️ Mark up (the Agents manager has its own, in its bar). */
import { PenLine } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { toggleMarkup, useMarkup } from "./store";

export function MarkupButton() {
  const on = useMarkup((s) => s.on);
  return (
    <Tooltip content={on ? "Leave mark-up" : "Mark up: draw on the Builder to show the coordinator what is wrong; each stroke names what it touches"}>
      <Button variant={on ? "subtle" : "ghost"} size="sm" aria-pressed={on} data-markup-button="" onClick={toggleMarkup}>
        <PenLine />
        Mark up
      </Button>
    </Tooltip>
  );
}
