"use client";
/**
 * The door to Audit and optimize, in the Builder's top bar.
 *
 * The audit is about Polio as a whole, not about the site on the board, so
 * it has no place on a part or a page; the top bar is where the Builder
 * keeps what is about everything (the swap between sites sits here too).
 * One small button, the same at every zoom, that says where it goes.
 */
import * as React from "react";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";

export function AuditDoor() {
  return (
    <Tooltip content="Audit and optimize: Polio's features on one dated line, and what could be cut">
      <Button asChild size="sm" variant="ghost" data-audit-door="" aria-label="Audit and optimize">
        <Link href="/builder/audit"><Gauge /><span className="hidden md:inline">Audit</span></Link>
      </Button>
    </Tooltip>
  );
}
