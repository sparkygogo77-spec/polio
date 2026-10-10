"use client";
import { UserRound } from "lucide-react";
import { Button, Tooltip } from "@/core/ui";
import { useActions } from "@/core/actions";
import { useAccount } from "./store";

/** The way to the Account page, in the top bar. A dot when this browser is signed in. */
export function AccountButton() {
  const ctx = useActions();
  const who = useAccount((s) => s.who);
  return (
    <Tooltip content={who ? (who.role === "owner" ? "Account, signed in with the owner key" : `Account, signed in as ${who.name}`) : "Account"}>
      <Button variant="ghost" size="icon" aria-label="Account" onClick={() => ctx.navigate("/account")} className="relative" data-account="top-button">
        <UserRound />
        {who ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-up shadow-[0_0_6px_var(--up)]" /> : null}
      </Button>
    </Tooltip>
  );
}
