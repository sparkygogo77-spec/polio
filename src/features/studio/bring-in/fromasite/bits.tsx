"use client";
import { useShallow } from "zustand/react/shallow";
import { Loader2, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { VOID } from "@/core/ui/void";
import { useStudio } from "../../board/store";

/**
 * The repositories this site has connected, and the way to let one go.
 *
 * Shown here rather than only in the shelf because this is where they
 * were brought in: a category that appeared in the menu with no way back
 * to where it came from is a category nobody can account for. Letting one
 * go takes its elements out of the shelf and leaves anything already on
 * the board exactly where it is — those are parts of this site now.
 */
export function Brought() {
  const brought = useStudio(useShallow((s) => s.brought));
  const parts = useStudio(useShallow((s) => s.broughtParts));
  if (!brought.length) return null;
  return (
    <ul data-brought-repos="" className="mb-1.5 space-y-1">
      {brought.map((r) => {
        const n = parts.filter((p) => p.categoryId === r.id).length;
        return (
          <li
            key={r.id}
            data-brought-repo={r.id}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-small"
            style={{ background: VOID.box, border: `1px solid ${VOID.rim}`, color: VOID.text }}
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: `oklch(0.72 0.15 ${r.hue})` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.from}</span>
              <span className="block truncate text-fine" style={{ color: VOID.muted }}>
                {n} element{n === 1 ? "" : "s"} in the shelf, read from {r.page}
              </span>
            </span>
            <button
              type="button"
              data-brought-drop={r.id}
              aria-label={`Let ${r.from} go`}
              title="Take its elements out of the shelf. Anything already on the board stays."
              onClick={() => { play("close"); useStudio.getState().sendBack(r.id); }}
              className="tactile shrink-0 rounded-sm p-0.5"
              style={{ color: VOID.muted }}
            >
              <X className="size-3" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The long account behind a short line, folded: read it when you want it. */
export function Details({ text }: { text: string }) {
  return (
    <details data-said-details="" className="mt-0.5">
      <summary className="cursor-pointer text-small underline-offset-2 hover:underline" style={{ color: VOID.muted }}>details</summary>
      <span className="mt-0.5 block whitespace-pre-line text-small leading-snug" style={{ color: VOID.muted }}>{text}</span>
    </details>
  );
}

export function Waiting({ says }: { says: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-1 text-small" style={{ color: VOID.muted }}>
      <Loader2 className="size-3 animate-spin" />
      {says}
    </div>
  );
}