"use client";
import { Activity } from "lucide-react";
import { usePulse } from "./sim";
import { Tooltip } from "@/core/ui/tooltip";
import { cn } from "@/core/lib/cn";

export function StreamRate() {
  const rate = usePulse((s) => s.rate);
  const running = usePulse((s) => s.running);
  return (
    <Tooltip content={running ? "Simulated launches per second" : "Stream paused (press p on the feed)"}>
      <span className={cn("flex items-center gap-1", !running && "text-warn")}>
        <Activity className="size-3" />
        <span className="num">{running ? `${rate}/s` : "paused"}</span>
      </span>
    </Tooltip>
  );
}
