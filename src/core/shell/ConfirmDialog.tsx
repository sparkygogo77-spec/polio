"use client";
import * as React from "react";
import { useUi } from "@/core/ui-state/store";
import { Dialog } from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { getSetting } from "@/core/settings/store";

export function ConfirmDialog() {
  const req = useUi((s) => s.confirm);
  const resolve = useUi((s) => s.resolveConfirm);
  const okRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (req) window.setTimeout(() => okRef.current?.focus(), 30);
  }, [req]);
  return (
    <Dialog
      open={Boolean(req)}
      onOpenChange={(v) => !v && resolve(false)}
      title={req?.title ?? ""}
      description={req?.body}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => resolve(false)} sound="close">
            {req?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            ref={okRef}
            variant={req?.danger ? "danger" : "primary"}
            size="sm"
            sound={req?.danger ? "deny" : "confirm"}
            onClick={() => resolve(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && getSetting<boolean>("keyboard.enterSubmits")) resolve(true);
            }}
          >
            {req?.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    />
  );
}
